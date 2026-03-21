// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { applyInjectManifestCodeSplittingFix } from "./pwaInjectManifestBuildConfig";

describe("applyInjectManifestCodeSplittingFix", () => {
  it("replaces the deprecated inlineDynamicImports flag with codeSplitting false", () => {
    const inlineConfig = {
      build: {
        rollupOptions: {
          output: {
            entryFileNames: "sw.mjs",
            inlineDynamicImports: true,
          },
        },
      },
    };

    applyInjectManifestCodeSplittingFix(inlineConfig);

    expect(inlineConfig.build.rollupOptions.output).toEqual({
      entryFileNames: "sw.mjs",
      codeSplitting: false,
    });
  });

  it("leaves other build outputs unchanged", () => {
    const inlineConfig = {
      build: {
        rollupOptions: {
          output: {
            entryFileNames: "sw.mjs",
          },
        },
      },
    };

    applyInjectManifestCodeSplittingFix(inlineConfig);

    expect(inlineConfig.build.rollupOptions.output).toEqual({
      entryFileNames: "sw.mjs",
    });
  });
});
