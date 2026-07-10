// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { Code2, FileText, Languages, Scale, Shield } from "lucide-react";
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { PrefetchLink } from "@/components/PrefetchLink";
import { activateLocale, locales, setLocalePreference } from "@/i18n";
import {
  Button,
  LoginFieldError,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

interface LoginLegalMenuProps {
  sourceReturnTo?: string;
}

export function LoginLegalMenu({
  sourceReturnTo: preservedSourceReturnTo,
}: LoginLegalMenuProps = {}) {
  const location = useLocation();
  const sourceReturnTo =
    preservedSourceReturnTo ??
    `${location.pathname}${location.search}${location.hash}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="border-input bg-background text-foreground w-auto justify-start gap-2 px-3 text-base font-normal whitespace-nowrap shadow-xs hover:bg-accent hover:text-accent-foreground md:text-sm dark:bg-background dark:hover:bg-accent"
        >
          <Scale className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Trans>Legal</Trans>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-fit min-w-fit">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <Trans>Legal pages</Trans>
          </DropdownMenuLabel>
          <DropdownMenuItem disabled>
            <FileText />
            <Trans>Imprint</Trans>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Shield />
            <Trans>Privacy</Trans>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <Trans>Open Source</Trans>
          </DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <PrefetchLink to="/source" state={{ sourceReturnTo }}>
              <Code2 />
              <Trans>Source Code</Trans>
            </PrefetchLink>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LoginTopControls({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute top-[calc(1rem+var(--app-safe-area-inset-top))] inset-x-4 flex items-start justify-between gap-2 sm:top-[calc(1.5rem+var(--app-safe-area-inset-top))] sm:inset-x-6">
      {children}
    </div>
  );
}

export function LoginLanguageSwitcher() {
  const { _, i18n } = useLingui();
  const [error, setError] = useState<string | null>(null);

  const handleValueChange = async (locale: string) => {
    setError(null);

    try {
      await activateLocale(locale);
      setLocalePreference(locale);
    } catch {
      setError(_(msg`Failed to change language. Please try again.`));
    }
  };

  return (
    <div>
      <Select
        value={i18n.locale}
        onValueChange={(locale) => {
          void handleValueChange(locale);
        }}
      >
        <SelectTrigger
          aria-label={_(msg`Select language`)}
          className="w-auto justify-start [&>[data-slot='select-trigger-icon']]:hidden"
        >
          <Languages aria-hidden="true" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent
          className="w-fit min-w-fit"
          viewportClassName="h-auto w-fit min-w-0"
        >
          <SelectGroup>
            <SelectLabel>{_(msg`Language`)}</SelectLabel>
            {Object.entries(locales).map(([code, name]) => (
              <SelectItem key={code} value={code} hideIndicator>
                {name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {error ? (
        <LoginFieldError role="alert" aria-live="assertive" className="mt-2">
          {error}
        </LoginFieldError>
      ) : null}
    </div>
  );
}

export function LoginHeaderControls() {
  return (
    <LoginTopControls>
      <LoginLegalMenu />
      <LoginLanguageSwitcher />
    </LoginTopControls>
  );
}

export function LoginTopControlsSkeleton() {
  return (
    <LoginTopControls>
      <div
        aria-hidden="true"
        className="border-input bg-muted flex h-10 min-w-[8rem] items-center gap-2 rounded-md border px-3"
      >
        <span className="bg-border h-3 flex-1 rounded-full" />
        <span className="bg-border h-3 w-3 rounded-full" />
      </div>
      <div
        aria-hidden="true"
        className="border-input bg-muted flex h-10 min-w-[7rem] items-center gap-2 rounded-md border px-3"
      >
        <span className="bg-border h-3 flex-1 rounded-full" />
        <span className="bg-border h-3 w-3 rounded-full" />
      </div>
    </LoginTopControls>
  );
}
