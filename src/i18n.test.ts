// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { i18n } from "@lingui/core";
import { activateLocale, defaultLocale } from "./i18n";

describe("i18n catalog loading", () => {
  it("keeps locale catalog loading on a single static path", async () => {
    const source = await readFile(
      resolve(process.cwd(), "src/i18n.ts"),
      "utf8"
    );

    expect(source).not.toContain("await import(");
  });

  it("activates supported locales and falls back to the default locale", async () => {
    await activateLocale("de");
    expect(i18n.locale).toBe("de");

    await activateLocale("unsupported");
    expect(i18n.locale).toBe(defaultLocale);
  });
});
