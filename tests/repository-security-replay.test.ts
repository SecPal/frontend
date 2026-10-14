// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  assertCandidateEvidence,
  assertReplayEvidence,
} from "../scripts/replay-repository-security.mjs";

const commit = "076bb1b204fef897231a04eaa0c580511b98bb65";

// Only the consumer assertion surface; genuine schema/scanner coverage uses
// the authenticated upstream action and its maintained conformance tests.
function evidence() {
  return {
    schema_version: "secpal-trivy-repository-scan-v2",
    subject: { repository: "SecPal/frontend", commit },
    policy: {
      sha256:
        "sha256:a8334e36ab688b8e148ed6115ecbf03b38fc692992e67cd57a357b9b1a9c5327",
    },
    scanner: {
      version: "0.74.0",
      immutable_id:
        "sha256:2ae6fe3ee734b7fdf11335663e18c75ea12dccc76062f09f164a3b0f8be4371a",
      configuration_sha256:
        "sha256:d9d411f1348ab50a17018cf04be144a39b0448af389f7c4406e5b7818fa3a6d9",
    },
    database: { status: "FRESH", identity: `sha256:${"a".repeat(64)}` },
    operation: { name: "TRIVY_REPOSITORY_SCAN", status: "SUCCEEDED" },
    completed_at: "2026-10-14T10:00:00Z",
    gate_state: "CLEAN",
    summary: { total: 1, actionable: 0, review_required: 0, excepted: 1 },
    findings: [
      {
        class: "VULNERABILITY",
        rule_id: "CVE-2026-93687",
        package: "braces",
        installed_version: "3.0.3",
        path: "package-lock.json",
        exception: {
          id: "frontend-braces-cve-2026-93687-not-affected-1199",
          disposition: "NOT_AFFECTED",
          expires_at: "2026-10-27T00:00:00Z",
        },
      },
    ],
  };
}

describe("maintained replay consumer assertions", () => {
  it("accepts the exact reviewed identities and retained braces inventory", () => {
    const result = evidence();
    expect(() => assertReplayEvidence(result, commit)).not.toThrow();
    expect(() => assertCandidateEvidence(result)).not.toThrow();
  });

  it.each([
    [
      "old schema",
      (r) => (r.schema_version = "secpal-trivy-repository-scan-v1"),
    ],
    ["wrong source", (r) => (r.subject.commit = "1".repeat(40))],
    ["wrong policy", (r) => (r.policy.sha256 = `sha256:${"0".repeat(64)}`)],
    [
      "old configuration",
      (r) => (r.scanner.configuration_sha256 = `sha256:${"0".repeat(64)}`),
    ],
    [
      "wrong scanner",
      (r) => (r.scanner.immutable_id = `sha256:${"0".repeat(64)}`),
    ],
    ["stale database", (r) => (r.database.status = "STALE")],
    ["missing database", (r) => Reflect.deleteProperty(r, "database")],
    ["failed operation", (r) => (r.operation.status = "FAILED")],
    ["skipped operation", (r) => (r.operation.status = "SKIPPED")],
    ["unknown operation", (r) => (r.operation.status = "UNKNOWN")],
  ] satisfies [string, (result: ReturnType<typeof evidence>) => unknown][])(
    "rejects %s",
    (_name, mutate) => {
      const result = evidence();
      mutate(result);
      expect(() => assertReplayEvidence(result, commit)).toThrow();
    }
  );

  it.each([
    ["unknown gate", (r) => (r.gate_state = "UNKNOWN_STALE")],
    ["actionable gate", (r) => (r.gate_state = "ACTIONABLE")],
    ["actionable inventory", (r) => (r.summary.actionable = 1)],
    ["missing finding", (r) => (r.findings = [])],
    ["extra finding", (r) => r.findings.push(structuredClone(r.findings[0]))],
    [
      "substituted exception",
      (r) => (r.findings[0].exception.id = "unreviewed"),
    ],
    [
      "substituted disposition",
      (r) => (r.findings[0].exception.disposition = "IGNORED"),
    ],
    [
      "old expiry",
      (r) => (r.findings[0].exception.expires_at = "2026-10-19T00:00:00Z"),
    ],
    ["expired exception", (r) => (r.completed_at = "2026-10-27T00:00:00Z")],
    ["malformed completion", (r) => (r.completed_at = "unknown")],
  ] satisfies [string, (result: ReturnType<typeof evidence>) => unknown][])(
    "rejects %s",
    (_name, mutate) => {
      const result = evidence();
      mutate(result);
      expect(() => assertCandidateEvidence(result)).toThrow();
    }
  );
});
