// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import {
  NotificationDeploymentUnavailableError,
  useNotifications,
} from "@/hooks/useNotifications";
import { getNotificationInstallationsErrorMessage } from "@/components/notificationInstallationsErrorMessage";
import { Button } from "@/ui";
import { Bell, X } from "lucide-react";

function getPromptErrorMessage(
  error: unknown,
  translate: (message: ReturnType<typeof msg>) => string
): string {
  const installationErrorMessage = getNotificationInstallationsErrorMessage(
    error,
    translate
  );

  if (installationErrorMessage) {
    return installationErrorMessage;
  }

  if (error instanceof NotificationDeploymentUnavailableError) {
    return translate(
      msg`This deployment does not currently publish browser Web Push. Keep HTTPS, the selected deployment domain, and same-origin service-worker hosting aligned before rollout.`
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

  // Hide when unsupported, dismissed, or permission already settled in a terminal state.
  // "denied" is always terminal for this prompt — errors arising after denial belong in
  // NotificationPreferences, not this transient banner. "granted" with no error means
  // registration succeeded and the prompt auto-dismissed; only keep it visible when
  // permission is still "default" or when permission moved to "granted" but a subsequent
  // showNotification call failed (error !== null) so the user sees what went wrong.
  if (
    !isSupported ||
    isDismissed ||
    permission === "denied" ||
    (permission !== "default" && error === null)
  ) {
    return null;
  }

  const handleEnable = async () => {
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
      } else {
        setError(null);
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
      className="bg-card text-card-foreground border-border fixed bottom-4 left-4 right-4 z-50 rounded-lg border p-4 shadow-lg md:left-auto md:right-4 md:w-96"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <Bell className="text-primary h-6 w-6" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-foreground text-sm font-semibold">
            <Trans>Enable browser notifications</Trans>
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">
            <Trans>
              Turn on notifications for this signed-in browser on the current
              SecPal deployment.
            </Trans>
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            <Trans>
              Category-specific notification controls are not available yet.
            </Trans>
          </p>
          {error ? (
            <p className="text-destructive mt-2 text-sm">{error}</p>
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
              variant="secondary"
            >
              <Trans>Not Now</Trans>
            </Button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground flex-shrink-0"
          aria-label={_(msg`Dismiss notification prompt`)}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
