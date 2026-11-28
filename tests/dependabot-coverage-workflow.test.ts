// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
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

// Classification, signed metadata and complete rename-aware file inventories
// are qualified once by the immutable central workflow's boundary regressions.
// The consumer must not keep a parallel title parser or execute PR source.
function caller() {
  return load(
    readFileSync(".github/workflows/dependabot-auto-merge.yml", "utf8")
  ) as {
    on: {
      pull_request?: unknown;
      pull_request_target?: { types: string[]; branches?: string[] };
    };
    permissions: Record<string, string>;
    concurrency: Record<string, unknown>;
    "cache-mode": string;
    jobs: Record<
      string,
      {
        uses?: string;
        steps?: unknown;
        secrets?: unknown;
        if?: string;
        with: Record<string, string>;
      }
    >;
  };
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
    expect(readFileSync("Containerfile", "utf8")).toMatch(
      /^FROM docker\.io\/nginx\/nginx-unprivileged:\S+@sha256:[a-f0-9]{64} AS runtime$/mu
    );
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

  it("labels verified pre-commit proposals and keeps Docker out of auto-merge", () => {
    const docker = updates().find(
      (entry) => entry["package-ecosystem"] === "docker"
    );
    const hooks = updates().find(
      (entry) => entry["package-ecosystem"] === "pre-commit"
    );
    expect(docker?.labels).toContain("dependabot");
    expect(docker?.labels).not.toContain("dependencies");
    expect(hooks?.labels).toEqual(
      expect.arrayContaining(["dependabot", "dependencies"])
    );
  });

  it("delegates authenticated classification to the immutable central workflow", () => {
    const workflow = caller();
    const job = workflow.jobs["auto-merge"];
    expect(job).toEqual({
      uses: expect.stringMatching(
        /^SecPal\/\.github\/\.github\/workflows\/reusable-dependabot-auto-merge\.yml@[0-9a-f]{40}$/u
      ),
      secrets: {
        "dependabot-merger-private-key":
          "${{ secrets.DEPENDABOT_MERGER_PRIVATE_KEY }}",
      },
      with: {
        "publisher-events": "${{ vars.DEPENDABOT_MERGER_APP_ID != '' }}",
        phase: "2",
        "merge-method": "squash",
        "allowed-ecosystems": "github_actions,npm_and_yarn,pre_commit",
        "pre-commit-path": ".pre-commit-config.yaml",
      },
    });
    expect(workflow.on.pull_request).toBeUndefined();
    expect(workflow.on.pull_request_target?.branches).toBeUndefined();
    expect(workflow.on.pull_request_target?.types).toEqual([
      "opened",
      "synchronize",
      "reopened",
      "ready_for_review",
      "labeled",
      "unlabeled",
      "edited",
      "converted_to_draft",
    ]);
    expect(workflow.permissions).toEqual({
      contents: "write",
      "pull-requests": "write",
      checks: "read",
      statuses: "read",
      attestations: "read",
    });
    expect(workflow["cache-mode"]).toBe("none");
    expect(workflow.concurrency["cancel-in-progress"]).toBe(true);
  });

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
      uses: expect.stringMatching(
        /^SecPal\/\.github\/\.github\/workflows\/reusable-dependabot-manifest-coverage\.yml@[0-9a-f]{40}$/u
      ),
    });
  });
});
