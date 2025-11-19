// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/button";
import { XMarkIcon, BellIcon } from "@heroicons/react/24/outline";

/**
 * Non-intrusive notification permission prompt
 * Appears as a banner when notification permission is in "default" state
 *
 * @example
 * ```tsx
 * <NotificationPermissionPrompt />
 * ```
 */
export function NotificationPermissionPrompt() {
  const {
    permission,
    isSupported,
    requestPermission,
    showNotification,
    isLoading,
  } = useNotifications();
  const [isDismissed, setIsDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Don't show if:
  // - Already granted or denied
  // - Not supported
  // - User dismissed it
  if (!isSupported || permission !== "default" || isDismissed) {
    return null;
  }

  const handleEnable = async () => {
    setError(null);
    try {
      const result = await requestPermission();

      if (result === "granted") {
        // Show test notification
        try {
          await showNotification({
            title: "Notifications Enabled",
            body: "You'll now receive important updates from SecPal",
          });
          setIsDismissed(true);
        } catch (notifErr) {
          // Keep prompt visible to show error
          setError(
            notifErr instanceof Error
              ? notifErr.message
              : "Failed to show test notification"
          );
        }
      } else if (result === "denied") {
        // User denied, just hide the prompt
        setIsDismissed(true);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to enable notifications"
      );
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-4 border border-gray-200 dark:border-gray-700 z-50"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <BellIcon className="h-6 w-6 text-blue-500" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Enable Notifications
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Stay updated with important alerts and security notifications.
          </p>
          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              onClick={handleEnable}
              disabled={isLoading}
              className="text-sm"
            >
              {isLoading ? "Enabling..." : "Enable"}
            </Button>
            <Button
              onClick={handleDismiss}
              disabled={isLoading}
              className="text-sm"
              color="zinc"
            >
              Not Now
            </Button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Dismiss notification prompt"
        >
          <XMarkIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
