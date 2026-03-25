// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/macro";
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
        <Text className="mb-2 text-lg font-semibold">
          <Trans>Access Denied</Trans>
        </Text>
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
