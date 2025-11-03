// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { i18n } from "@lingui/core";

export const locales = {
  en: "English",
  de: "Deutsch",
};

export const defaultLocale = "en";

export async function activateLocale(locale: string) {
  // Validate locale; fallback to defaultLocale if invalid
  const selectedLocale = locale in locales ? locale : defaultLocale;

  try {
    // Use dynamic import with template literal for scalability
    const messagesModule: { messages: Record<string, string | string[]> } =
      await import(`./locales/${selectedLocale}/messages.js`);

    i18n.load(selectedLocale, messagesModule.messages);
    i18n.activate(selectedLocale);
  } catch (error) {
    console.error(`Failed to load locale "${selectedLocale}":`, error);
    // Fallback to default locale if not already tried
    if (selectedLocale !== defaultLocale) {
      try {
        const messagesModule = await import("./locales/en/messages.js");
        i18n.load(defaultLocale, messagesModule.messages);
        i18n.activate(defaultLocale);
      } catch (fallbackError) {
        console.error("Failed to load default locale:", fallbackError);
      }
    }
  }
}

// Detect locale from browser or localStorage
export function detectLocale(): string {
  // Check localStorage first
  const stored = localStorage.getItem("secpal-locale");
  if (stored && stored in locales) {
    return stored;
  }

  // Fall back to browser language
  const browserLang = navigator.language.split("-")[0];
  if (browserLang && browserLang in locales) {
    return browserLang;
  }

  return defaultLocale;
}

// Save locale preference
export function setLocalePreference(locale: string) {
  // Only save valid locales
  if (locale in locales) {
    localStorage.setItem("secpal-locale", locale);
  }
}
