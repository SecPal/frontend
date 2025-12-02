// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { useLingui } from "@lingui/react";
import { activateLocale, locales, setLocalePreference } from "../i18n";
import { Select } from "./select";

export function LanguageSwitcher() {
  const { i18n } = useLingui();
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const locale = event.target.value;
    setError(null);
    try {
      await activateLocale(locale);
      setLocalePreference(locale);
    } catch (err) {
      const fallbackMessage = i18n._(
        "Failed to change language. Please try again."
      );
      setError(err instanceof Error ? err.message : fallbackMessage);
    }
  };

  return (
    <div>
      <Select
        value={i18n.locale}
        onChange={handleChange}
        aria-label="Select language"
      >
        {Object.entries(locales).map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </Select>
      {error && (
        <p
          role="alert"
          aria-live="assertive"
          className="mt-2 text-base/6 text-red-600 sm:text-sm/6 dark:text-red-500"
        >
          {error}
        </p>
      )}
    </div>
  );
}
