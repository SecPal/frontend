// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function normalized(source: string) {
  return source
    .replace(/[`*_"']/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function expectNativeGraphAuthority(source: string) {
  const prose = normalized(source);

  expect(prose).toMatch(/github-native issue (data|state).*authoritative/);
  expect(prose).toMatch(/body .*mirrors.*not.*authoritative/);
  expect(prose).not.toMatch(/native (github )?graph.*not authoritative/);
  expect(prose).not.toMatch(
    /body (status|relationships?|mirrors?).*\b(is|are) authoritative/
  );
}

describe("frontend work-graph governance", () => {
  const agents = readRepoFile("AGENTS.md");
  const copilotMirror = readRepoFile(".github/copilot-instructions.md");
  const runtimeOverlay = readRepoFile(
    ".github/instructions/org-shared.instructions.md"
  );
  const reactOverlay = readRepoFile(
    ".github/instructions/react-typescript.instructions.md"
  );
  const pullRequestTemplate = readRepoFile(".github/pull_request_template.md");

  it("delegates graph semantics to the canonical contract and native GitHub state", () => {
    for (const source of [agents, copilotMirror, runtimeOverlay]) {
      expect(source).toContain("SecPal/.github/docs/work-graph-contract.md");
    }

    expectNativeGraphAuthority(agents);
    expect(() =>
      expectNativeGraphAuthority(
        "The native graph is not authoritative. Body status is authoritative."
      )
    ).toThrow();
  });

  it("keeps decomposition, findings, review, and evidence finite", () => {
    const governance = normalized(
      [agents, copilotMirror, runtimeOverlay, pullRequestTemplate].join("\n")
    );

    expect(governance).toContain("one delivery contract");
    expect(governance).toContain("one primary implementation pull request");
    expect(governance).not.toMatch(
      /more than one pr.*(create|required?).*epic|epic.*more than one pr/
    );
    expect(governance).not.toMatch(
      /every (real )?out-of-scope (bug|finding).*issue/
    );
    expect(governance).not.toMatch(/review.*zero issues|zero issues.*review/);
    expect(governance).not.toContain("4-pass review");
    expect(governance).toMatch(/proven.*material.*actionable.*non-duplicate/);
    expect(governance).toMatch(/bounded full review.*delta-only/);
    expect(governance).toMatch(
      /behavior-preserving.*(structural|characterization)/
    );
  });

  it("retains frontend security, storage, and accessibility invariants", () => {
    const frontendRules = normalized([agents, reactOverlay].join("\n"));

    for (const invariant of [
      "generated openapi types",
      "semantic html",
      "focus behavior",
      "aria-live",
      "role=status",
      "cleartext localstorage/sessionstorage",
      "web lock",
      "root-key zeroization",
      "cross-tab",
      "runtime/tenant",
      "fail-closed",
    ]) {
      expect(frontendRules, invariant).toContain(invariant);
    }
  });
});
