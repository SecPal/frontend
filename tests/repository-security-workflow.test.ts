// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getReplayActionPin } from "../scripts/replay-repository-security.mjs";

interface Step {
  name: string;
  id?: string;
  uses?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
  run?: string;
}

interface Workflow {
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  jobs: Record<
    string,
    {
      name: string;
      uses?: string;
      permissions: Record<string, string>;
      needs?: string[];
      steps: Step[];
      "runs-on"?: string;
      "timeout-minutes"?: number;
    }
  >;
}

const { load } = createRequire(import.meta.url)("js-yaml") as {
  load: (source: string) => Workflow;
};
const reusablePath = ".github/workflows/reusable-repository-security.yml";
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function readWorkflow(relativePath: string): Workflow {
  return load(readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

describe("pre-publication repository source security", () => {
  it("provides PR/main feedback and independently gates publication without credentials or bypasses", () => {
    const quality = readWorkflow(".github/workflows/quality.yml");
    expect(quality.on).toHaveProperty("pull_request");
    expect(quality.on).toHaveProperty("push");
    for (const workflow of [
      quality,
      readWorkflow(".github/workflows/publish-container.yml"),
    ]) {
      expect(workflow.jobs["repository-security"]).toEqual({
        name: "Repository Security",
        uses: `./${reusablePath}`,
        permissions: { contents: "read" },
      });
    }
    const publish = readWorkflow(".github/workflows/publish-container.yml").jobs
      .build;
    expect(publish.needs).toEqual(["validate", "repository-security"]);
    expect(publish).not.toHaveProperty("if");
    expect(publish).not.toHaveProperty("continue-on-error");
  });

  it("checks the reviewed exception reachability assumptions before publication", () => {
    const validation = readWorkflow(".github/workflows/publish-container.yml")
      .jobs.validate;
    const contract = validation.steps.find(
      (step) => step.name === "Run container publishing and source policy tests"
    );
    expect(contract?.run).toContain(
      "tests/repository-security-reachability.test.ts"
    );
    expect(validation).not.toHaveProperty("if");
    expect(validation).not.toHaveProperty("continue-on-error");
    expect(contract).not.toHaveProperty("if");
    expect(contract).not.toHaveProperty("continue-on-error");
  });

  it("uses the immutable central Action on the exact clean target with read-only authority", () => {
    const workflow = readWorkflow(reusablePath);
    expect(workflow.on).toHaveProperty(
      "workflow_call.outputs.evidence-artifact"
    );
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(Object.keys(workflow.jobs)).toEqual(["repository-security"]);
    const job = workflow.jobs["repository-security"];
    expect(job.permissions).toEqual({ contents: "read" });
    expect(job["runs-on"]).toBe("ubuntu-latest");
    expect(job["timeout-minutes"]).toBe(20);
    expect(job).not.toHaveProperty("if");
    expect(job).not.toHaveProperty("continue-on-error");
    expect(job).not.toHaveProperty("secrets");
    expect(job.steps).toHaveLength(3);
    expect(job.steps[0]).toEqual({
      name: "Checkout exact frontend commit",
      uses: expect.stringMatching(/^actions\/checkout@[0-9a-f]{40}$/),
      with: { ref: "${{ github.sha }}", "persist-credentials": false },
    });
    expect(job.steps[1]).toEqual({
      name: "Scan repository source",
      id: "scan",
      uses: expect.stringMatching(
        /^SecPal\/\.github\/\.github\/actions\/trivy-repository-scan@[0-9a-f]{40}$/
      ),
    });
  });

  it("binds the maintained replay to the same accepted action and v2 evidence", () => {
    const replay = readFileSync(
      path.join(repoRoot, "scripts/replay-repository-security.mjs"),
      "utf8"
    );
    const pin =
      readWorkflow(reusablePath).jobs[
        "repository-security"
      ].steps[1].uses!.split("@")[1];
    expect(getReplayActionPin(readWorkflow(reusablePath))).toBe(pin);
    expect(replay).toContain("secpal-trivy-repository-scan-v2.schema.json");
    expect(replay).toContain(
      "frontend-braces-cve-2026-93687-not-affected-1199"
    );
    expect(replay).toContain("2026-10-27T00:00:00Z");
    expect(replay).not.toContain("secpal-trivy-repository-scan-v1.schema.json");
    expect(replay).not.toContain("2026-10-19T00:00:00Z");
  });

  it.each([
    undefined,
    "",
    "CLEAN",
    "ACTIONABLE",
    "REVIEW_REQUIRED",
    "UNKNOWN_STALE",
    "UNKNOWN",
    "clean",
    "CLEAN\n",
    "CLEAN; exit 0",
    "SECPAL_UNTRUSTED_GATE_CONTENT",
  ])(
    "accepts only CLEAN for gate %s without echoing untrusted content",
    (state) => {
      const acceptance =
        readWorkflow(reusablePath).jobs["repository-security"].steps[2];
      expect(acceptance.env).toEqual({
        GATE_STATE: "${{ steps.scan.outputs.gate-state }}",
      });
      expect(acceptance).not.toHaveProperty("if");
      expect(acceptance).not.toHaveProperty("continue-on-error");
      expect(acceptance.run).toBeTypeOf("string");
      const result = spawnSync("bash", ["-c", acceptance.run!], {
        env: state === undefined ? {} : { GATE_STATE: state },
        encoding: "utf8",
      });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(state === "CLEAN" ? 0 : 1);
      if (state && state !== "CLEAN") {
        expect(result.stdout + result.stderr).not.toContain(state);
      }
    }
  );
});
