// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { i18n } from "@lingui/core";

export const locales = {
  en: "English",
  de: "Deutsch",
};

export const defaultLocale = "en";

export async function activateLocale(locale: string) {
  const { messages } = await import(`./locales/${locale}/messages.po`);
  i18n.load(locale, messages);
  i18n.activate(locale);
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
  localStorage.setItem("secpal-locale", locale);
}
