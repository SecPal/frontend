// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Trans } from "@lingui/macro";
import {
  AuthApiError,
  sendVerificationNotification,
} from "../services/authApi";
import { Button } from "./button";
import { Text } from "./text";

interface RouteBootstrapRecoveryStateProps {
  onRetry: () => void;
  onSignInAgain: () => void;
  reason: "timeout" | "network";
}

interface RouteEmailVerificationStateProps {
  email: string;
  onRetry: () => void;
  onSignInAgain: () => void;
}

export function RouteLoadingState() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="text-lg">
        <Trans>Loading...</Trans>
      </div>
    </div>
  );
}

export function RouteBootstrapRecoveryState({
  onRetry,
  onSignInAgain,
  reason,
}: RouteBootstrapRecoveryStateProps) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md text-center" role="status" aria-live="polite">
        <h1 className="mb-2 text-lg font-semibold">
          <Trans>Still loading your secure session</Trans>
        </h1>
        <Text className="text-zinc-500 dark:text-zinc-400">
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
        </Text>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={onRetry} type="button">
            <Trans>Retry</Trans>
          </Button>
          <Button outline onClick={onSignInAgain} type="button">
            <Trans>Go to Login</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
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
        <Text className="text-zinc-500 dark:text-zinc-400">
          <Trans>
            SecPal signed you in as {email}, but this account cannot access the
            protected app until the email address is verified.
          </Trans>
        </Text>
        <Text className="mt-2 text-zinc-500 dark:text-zinc-400">
          <Trans>
            Open the verification email, then return here and check again. If
            the message is missing, request a new verification email below.
          </Trans>
        </Text>

        <div role="status" aria-live="polite">
          {statusMessage ? (
            <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400">
              {statusMessage}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={onRetry} type="button">
            <Trans>I have verified my email</Trans>
          </Button>
          <Button
            outline
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
          <Button outline onClick={onSignInAgain} type="button">
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
        <Text className="text-zinc-500 dark:text-zinc-400">
          <Trans>
            You do not have permission to access this feature. Contact your
            administrator if you believe this is an error.
          </Trans>
        </Text>
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
        <Text className="text-zinc-500 dark:text-zinc-400">
          <Trans>
            The page you requested does not exist or is no longer available.
          </Trans>
        </Text>
        <div className="mt-6 flex justify-center">
          <Button href="/" outline>
            <Trans>Back to Home</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
}
