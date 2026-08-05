// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const canonicalFakeImageReference =
  "ghcr.io/secpal/frontend@sha256:" + "0".repeat(64);
const temporaryRoots: string[] = [];

interface FakeRuntime {
  binDirectory: string;
  stateDirectory: string;
  temporaryDirectory: string;
}

interface RuntimeResult {
  calls: string[];
  removedContainers: string[];
  result: ReturnType<typeof spawnSync>;
  runtime: FakeRuntime;
}

function executable(filePath: string, contents: string): void {
  writeFileSync(filePath, contents, "utf8");
  chmodSync(filePath, 0o755);
}

function createFakeRuntime(): FakeRuntime {
  const root = mkdtempSync(path.join(tmpdir(), "secpal-container-lifecycle-"));
  const binDirectory = path.join(root, "bin");
  const stateDirectory = path.join(root, "state");
  const temporaryDirectory = path.join(root, "tmp");

  temporaryRoots.push(root);
  mkdirSync(binDirectory);
  mkdirSync(stateDirectory);
  mkdirSync(temporaryDirectory);

  executable(
    path.join(binDirectory, "docker"),
    `#!/usr/bin/env bash
set -u

printf '%s\n' "$*" >>"$FAKE_DOCKER_STATE_DIR/calls"

command_name=\${1:-}
shift || true

case "$command_name" in
  image)
    if [ "\${1:-}" = "inspect" ]; then
      printf 'sha256:fake-image\n'
      exit 0
    fi
    ;;
  create)
    if [ "$FAKE_DOCKER_SCENARIO" = "name-conflict" ]; then
      printf 'docker: Error response from daemon: Conflict. The container name is already in use.\n' >&2
      exit 125
    fi
    while [ "$#" -gt 0 ]; do
      if [ "$1" = "--name" ]; then
        printf 'fake-id-%s\n' "$2"
        exit 0
      fi
      shift
    done
    exit 125
    ;;
  run)
    exit 0
    ;;
  start)
    if [ "$FAKE_DOCKER_SCENARIO" = "start-fails" ]; then
      printf 'docker: controlled start failure\n' >&2
      exit 125
    fi
    exit 0
    ;;
  restart | exec | stop)
    exit 0
    ;;
  port)
    count_file="$FAKE_DOCKER_STATE_DIR/port-count"
    count=0
    if [ -f "$count_file" ]; then
      count=$(<"$count_file")
    fi
    count=$((count + 1))
    printf '%s\n' "$count" >"$count_file"

    if [ "$FAKE_DOCKER_SCENARIO" = "delayed" ] && [ "$count" -ge 3 ]; then
      printf '127.0.0.1:49152\n'
      exit 0
    fi
    exit 1
    ;;
  inspect)
    format=\${2:-}
    if [ "$FAKE_DOCKER_SCENARIO" = "inspect-fails" ]; then
      exit 125
    fi

    case "$format" in
      '{{.State.Status}}')
        if [ "$FAKE_DOCKER_SCENARIO" = "exited" ]; then
          printf 'exited\n'
        else
          printf 'running\n'
        fi
        ;;
      status=*)
        if [ "$FAKE_DOCKER_SCENARIO" = "name-conflict" ]; then
          printf 'status=running running=true exit=0 error="" ports={"foreign":true}\n'
        elif [ "$FAKE_DOCKER_SCENARIO" = "start-fails" ]; then
          printf 'status=created running=false exit=0 error="controlled start failure" ports={}\n'
        elif [ "$FAKE_DOCKER_SCENARIO" = "exited" ]; then
          printf 'status=exited running=false exit=1 error="failed to create task" ports=null\n'
        else
          printf 'status=running running=true exit=0 error="" ports=null\n'
        fi
        ;;
      '{{.Config.User}}')
        printf '101:101\n'
        ;;
      '{{.State.Running}}')
        printf 'false\n'
        ;;
      *)
        exit 125
        ;;
    esac
    ;;
  logs)
    if [ "$FAKE_DOCKER_SCENARIO" = "logs-fail" ]; then
      exit 125
    fi
    if [ "$FAKE_DOCKER_SCENARIO" = "name-conflict" ]; then
      printf 'foreign-container-log-must-not-be-read\n'
      exit 0
    fi
    printf 'nginx: [emerg] controlled startup error\n'
    ;;
  rm)
    printf '%s\n' "\${*: -1}" >>"$FAKE_DOCKER_STATE_DIR/removed"
    ;;
esac
`
  );

  executable(
    path.join(binDirectory, "curl"),
    `#!/usr/bin/env bash
set -u

printf 'curl %s\n' "$*" >>"$FAKE_DOCKER_STATE_DIR/calls"

if [ "$FAKE_DOCKER_SCENARIO" = "hanging-health" ]; then
  request_is_bounded=0
  while [ "$#" -gt 0 ]; do
    if [ "$1" = "--max-time" ]; then
      request_is_bounded=1
      break
    fi
    shift
  done

  if [ "$request_is_bounded" = "0" ]; then
    sleep 10
  fi
  exit 28
fi

exit 0
`
  );
  executable(path.join(binDirectory, "npm"), "#!/bin/sh\nexit 0\n");

  return { binDirectory, stateDirectory, temporaryDirectory };
}

function readLines(filePath: string): string[] {
  if (!existsSync(filePath)) {
    return [];
  }

  return readFileSync(filePath, "utf8").trim().split("\n").filter(Boolean);
}

function runCommand(
  scenario: string,
  command: string,
  args: string[],
  extraEnvironment: NodeJS.ProcessEnv = {}
): RuntimeResult {
  const runtime = createFakeRuntime();
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...extraEnvironment,
      FAKE_DOCKER_SCENARIO: scenario,
      FAKE_DOCKER_STATE_DIR: runtime.stateDirectory,
      PATH: `${runtime.binDirectory}:${process.env.PATH ?? ""}`,
      TMPDIR: runtime.temporaryDirectory,
    },
    timeout: 5_000,
  });

  return {
    calls: readLines(path.join(runtime.stateDirectory, "calls")),
    removedContainers: readLines(path.join(runtime.stateDirectory, "removed")),
    result,
    runtime,
  };
}

function runHelper(scenario: string, attempts = 3): RuntimeResult {
  const harness = `
set -euo pipefail
RUNTIME_TEMP_DIR=$(mktemp -d)
cleanup() {
  docker rm --force owned-container >/dev/null 2>&1 || true
  rm -rf "$RUNTIME_TEMP_DIR"
}
trap cleanup EXIT HUP INT TERM
source "$REPO_ROOT/scripts/container-runtime.sh"
wait_for_container_port owned-container 8080 "$ATTEMPTS" 0
`;

  return runCommand(scenario, "bash", ["-c", harness], {
    ATTEMPTS: String(attempts),
    REPO_ROOT: repoRoot,
  });
}

function runHealthHelper(scenario: string, attempts = 2): RuntimeResult {
  const harness = `
set -euo pipefail
RUNTIME_TEMP_DIR=$(mktemp -d)
cleanup() {
  docker rm --force owned-container >/dev/null 2>&1 || true
  rm -rf "$RUNTIME_TEMP_DIR"
}
trap cleanup EXIT HUP INT TERM
source "$REPO_ROOT/scripts/container-runtime.sh"
wait_for_container_live owned-container 49152 "$ATTEMPTS" 0
`;

  return runCommand(scenario, "bash", ["-c", harness], {
    ATTEMPTS: String(attempts),
    REPO_ROOT: repoRoot,
  });
}

function expectOwnedContainerCleanup(execution: RuntimeResult): void {
  expect(execution.removedContainers).toEqual(["owned-container"]);
  expect(readdirSync(execution.runtime.temporaryDirectory)).toEqual([]);
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("container runtime lifecycle", () => {
  it("waits for delayed loopback port assignment and returns the port", () => {
    const execution = runHelper("delayed");

    expect(execution.result.error).toBeUndefined();
    expect(execution.result.status).toBe(0);
    expect(execution.result.stdout).toBe("49152\n");
    expect(
      execution.calls.filter((call) => call.startsWith("port owned-container"))
    ).toHaveLength(3);
    expect(
      execution.calls.filter((call) =>
        call.includes("inspect --format {{.State.Status}} owned-container")
      )
    ).toHaveLength(2);
    expectOwnedContainerCleanup(execution);
  });

  it("reports an exited smoke container and its startup logs before cleanup", () => {
    const execution = runCommand(
      "exited",
      "bash",
      ["scripts/container-smoke.sh"],
      {
        SECPAL_CONTAINER_IMAGE: canonicalFakeImageReference,
        SECPAL_CONTAINER_SKIP_BUILD: "1",
      }
    );

    expect(execution.result.error).toBeUndefined();
    expect(execution.result.status).toBe(1);
    expect(execution.result.stderr).toContain(
      "container exited before publishing 8080/tcp"
    );
    expect(execution.result.stderr).toContain(
      'status=exited running=false exit=1 error="failed to create task" ports=null'
    );
    expect(execution.result.stderr).toContain(
      "nginx: [emerg] controlled startup error"
    );
    expect(execution.result.stderr).not.toContain("template parsing error");
    expect(execution.removedContainers).toHaveLength(2);
    expect(
      execution.removedContainers.every((name) =>
        name.startsWith("fake-id-secpal-frontend-contract-")
      )
    ).toBe(true);
    expect(execution.removedContainers).not.toContain("foreign-container");
    expect(readdirSync(execution.runtime.temporaryDirectory)).toEqual([]);
  });

  it.each(["scripts/container-smoke.sh", "scripts/container-browser.sh"])(
    "does not inspect or remove a container it did not create in %s",
    (script) => {
      const execution = runCommand("name-conflict", "bash", [script], {
        SECPAL_CONTAINER_IMAGE: canonicalFakeImageReference,
        SECPAL_CONTAINER_SKIP_BUILD: "1",
      });

      expect(execution.result.error).toBeUndefined();
      expect(execution.result.status).toBe(1);
      expect(execution.result.stderr).toContain(
        "container name is already in use"
      );
      expect(execution.result.stderr).not.toContain(
        "foreign-container-log-must-not-be-read"
      );
      expect(execution.calls).not.toContainEqual(
        expect.stringMatching(/^inspect --format status=/u)
      );
      expect(execution.calls).not.toContainEqual(
        expect.stringMatching(/^logs /u)
      );
      expect(execution.removedContainers).toEqual([]);
    }
  );

  it.each(["scripts/container-smoke.sh", "scripts/container-browser.sh"])(
    "diagnoses and removes only its created container when startup fails in %s",
    (script) => {
      const execution = runCommand("start-fails", "bash", [script], {
        SECPAL_CONTAINER_IMAGE: canonicalFakeImageReference,
        SECPAL_CONTAINER_SKIP_BUILD: "1",
      });

      expect(execution.result.error).toBeUndefined();
      expect(execution.result.status).toBe(1);
      expect(execution.result.stderr).toContain("controlled start failure");
      expect(execution.result.stderr).toContain("could not start");
      expect(execution.result.stderr).toContain("status=created running=false");
      expect(execution.removedContainers).toHaveLength(1);
      expect(execution.removedContainers[0]).toMatch(
        /^fake-id-secpal-frontend-(?:contract|browser)-/u
      );
    }
  );

  it("fails closed when Docker cannot inspect container state", () => {
    const execution = runHelper("inspect-fails");

    expect(execution.result.status).toBe(1);
    expect(execution.result.stderr).toContain(
      "ERROR: could not inspect container state"
    );
    expect(execution.result.stderr).toContain(
      "docker inspect failed for owned-container"
    );
    expectOwnedContainerCleanup(execution);
  });

  it("times out after bounded attempts and prints state and logs", () => {
    const execution = runHelper("timeout", 4);

    expect(execution.result.status).toBe(1);
    expect(
      execution.calls.filter((call) => call.startsWith("port "))
    ).toHaveLength(4);
    expect(execution.result.stderr).toContain(
      "ERROR: container did not publish 8080/tcp before timeout"
    );
    expect(execution.result.stderr).toContain(
      'status=running running=true exit=0 error="" ports=null'
    );
    expect(execution.result.stderr).toContain(
      "nginx: [emerg] controlled startup error"
    );
    expectOwnedContainerCleanup(execution);
  });

  it("preserves the timeout error when container logs also fail", () => {
    const execution = runHelper("logs-fail", 2);
    const originalError =
      "ERROR: container did not publish 8080/tcp before timeout";

    expect(execution.result.status).toBe(1);
    expect(execution.result.stderr).toContain(originalError);
    expect(execution.result.stderr).toContain(
      "docker logs failed for owned-container"
    );
    expect(execution.result.stderr.indexOf(originalError)).toBeLessThan(
      execution.result.stderr.indexOf("docker logs failed for owned-container")
    );
    expectOwnedContainerCleanup(execution);
  });

  it("bounds each readiness request as well as the retry count", () => {
    const execution = runHealthHelper("hanging-health");
    const curlCalls = execution.calls.filter((call) =>
      call.startsWith("curl ")
    );

    expect(execution.result.error).toBeUndefined();
    expect(execution.result.status).toBe(1);
    expect(curlCalls).toHaveLength(2);
    expect(
      curlCalls.every((call) =>
        call.includes("--connect-timeout 0.2 --max-time 0.5")
      )
    ).toBe(true);
    expect(execution.result.stderr).toContain(
      "ERROR: container did not expose /health/live before timeout"
    );
    expectOwnedContainerCleanup(execution);
  });

  it("uses the same bounded lifecycle contract in the browser script", () => {
    const execution = runCommand(
      "delayed",
      "bash",
      ["scripts/container-browser.sh"],
      {
        SECPAL_CONTAINER_IMAGE: canonicalFakeImageReference,
        SECPAL_CONTAINER_SKIP_BUILD: "1",
      }
    );

    expect(execution.result.error).toBeUndefined();
    expect(execution.result.status).toBe(0);
    expect(execution.calls).toContainEqual(
      expect.stringContaining(canonicalFakeImageReference)
    );
    expect(execution.calls).toContainEqual(
      expect.stringContaining("--env SECPAL_API_URL=https://api.secpal.dev")
    );
    expect(
      execution.calls.filter((call) => call.startsWith("port "))
    ).toHaveLength(3);
    expect(execution.result.stderr).not.toContain("template parsing error");
    expect(execution.removedContainers).toHaveLength(1);
    expect(execution.removedContainers[0]).toMatch(
      /^fake-id-secpal-frontend-browser-/u
    );
  });

  it("removes the fragile nested port template from both active scripts", () => {
    for (const script of [
      "scripts/container-smoke.sh",
      "scripts/container-browser.sh",
    ]) {
      const contents = readFileSync(path.join(repoRoot, script), "utf8");

      expect(contents).toContain("container-runtime.sh");
      expect(contents).not.toContain(
        '{{(index (index .NetworkSettings.Ports "8080/tcp") 0).HostPort}}'
      );
    }
  });

  it("runs lifecycle regressions in pull-request and publisher validation", () => {
    for (const workflow of [
      ".github/workflows/frontend-container.yml",
      ".github/workflows/publish-container.yml",
    ]) {
      expect(readFileSync(path.join(repoRoot, workflow), "utf8")).toContain(
        "tests/container-runtime-lifecycle.test.ts"
      );
    }
  });
});
