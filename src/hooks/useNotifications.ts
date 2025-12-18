// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback } from "react";

export type NotificationPermissionState = "default" | "granted" | "denied";

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: Record<string, unknown>;
}

interface UseNotificationsReturn {
  permission: NotificationPermissionState;
  isSupported: boolean;
  requestPermission: () => Promise<NotificationPermissionState>;
  showNotification: (options: NotificationOptions) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for managing push notifications in the app
 * Handles permission requests, subscription management, and notification display
 *
 * @example
 * ```tsx
 * const { permission, requestPermission, showNotification } = useNotifications();
 *
 * const handleSubscribe = async () => {
 *   const state = await requestPermission();
 *   if (state === "granted") {
 *     await showNotification({
 *       title: "Welcome!",
 *       body: "You'll now receive important updates"
 *     });
 *   }
 * };
 * ```
 */
export function useNotifications(): UseNotificationsReturn {
  const [permission, setPermission] =
    useState<NotificationPermissionState>("default");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Check if notifications are supported
  const isSupported =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator;

  // Initialize permission state
  useEffect(() => {
    if (isSupported) {
      setPermission(Notification.permission);
    }
    // Note: Permission changes are rare (user must manually change in browser settings)
    // We don't poll for changes to avoid performance overhead
    // Permission state is updated after requestPermission() is called
  }, [isSupported]);

  /**
   * Request notification permission from the user
   */
  const requestPermission =
    useCallback(async (): Promise<NotificationPermissionState> => {
      if (!isSupported) {
        const err = new Error(
          "Notifications are not supported in this browser"
        );
        setError(err);
        throw err;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await Notification.requestPermission();
        setPermission(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    }, [isSupported]);

  /**
   * Show a notification to the user
   * Falls back to browser notification if service worker is unavailable
   */
  const showNotification = useCallback(
    async (options: NotificationOptions): Promise<void> => {
      if (!isSupported) {
        throw new Error("Notifications are not supported");
      }

      if (permission !== "granted") {
        throw new Error("Notification permission not granted");
      }

      setIsLoading(true);
      setError(null);

      try {
        // Try to use service worker notification first (preferred)
        const registration = await navigator.serviceWorker.ready;

        if (registration && registration.showNotification) {
          await registration.showNotification(options.title, {
            body: options.body,
            icon: options.icon || "/pwa-192x192.png",
            badge: options.badge || "/pwa-192x192.png",
            tag: options.tag,
            requireInteraction: options.requireInteraction,
            data: options.data,
          });
        } else {
          // Fallback to regular notification
          new Notification(options.title, {
            body: options.body,
            icon: options.icon || "/pwa-192x192.svg",
            tag: options.tag,
            requireInteraction: options.requireInteraction,
            data: options.data,
          });
        }
      } catch (err) {
        // Handle specific notification errors
        const error = err instanceof Error ? err : new Error(String(err));

        if (error.name === "SecurityError") {
          console.error(
            "Notification failed due to security error (cross-origin or insecure context):",
            error
          );
        } else if (error.name === "NotAllowedError") {
          console.error(
            "Notification blocked by user or browser policy:",
            error
          );
        }

        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [isSupported, permission]
  );

  return {
    permission,
    isSupported,
    requestPermission,
    showNotification,
    isLoading,
    error,
  };
}
