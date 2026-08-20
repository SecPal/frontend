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

function authorityStatement(source: string, subject: RegExp) {
  const statement = normalized(source)
    .split(/[.!?]+/)
    .find((candidate) => subject.test(candidate));

  expect(statement).toBeDefined();
  return statement ?? "";
}

function expectNativeAuthority(source: string) {
  const statement = authorityStatement(
    source,
    /github-native issue (data|state)/
  );

  expect(statement).toMatch(/parent\/sub-issue relationships?|hierarch/);
  expect(statement).toMatch(/dependenc/);
  expect(statement).toMatch(/(?:sibling )?order/);
  expect(statement).toMatch(/(?:open\/closed )?state/);
  expect(statement).toMatch(/\b(is|are) authoritative\b/);
  expect(statement).not.toMatch(
    /\b(is|are) (not|never) authoritative\b|\b(is|are) non-authoritative\b/
  );
}

function expectBodyMirrorNonAuthority(source: string) {
  const statement = authorityStatement(
    source,
    /body .*relationship.*status.*mirrors/
  );

  expect(statement).toMatch(
    /\b(is|are) (not|never) authoritative\b|\b(is|are) non-authoritative\b/
  );
  expect(statement).not.toMatch(/\b(is|are) authoritative\b/);
}

function expectNativeGraphAuthority(source: string) {
  expectNativeAuthority(source);
  expectBodyMirrorNonAuthority(source);
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

    const nativeAuthority =
      "GitHub-native issue data, parent/sub-issue relationships, dependencies, sibling order, and open/closed state are authoritative.";
    const nativeNonAuthority =
      "GitHub-native issue data, parent/sub-issue relationships, dependencies, sibling order, and open/closed state are not authoritative.";
    const bodyNonAuthority =
      "Body relationship/status mirrors are not authoritative.";
    const bodyAuthority = "Body relationship/status mirrors are authoritative.";

    expect(() =>
      expectNativeAuthority(`${nativeNonAuthority} ${bodyNonAuthority}`)
    ).toThrow();
    expectBodyMirrorNonAuthority(`${nativeNonAuthority} ${bodyNonAuthority}`);

    expectNativeAuthority(`${nativeAuthority} ${bodyAuthority}`);
    expect(() =>
      expectBodyMirrorNonAuthority(`${nativeAuthority} ${bodyAuthority}`)
    ).toThrow();

    expect(() =>
      expectNativeAuthority(`${nativeNonAuthority} ${bodyAuthority}`)
    ).toThrow();
    expect(() =>
      expectBodyMirrorNonAuthority(`${nativeNonAuthority} ${bodyAuthority}`)
    ).toThrow();

    expectNativeGraphAuthority(
      "GitHub-native issue state, including hierarchy, dependencies, order, and open/closed state, is authoritative. Body relationship and status mirrors are not authoritative."
    );
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
