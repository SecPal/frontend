// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect } from "react";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { ChevronDown, WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/ui";
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
          className="border-amber-500/30 bg-background text-foreground hover:bg-accent focus:ring-ring/50 focus:ring-offset-background flex h-10 w-10 items-center justify-center rounded-full border shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2"
          aria-label={_(msg`You're offline. Click for details.`)}
        >
          <WifiOff className="h-5 w-5" aria-hidden="true" />
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
      <Alert
        role="presentation"
        className="grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 border-amber-500/30 bg-amber-500/10 shadow-lg [&>svg+div]:translate-y-0 [&>svg]:static [&>svg]:mt-0.5 [&>svg~*]:pl-0"
      >
        <WifiOff className="text-foreground h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <AlertTitle className="text-foreground text-sm font-semibold">
            <Trans>You're offline</Trans>
          </AlertTitle>
          <AlertDescription className="mt-1 text-xs">
            <Trans>
              Some features may be limited. Your changes will sync when you're
              back online.
            </Trans>
          </AlertDescription>
        </div>
        <button
          type="button"
          onClick={() => setIsMinimized(true)}
          className="text-foreground hover:bg-accent focus:ring-ring/50 self-start shrink-0 rounded p-1 transition-colors focus:outline-none focus:ring-2"
          aria-label={_(msg`Minimize offline notice`)}
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
      </Alert>
    </div>
  );
}
