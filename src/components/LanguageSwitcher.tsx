// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { useLingui } from "@lingui/react";
import { Alert, AlertDescription } from "@/ui/alert";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
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
        <Alert className="mt-2 border-destructive/30 bg-destructive/10 text-foreground">
          <AlertDescription className="text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
