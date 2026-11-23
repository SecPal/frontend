// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

interface WorkflowStep {
  id?: string;
  uses?: string;
  shell?: string;
  run?: string;
  env?: Record<string, string>;
  with?: Record<string, string>;
}

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
          needs?: string;
          with?: Record<string, unknown>;
          permissions?: Record<string, string>;
          steps?: WorkflowStep[];
        }
      >;
    };
    expect(w.on).toHaveProperty("schedule");
    expect(w.on).toHaveProperty("workflow_dispatch");
    expect(w.on).not.toHaveProperty("push");
    expect(w.on).not.toHaveProperty("pull_request");
    expect(w.permissions).toEqual({});
    expect(Object.keys(w.jobs)).toEqual(["release", "reevaluate"]);
    expect(w.jobs.release.if).toBeUndefined();
    expect(w.jobs.reevaluate.uses).toMatch(
      /^SecPal\/\.github\/\.github\/workflows\/reusable-vulnerability-reevaluation\.yml@[0-9a-f]{40}$/u
    );
    expect(
      w.jobs.release.steps?.find(
        (step) => step.with?.repository === "SecPal/.github"
      )?.with?.ref
    ).toBe("${{ steps.governance.outputs.revision }}");
    const selection = w.jobs.release.steps?.find(
      (step) => step.id === "governance"
    );
    expect(selection?.env?.GOVERNANCE_WORKFLOW).toBe(w.jobs.reevaluate.uses);
    expect(selection?.shell).toBe("bash");
    const policyInstall = w.jobs.release.steps?.find((step) =>
      step.run?.includes("/bin/pip")
    );
    expect(policyInstall?.run).toContain(
      ".context/released-artifact-governance/requirements/requirements.txt"
    );

    expect(w.jobs.reevaluate.with?.triage).toBe(true);
    expect(w.jobs.reevaluate.needs).toBe("release");
    expect(w.jobs.reevaluate.if).toBeUndefined();
    expect(w.jobs.reevaluate).not.toHaveProperty("continue-on-error");
    for (const job of Object.values(w.jobs)) {
      expect(job.permissions).not.toHaveProperty("id-token");
      expect(job.permissions?.packages).not.toBe("write");
      expect(job.permissions?.contents).not.toBe("write");
    }
    expect(w.jobs.reevaluate.permissions?.issues).toBe("write");
    expect(w.jobs.release.permissions?.issues).toBeUndefined();
    expect(readFileSync(file, "utf8")).not.toMatch(
      /build-container|publish-container\.sh|scan-container-artifact\.sh/u
    );
  });

  it.each([
    ["SecPal/frontend", "refs/heads/main", "true", "a".repeat(40), true],
    ["Other/frontend", "refs/heads/main", "true", "a".repeat(40), false],
    ["SecPal/frontend", "refs/heads/topic", "true", "a".repeat(40), false],
    ["SecPal/frontend", "refs/tags/main", "true", "a".repeat(40), false],
    ["SecPal/frontend", "refs/heads/main", "false", "a".repeat(40), false],
    ["SecPal/frontend", "refs/heads/main", "true", "main", false],
  ])(
    "fails closed before release admission for %s %s (protected %s, SHA %s)",
    (repository, ref, protectedRef, sha, accepted) => {
      const workflow = load(readFileSync(file, "utf8")) as {
        jobs: { release: { if?: string; steps: WorkflowStep[] } };
      };
      expect(workflow.jobs.release.if).toBeUndefined();
      const step = workflow.jobs.release.steps[0];
      expect(step.id).toBe("admit-source");
      expect(step.shell).toBe("bash");
      const result = spawnSync("bash", ["-eo", "pipefail", "-c", step.run!], {
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_REPOSITORY: repository,
          GITHUB_REF: ref,
          GITHUB_REF_PROTECTED: protectedRef,
          GITHUB_SHA: sha,
        },
      });
      expect(result.status).toBe(accepted ? 0 : 1);
    }
  );

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
          uses?: string;
          steps?: (WorkflowStep & { name: string; if?: string })[];
        }
      >;
    };
    expect(w.on.schedule.map((event) => event.cron)).toEqual([
      "17 3 * * *",
      "37 3 * * *",
      "17 4 * * *",
      "37 4 * * *",
      "17 6 * * *",
      "37 6 * * *",
    ]);
    expect(Object.keys(w.on.workflow_dispatch.inputs)).toEqual([
      "consumer",
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
    // Inspect resolved YAML so aliases receive the same immutable-pin check.
    for (const job of Object.values(w.jobs)) {
      const uses = [job.uses, ...(job.steps ?? []).map((step) => step.uses)];
      for (const value of uses.filter((value) => value !== undefined)) {
        expect(value).toMatch(/@[0-9a-f]{40}$/u);
      }
    }
  });

  it.each([
    ["current", true],
    ["a".repeat(40), true],
    ["b".repeat(40), true],
    ["main", false],
    ["a".repeat(39), false],
    ["g".repeat(40), false],
    ["", false],
  ])(
    "selects only an immutable shared revision after an update: %s",
    (revision, accepted) => {
      const raw = readFileSync(file, "utf8");
      const current = load(raw) as {
        jobs: {
          release: { steps: WorkflowStep[] };
          reevaluate: { uses: string };
        };
      };
      const reference = current.jobs.reevaluate.uses;
      const selected =
        revision === "current" ? reference.split("@")[1] : revision;
      // Model a dependency update at the single reference, preserving the alias.
      expect(raw.split(reference)).toHaveLength(2);
      const updated = load(
        raw.replace(reference, `${reference.split("@")[0]}@${selected}`)
      ) as typeof current;
      const step = updated.jobs.release.steps.find(
        (candidate) => candidate.id === "governance"
      );
      expect(step?.env?.GOVERNANCE_WORKFLOW).toBe(updated.jobs.reevaluate.uses);
      expect(step?.run).toBeDefined();
      const temporary = mkdtempSync(
        path.join(tmpdir(), "frontend-governance-")
      );
      const output = path.join(temporary, "output");
      try {
        const result = spawnSync(
          "bash",
          ["-e", "-o", "pipefail", "-c", step!.run!],
          {
            encoding: "utf8",
            env: { ...process.env, ...step!.env, GITHUB_OUTPUT: output },
          }
        );
        expect(result.status).toBe(accepted ? 0 : 1);
        expect(existsSync(output) ? readFileSync(output, "utf8") : "").toBe(
          accepted ? `revision=${selected}\n` : ""
        );
      } finally {
        rmSync(temporary, { recursive: true, force: true });
      }
    }
  );

  it("executes the release-admission regressions without images or scanner substitutes", () => {
    execFileSync("python3", ["tests/released-artifact-security.py"], {
      encoding: "utf8",
      stdio: "pipe",
    });
  });
});
