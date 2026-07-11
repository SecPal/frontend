// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultLocale, locales } from "../src/i18n";

const repoRoot = path.resolve(import.meta.dirname, "..");
const bootstrapSource = readFileSync(
  path.join(repoRoot, "public/document-language.js"),
  "utf8"
);
const runBootstrap = new Function(
  "window",
  "navigator",
  "document",
  bootstrapSource
);

function executeBootstrap({
  browserLanguage = "en-US",
  storedLocale = null,
  storageError,
  languageError,
}: {
  browserLanguage?: string;
  storedLocale?: string | null;
  storageError?: Error;
  languageError?: Error;
} = {}) {
  const documentElement = { lang: "" };
  const localStorage = {
    getItem() {
      if (storageError) {
        throw storageError;
      }
      return storedLocale;
    },
  };
  const navigator = {
    get language() {
      if (languageError) {
        throw languageError;
      }
      return browserLanguage;
    },
  };

  runBootstrap({ localStorage }, navigator, { documentElement });

  return documentElement.lang;
}

describe("document language bootstrap", () => {
  it("supports every application locale and uses the shared default", () => {
    for (const locale of Object.keys(locales)) {
      expect(executeBootstrap({ storedLocale: locale })).toBe(locale);
    }

    expect(executeBootstrap({ browserLanguage: "unsupported" })).toBe(
      defaultLocale
    );
  });

  it("prefers a supported saved locale over the browser locale", () => {
    expect(
      executeBootstrap({ storedLocale: "de", browserLanguage: "en-US" })
    ).toBe("de");
  });

  it("uses the supported browser locale when no valid preference exists", () => {
    expect(
      executeBootstrap({
        storedLocale: "unsupported",
        browserLanguage: "de-DE",
      })
    ).toBe("de");
  });

  it("uses the browser locale when storage is unavailable", () => {
    expect(
      executeBootstrap({
        browserLanguage: "de-DE",
        storageError: new Error("storage unavailable"),
      })
    ).toBe("de");
  });

  it("keeps the default locale when browser detection is unavailable", () => {
    expect(() =>
      executeBootstrap({
        storageError: new Error("storage unavailable"),
        languageError: new Error("language unavailable"),
      })
    ).not.toThrow();
    expect(
      executeBootstrap({ languageError: new Error("language unavailable") })
    ).toBe("en");
  });

  it("loads before the application bootstrap", () => {
    const indexHtml = readFileSync(path.join(repoRoot, "index.html"), "utf8");

    expect(indexHtml.indexOf("/document-language.js")).toBeGreaterThan(-1);
    expect(indexHtml.indexOf("/document-language.js")).toBeLessThan(
      indexHtml.indexOf("/src/main.tsx")
    );
  });
});
