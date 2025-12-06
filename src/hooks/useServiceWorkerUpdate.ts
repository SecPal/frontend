// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState, useCallback, useRef } from "react";
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
}

/**
 * Hook for managing PWA service worker updates
 *
 * Detects when a new version of the app is available and provides
 * a method to update. The update banner is always visible when an
 * update is available - it cannot be dismissed.
 *
 * @example
 * ```tsx
 * const { needRefresh, updateServiceWorker } = useServiceWorkerUpdate();
 *
 * if (needRefresh) {
 *   return (
 *     <Alert>
 *       <Text>New version available!</Text>
 *       <Button onClick={updateServiceWorker}>Update</Button>
 *     </Alert>
 *   );
 * }
 * ```
 */
export function useServiceWorkerUpdate(): UseServiceWorkerUpdateReturn {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  // Track interval ID for cleanup
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  const {
    needRefresh: [swNeedRefresh],
    offlineReady: [swOfflineReady],
    updateServiceWorker: swUpdate,
  } = useRegisterSW({
    onRegisteredSW(swUrl: string, registration?: ServiceWorkerRegistration) {
      console.log(`[SW] Service Worker registered: ${swUrl}`);

      // Check for updates every hour
      if (registration) {
        // Clear any existing interval before creating a new one
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current);
        }

        intervalIdRef.current = setInterval(
          () => {
            console.log("[SW] Checking for updates...");
            registration.update();
          },
          60 * 60 * 1000
        ); // 60 minutes
      }
    },
    onRegisterError(error: unknown) {
      console.error("[SW] Registration failed:", error);
    },
  });

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, []);

  // Sync states from useRegisterSW
  useEffect(() => {
    setNeedRefresh(swNeedRefresh);
  }, [swNeedRefresh]);

  useEffect(() => {
    setOfflineReady(swOfflineReady);
  }, [swOfflineReady]);

  /**
   * Update service worker and reload the page
   */
  const updateServiceWorker = useCallback(async () => {
    console.log("[SW Hook] updateServiceWorker called");
    try {
      console.log("[SW Hook] Calling swUpdate(true)...");
      await swUpdate(true); // true = reload page after update
      console.log("[SW Hook] swUpdate completed, reloading...");
    } catch (error) {
      console.error("[SW Hook] Update failed:", error);
      // Force reload as fallback
      console.log("[SW Hook] Forcing page reload as fallback");
      window.location.reload();
    }
  }, [swUpdate]);

  return {
    needRefresh,
    offlineReady,
    updateServiceWorker,
  };
}
