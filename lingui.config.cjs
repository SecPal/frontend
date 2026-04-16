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
  // Use messageId ordering to guarantee a deterministic catalog sort.
  // The default "message" ordering is unstable when two entries share the
  // same translated text (e.g. "Cancel" appears as both a generic button
  // label and the msgstr for the "login.mfa.cancel" explicit ID), causing
  // the PO file to oscillate between two orderings on successive runs.
  orderBy: "messageId",
};
