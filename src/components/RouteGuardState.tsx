// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/macro";
import { Button } from "./button";
import { Text } from "./text";

interface RouteBootstrapRecoveryStateProps {
  onRetry: () => void;
  onSignInAgain: () => void;
  reason: "timeout" | "network";
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
      <div className="max-w-md text-center" role="alert" aria-live="polite">
        <h1 className="mb-2 text-lg font-semibold">
          <Trans>Still loading your secure session</Trans>
        </h1>
        <Text className="text-zinc-500 dark:text-zinc-400">
          {reason === "timeout" ? (
            <Trans>
              SecPal could not confirm your Android session quickly enough.
              Retry the secure session check or return to the login screen.
            </Trans>
          ) : (
            <Trans>
              SecPal could not confirm your Android session because the session
              check failed. Retry the secure session check or return to the
              login screen.
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
