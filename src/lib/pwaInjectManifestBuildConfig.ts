// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { InlineConfig } from "vite";

type ServiceWorkerBuildOutput = {
  inlineDynamicImports?: boolean;
  codeSplitting?: boolean;
  [key: string]: unknown;
};

type ServiceWorkerRollupOptions = {
  output?: ServiceWorkerBuildOutput | ServiceWorkerBuildOutput[];
};

function isSingleOutput(
  output: ServiceWorkerRollupOptions["output"]
): output is ServiceWorkerBuildOutput {
  return Boolean(output) && !Array.isArray(output);
}

export function applyInjectManifestCodeSplittingFix(
  inlineConfig: InlineConfig
): void {
  const rollupOptions = inlineConfig.build?.rollupOptions as
    | ServiceWorkerRollupOptions
    | undefined;

  if (!rollupOptions || !isSingleOutput(rollupOptions.output)) {
    return;
  }

  if (rollupOptions.output.inlineDynamicImports !== true) {
    return;
  }

  const output = { ...rollupOptions.output };

  delete output.inlineDynamicImports;

  rollupOptions.output = {
    ...output,
    codeSplitting: false,
  };
}
