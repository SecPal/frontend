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
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

export function getReplayActionPin(workflow) {
  const reference = workflow?.jobs?.["repository-security"]?.steps?.[1]?.uses;
  assert.equal(typeof reference, "string", "Missing repository scan action.");
  const match = reference.match(
    /^SecPal\/\.github\/\.github\/actions\/trivy-repository-scan@([0-9a-f]{40})$/
  );
  assert.ok(
    match && match[0] === reference,
    "Repository scan action must use the organization action at a full commit SHA."
  );
  return match[1];
}

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

function observeGovernanceIdentity(governance) {
  const source = [
    "import importlib.util,json,pathlib,sys",
    "root=pathlib.Path(sys.argv[1])",
    "spec=importlib.util.spec_from_file_location('reviewed_scanner',root/'scripts/secpal-trivy-repository-scan.py')",
    "owner=importlib.util.module_from_spec(spec);spec.loader.exec_module(owner)",
    "policy=json.loads((root/'policies/trivy-repository-scan-v1.json').read_text())",
    "print(json.dumps({'policy_sha256':owner._sha256(policy),'configuration_sha256':owner.configuration_identity(),'scanner_version':owner.TRIVY_VERSION,'scanner_identity':owner.TRIVY_ARCHIVE_ID,'exceptions':policy['exceptions']}))",
  ].join("\n");
  return JSON.parse(command("python3", ["-I", "-c", source, governance]));
}

function git(workspace, args) {
  return command("git", ["--no-replace-objects", "-C", workspace, ...args]);
}

function scan(
  action,
  governance,
  workspace,
  temporaryRoot,
  label,
  identity,
  secret
) {
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
      "docs/schemas/secpal-trivy-repository-scan-v4.schema.json"
    ),
  ]);
  if (result.gate_state === "UNKNOWN_STALE") {
    throw new Error(
      `Shared Action failed closed (${result.operation.failure_code}).`
    );
  }
  assertReplayEvidence(result, commit, identity);
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

// Consumer assertions bind the shared result; normalization remains upstream.
export function assertReplayEvidence(result, commit, identity) {
  assert.equal(result.schema_version, "secpal-trivy-repository-scan-v4");
  assert.deepEqual(result.subject, { repository: "SecPal/frontend", commit });
  assert.equal(result.policy.sha256, identity.policy_sha256);
  assert.equal(
    result.scanner.configuration_sha256,
    identity.configuration_sha256
  );
  assert.equal(result.database.status, "FRESH");
  assert.deepEqual(result.operation, {
    name: "TRIVY_REPOSITORY_SCAN",
    status: "SUCCEEDED",
  });
  assert.equal(result.scanner.version, identity.scanner_version);
  assert.equal(result.scanner.immutable_id, identity.scanner_identity);
  for (const digest of [
    result.scanner.configuration_sha256,
    result.scanner.immutable_id,
    result.database.identity,
    result.policy.sha256,
  ]) {
    assert.match(digest, /^sha256:[a-f0-9]{64}$/);
  }
}

export function assertCandidateEvidence(result, exceptions) {
  assert.equal(
    result.gate_state,
    "CLEAN",
    "Candidate repository evidence requires finding triage."
  );
  assert.ok(
    Number.isFinite(Date.parse(result.completed_at)),
    "Malformed completion time."
  );
  assert.deepEqual(
    result.summary,
    {
      total: result.findings.length,
      actionable: 0,
      review_required: 0,
      excepted: result.findings.length,
    },
    "Current normalized inventory must remain complete."
  );
  for (const finding of result.findings) {
    assert.equal(finding.class, "VULNERABILITY");
    const reviewed = exceptions.find(
      (entry) =>
        entry.repository === "SecPal/frontend" &&
        entry.class === finding.class &&
        entry.rule_id === finding.rule_id &&
        entry.path === finding.path &&
        entry.id === finding.exception?.id
    );
    assert.ok(reviewed, "Finding lacks its exact reviewed policy disposition.");
    assert.deepEqual(finding.exception, {
      id: reviewed.id,
      disposition: reviewed.disposition,
      expires_at: reviewed.expires_at,
    });
    assert.ok(
      Date.parse(result.completed_at) < Date.parse(reviewed.expires_at),
      "Reviewed exception has expired."
    );
  }
}

function main() {
  const { values } = parseArgs({
    options: {
      governance: { type: "string" },
      target: { type: "string" },
      output: { type: "string" },
    },
  });
  assert.ok(
    values.governance && values.output,
    "Provide --governance and --output."
  );
  const workflow = load(
    readFileSync(
      path.join(repoRoot, ".github/workflows/reusable-repository-security.yml"),
      "utf8"
    )
  );
  const pin = getReplayActionPin(workflow);
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
  const identity = observeGovernanceIdentity(governance);
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
      identity,
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
        "candidate-scan",
        identity
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
      assertCandidateEvidence(target.result, identity.exceptions);
    }
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
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
}
