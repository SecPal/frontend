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
import { Button } from "./button";
import { Heading } from "./heading";
import { Text } from "./text";
import { getNotificationInstallationsErrorMessage } from "./notificationInstallationsErrorMessage";

type NotificationStatusTone = "blue" | "green" | "yellow" | "red";

interface NotificationStatusCopy {
  tone: NotificationStatusTone;
  message: string;
}

function getStatusClasses(tone: NotificationStatusTone): string {
  switch (tone) {
    case "green":
      return "rounded-lg bg-green-50 p-4 dark:bg-green-950/10";
    case "yellow":
      return "rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950/10";
    case "red":
      return "rounded-lg bg-red-50 p-4 dark:bg-red-950/10";
    case "blue":
    default:
      return "rounded-lg bg-blue-50 p-4 dark:bg-blue-950/10";
  }
}

function getStatusTextClasses(tone: NotificationStatusTone): string {
  switch (tone) {
    case "green":
      return "text-green-800 dark:text-green-200";
    case "yellow":
      return "text-yellow-800 dark:text-yellow-200";
    case "red":
      return "text-red-800 dark:text-red-200";
    case "blue":
    default:
      return "text-blue-800 dark:text-blue-200";
  }
}

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
          <Heading level={3}>
            <Trans>Browser Notifications</Trans>
          </Heading>
          <Text>
            <Trans>
              SecPal only exposes backend-backed browser delivery state here. It
              does not offer category-by-category notification controls yet.
            </Trans>
          </Text>
        </div>
        {permission === "granted" && error === null ? (
          <Button onClick={handleTestNotification} outline>
            <Trans>Send Test</Trans>
          </Button>
        ) : null}
      </div>

      <div className={getStatusClasses(status.tone)}>
        <Text className={getStatusTextClasses(status.tone)}>
          {status.message}
        </Text>
      </div>

      {permission === "default" && isSupported ? (
        <Button
          onClick={handleEnableNotifications}
          disabled={isEnabling}
          color="blue"
        >
          {isEnabling ? (
            <Trans>Enabling...</Trans>
          ) : (
            <Trans>Enable Notifications</Trans>
          )}
        </Button>
      ) : null}

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <Heading level={4}>
          <Trans>Rollout Expectations</Trans>
        </Heading>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-600 dark:text-zinc-300">
          {rolloutExpectations.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
