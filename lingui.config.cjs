// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: CC0-1.0

/** @type {import('@lingui/conf').LinguiConfig} */
module.exports = {
  locales: ["en", "de"],
  sourceLocale: "en",
  catalogs: [
    {
      path: "src/locales/{locale}/messages",
      include: ["src"],
      exclude: ["**/*.d.ts"],
    },
  ],
  format: "po",
};
