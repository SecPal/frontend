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

function patchOutput(
  output: ServiceWorkerBuildOutput
): ServiceWorkerBuildOutput {
  if (output.inlineDynamicImports !== true) {
    return output;
  }

  const patched = { ...output };

  delete patched.inlineDynamicImports;

  return { ...patched, codeSplitting: false };
}

export function applyInjectManifestCodeSplittingFix(
  inlineConfig: InlineConfig
): void {
  const rollupOptions = inlineConfig.build?.rollupOptions as
    | ServiceWorkerRollupOptions
    | undefined;

  if (!rollupOptions?.output) {
    return;
  }

  if (Array.isArray(rollupOptions.output)) {
    rollupOptions.output = rollupOptions.output.map(patchOutput);

    return;
  }

  rollupOptions.output = patchOutput(rollupOptions.output);
}
