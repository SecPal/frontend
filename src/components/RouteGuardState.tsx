// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/macro";
import { Button } from "./button";
import { Text } from "./text";

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
