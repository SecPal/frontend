// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it, vi } from "vitest";
import { resolveLinguiVitePluginExports } from "../../linguiVitePluginInterop";

describe("resolveLinguiVitePluginExports", () => {
  it("returns the named lingui export directly when it is present", () => {
    const lingui = vi.fn();

    expect(resolveLinguiVitePluginExports({ lingui })).toEqual({ lingui });
  });

  it("falls back to CommonJS default exports when the named lingui export is unavailable", () => {
    const lingui = vi.fn();

    expect(
      resolveLinguiVitePluginExports({
        default: {
          lingui,
        },
      })
    ).toEqual({ lingui });
  });

  it("throws when neither named exports nor default exports expose a usable lingui function", () => {
    expect(() => resolveLinguiVitePluginExports({})).toThrow(
      "@lingui/vite-plugin did not expose a usable lingui() export"
    );
  });
});
