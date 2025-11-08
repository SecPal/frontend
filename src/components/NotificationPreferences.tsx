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
import type { I18n } from "@lingui/core";

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
 * Helper function to get translations for a given category
 * Centralizes translation strings to follow DRY principle
 */
function getTranslationsForCategory(
  category: NotificationCategory,
  i18n: I18n
): { label: string; description: string } {
  switch (category) {
    case "alerts":
      return {
        label: i18n._(msg`Security Alerts`),
        description: i18n._(msg`Critical security notifications and warnings`),
      };
    case "updates":
      return {
        label: i18n._(msg`System Updates`),
        description: i18n._(msg`App updates and maintenance notifications`),
      };
    case "reminders":
      return {
        label: i18n._(msg`Shift Reminders`),
        description: i18n._(msg`Reminders about upcoming shifts and duties`),
      };
    case "messages":
      return {
        label: i18n._(msg`Team Messages`),
        description: i18n._(msg`Messages from team members and supervisors`),
      };
  }
}

/**
 * Component for managing notification preferences
 * Allows users to control which types of notifications they receive
 */
export function NotificationPreferences() {
  const { _, i18n } = useLingui();
  const { permission, isSupported, requestPermission, showNotification } =
    useNotifications();

  // Default preferences with translations that update when locale changes
  const defaultPreferences = useMemo<NotificationPreference[]>(
    () => [
      {
        category: "alerts" as const,
        enabled: true,
        ...getTranslationsForCategory("alerts", i18n),
      },
      {
        category: "updates" as const,
        enabled: true,
        ...getTranslationsForCategory("updates", i18n),
      },
      {
        category: "reminders" as const,
        enabled: true,
        ...getTranslationsForCategory("reminders", i18n),
      },
      {
        category: "messages" as const,
        enabled: false,
        ...getTranslationsForCategory("messages", i18n),
      },
    ],
    [i18n]
  );

  const [preferences, setPreferences] = useState<NotificationPreference[]>(
    () => defaultPreferences
  );

  const [isEnabling, setIsEnabling] = useState(false);

  // Update translations when locale changes
  // We compute translations directly using helper function to avoid depending on
  // defaultPreferences which would cause infinite loops due to the _ function reference changing
  useEffect(() => {
    setPreferences((current) =>
      current.map((pref) => ({
        ...pref,
        ...getTranslationsForCategory(pref.category, i18n),
      }))
    );
  }, [i18n, i18n.locale]); // Depend on i18n.locale to update translations on locale change

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Validate that parsed data is an array
          if (!Array.isArray(parsed)) {
            console.warn(
              "Invalid notification preferences format, using defaults"
            );
            return;
          }

          setPreferences((current) =>
            current.map((pref) => {
              const storedPref = parsed.find(
                (p: NotificationPreference) =>
                  p &&
                  typeof p === "object" &&
                  p.category === pref.category &&
                  typeof p.enabled === "boolean"
              );
              return storedPref
                ? { ...pref, enabled: storedPref.enabled }
                : pref;
            })
          );
        } catch (parseError) {
          console.error(
            "Failed to parse notification preferences, using defaults:",
            parseError
          );
          // Clear corrupted data
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {
            // Ignore removal errors (e.g., SecurityError in private mode)
          }
        }
      }
    } catch (error) {
      // Handle QuotaExceededError or SecurityError when accessing localStorage
      console.error(
        "Failed to load notification preferences (storage access denied):",
        error
      );
    }
  }, []);

  // Save preferences to localStorage synchronously for immediate error feedback
  const savePreferences = (newPreferences: NotificationPreference[]) => {
    setPreferences(newPreferences);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences));
    } catch (error) {
      // Handle QuotaExceededError or SecurityError
      if (error instanceof Error) {
        if (error.name === "QuotaExceededError") {
          console.error(
            "Failed to save notification preferences: Storage quota exceeded"
          );
          // Optionally notify user about storage issues
        } else if (error.name === "SecurityError") {
          console.error(
            "Failed to save notification preferences: Storage access denied (private mode?)"
          );
        } else {
          console.error("Failed to save notification preferences:", error);
        }
      }
    }
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
