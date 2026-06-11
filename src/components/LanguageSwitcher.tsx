// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { useLingui } from "@lingui/react";
import { activateLocale, locales, setLocalePreference } from "../i18n";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui";

export function LanguageSwitcher() {
  const { i18n } = useLingui();
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (locale: string) => {
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
    <div data-slot="app-language-switcher">
      <Select
        value={i18n.locale}
        onValueChange={(locale) => {
          void handleChange(locale);
        }}
      >
        <SelectTrigger
          aria-label="Select language"
          className="h-9 min-h-9 w-auto min-w-[7rem] px-3 py-1.5"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Object.entries(locales).map(([code, name]) => (
              <SelectItem key={code} value={code}>
                {name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
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
