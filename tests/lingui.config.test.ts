// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { existsSync } from "node:fs";
import { join } from "node:path";
import packageJson from "../package.json";
import { describe, expect, it } from "vitest";

describe("Lingui configuration", () => {
  const baseConfigPath = join(process.cwd(), "lingui.config.cjs");

  it("keeps the default sync config local-only", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require(baseConfigPath);

    expect(config.service).toBeUndefined();
  });

  it("does not ship a Translation.io-specific config overlay", () => {
    expect(
      existsSync(join(process.cwd(), "lingui.translationio.config.cjs"))
    ).toBe(false);
  });

  it("uses local Lingui sync commands as the only catalog maintenance path", () => {
    expect(packageJson.scripts.sync).toBe(
      'cross-env-shell "lingui extract --overwrite && lingui compile --namespace es"'
    );
    expect(packageJson.scripts["sync:purge"]).toBe(
      'cross-env-shell "lingui extract --overwrite --clean && lingui compile --namespace es"'
    );
    expect(packageJson.scripts["sync:translationio"]).toBeUndefined();
    expect(packageJson.scripts["sync:translationio:purge"]).toBeUndefined();
  });
});
