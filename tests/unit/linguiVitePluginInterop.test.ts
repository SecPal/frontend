// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { resolveLinguiVitePluginExports } from "../../linguiVitePluginInterop";

describe("resolveLinguiVitePluginExports", () => {
  it("falls back to CommonJS default exports when named exports are unavailable", () => {
    const lingui = vi.fn();
    const linguiTransformerBabelPreset = vi.fn();

    expect(
      resolveLinguiVitePluginExports({
        default: {
          lingui,
          linguiTransformerBabelPreset,
        },
      })
    ).toEqual({
      lingui,
      linguiTransformerBabelPreset,
    });
  });

  it("throws when neither named exports nor default exports expose the required Lingui functions", () => {
    expect(() => resolveLinguiVitePluginExports({})).toThrow(
      "@lingui/vite-plugin did not expose usable lingui() and linguiTransformerBabelPreset() exports"
    );
  });
});
