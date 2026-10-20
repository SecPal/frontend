// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

interface Update {
  "package-ecosystem": string;
  directory: string;
  schedule: { interval: string; time: string; timezone: string };
  labels: string[];
}

function updates(): Update[] {
  return (
    load(readFileSync(".github/dependabot.yml", "utf8")) as {
      updates: Update[];
    }
  ).updates;
}

function patchEligibility(labels: string[], title: string): string {
  const workflow = load(
    readFileSync(".github/workflows/dependabot-auto-merge.yml", "utf8")
  ) as {
    jobs: { "auto-merge": { steps: { id?: string; run?: string }[] } };
  };
  const script = workflow.jobs["auto-merge"].steps.find(
    (step) => step.id === "eligibility"
  )?.run;
  expect(script).toBeDefined();
  const directory = mkdtempSync(join(tmpdir(), "frontend-dependabot-"));
  const output = join(directory, "output");
  try {
    const result = spawnSync("bash", ["-c", script!], {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        PR_LABELS: JSON.stringify(labels),
        PR_TITLE: title,
        GITHUB_OUTPUT: output,
      },
    });
    expect(result.status, result.stderr).toBe(0);
    return readFileSync(output, "utf8");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("frontend manifest coverage adoption", () => {
  it("configures the active root Containerfile and pre-commit ecosystems", () => {
    expect(
      updates().map((entry) => [entry["package-ecosystem"], entry.directory])
    ).toEqual([
      ["npm", "/"],
      ["github-actions", "/"],
      ["docker", "/"],
      ["pre-commit", "/"],
    ]);
    expect(readFileSync("Containerfile", "utf8")).toContain("ARG NGINX_IMAGE=");
    expect(readFileSync(".pre-commit-config.yaml", "utf8")).toContain(
      "repo: https://github.com/"
    );
  });

  it("keeps every effective update schedule daily at 04:00 Europe/Berlin", () => {
    for (const entry of updates()) {
      expect(entry.schedule).toEqual({
        interval: "daily",
        time: "04:00",
        timezone: "Europe/Berlin",
      });
    }
  });

  it.each(["docker", "pre-commit"])(
    "keeps %s proposals out of the existing patch auto-merge path",
    (ecosystem) => {
      const entry = updates().find(
        (candidate) => candidate["package-ecosystem"] === ecosystem
      );
      expect(entry).toBeDefined();
      // The owning workflow searches the whole labels JSON for this substring.
      expect(JSON.stringify(entry!.labels)).not.toContain("dependencies");
      expect(entry!.labels).toContain("dependabot");
      expect(
        patchEligibility(
          [...entry!.labels, "patch"],
          "chore(deps): bump example from 1.30.6 to 1.30.7"
        )
      ).toContain("eligible=false\n");
    }
  );

  it.each(["npm", "github-actions"])(
    "preserves %s patch eligibility and rejects minor/major changes",
    (ecosystem) => {
      const entry = updates().find(
        (candidate) => candidate["package-ecosystem"] === ecosystem
      )!;
      expect(
        patchEligibility(
          entry.labels,
          "chore(deps): bump example from 1.2.3 to 1.2.4"
        )
      ).toContain("eligible=true\n");
      for (const next of ["1.3.0", "2.0.0"]) {
        expect(
          patchEligibility(
            entry.labels,
            `chore(deps): bump example from 1.2.3 to ${next}`
          )
        ).toContain("eligible=false\n");
      }
    }
  );

  it("reuses the exact central coverage and cadence guard without policy overrides", () => {
    const quality = load(
      readFileSync(".github/workflows/quality.yml", "utf8")
    ) as {
      on: Record<string, unknown>;
      jobs: Record<string, Record<string, unknown>>;
    };
    expect(quality.on).toHaveProperty("pull_request");
    expect(quality.on).toHaveProperty("push");
    expect(quality.jobs["dependabot-manifests"]).toEqual({
      name: "Dependabot Manifest Guard",
      permissions: { contents: "read" },
      uses: "SecPal/.github/.github/workflows/reusable-dependabot-manifest-coverage.yml@80732e29ad253f63fa8c46637f6686c344ce82ad",
    });
  });
});
