// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import {
  NotificationDeploymentUnavailableError,
  useNotifications,
} from "@/hooks/useNotifications";
import { Alert, AlertDescription, Button } from "@/ui";
import { getNotificationInstallationsErrorMessage } from "./notificationInstallationsErrorMessage";

type NotificationStatusTone = "blue" | "green" | "yellow" | "red";

interface NotificationStatusCopy {
  tone: NotificationStatusTone;
  message: string;
}

const notificationStatusStyles: Record<
  NotificationStatusTone,
  { alertClassName: string; descriptionClassName: string }
> = {
  blue: {
    alertClassName: "rounded-lg border border-primary/30 bg-primary/10 p-4",
    descriptionClassName: "text-primary",
  },
  green: {
    alertClassName:
      "rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4",
    descriptionClassName: "text-foreground",
  },
  yellow: {
    alertClassName:
      "rounded-lg border border-amber-500/30 bg-amber-500/10 p-4",
    descriptionClassName: "text-foreground",
  },
  red: {
    alertClassName:
      "rounded-lg border border-destructive/30 bg-destructive/10 p-4",
    descriptionClassName: "text-destructive",
  },
};

function getNotificationStatusCopy(
  permission: "default" | "granted" | "denied",
  isSupported: boolean,
  error: Error | null,
  translate: (message: ReturnType<typeof msg>) => string
): NotificationStatusCopy {
  if (!isSupported) {
    return {
      tone: "yellow",
      message: translate(
        msg`This browser cannot receive SecPal Web Push notifications. Use a current Chrome, Edge, Firefox, or Safari release with Web Push support.`
      ),
    };
  }

  // Check actionable auth/runtime errors before the generic "denied" copy so that a
  // 401/403 (session expired) or stale-runtime error is not masked by advice to go
  // into browser settings — which would be actively misleading remediation.
  const installationErrorMessage = getNotificationInstallationsErrorMessage(
    error,
    translate
  );

  if (installationErrorMessage) {
    return {
      tone: "yellow",
      message: installationErrorMessage,
    };
  }

  if (permission === "denied") {
    return {
      tone: "red",
      message: translate(
        msg`Browser notifications are blocked for this site. Re-enable them in your browser settings to receive SecPal updates on this device.`
      ),
    };
  }

  if (error instanceof NotificationDeploymentUnavailableError) {
    return {
      tone: "yellow",
      message: translate(
        msg`This deployment does not currently publish browser Web Push. Keep HTTPS, the selected deployment domain, and same-origin service-worker hosting aligned before rollout.`
      ),
    };
  }

  if (error) {
    return {
      tone: "yellow",
      message: translate(
        msg`SecPal could not sync this browser's notification registration with the server. Refresh the app and try again.`
      ),
    };
  }

  if (permission === "granted") {
    return {
      tone: "green",
      message: translate(
        msg`Browser notifications are enabled for this signed-in browser on this deployment. SecPal will deliver backend-backed notifications when this deployment publishes them.`
      ),
    };
  }

  return {
    tone: "blue",
    message: translate(
      msg`Turn on notifications for this signed-in browser on the current SecPal deployment.`
    ),
  };
}

/**
 * Truthful notification UX surface for browser Web Push.
 * SecPal currently supports browser-level delivery state, not category-level preferences.
 */
export function NotificationPreferences() {
  const { _ } = useLingui();
  const {
    permission,
    isSupported,
    requestPermission,
    showNotification,
    error,
  } = useNotifications();
  const [isEnabling, setIsEnabling] = useState(false);

  const status = getNotificationStatusCopy(permission, isSupported, error, _);
  const statusStyles = notificationStatusStyles[status.tone];
  const rolloutExpectations = [
    _(
      msg`Category-specific notification preferences are not available yet. SecPal currently manages browser notifications at the browser and deployment level.`
    ),
    _(
      msg`Notifications are tied to this signed-in browser profile and the selected deployment domain.`
    ),
    _(
      msg`HTTPS and a same-origin service worker are required before browser Web Push can register.`
    ),
    _(
      msg`Changing deployment domains, service-worker scope, site data, or signing out can require you to enable notifications again.`
    ),
  ];

  const handleEnableNotifications = async () => {
    setIsEnabling(true);

    try {
      const result = await requestPermission();

      if (result === "granted") {
        await showNotification({
          title: _(/*i18n*/ msg`Notifications Enabled`),
          body: _(
            /*i18n*/ msg`You'll now receive important updates from SecPal`
          ),
          tag: "welcome-notification",
        });
      }
    } catch (requestError) {
      console.error("Failed to enable notifications:", requestError);
    } finally {
      setIsEnabling(false);
    }
  };

  const handleTestNotification = async () => {
    if (permission !== "granted" || error) {
      return;
    }

    try {
      await showNotification({
        title: _(/*i18n*/ msg`Test Notification`),
        body: _(/*i18n*/ msg`This is a test notification from SecPal`),
        tag: "test-notification",
        requireInteraction: false,
      });
    } catch (notificationError) {
      console.error("Failed to send test notification:", notificationError);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <h3 className="text-foreground text-xl/7 font-semibold tracking-normal">
            <Trans>Browser Notifications</Trans>
          </h3>
          <p className="text-muted-foreground text-base/6 sm:text-sm/6">
            <Trans>
              SecPal only exposes backend-backed browser delivery state here. It
              does not offer category-by-category notification controls yet.
            </Trans>
          </p>
        </div>
        {permission === "granted" && error === null ? (
          <Button onClick={handleTestNotification} variant="outline">
            <Trans>Send Test</Trans>
          </Button>
        ) : null}
      </div>

      <Alert className={statusStyles.alertClassName}>
        <AlertDescription
          className={`mt-0 text-base/6 sm:text-sm/6 ${statusStyles.descriptionClassName}`}
        >
          {status.message}
        </AlertDescription>
      </Alert>

      {permission === "default" && isSupported ? (
        <Button
          onClick={handleEnableNotifications}
          disabled={isEnabling}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isEnabling ? (
            <Trans>Enabling...</Trans>
          ) : (
            <Trans>Enable Notifications</Trans>
          )}
        </Button>
      ) : null}

      <div className="rounded-lg border border-border p-4">
        <h4 className="text-foreground text-lg/7 font-semibold tracking-normal">
          <Trans>Rollout Expectations</Trans>
        </h4>
        <ul className="text-muted-foreground mt-3 list-disc space-y-2 pl-5 text-sm">
          {rolloutExpectations.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
