// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("Lingui catalog sync guard", () => {
  it("keeps checked-in catalogs synchronized with source strings", async () => {
    const scriptPath = resolve(
      process.cwd(),
      "scripts/check-lingui-catalogs.mjs"
    );

    const result = await execFileAsync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CI: "1",
      },
      maxBuffer: 16 * 1024 * 1024,
    });

    expect(result.stdout).toContain("Lingui catalogs are up to date.");
  }, 120_000);
});
