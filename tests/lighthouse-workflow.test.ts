// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function readWorkflow(): string {
  return readFileSync(
    path.join(repoRoot, ".github/workflows/lighthouse.yml"),
    "utf8"
  );
}

describe("Lighthouse workflow report comment", () => {
  it("links pull-request readers to the current run's uploaded report artifact", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("uploadArtifacts: true");
    expect(workflow).toContain(
      "${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}#artifacts"
    );
    expect(workflow).toContain("context.serverUrl");
    expect(workflow).toContain("[View full report artifact](${artifactUrl})");
  });

  it("never includes a runner-local Lighthouse report path in the comment", () => {
    expect(readWorkflow()).not.toContain("result.htmlPath");
  });
});
