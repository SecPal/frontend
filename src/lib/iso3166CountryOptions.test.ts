// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { getCountrySelectOptions } from "./iso3166CountryOptions";

describe("getCountrySelectOptions", () => {
  it("includes Germany with ISO code DE", () => {
    const options = getCountrySelectOptions("de");
    const de = options.find((o) => o.code === "DE");
    expect(de).toBeDefined();
    expect(de?.label.length).toBeGreaterThan(0);
  });

  it("returns a comprehensive ISO country list instead of a short fallback subset", () => {
    const options = getCountrySelectOptions("en");

    expect(options.length).toBeGreaterThan(180);
    expect(options.some((o) => o.code === "ZA")).toBe(true);
  });

  it("sorts labels for the given locale", () => {
    const options = getCountrySelectOptions("en");
    const labels = options.map((o) => o.label);
    const sorted = [...labels].sort((a, b) =>
      a.localeCompare(b, "en", { sensitivity: "base" })
    );
    expect(labels).toEqual(sorted);
  });

  it("falls back only for unsupported region codes instead of the whole list", () => {
    const originalIntl = globalThis.Intl;

    vi.stubGlobal("Intl", {
      ...originalIntl,
      DisplayNames: class MockDisplayNames {
        static supportedLocalesOf(locales?: Intl.LocalesArgument) {
          return Array.isArray(locales) ? [...locales] : locales ? [locales] : [];
        }

        of(code: string) {
          if (code === "XA" || code === "XK") {
            throw new RangeError(`Unsupported region: ${code}`);
          }

          return code === "DE" ? "Germany" : code;
        }
      } as unknown as typeof Intl.DisplayNames,
    });

    try {
      const options = getCountrySelectOptions("en");
      expect(options.find((o) => o.code === "DE")?.label).toBe("Germany");
      expect(options.find((o) => o.code === "XA")?.label).toBe("XA");
      expect(options.find((o) => o.code === "XK")?.label).toBe("XK");
    } finally {
      vi.stubGlobal("Intl", originalIntl);
    }
  });
});
