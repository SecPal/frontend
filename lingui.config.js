// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: CC0-1.0

// Load environment variables from .env.local
require("dotenv").config({ path: ".env.local" });

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
  service: {
    name: "TranslationIO",
    apiKey: process.env.TRANSLATION_IO_API_KEY || "",
  },
};
