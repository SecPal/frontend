// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState, useCallback } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Return value of useServiceWorkerUpdate hook
 */
export interface UseServiceWorkerUpdateReturn {
  /**
   * True if new service worker is waiting and ready to activate
   */
  needRefresh: boolean;

  /**
   * True if app is ready to work offline
   */
  offlineReady: boolean;

  /**
   * Trigger service worker update and reload the page
   */
  updateServiceWorker: () => Promise<void>;

  /**
   * Dismiss the update prompt without updating
   */
  close: () => void;
}

/**
 * Hook for managing PWA service worker updates
 *
 * Detects when a new version of the app is available and provides
 * methods to update or dismiss the notification.
 *
 * When user dismisses the prompt, it will reappear after 1 hour (snooze).
 * This ensures users don't stay on outdated versions indefinitely.
 *
 * @example
 * ```tsx
 * const { needRefresh, updateServiceWorker, close } = useServiceWorkerUpdate();
 *
 * if (needRefresh) {
 *   return (
 *     <Alert>
 *       <Text>New version available!</Text>
 *       <Button onClick={updateServiceWorker}>Update</Button>
 *       <Button onClick={close}>Later</Button>
 *     </Alert>
 *   );
 * }
 * ```
 */
export function useServiceWorkerUpdate(): UseServiceWorkerUpdateReturn {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);

  const {
    needRefresh: [swNeedRefresh, swSetNeedRefresh],
    offlineReady: [swOfflineReady, swSetOfflineReady],
    updateServiceWorker: swUpdate,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      console.log(`[SW] Service Worker registered: ${swUrl}`);

      // Check for updates every hour
      if (registration) {
        setInterval(
          () => {
            console.log("[SW] Checking for updates...");
            registration.update();
          },
          60 * 60 * 1000
        ); // 60 minutes
      }
    },
    onRegisterError(error) {
      console.error("[SW] Registration failed:", error);
    },
  });

  // Sync states from useRegisterSW
  useEffect(() => {
    setNeedRefresh(swNeedRefresh);
  }, [swNeedRefresh]);

  useEffect(() => {
    setOfflineReady(swOfflineReady);
  }, [swOfflineReady]);

  /**
   * Check if snooze period has expired and re-show prompt
   */
  useEffect(() => {
    if (snoozedUntil === null) return;

    const now = Date.now();
    if (now >= snoozedUntil) {
      // Snooze expired, re-enable prompt if update is still available
      setSnoozedUntil(null);
      if (swNeedRefresh) {
        setNeedRefresh(true);
        console.log("[SW] Snooze expired, showing update prompt again");
      }
      return;
    }

    // Set timeout to re-enable prompt when snooze expires
    const timeUntilSnoozeEnd = snoozedUntil - now;
    const timeout = setTimeout(() => {
      setSnoozedUntil(null);
      if (swNeedRefresh) {
        setNeedRefresh(true);
        console.log("[SW] Snooze expired, showing update prompt again");
      }
    }, timeUntilSnoozeEnd);

    return () => clearTimeout(timeout);
  }, [snoozedUntil, swNeedRefresh]);

  /**
   * Override needRefresh to hide during snooze period
   */
  const effectiveNeedRefresh = needRefresh && snoozedUntil === null;

  /**
   * Update service worker and reload the page
   */
  const updateServiceWorker = useCallback(async () => {
    try {
      await swUpdate(true); // true = reload page after update
      console.log("[SW] Service Worker updated and reloading...");
    } catch (error) {
      console.error("[SW] Update failed:", error);
    }
  }, [swUpdate]);

  /**
   * Dismiss the update prompt without updating
   * Sets a 1-hour snooze period, after which the prompt will reappear
   */
  const close = useCallback(() => {
    const snoozeTime = 60 * 60 * 1000; // 1 hour
    const snoozeUntil = Date.now() + snoozeTime;
    setSnoozedUntil(snoozeUntil);
    setNeedRefresh(false);
    console.log(
      `[SW] Update prompt snoozed for 1 hour (until ${new Date(snoozeUntil).toLocaleTimeString()})`
    );
  }, []);

  return {
    needRefresh: effectiveNeedRefresh,
    offlineReady,
    updateServiceWorker,
    close,
  };
}
