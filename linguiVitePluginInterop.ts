// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

type LinguiPluginFactory = (...args: unknown[]) => unknown;

type LinguiVitePluginExports = {
  lingui: LinguiPluginFactory;
  linguiTransformerBabelPreset: LinguiPluginFactory;
};

function hasLinguiVitePluginExports(
  value: unknown
): value is LinguiVitePluginExports {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.lingui === "function" &&
    typeof candidate.linguiTransformerBabelPreset === "function"
  );
}

export function resolveLinguiVitePluginExports(
  moduleExports: unknown
): LinguiVitePluginExports {
  if (hasLinguiVitePluginExports(moduleExports)) {
    return moduleExports;
  }

  if (
    typeof moduleExports === "object" &&
    moduleExports !== null &&
    hasLinguiVitePluginExports(
      (moduleExports as { default?: unknown }).default
    )
  ) {
    return (moduleExports as { default: LinguiVitePluginExports }).default;
  }

  throw new TypeError(
    "@lingui/vite-plugin did not expose usable lingui() and linguiTransformerBabelPreset() exports"
  );
}
