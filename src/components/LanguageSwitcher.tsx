// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLingui } from "@lingui/react";
import { activateLocale, locales, setLocalePreference } from "../i18n";

export function LanguageSwitcher() {
  const { i18n } = useLingui();

  const handleChange = async (locale: string) => {
    await activateLocale(locale);
    setLocalePreference(locale);
  };

  return (
    <select
      value={i18n.locale}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-md border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      aria-label="Select language"
    >
      {Object.entries(locales).map(([code, name]) => (
        <option key={code} value={code}>
          {name}
        </option>
      ))}
    </select>
  );
}
