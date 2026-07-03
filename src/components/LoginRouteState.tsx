// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import {
  LoginHeaderControls,
  LoginTopControlsSkeleton,
} from "./LoginLegalMenu";
import { Logo } from "./Logo";
import {
  Alert,
  AlertDescription,
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
} from "@/ui";

interface LoginRouteVaultLockedStateProps {
  onUnlock: () => Promise<boolean>;
  onSignInAgain: () => void;
}

function LoginRouteFooter() {
  return (
    <footer className="mt-auto w-full max-w-sm pt-3 pb-[var(--app-footer-padding-bottom)] text-center text-xs">
      <div className="text-muted-foreground">
        <span className="text-foreground inline-block text-xs font-semibold">
          <Trans>Powered by SecPal – A guard's best friend</Trans>
        </span>
      </div>
    </footer>
  );
}

export function LoginRouteLoadingState() {
  const { i18n } = useLingui();

  return (
    <LoginShell
      data-route-guard-state="login-bootstrap-loading"
      className="pb-0 md:pb-0"
    >
      <LoginTopControlsSkeleton />

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

      <LoginRouteFooter />
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
      <LoginHeaderControls />

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
            <p className="text-muted-foreground text-sm">
              <Trans>
                SecPal locked the local encrypted vault on this device. Unlock
                to restore previously cached offline-safe data, or sign out to
                clear the device state.
              </Trans>
            </p>
            {errorMessage ? (
              <Alert
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="border-destructive/30 bg-destructive/10 text-foreground"
              >
                <AlertDescription className="text-destructive">
                  {errorMessage}
                </AlertDescription>
              </Alert>
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

      <LoginRouteFooter />
    </LoginShell>
  );
}
