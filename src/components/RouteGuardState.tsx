// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { msg } from "@lingui/core/macro";
import { useEffect, useState } from "react";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/ui/alert";
import { Button } from "@/ui/button";
import { buttonVariants } from "@/ui/styles";
import { AuthApiError } from "../services/AuthApiError";
import { RouteLoader } from "./RouteLoader";

interface RouteBootstrapRecoveryStateProps {
  onRetry: () => void;
  onSignInAgain: () => void;
  reason: "timeout" | "network";
}

interface RouteVaultLockedStateProps {
  onUnlock: () => Promise<boolean>;
  onSignInAgain: () => void;
}

interface RoutePrivacyShieldStateProps {
  onDismiss: () => void;
  children?: React.ReactNode;
  isActive?: boolean;
}

interface RouteEmailVerificationStateProps {
  email: string;
  onRetry: () => void;
  onSignInAgain: () => void;
}

async function loadAuthAccountApiModule() {
  return await import("../services/authAccountApi");
}

export function RouteLoadingState() {
  return <RouteLoader />;
}

export function RouteBootstrapRecoveryState({
  onRetry,
  onSignInAgain,
  reason,
}: RouteBootstrapRecoveryStateProps) {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      data-route-guard-state="bootstrap-recovery"
    >
      <div className="max-w-md text-center">
        <h1 className="mb-2 text-lg font-semibold">
          <Trans>Still loading your secure session</Trans>
        </h1>
        <p className="text-muted-foreground text-base/6 sm:text-sm/6">
          {reason === "timeout" ? (
            <Trans>
              SecPal could not confirm your session quickly enough. Retry the
              session check or return to the login screen.
            </Trans>
          ) : (
            <Trans>
              SecPal could not confirm your session because the session check
              failed. Retry the session check or return to the login screen.
            </Trans>
          )}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={onRetry} type="button">
            <Trans>Retry</Trans>
          </Button>
          <Button variant="outline" onClick={onSignInAgain} type="button">
            <Trans>Go to Login</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RouteVaultLockedState({
  onUnlock,
  onSignInAgain,
}: RouteVaultLockedStateProps) {
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
    <div
      className="flex min-h-screen items-center justify-center p-4"
      data-route-guard-state="vault-locked"
    >
      <div className="max-w-md text-center">
        <h1 className="mb-2 text-lg font-semibold">
          <Trans>Unlock your secure offline data</Trans>
        </h1>
        <p className="text-muted-foreground text-base/6 sm:text-sm/6">
          <Trans>
            SecPal locked the local encrypted vault on this device. Unlock to
            restore previously cached offline-safe data, or sign out to clear
            the device state.
          </Trans>
        </p>
        <div role="status" aria-live="polite" aria-atomic="true">
          {errorMessage ? (
            <p className="text-destructive mt-4 text-sm">{errorMessage}</p>
          ) : null}
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <Button
            onClick={() => {
              void handleUnlock();
            }}
            type="button"
            disabled={isUnlocking}
            aria-busy={isUnlocking}
          >
            {isUnlocking ? <Trans>Unlocking...</Trans> : <Trans>Unlock</Trans>}
          </Button>
          <Button variant="outline" onClick={onSignInAgain} type="button">
            <Trans>Sign out</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RoutePrivacyShieldState({
  onDismiss,
  children,
  isActive = true,
}: RoutePrivacyShieldStateProps) {
  useEffect(() => {
    if (!isActive || typeof document === "undefined") {
      return;
    }

    const overlayMarker = document.querySelector(
      '[data-route-guard-overlay="privacy-shield"]'
    );
    const overlayContainer = overlayMarker;

    if (!(overlayContainer instanceof HTMLElement)) {
      return;
    }

    const hiddenSiblings = Array.from(document.body.children).filter(
      (element) => element !== overlayContainer
    );
    const previousState = hiddenSiblings.map((element) => ({
      element,
      ariaHidden: element.getAttribute("aria-hidden"),
      hadInert: element.hasAttribute("inert"),
    }));

    for (const element of hiddenSiblings) {
      element.setAttribute("aria-hidden", "true");
      element.setAttribute("inert", "");
    }

    return () => {
      for (const { element, ariaHidden, hadInert } of previousState) {
        if (ariaHidden === null) {
          element.removeAttribute("aria-hidden");
        } else {
          element.setAttribute("aria-hidden", ariaHidden);
        }

        if (hadInert) {
          element.setAttribute("inert", "");
        } else {
          element.removeAttribute("inert");
        }
      }
    };
  }, [isActive]);

  const overlayContent = (
    <div
      data-route-guard-overlay="privacy-shield"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-shield-title"
      onKeyDownCapture={(event) => {
        if (event.key !== "Tab") {
          return;
        }

        const dismissButton = event.currentTarget.querySelector("button");

        if (!(dismissButton instanceof HTMLButtonElement)) {
          return;
        }

        event.preventDefault();
        dismissButton.focus();
      }}
    >
      <div
        className="w-full max-w-md text-center"
        data-route-guard-state="privacy-shield"
      >
        <h1 id="privacy-shield-title" className="mb-2 text-lg font-semibold">
          <Trans>Privacy Shield</Trans>
        </h1>
        <p className="text-muted-foreground text-base/6 sm:text-sm/6">
          <Trans>
            SecPal is visually shielding this screen. The encrypted offline
            vault stays unlocked until you lock it explicitly.
          </Trans>
        </p>
        <div className="mt-6 flex justify-center">
          <Button autoFocus onClick={onDismiss} type="button">
            <Trans>Show app</Trans>
          </Button>
        </div>
      </div>
    </div>
  );

  if (children !== undefined) {
    return (
      <div
        className={isActive ? "relative min-h-screen" : undefined}
        data-route-guard-state={isActive ? "privacy-shield" : undefined}
      >
        <div
          aria-hidden={isActive ? "true" : undefined}
          inert={isActive ? true : undefined}
          className={isActive ? "pointer-events-none select-none" : undefined}
        >
          {children}
        </div>
        {isActive && typeof document !== "undefined"
          ? createPortal(overlayContent, document.body)
          : null}
      </div>
    );
  }

  if (!isActive) {
    return null;
  }

  return typeof document !== "undefined"
    ? createPortal(overlayContent, document.body)
    : overlayContent;
}

export function RouteEmailVerificationState({
  email,
  onRetry,
  onSignInAgain,
}: RouteEmailVerificationStateProps) {
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSendVerificationEmail = async () => {
    setStatusMessage(null);
    setErrorMessage(null);
    setIsSending(true);

    try {
      const { sendVerificationNotification } = await loadAuthAccountApiModule();
      const response = await sendVerificationNotification();
      setStatusMessage(response.message);
    } catch (error) {
      if (error instanceof AuthApiError || error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(
          "We could not send a new verification email. Please try again."
        );
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-xl text-center">
        <h1 className="mb-2 text-lg font-semibold">
          <Trans>Verify your email address</Trans>
        </h1>
        <p className="text-muted-foreground text-base/6 sm:text-sm/6">
          <Trans>
            SecPal signed you in as {email}, but this account cannot access the
            protected app until the email address is verified.
          </Trans>
        </p>
        <p className="text-muted-foreground mt-2 text-base/6 sm:text-sm/6">
          <Trans>
            Open the verification email, then return here and check again. If
            the message is missing, request a new verification email below.
          </Trans>
        </p>

        {statusMessage ? (
          <Alert
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mt-4 border-emerald-500/30 bg-emerald-500/10 text-foreground"
          >
            <AlertDescription className="text-foreground">
              {statusMessage}
            </AlertDescription>
          </Alert>
        ) : null}

        {errorMessage ? (
          <Alert
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="mt-4"
          >
            <AlertDescription className="text-destructive">
              {errorMessage}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={onRetry} type="button">
            <Trans>I have verified my email</Trans>
          </Button>
          <Button
            variant="outline"
            onClick={handleSendVerificationEmail}
            type="button"
            disabled={isSending}
            aria-busy={isSending}
          >
            {isSending ? (
              <Trans>Sending verification email...</Trans>
            ) : (
              <Trans>Send verification email again</Trans>
            )}
          </Button>
          <Button variant="outline" onClick={onSignInAgain} type="button">
            <Trans>Go to Login</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RouteAccessDeniedState() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md text-center">
        <h1 className="mb-2 text-lg font-semibold">
          <Trans>Access Denied</Trans>
        </h1>
        <p className="text-muted-foreground text-base/6 sm:text-sm/6">
          <Trans>
            You do not have permission to access this feature. Contact your
            administrator if you believe this is an error.
          </Trans>
        </p>
      </div>
    </div>
  );
}

export function RouteNotFoundState() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <div className="max-w-md text-center">
        <h1 className="mb-2 text-lg font-semibold">
          <Trans>Page Not Found</Trans>
        </h1>
        <p className="text-muted-foreground text-base/6 sm:text-sm/6">
          <Trans>
            The page you requested does not exist or is no longer available.
          </Trans>
        </p>
        <div className="mt-6 flex justify-center">
          <Link to="/" className={buttonVariants({ variant: "outline" })}>
            <Trans>Back to Home</Trans>
          </Link>
        </div>
      </div>
    </div>
  );
}
