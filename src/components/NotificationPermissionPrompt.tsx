// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { NotificationInstallationsApiError } from "@/services/notificationInstallationsApi";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/button";
import { XMarkIcon, BellIcon } from "@heroicons/react/24/outline";

function getPromptErrorMessage(
  error: unknown,
  translate: (message: ReturnType<typeof msg>) => string
): string {
  if (
    error instanceof NotificationInstallationsApiError &&
    error.code === "NOTIFICATION_RUNTIME_STATE_INVALID"
  ) {
    return translate(
      msg`This deployment's notification configuration changed. Refresh SecPal and enable notifications again if the browser prompts you.`
    );
  }

  if (
    error instanceof NotificationInstallationsApiError &&
    (error.status === 401 || error.status === 403)
  ) {
    return translate(
      msg`Sign in again before SecPal can sync this browser with the server.`
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return translate(msg`Failed to enable notifications`);
}

/**
 * Non-intrusive browser notification permission prompt.
 * This surface scopes messaging to browser-level delivery, not server-side categories.
 */
export function NotificationPermissionPrompt() {
  const { _ } = useLingui();
  const {
    permission,
    isSupported,
    requestPermission,
    showNotification,
    isLoading,
  } = useNotifications();
  const [isDismissed, setIsDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isSupported || permission !== "default" || isDismissed) {
    return null;
  }

  const handleEnable = async () => {
    setError(null);

    try {
      const result = await requestPermission();

      if (result === "granted") {
        try {
          await showNotification({
            title: _(/*i18n*/ msg`Notifications Enabled`),
            body: _(
              /*i18n*/ msg`You'll now receive important updates from SecPal`
            ),
          });
          setIsDismissed(true);
        } catch (notificationError) {
          setError(getPromptErrorMessage(notificationError, _));
        }
      } else if (result === "denied") {
        setIsDismissed(true);
      }
    } catch (requestError) {
      setError(getPromptErrorMessage(requestError, _));
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800 md:left-auto md:right-4 md:w-96"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <BellIcon className="h-6 w-6 text-blue-500" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Trans>Enable browser notifications</Trans>
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            <Trans>
              Turn on notifications for this signed-in browser on the current
              SecPal deployment.
            </Trans>
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            <Trans>
              Category-specific notification controls are not available yet.
            </Trans>
          </p>
          {error ? (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button
              onClick={handleEnable}
              disabled={isLoading}
              className="text-sm"
            >
              {isLoading ? <Trans>Enabling...</Trans> : <Trans>Enable</Trans>}
            </Button>
            <Button
              onClick={handleDismiss}
              disabled={isLoading}
              className="text-sm"
              color="zinc"
            >
              <Trans>Not Now</Trans>
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
