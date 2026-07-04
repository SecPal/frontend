// SPDX-FileCopyrightText: 2025 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { i18n } from "@lingui/core";
import { messages as deMessages } from "./locales/de/messages.mjs";
import { messages as enMessages } from "./locales/en/messages.mjs";

export const locales = {
  en: "English",
  de: "Deutsch",
} as const;

export type Locale = keyof typeof locales;

export const defaultLocale: Locale = "en";

const localeMessages = {
  de: deMessages,
  en: enMessages,
} satisfies Record<Locale, Record<string, string | string[]>>;

i18n.load(defaultLocale, localeMessages[defaultLocale]);
i18n.activate(defaultLocale);

export async function activateLocale(locale: string) {
  const selectedLocale: Locale =
    locale in locales ? (locale as Locale) : defaultLocale;
  i18n.load(selectedLocale, localeMessages[selectedLocale]);
  i18n.activate(selectedLocale);
}

// Detect locale from browser or localStorage
export function detectLocale(): string {
  // Check localStorage first (with safety check)
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("secpal-locale");
      if (stored && stored in locales) {
        return stored;
      }
    }
  } catch (error) {
    // localStorage might be blocked or unavailable
    console.warn("localStorage access failed:", error);
  }

  // Fall back to browser language
  try {
    if (typeof navigator !== "undefined" && navigator.language) {
      const browserLang = navigator.language.split("-")[0];
      if (browserLang && browserLang in locales) {
        return browserLang;
      }
    }
  } catch (error) {
    // navigator might be unavailable
    console.warn("navigator access failed:", error);
  }

  return defaultLocale;
}

// Save locale preference
export function setLocalePreference(locale: string) {
  // Only save valid locales
  if (locale in locales) {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("secpal-locale", locale);
      }
    } catch (error) {
      // localStorage might be blocked or unavailable
      console.warn("Failed to save locale preference:", error);
    }
  }
}
