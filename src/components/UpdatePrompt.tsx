// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { Button } from "./button";
import { useServiceWorkerUpdate } from "../hooks/useServiceWorkerUpdate";

/**
 * UpdatePrompt Component
 *
 * Displays a notification when a new version of the PWA is available.
 * Users can choose to update immediately or dismiss the prompt.
 *
 * This component automatically appears when the service worker detects
 * a new version and disappears after user interaction.
 *
 * @example
 * ```tsx
 * // In App.tsx
 * function App() {
 *   return (
 *     <>
 *       <UpdatePrompt />
 *       <Router />
 *     </>
 *   );
 * }
 * ```
 */
export function UpdatePrompt() {
  const { _ } = useLingui();
  const { needRefresh, updateServiceWorker, close } = useServiceWorkerUpdate();

  // Only render when update is available
  if (!needRefresh) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 max-w-md rounded-lg bg-white p-6 shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-950 dark:text-white">
            <Trans>New version available</Trans>
          </h3>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Trans>
              A new version of SecPal is ready. Click "Update" to reload and use
              the latest version.
            </Trans>
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={updateServiceWorker}
            color="blue"
            aria-label={_(msg`Update application now`)}
          >
            <Trans>Update</Trans>
          </Button>
          <Button
            onClick={close}
            plain
            aria-label={_(msg`Dismiss update notification`)}
          >
            <Trans>Later</Trans>
          </Button>
        </div>
      </div>
    </div>
  );
}
