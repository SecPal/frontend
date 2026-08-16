// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readWorkflow(): string {
  return readFileSync(
    path.join(repoRoot, ".github/workflows/lighthouse.yml"),
    "utf8"
  );
}

function getWorkflowStep(name: string): Record<string, unknown> {
  const workflow = load(readWorkflow());

  if (!isRecord(workflow) || !isRecord(workflow.jobs)) {
    throw new Error("Lighthouse workflow must define jobs");
  }

  const lighthouseJob = workflow.jobs.lighthouse;
  if (!isRecord(lighthouseJob) || !Array.isArray(lighthouseJob.steps)) {
    throw new Error("Lighthouse workflow must define lighthouse steps");
  }

  const step = lighthouseJob.steps.find(
    (candidate) => isRecord(candidate) && candidate.name === name
  );
  if (!isRecord(step)) {
    throw new Error(`Lighthouse workflow step not found: ${name}`);
  }

  return step;
}

describe("Lighthouse workflow report comment", () => {
  it("links pull-request readers directly to the uploaded report artifact", async () => {
    const uploadStep = getWorkflowStep("Upload Lighthouse report");
    expect(uploadStep.id).toBe("upload_lighthouse_artifact");
    expect(uploadStep.uses).toBe(
      "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a"
    );
    expect(uploadStep.if).toBe("${{ always() }}");
    expect(uploadStep.with).toMatchObject({
      "if-no-files-found": "error",
      "include-hidden-files": true,
      name: "lighthouse-report",
      path: ".lighthouseci",
    });

    const formatStep = getWorkflowStep("Format Lighthouse Score");
    expect(formatStep.env).toMatchObject({
      LIGHTHOUSE_ARTIFACT_URL:
        "${{ steps.upload_lighthouse_artifact.outputs.artifact-url }}",
    });

    if (
      !isRecord(formatStep.with) ||
      typeof formatStep.with.script !== "string"
    ) {
      throw new Error("Format Lighthouse Score must define a script");
    }

    const artifactUrl =
      "https://github.com/SecPal/frontend/actions/runs/123/artifacts/456";
    const outputs = new Map<string, string>();
    const manifest = JSON.stringify([
      {
        htmlPath: "/home/runner/work/frontend/.lighthouseci/report.html",
        summary: {
          accessibility: 0.98,
          "best-practices": 0.97,
          performance: 0.96,
        },
      },
    ]);
    const requireModule = (moduleName: string): unknown => {
      if (moduleName === "fs") {
        return {
          existsSync: () => true,
          readFileSync: () => manifest,
          readdirSync: () => ["manifest.json"],
        };
      }
      if (moduleName === "path") {
        return path;
      }

      throw new Error(`Unexpected module request: ${moduleName}`);
    };
    const script = new vm.Script(
      `(async () => {\n${formatStep.with.script}\n})()`
    );

    await script.runInNewContext({
      URL,
      console,
      core: {
        setOutput: (name: string, value: string) => outputs.set(name, value),
      },
      process: { env: { LIGHTHOUSE_ARTIFACT_URL: artifactUrl } },
      require: requireModule,
    });

    const comment = outputs.get("comment");
    expect(comment).toContain(`[View full report artifact](${artifactUrl})`);
    expect(comment).not.toContain("/home/runner/");
    expect(comment).not.toContain(".lighthouseci/");
    expect(comment).not.toContain("#artifacts");
  });
});
