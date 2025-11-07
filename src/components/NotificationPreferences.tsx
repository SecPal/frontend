// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useMemo } from "react";
import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "./button";
import { Fieldset, Field, Label, Description } from "./fieldset";
import { Switch } from "./switch";
import { Heading } from "./heading";
import { Text } from "./text";

export type NotificationCategory =
  | "alerts"
  | "updates"
  | "reminders"
  | "messages";

interface NotificationPreference {
  category: NotificationCategory;
  enabled: boolean;
  label: string;
  description: string;
}

const STORAGE_KEY = "secpal-notification-preferences";

/**
 * Component for managing notification preferences
 * Allows users to control which types of notifications they receive
 */
export function NotificationPreferences() {
  const { _ } = useLingui();
  const { permission, isSupported, requestPermission, showNotification } =
    useNotifications();

  // Default preferences with translations that update when locale changes
  const defaultPreferences = useMemo<NotificationPreference[]>(
    () => [
      {
        category: "alerts",
        enabled: true,
        label: _(msg`Security Alerts`),
        description: _(msg`Critical security notifications and warnings`),
      },
      {
        category: "updates",
        enabled: true,
        label: _(msg`System Updates`),
        description: _(msg`App updates and maintenance notifications`),
      },
      {
        category: "reminders",
        enabled: true,
        label: _(msg`Shift Reminders`),
        description: _(msg`Reminders about upcoming shifts and duties`),
      },
      {
        category: "messages",
        enabled: false,
        label: _(msg`Team Messages`),
        description: _(msg`Messages from team members and supervisors`),
      },
    ],
    [_]
  );

  const [preferences, setPreferences] = useState<NotificationPreference[]>(
    () => defaultPreferences
  );

  const [isEnabling, setIsEnabling] = useState(false);

  // Update translations when locale changes
  useEffect(() => {
    setPreferences((current) =>
      current.map((pref) => {
        const defaultPref = defaultPreferences.find(
          (d) => d.category === pref.category
        );
        return defaultPref
          ? {
              ...pref,
              label: defaultPref.label,
              description: defaultPref.description,
            }
          : pref;
      })
    );
  }, [defaultPreferences]);

  // Load preferences from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPreferences((current) =>
          current.map((pref) => {
            const storedPref = parsed.find(
              (p: NotificationPreference) => p.category === pref.category
            );
            return storedPref ? { ...pref, enabled: storedPref.enabled } : pref;
          })
        );
      } catch (error) {
        console.error("Failed to load notification preferences:", error);
      }
    }
  }, []);

  // Save preferences to localStorage (with queueMicrotask to avoid blocking)
  const savePreferences = (newPreferences: NotificationPreference[]) => {
    setPreferences(newPreferences);
    // Use queueMicrotask to defer localStorage write and avoid blocking render
    queueMicrotask(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences));
      } catch (error) {
        console.error("Failed to save notification preferences:", error);
      }
    });
  };

  // Handle enabling notifications
  const handleEnableNotifications = async () => {
    setIsEnabling(true);
    try {
      const result = await requestPermission();
      if (result === "granted") {
        await showNotification({
          title: _(msg`Notifications Enabled`),
          body: _(msg`You'll now receive important updates from SecPal`),
          tag: "welcome-notification",
        });
      }
    } catch (error) {
      console.error("Failed to enable notifications:", error);
    } finally {
      setIsEnabling(false);
    }
  };

  // Handle toggling a preference
  const handleTogglePreference = (category: NotificationCategory) => {
    const newPreferences = preferences.map((pref) =>
      pref.category === category ? { ...pref, enabled: !pref.enabled } : pref
    );
    savePreferences(newPreferences);
  };

  // Handle sending a test notification
  const handleTestNotification = async () => {
    if (permission !== "granted") return;

    try {
      await showNotification({
        title: _(msg`Test Notification`),
        body: _(msg`This is a test notification from SecPal`),
        tag: "test-notification",
        requireInteraction: false,
      });
    } catch (error) {
      console.error("Failed to send test notification:", error);
    }
  };

  if (!isSupported) {
    return (
      <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950/10">
        <Text className="text-yellow-800 dark:text-yellow-200">
          <Trans>
            Notifications are not supported in your browser. Please use a modern
            browser like Chrome, Firefox, or Safari.
          </Trans>
        </Text>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="rounded-lg bg-red-50 p-4 dark:bg-red-950/10">
        <Text className="text-red-800 dark:text-red-200">
          <Trans>
            Notifications have been blocked. Please enable them in your browser
            settings to receive important updates.
          </Trans>
        </Text>
      </div>
    );
  }

  if (permission === "default") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/10">
          <Text className="text-blue-800 dark:text-blue-200">
            <Trans>
              Enable notifications to receive important updates about security
              alerts, shift reminders, and system notifications.
            </Trans>
          </Text>
        </div>
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading level={3}>
            <Trans>Notification Preferences</Trans>
          </Heading>
          <Text>
            <Trans>Choose which notifications you want to receive</Trans>
          </Text>
        </div>
        <Button onClick={handleTestNotification} outline>
          <Trans>Send Test</Trans>
        </Button>
      </div>

      <Fieldset>
        {preferences.map((pref) => (
          <Field key={pref.category}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <Label>{pref.label}</Label>
                <Description>{pref.description}</Description>
              </div>
              <Switch
                checked={pref.enabled}
                onChange={() => handleTogglePreference(pref.category)}
                color="blue"
              />
            </div>
          </Field>
        ))}
      </Fieldset>

      <div className="rounded-lg bg-green-50 p-4 dark:bg-green-950/10">
        <Text className="text-green-800 dark:text-green-200">
          <Trans>
            ✓ Notifications are enabled. You'll receive updates based on your
            preferences.
          </Trans>
        </Text>
      </div>
    </div>
  );
}
