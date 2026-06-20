// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { Code2, KeyRound, Scale } from "lucide-react";
import { useState } from "react";
import { Logo } from "./Logo";
import {
  LoginButton,
  LoginCard,
  LoginCardHeader,
  LoginCardTitle,
  LoginField,
  LoginFieldGroup,
  LoginFieldLabel,
  LoginFieldSeparator,
  LoginInput,
  LoginShell,
} from "../pages/Auth/ui-lite";

interface LoginRouteVaultLockedStateProps {
  onUnlock: () => Promise<boolean>;
  onSignInAgain: () => void;
}

export function LoginRouteLoadingState() {
  const { i18n } = useLingui();

  return (
    <LoginShell data-route-guard-state="login-bootstrap-loading">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <div
          aria-hidden="true"
          className="flex h-10 min-w-[7rem] items-center gap-2 rounded-md border border-zinc-300 bg-zinc-100 px-3 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <span className="h-3 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          <span className="h-3 w-3 rounded-full bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>

      <div className="flex w-full flex-1 items-center justify-center">
        <LoginCard aria-labelledby="login-loading-title" className="relative">
          <div
            aria-busy="true"
            aria-live="polite"
            aria-label={i18n._(msg`Loading login`)}
            role="status"
          >
            <LoginFieldGroup>
              <LoginCardHeader>
                <div className="flex size-12 items-center justify-center rounded-md">
                  <Logo size="48" />
                </div>
                <LoginCardTitle id="login-loading-title">
                  <Trans id="login.title">Welcome to SecPal</Trans>
                </LoginCardTitle>
              </LoginCardHeader>

              <LoginField>
                <LoginFieldLabel htmlFor="login-loading-email">
                  <Trans id="login.email">Email address</Trans>
                </LoginFieldLabel>
                <LoginInput
                  id="login-loading-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@secpal.app"
                  disabled
                  readOnly
                  value=""
                />
              </LoginField>

              <LoginField>
                <LoginFieldLabel htmlFor="login-loading-password">
                  <Trans id="login.password">Password</Trans>
                </LoginFieldLabel>
                <LoginInput
                  id="login-loading-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled
                  readOnly
                  value=""
                />
              </LoginField>

              <LoginField>
                <LoginButton className="w-full" disabled aria-disabled="true">
                  <Trans id="login.submit">Log in</Trans>
                </LoginButton>
              </LoginField>

              <LoginFieldSeparator>
                <Trans id="login.separator">or</Trans>
              </LoginFieldSeparator>

              <LoginField>
                <LoginButton
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled
                  aria-disabled="true"
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  <Trans>Sign in with passkey</Trans>
                </LoginButton>
              </LoginField>
            </LoginFieldGroup>
          </div>
        </LoginCard>
      </div>

      <footer className="mt-4 w-full max-w-sm pb-[env(safe-area-inset-bottom,0px)] text-center text-[11px]">
        <div className="flex flex-col items-center gap-2 text-zinc-500 dark:text-zinc-400">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            <Trans>Powered by SecPal – A guard's best friend</Trans>
          </span>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center gap-1.5">
              <Scale className="h-4 w-4" aria-hidden="true" />
              <Trans>AGPL v3+</Trans>
            </span>
            <span
              className="text-zinc-300 dark:text-zinc-700"
              aria-hidden="true"
            >
              |
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Code2 className="h-4 w-4" aria-hidden="true" />
              <Trans>Source Code</Trans>
            </span>
          </div>
        </div>
      </footer>
    </LoginShell>
  );
}

export function LoginRouteVaultLockedState({
  onUnlock,
  onSignInAgain,
}: LoginRouteVaultLockedStateProps) {
  const { i18n } = useLingui();
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUnlock = async () => {
    setErrorMessage(null);
    setIsUnlocking(true);

    try {
      const unlocked = await onUnlock();

      if (!unlocked) {
        setErrorMessage(
          i18n._(
            msg`SecPal could not unlock the encrypted offline data on this device. Sign in again to rebuild the local vault.`
          )
        );
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <LoginShell data-route-guard-state="vault-locked">
      <div className="flex w-full flex-1 items-center justify-center">
        <LoginCard className="text-center">
          <LoginFieldGroup>
            <LoginCardHeader>
              <div className="flex size-12 items-center justify-center rounded-md">
                <Logo size="48" />
              </div>
              <LoginCardTitle>
                <Trans>Unlock your secure offline data</Trans>
              </LoginCardTitle>
            </LoginCardHeader>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <Trans>
                SecPal locked the local encrypted vault on this device. Unlock
                to restore previously cached offline-safe data, or sign out to
                clear the device state.
              </Trans>
            </p>
            {errorMessage ? (
              <p
                role="status"
                aria-live="polite"
                className="text-sm text-red-600 dark:text-red-400"
              >
                {errorMessage}
              </p>
            ) : null}
            <div className="flex justify-center gap-3">
              <LoginButton
                onClick={() => {
                  void handleUnlock();
                }}
                type="button"
                disabled={isUnlocking}
                aria-busy={isUnlocking}
              >
                {isUnlocking ? (
                  <Trans>Unlocking...</Trans>
                ) : (
                  <Trans>Unlock</Trans>
                )}
              </LoginButton>
              <LoginButton
                variant="outline"
                onClick={onSignInAgain}
                type="button"
              >
                <Trans>Sign out</Trans>
              </LoginButton>
            </div>
          </LoginFieldGroup>
        </LoginCard>
      </div>
    </LoginShell>
  );
}
