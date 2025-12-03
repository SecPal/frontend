// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect } from "react";
import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { SignalSlashIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

/** Time in milliseconds before the banner auto-minimizes */
const AUTO_MINIMIZE_DELAY = 5000;

/**
 * Component that displays a non-blocking banner when the user is offline.
 *
 * The banner auto-minimizes to a small icon after 5 seconds to avoid
 * obstructing the user's workflow. Users can click the icon to expand
 * the full message again.
 *
 * @example
 * ```tsx
 * // In App.tsx - place outside main content
 * function App() {
 *   return (
 *     <>
 *       <main>...</main>
 *       <OfflineIndicator />
 *     </>
 *   );
 * }
 * ```
 */
export function OfflineIndicator() {
  const { _ } = useLingui();
  const isOnline = useOnlineStatus();
  const [isMinimized, setIsMinimized] = useState(false);

  // Reset to expanded when online status changes to offline
  const [wasOnline, setWasOnline] = useState(isOnline);
  if (isOnline !== wasOnline) {
    setWasOnline(isOnline);
    if (!isOnline) {
      // Going offline - reset to expanded state
      setIsMinimized(false);
    }
  }

  // Auto-minimize after delay when offline
  useEffect(() => {
    if (isOnline || isMinimized) {
      return;
    }

    const timer = setTimeout(() => {
      setIsMinimized(true);
    }, AUTO_MINIMIZE_DELAY);

    return () => clearTimeout(timer);
  }, [isOnline, isMinimized]);

  if (isOnline) {
    return null;
  }

  // Minimized state: just the icon button
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-600 text-white shadow-lg transition-transform hover:scale-110 hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 dark:bg-amber-700 dark:hover:bg-amber-600"
          aria-label={_(msg`You're offline. Click for details.`)}
        >
          <SignalSlashIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  // Expanded state: full banner
  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-auto sm:max-w-sm"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-center gap-3 rounded-lg bg-amber-600 px-4 py-3 text-white shadow-lg dark:bg-amber-700">
        <SignalSlashIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-semibold">
            <Trans>You're offline</Trans>
          </p>
          <p className="text-xs text-amber-100">
            <Trans>
              Some features may be limited. Your changes will sync when you're
              back online.
            </Trans>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsMinimized(true)}
          className="ml-2 rounded p-1 text-amber-200 transition-colors hover:bg-amber-500 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
          aria-label={_(msg`Minimize offline notice`)}
        >
          <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
