// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@lingui/core";
import { activateLocale, defaultLocale, initializeLocale } from "./i18n";

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it("keeps the document language in sync with the active locale", async () => {
    await activateLocale("de");
    expect(document.documentElement).toHaveAttribute("lang", "de");

    await activateLocale("unsupported");
    expect(document.documentElement).toHaveAttribute("lang", defaultLocale);
  });

  it("reports locale activation failures during initialization", () => {
    const error = new Error("catalog activation failed");
    vi.spyOn(i18n, "load").mockImplementationOnce(() => {
      throw error;
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    initializeLocale();

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to initialize i18n locale:",
      error
    );
  });
});
