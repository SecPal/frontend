// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { load } from "js-yaml";
import { expect, it } from "vitest";

const caller = ".github/workflows/daily-repository-security.yml";
const focusedTest = "tests/daily-repository-security-workflow.test.ts";
const sourceSecurity = "./.github/workflows/reusable-repository-security.yml";

interface DailyWorkflow {
  on: unknown;
  permissions: Record<string, string>;
  jobs: Record<
    string,
    {
      if?: string;
      steps?: { shell?: string; run?: string; if?: string }[];
    }
  >;
}

function dailyWorkflow(): DailyWorkflow {
  return load(readFileSync(caller, "utf8")) as DailyWorkflow;
}

it("schedules a source-only assessment with no input or publisher authority", () => {
  expect(existsSync(caller)).toBe(true);
  const workflow = dailyWorkflow();
  expect(workflow.on).toEqual({
    schedule: [{ cron: "07 3 * * *" }],
    workflow_dispatch: null,
  });
  expect(workflow.permissions).toEqual({});
  expect(Object.keys(workflow.jobs)).toEqual([
    "admit-source",
    "repository-security",
  ]);
  expect(workflow.jobs["admit-source"]).not.toHaveProperty("if");
  expect(workflow.jobs["admit-source"]).not.toHaveProperty("permissions");
  expect(workflow.jobs["admit-source"].steps).toHaveLength(1);
  expect(workflow.jobs["repository-security"]).toEqual({
    name: "Repository Security",
    needs: "admit-source",
    permissions: { contents: "read" },
    uses: sourceSecurity,
  });
  const publisher = load(
    readFileSync(".github/workflows/publish-container.yml", "utf8")
  ) as { on: { push: { "paths-ignore": string[] } } };
  expect(publisher.on.push["paths-ignore"]).toEqual(
    expect.arrayContaining([caller, focusedTest])
  );
});

it.each([
  ["exact protected main", {}, true],
  ["wrong repository", { GITHUB_REPOSITORY: "Other/frontend" }, false],
  ["wrong branch", { GITHUB_REF: "refs/heads/candidate" }, false],
  ["main tag", { GITHUB_REF: "refs/tags/main" }, false],
  ["unprotected main", { GITHUB_REF_PROTECTED: "false" }, false],
  ["missing protection", { GITHUB_REF_PROTECTED: "" }, false],
  ["moving source ref", { GITHUB_SHA: "main" }, false],
  ["short source SHA", { GITHUB_SHA: "a".repeat(39) }, false],
  ["missing source SHA", { GITHUB_SHA: "" }, false],
])("admits or rejects the event source for %s", (_, changed, accepted) => {
  const step = dailyWorkflow().jobs["admit-source"].steps![0];
  expect(step.shell).toBe("bash");
  expect(step.if).toBeUndefined();
  const sha = "a".repeat(40);
  const temporary = mkdtempSync(path.join(tmpdir(), "frontend-source-"));
  const summary = path.join(temporary, "summary.md");
  try {
    const result = spawnSync("bash", ["-eo", "pipefail", "-c", step.run!], {
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_REPOSITORY: "SecPal/frontend",
        GITHUB_REF: "refs/heads/main",
        GITHUB_REF_PROTECTED: "true",
        GITHUB_SHA: sha,
        ...changed,
        GITHUB_STEP_SUMMARY: summary,
      },
    });
    expect(result.status).toBe(accepted ? 0 : 1);
    expect(result.stdout).toBe("");
    expect(existsSync(summary)).toBe(accepted);
    if (accepted) {
      expect(readFileSync(summary, "utf8")).toBe(
        `Source subject: SecPal/frontend@${sha}\n\n`
      );
    } else {
      expect(result.stderr).toContain("protected Frontend main event SHA");
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
