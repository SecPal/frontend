// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const scriptPath = path.join(
  repoRoot,
  "scripts",
  "run-live-web-push-smoke.mjs"
);

describe("run-live-web-push-smoke preflight", () => {
  it("accepts canonical workspace preview URLs outside Polyscope clones", () => {
    const tempDir = mkdtempSync(
      path.join(os.tmpdir(), "secpal-live-web-push-")
    );

    try {
      const result = spawnSync(process.execPath, [scriptPath], {
        cwd: tempDir,
        encoding: "utf8",
        env: {
          ...process.env,
          PLAYWRIGHT_BASE_URL: "https://grumpy-lynx.preview.secpal.dev",
          POLYSCOPE_WORKSPACE: "",
          CHROME_PATH: "",
        },
      });

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("CHROME_PATH must point");
      expect(result.stderr).not.toContain(
        "must run inside a Polyscope workspace clone"
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
