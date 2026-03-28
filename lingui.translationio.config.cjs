// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: CC0-1.0

require("dotenv").config({ path: ".env.local", quiet: true });

const baseConfig = require("./lingui.config.cjs");

const translationIoApiKey = process.env.TRANSLATION_IO_API_KEY?.trim() ?? "";

if (translationIoApiKey.length === 0) {
  throw new Error(
    "Translation.io sync requires TRANSLATION_IO_API_KEY in .env.local or the current environment.",
  );
}

module.exports = {
  ...baseConfig,
  service: {
    name: "TranslationIO",
    apiKey: translationIoApiKey,
  },
};
