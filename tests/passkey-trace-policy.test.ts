// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");

describe("live passkey trace policy", () => {
  it("disables Playwright traces that could retain the current password", () => {
    const livePasskeySuite = readFileSync(
      path.join(repoRoot, "tests/e2e/passkeys.live.spec.ts"),
      "utf8"
    );

    expect(livePasskeySuite).toMatch(
      /test\.use\(\{\s*trace:\s*["']off["']\s*\}\);/
    );
  });
});
