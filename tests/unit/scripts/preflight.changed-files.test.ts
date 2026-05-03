// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

function run(
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv
) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: env ?? process.env,
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return result;
}

function installMockBinaries(tempDir: string) {
  const binDir = path.join(tempDir, "bin");
  mkdirSync(binDir, { recursive: true });

  writeFileSync(
    path.join(binDir, "npx"),
    `#!/usr/bin/env bash
echo "$@" >> "$NPX_LOG_PATH"
exit 0
`,
    "utf8"
  );
  writeFileSync(
    path.join(binDir, "reuse"),
    `#!/usr/bin/env bash
echo "reuse $@" >> "$REUSE_LOG_PATH"
exit 0
`,
    "utf8"
  );
  run("chmod", ["+x", path.join(binDir, "npx")], tempDir);
  run("chmod", ["+x", path.join(binDir, "reuse")], tempDir);

  return binDir;
}

function prepareScript(tempDir: string) {
  const scriptsDir = path.join(tempDir, "scripts");
  mkdirSync(scriptsDir, { recursive: true });
  const preflightScriptPath = path.join(scriptsDir, "preflight.sh");
  writeFileSync(
    preflightScriptPath,
    readFileSync(path.join(repoRoot, "scripts", "preflight.sh"), "utf8")
  );
  run("chmod", ["+x", preflightScriptPath], tempDir);
  return preflightScriptPath;
}

describe("preflight changed-file detection", () => {
  it("runs markdownlint when markdown is changed but unstaged", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "secpal-preflight-"));

    try {
      const preflightScriptPath = prepareScript(tempDir);
      const binDir = installMockBinaries(tempDir);

      const npxLogPath = path.join(tempDir, "npx.log");
      const reuseLogPath = path.join(tempDir, "reuse.log");

      run("git", ["init", "-b", "main"], tempDir);
      run("git", ["config", "user.name", "SecPal Test"], tempDir);
      run("git", ["config", "user.email", "test@secpal.dev"], tempDir);

      writeFileSync(path.join(tempDir, "README.md"), "# SecPal\n", "utf8");
      run("git", ["add", "README.md"], tempDir);
      run("git", ["commit", "-m", "init"], tempDir);
      run("git", ["checkout", "-b", "topic/preflight-test"], tempDir);

      writeFileSync(
        path.join(tempDir, "README.md"),
        "# SecPal\n\nUpdated content.\n",
        "utf8"
      );

      const preflight = spawnSync("bash", [preflightScriptPath], {
        cwd: tempDir,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          NPX_LOG_PATH: npxLogPath,
          REUSE_LOG_PATH: reuseLogPath,
        },
      });

      expect(preflight.error).toBeUndefined();
      expect(preflight.status, preflight.stderr).toBe(0);

      const npxLog = readFileSync(npxLogPath, "utf8");
      expect(npxLog).toContain("prettier");
      expect(npxLog).toContain("markdownlint-cli2");
      expect(preflight.stdout + preflight.stderr).not.toContain(
        "No markdown files changed, skipping markdownlint"
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("runs markdownlint for committed markdown changes when index and workspace are clean", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "secpal-preflight-"));

    try {
      const preflightScriptPath = prepareScript(tempDir);
      const binDir = installMockBinaries(tempDir);
      const npxLogPath = path.join(tempDir, "npx.log");
      const reuseLogPath = path.join(tempDir, "reuse.log");
      const remoteDir = path.join(tempDir, "remote.git");

      run("git", ["init", "--bare", remoteDir], tempDir);
      run("git", ["init", "-b", "main"], tempDir);
      run("git", ["config", "user.name", "SecPal Test"], tempDir);
      run("git", ["config", "user.email", "test@secpal.dev"], tempDir);

      writeFileSync(path.join(tempDir, "README.md"), "# SecPal\n", "utf8");
      run("git", ["add", "README.md"], tempDir);
      run("git", ["commit", "-m", "init"], tempDir);
      run("git", ["remote", "add", "origin", remoteDir], tempDir);
      run("git", ["push", "-u", "origin", "main"], tempDir);
      run(
        "git",
        [
          "symbolic-ref",
          "refs/remotes/origin/HEAD",
          "refs/remotes/origin/main",
        ],
        tempDir
      );

      run("git", ["checkout", "-b", "topic/preflight-committed-md"], tempDir);
      writeFileSync(
        path.join(tempDir, "README.md"),
        "# SecPal\n\nCommitted update.\n",
        "utf8"
      );
      run("git", ["commit", "-am", "update markdown"], tempDir);

      const preflight = spawnSync("bash", [preflightScriptPath], {
        cwd: tempDir,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
          NPX_LOG_PATH: npxLogPath,
          REUSE_LOG_PATH: reuseLogPath,
        },
      });

      expect(preflight.error).toBeUndefined();
      expect(preflight.status, preflight.stderr).toBe(0);

      const npxLog = readFileSync(npxLogPath, "utf8");
      expect(npxLog).toContain("prettier");
      expect(npxLog).toContain("markdownlint-cli2");
      expect(preflight.stdout + preflight.stderr).not.toContain(
        "No markdown files changed, skipping markdownlint"
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
