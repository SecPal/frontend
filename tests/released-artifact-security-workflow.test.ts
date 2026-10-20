// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

const file = ".github/workflows/released-artifact-security.yml";
describe("released frontend security adoption", () => {
  it("installs daily and manual read-only re-evaluation independently of publication", () => {
    expect(existsSync(file)).toBe(true);
    const w = load(readFileSync(file, "utf8")) as {
      on: Record<string, unknown>;
      permissions: Record<string, string>;
      jobs: Record<
        string,
        {
          uses?: string;
          if?: string;
          with?: Record<string, unknown>;
          permissions?: Record<string, string>;
        }
      >;
    };
    expect(w.on).toHaveProperty("schedule");
    expect(w.on).toHaveProperty("workflow_dispatch");
    expect(w.on).not.toHaveProperty("push");
    expect(w.on).not.toHaveProperty("pull_request");
    expect(w.permissions).toEqual({});
    expect(w.jobs.release.if).toBe(
      "github.repository == 'SecPal/frontend' && github.ref == 'refs/heads/main'"
    );
    expect(w.jobs.reevaluate.uses).toMatch(
      /^SecPal\/\.github\/\.github\/workflows\/reusable-vulnerability-reevaluation\.yml@[0-9a-f]{40}$/u
    );
    expect(w.jobs.reevaluate.with?.triage).toBe(true);
    for (const job of Object.values(w.jobs)) {
      expect(job.permissions).not.toHaveProperty("id-token");
      expect(job.permissions?.packages).not.toBe("write");
      expect(job.permissions?.contents).not.toBe("write");
    }
    expect(w.jobs.reevaluate.permissions?.issues).toBe("write");
    expect(w.jobs.release.permissions?.issues).toBeUndefined();
    expect(w.jobs.result.permissions?.issues).toBeUndefined();
    expect(readFileSync(file, "utf8")).not.toMatch(
      /build-container|publish-container\.sh|scan-container-artifact\.sh/u
    );
  });

  it("keeps manual subject selection separate from publisher authority and daily hints", () => {
    const raw = readFileSync(file, "utf8");
    const w = load(raw) as {
      on: {
        schedule: { cron: string }[];
        workflow_dispatch: { inputs: Record<string, unknown> };
      };
      jobs: Record<
        string,
        {
          strategy?: unknown;
          with?: Record<string, unknown>;
          steps?: { name: string; if?: string }[];
        }
      >;
    };
    expect(w.on.schedule.map((event) => event.cron)).toEqual([
      "17 3 * * *",
      "37 3 * * *",
    ]);
    expect(Object.keys(w.on.workflow_dispatch.inputs)).toEqual([
      "platform",
      "evidence-artifact",
    ]);
    expect(w.jobs.reevaluate.strategy).toBeUndefined();
    expect(w.jobs.reevaluate.with?.["publisher-repository"]).toBe(
      "SecPal/frontend"
    );
    expect(w.jobs.reevaluate.with?.["publisher-workflow"]).toBe(
      "SecPal/frontend/.github/workflows/publish-container.yml"
    );
    expect(w.jobs.reevaluate.with?.["publisher-workflow-sha"]).toBe(
      "${{ needs.release.outputs.publisher-workflow-sha }}"
    );
    expect(
      w.jobs.release.steps?.find((s) => s.name.includes("lookup hint"))?.if
    ).toBe("steps.release.outputs.cacheable == 'true'");
    for (const [, value] of raw.matchAll(/uses:\s*([^\s]+)/gu)) {
      expect(/@[0-9a-f]{40}$/u.test(value)).toBe(true);
    }
  });

  it("executes the actual result boundary for clean, findings, failed and missing evidence", () => {
    const w = load(readFileSync(file, "utf8")) as {
      jobs: { result: { steps: { run: string }[] } };
    };
    const temporary = mkdtempSync(
      path.join(tmpdir(), "frontend-monitor-outcome-")
    );
    try {
      for (const [state, release, scan, success] of [
        ["CLEAN", "success", "success", true],
        ["ACTIONABLE", "success", "success", false],
        ["REVIEW_REQUIRED", "success", "success", false],
        ["UNKNOWN_STALE", "success", "failure", false],
        ["", "success", "failure", false],
        ["UNTRUSTED_SYNTHETIC_VALUE", "success", "success", false],
        ["CLEAN", "failure", "skipped", false],
        ["CLEAN", "success", "failure", false],
      ] as const) {
        const result = spawnSync("bash", ["-c", w.jobs.result.steps[0].run], {
          encoding: "utf8",
          env: {
            ...process.env,
            STATE: state,
            RELEASE: release,
            SCAN: scan,
            EVIDENCE: "synthetic-artifact",
            GITHUB_STEP_SUMMARY: path.join(temporary, "summary"),
          },
        });
        expect(result.status === 0).toBe(success);
        expect(result.stdout + result.stderr).not.toContain(
          "UNTRUSTED_SYNTHETIC_VALUE"
        );
      }
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  });

  it("executes the release-admission regressions without images or scanner substitutes", () => {
    execFileSync("python3", ["tests/released-artifact-security.py"], {
      encoding: "utf8",
      stdio: "pipe",
    });
  });
});
