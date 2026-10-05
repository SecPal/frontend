// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Usage: node scripts/replay-repository-security.mjs --governance <clean pinned
// organization checkout> [--target <clean frontend checkout>] --output <directory>
// Runs the shared Action's actual shell steps; downloads and policy stay upstream.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { load } = createRequire(import.meta.url)("js-yaml");
const pin = "a41b484ac5b7bbf1107775e55f4d1b6c44ac5e8f";
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const { values } = parseArgs({
  options: {
    governance: { type: "string" },
    target: { type: "string" },
    output: { type: "string" },
  },
});

function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    timeout: 1_200_000,
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
  // Subprocess output may contain fixture secrets. Keep failure text constant.
  assert.equal(result.status, 0, "Replay subprocess failed; output withheld.");
  return result.stdout.trim();
}

function git(workspace, args) {
  return command("git", ["--no-replace-objects", "-C", workspace, ...args]);
}

function scan(action, governance, workspace, temporaryRoot, label, secret) {
  const commit = git(workspace, ["rev-parse", "HEAD"]);
  const runner = path.join(temporaryRoot, label);
  mkdirSync(runner, { mode: 0o700 });
  const env = {
    PATH: process.env.PATH,
    HOME: temporaryRoot,
    ...action.runs.steps[0].env,
    GITHUB_ACTION_PATH: path.join(
      governance,
      ".github/actions/trivy-repository-scan"
    ),
    GITHUB_WORKSPACE: workspace,
    GITHUB_REPOSITORY: "SecPal/frontend",
    GITHUB_SHA: commit,
    GITHUB_RUN_ID: label,
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_OUTPUT: path.join(runner, "outputs"),
    GITHUB_STEP_SUMMARY: path.join(runner, "summary"),
    RUNNER_TEMP: runner,
    RUNNER_OS: "Linux",
    RUNNER_ARCH: "X64",
  };
  const execution = spawnSync("bash", ["-c", action.runs.steps[0].run], {
    cwd: workspace,
    env,
    encoding: "utf8",
    timeout: 1_200_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(
    execution.status,
    0,
    "Shared Action execution failed; output withheld."
  );
  const output = readFileSync(env.GITHUB_OUTPUT, "utf8");
  const outputs = Object.fromEntries(
    output
      .trim()
      .split("\n")
      .map((line) => {
        const split = line.indexOf("=");
        return [line.slice(0, split), line.slice(split + 1)];
      })
  );
  const evidenceRoot = outputs["evidence-path"];
  assert.equal(
    path.dirname(evidenceRoot),
    runner,
    "Evidence escaped runner directory."
  );
  assert.deepEqual(
    readdirSync(evidenceRoot),
    ["result.json"],
    "Unexpected retained artifact."
  );
  const evidence = readFileSync(path.join(evidenceRoot, "result.json"), "utf8");
  const summary = readFileSync(env.GITHUB_STEP_SUMMARY, "utf8");
  const publicOutput =
    execution.stdout + execution.stderr + output + summary + evidence;
  if (secret) {
    // Boolean assertions cannot embed either the secret or unsafe evidence on failure.
    assert.ok(
      !publicOutput.includes(secret),
      "Synthetic secret redaction failed."
    );
  }
  assert.ok(
    !readdirSync(runner).some((name) =>
      /^secpal-trivy-(tool|cache)-/.test(name)
    ),
    "Private scanner material was retained."
  );
  const result = JSON.parse(evidence);
  assert.deepEqual(result.subject, { repository: "SecPal/frontend", commit });
  assert.equal(result.gate_state, outputs["gate-state"]);
  command("python3", [
    "-I",
    "-c",
    "import json,jsonschema,sys; jsonschema.validate(json.load(open(sys.argv[1])),json.load(open(sys.argv[2])))",
    path.join(evidenceRoot, "result.json"),
    path.join(
      governance,
      "docs/schemas/secpal-trivy-repository-scan-v1.schema.json"
    ),
  ]);
  if (result.gate_state === "UNKNOWN_STALE") {
    throw new Error(
      `Shared Action failed closed (${result.operation.failure_code}).`
    );
  }
  assert.equal(result.database.status, "FRESH");
  assert.deepEqual(result.operation, {
    name: "TRIVY_REPOSITORY_SCAN",
    status: "SUCCEEDED",
  });
  assert.equal(result.scanner.version, action.runs.steps[0].env.TRIVY_VERSION);
  assert.equal(
    result.scanner.immutable_id,
    `sha256:${action.runs.steps[0].env.TRIVY_ARCHIVE_SHA256}`
  );
  for (const digest of [
    result.scanner.configuration_sha256,
    result.database.identity,
    result.policy.sha256,
  ]) {
    assert.match(digest, /^sha256:[a-f0-9]{64}$/);
  }
  const workflow = load(
    readFileSync(
      path.join(repoRoot, ".github/workflows/reusable-repository-security.yml"),
      "utf8"
    )
  );
  const gate = spawnSync(
    "bash",
    ["-c", workflow.jobs["repository-security"].steps[2].run],
    {
      env: { GATE_STATE: result.gate_state },
      encoding: "utf8",
    }
  );
  assert.equal(gate.status, result.gate_state === "CLEAN" ? 0 : 1);
  const health = spawnSync("bash", ["-c", action.runs.steps.at(-1).run], {
    env: { GATE_STATE: result.gate_state },
    encoding: "utf8",
  });
  assert.equal(health.status, 0);
  return { evidence, summary, result };
}

function main() {
  assert.ok(
    values.governance && values.output,
    "Provide --governance and --output."
  );
  const governance = realpathSync(values.governance);
  assert.equal(git(governance, ["rev-parse", "HEAD"]), pin);
  assert.equal(
    git(governance, ["status", "--porcelain", "--untracked-files=all"]),
    ""
  );
  const authenticated = JSON.parse(
    command("gh", ["api", `repos/SecPal/.github/commits/${pin}`])
  );
  assert.equal(authenticated.sha, pin);
  assert.equal(authenticated.commit.verification.verified, true);
  assert.equal(
    authenticated.commit.tree.sha,
    git(governance, ["rev-parse", "HEAD^{tree}"])
  );
  const action = load(
    readFileSync(
      path.join(governance, ".github/actions/trivy-repository-scan/action.yml"),
      "utf8"
    )
  );
  const temporaryRoot = mkdtempSync(
    path.join(tmpdir(), "frontend-repository-security-")
  );
  try {
    const fixture = path.join(temporaryRoot, "fixture");
    mkdirSync(fixture, { mode: 0o700 });
    const manifest = {
      name: "frontend-security-fixture",
      version: "1.0.0",
      devDependencies: { lodash: "4.17.20" },
    };
    writeFileSync(path.join(fixture, "package.json"), JSON.stringify(manifest));
    writeFileSync(
      path.join(fixture, "package-lock.json"),
      JSON.stringify({
        name: manifest.name,
        version: manifest.version,
        lockfileVersion: 3,
        requires: true,
        packages: {
          "": manifest,
          "node_modules/lodash": {
            version: "4.17.20",
            dev: true,
            resolved: "https://registry.npmjs.org/lodash/-/lodash-4.17.20.tgz",
          },
        },
      })
    );
    writeFileSync(
      path.join(fixture, "Dockerfile"),
      "FROM node:26.10.0\nUSER root\n"
    );
    const secret =
      "SECPAL_SYNTHETIC_" +
      "SECRET_" +
      randomBytes(8).toString("hex").toUpperCase();
    writeFileSync(
      path.join(fixture, ".env"),
      `FRONTEND_TEST_TOKEN=${secret}\n`,
      { mode: 0o600 }
    );
    git(fixture, ["init", "--quiet"]);
    git(fixture, ["add", "."]);
    git(fixture, [
      "-c",
      "user.name=SecPal Fixture",
      "-c",
      "user.email=test@secpal.dev",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "-m",
      "Temporary frontend scanner fixture",
    ]);
    const replay = scan(
      action,
      governance,
      fixture,
      temporaryRoot,
      "fixture-scan",
      secret
    );
    assert.equal(replay.result.gate_state, "ACTIONABLE");
    for (const [findingClass, affectedPath] of [
      ["VULNERABILITY", "package-lock.json"],
      ["MISCONFIGURATION", "Dockerfile"],
      ["SECRET", ".env"],
    ]) {
      assert.ok(
        replay.result.findings.some(
          (finding) =>
            finding.class === findingClass && finding.path === affectedPath
        ),
        `Missing ${findingClass} fixture coverage.`
      );
    }
    assert.ok(
      replay.result.findings.some(
        (finding) =>
          finding.class === "VULNERABILITY" && finding.package === "lodash"
      ),
      "Development npm dependency was not scanned."
    );
    assert.ok(
      replay.result.findings.some(
        (finding) =>
          finding.class === "MISCONFIGURATION" &&
          finding.rule_id &&
          finding.location
      ),
      "Misconfiguration lacks affected context."
    );
    mkdirSync(values.output, { recursive: true, mode: 0o700 });
    writeFileSync(
      path.join(values.output, "fixture-result.json"),
      replay.evidence,
      { mode: 0o600 }
    );
    writeFileSync(
      path.join(values.output, "fixture-summary.md"),
      replay.summary,
      { mode: 0o600 }
    );
    console.log(
      "PASS: exact frontend fixture commit; npm development dependency, Dockerfile, secret, redaction, fresh database, private cleanup, ACTIONABLE blocked."
    );
    if (values.target) {
      const target = scan(
        action,
        governance,
        realpathSync(values.target),
        temporaryRoot,
        "candidate-scan"
      );
      writeFileSync(
        path.join(values.output, "candidate-result.json"),
        target.evidence,
        { mode: 0o600 }
      );
      writeFileSync(
        path.join(values.output, "candidate-summary.md"),
        target.summary,
        { mode: 0o600 }
      );
      console.log(
        `Candidate ${target.result.subject.commit}: ${target.result.gate_state}; normalized inventory retained.`
      );
      assert.equal(
        target.result.gate_state,
        "CLEAN",
        "Candidate repository evidence requires finding triage."
      );
      assert.deepEqual(
        target.result.summary,
        { total: 1, actionable: 0, review_required: 0, excepted: 1 },
        "Expected retained reviewed frontend vulnerability inventory."
      );
      const [finding] = target.result.findings;
      assert.ok(
        target.result.findings.length === 1 &&
          finding.class === "VULNERABILITY" &&
          finding.rule_id === "CVE-2026-93687" &&
          finding.package === "braces" &&
          finding.installed_version === "3.0.3" &&
          finding.path === "package-lock.json" &&
          finding.exception?.disposition === "NOT_AFFECTED" &&
          finding.exception.expires_at === "2026-10-19T00:00:00Z",
        "Reviewed braces finding must remain in normalized evidence."
      );
    }
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  // Never print stack traces, subprocess buffers, assertion operands or fixtures.
  console.error(
    error instanceof assert.AssertionError
      ? error.message.split("\n")[0]
      : "Repository security replay failed; inspect secret-safe normalized evidence when available."
  );
  process.exitCode = 1;
}
