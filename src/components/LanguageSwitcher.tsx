// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { useLingui } from "@lingui/react";
import { activateLocale, locales, setLocalePreference } from "../i18n";

export function LanguageSwitcher() {
  const { i18n } = useLingui();
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (locale: string) => {
    setError(null);
    try {
      await activateLocale(locale);
      setLocalePreference(locale);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to change language. Please try again."
      );
    }
  };

  return (
    <div>
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
      {error && (
        <div
          role="alert"
          className="mt-2 text-sm text-red-600"
          aria-live="assertive"
        >
          {error}
        </div>
      )}
    </div>
  );
}
