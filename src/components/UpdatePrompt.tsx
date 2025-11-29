// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { Button } from "./button";
import { useServiceWorkerUpdate } from "../hooks/useServiceWorkerUpdate";

/**
 * UpdatePrompt Component
 *
 * Displays a non-intrusive banner when a new version of the PWA is available.
 * The banner is always visible when an update is available and cannot be dismissed.
 * Users can click "Update" to reload and use the latest version.
 *
 * The banner is rendered in the normal document flow (not fixed/absolute) to avoid
 * overlaying page content. It should be placed at the top of the app layout.
 *
 * @example
 * ```tsx
 * // In App.tsx - place as first child in the layout container
 * function App() {
 *   return (
 *     <div className="flex min-h-screen flex-col">
 *       <UpdatePrompt />
 *       <Header />
 *       <main>...</main>
 *     </div>
 *   );
 * }
 * ```
 */
export function UpdatePrompt() {
  const { _ } = useLingui();
  const { needRefresh, updateServiceWorker } = useServiceWorkerUpdate();

  // Only render when update is available
  if (!needRefresh) {
    return null;
  }

  return (
    <div
      className="bg-blue-600 px-4 py-2 text-white shadow-md dark:bg-blue-700"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-4">
        <p className="text-sm font-medium">
          <Trans>A new version of SecPal is available.</Trans>
        </p>
        <Button
          onClick={updateServiceWorker}
          color="white"
          className="py-1!"
          aria-label={_(msg`Update application now`)}
        >
          <Trans>Update now</Trans>
        </Button>
      </div>
    </div>
  );
}
