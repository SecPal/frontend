// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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
      .publish;
    expect(publish.needs).toEqual(["validate", "repository-security"]);
    expect(publish).not.toHaveProperty("if");
    expect(publish).not.toHaveProperty("continue-on-error");
  });

  it("uses the immutable central Action on the exact clean target with read-only authority", () => {
    const workflow = readWorkflow(reusablePath);
    expect(workflow.on).toEqual({ workflow_call: null });
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
      uses: "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      with: { ref: "${{ github.sha }}", "persist-credentials": false },
    });
    expect(job.steps[1]).toEqual({
      name: "Scan repository source",
      id: "scan",
      uses: "SecPal/.github/.github/actions/trivy-repository-scan@a41b484ac5b7bbf1107775e55f4d1b6c44ac5e8f",
    });
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
