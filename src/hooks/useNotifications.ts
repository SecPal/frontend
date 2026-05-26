// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useCallback, useContext, useEffect, useRef } from "react";
import { AuthContext } from "../contexts/auth-context";
import { usePushSubscription } from "./usePushSubscription";
import {
  getBrowserPushBootstrapData,
  NotificationInstallationsApiError,
  revokeBrowserNotificationInstallation,
  upsertBrowserNotificationInstallation,
} from "../services/notificationInstallationsApi";
import {
  clearBrowserPushInstallationId,
  getBrowserPushClientMetadata,
  getOrCreateBrowserPushInstallationId,
  peekBrowserPushInstallationId,
  getServiceWorkerScopePath,
} from "../lib/browserPushState";
import type {
  BrowserPushBootstrapData,
  NotificationInstallationLifecycleEvent,
} from "@/types/api";

export type NotificationPermissionState = "default" | "granted" | "denied";

function getNotificationPermissionState(): NotificationPermissionState {
  return typeof window !== "undefined" && "Notification" in window
    ? Notification.permission
    : "default";
}

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

interface UseNotificationsOptions {
  autoSync?: boolean;
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
export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsReturn {
  const authContext = useContext(AuthContext);
  const [permission, setPermission] = useState<NotificationPermissionState>(
    () => getNotificationPermissionState()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const {
    subscribe,
    unsubscribe,
    getSubscriptionData,
    isReady: isPushReady,
    isSupported: isPushSupported,
    refreshSubscription,
  } = usePushSubscription();

  // Check if notifications are supported
  const isSupported =
    typeof window !== "undefined" &&
    "Notification" in window &&
    isPushSupported;

  const isAuthenticated = authContext?.isAuthenticated === true;
  const autoSync = options.autoSync === true;
  const [autoSyncRegistrationGeneration, setAutoSyncRegistrationGeneration] =
    useState(0);
  const skipNextAutoSyncRegistrationRef = useRef(false);
  const currentPermission = getNotificationPermissionState();

  const toNotificationError = useCallback((err: unknown): Error => {
    return err instanceof NotificationInstallationsApiError ||
      err instanceof Error
      ? err
      : new Error(String(err));
  }, []);

  const runBackgroundNotificationTask = useCallback(
    (task: () => Promise<void>) => {
      let isActive = true;

      const execute = async () => {
        setIsLoading(true);
        setError(null);

        try {
          await task();
        } catch (err) {
          if (isActive) {
            setError(toNotificationError(err));
          }
        } finally {
          if (isActive) {
            setIsLoading(false);
          }
        }
      };

      void execute();

      return () => {
        isActive = false;
      };
    },
    [toNotificationError]
  );

  const registerBrowserPushInstallation = useCallback(
    async (runtimeOptions?: {
      bootstrapData?: BrowserPushBootstrapData | null;
      forceRotation?: boolean;
      allowRetry?: boolean;
    }) => {
      async function syncInstallation(nextRuntimeOptions?: {
        bootstrapData?: BrowserPushBootstrapData | null;
        forceRotation?: boolean;
        allowRetry?: boolean;
      }): Promise<void> {
        if (!isAuthenticated) {
          return;
        }

        const bootstrapData =
          nextRuntimeOptions?.bootstrapData ??
          (await getBrowserPushBootstrapData());
        const webPushRuntimeMetadata =
          bootstrapData?.notification_channels?.web_push;

        if (!webPushRuntimeMetadata) {
          throw new Error(
            "Web push notifications are not available for this deployment"
          );
        }

        let currentSubscription = await refreshSubscription();
        const hadExistingSubscription = currentSubscription !== null;

        if (nextRuntimeOptions?.forceRotation && currentSubscription) {
          await unsubscribe();
          currentSubscription = null;
        }

        currentSubscription =
          currentSubscription ??
          (await subscribe(
            webPushRuntimeMetadata.public_runtime_metadata.vapid_public_key
          ));
        const subscriptionData = getSubscriptionData() ?? {
          endpoint: currentSubscription.endpoint,
          expirationTime: currentSubscription.expirationTime ?? null,
          keys: (() => {
            const json = currentSubscription.toJSON();

            if (!json.keys?.p256dh || !json.keys?.auth) {
              throw new Error(
                "Push subscription is missing required browser credentials"
              );
            }

            return {
              p256dh: json.keys.p256dh,
              auth: json.keys.auth,
            };
          })(),
        };

        if (
          typeof navigator === "undefined" ||
          navigator.serviceWorker === undefined ||
          !subscriptionData.endpoint
        ) {
          throw new Error("Browser push registration is unavailable");
        }

        const registration = await navigator.serviceWorker.ready;
        const { browserName, browserVersion, installationName } =
          getBrowserPushClientMetadata();

        let lifecycleEvent: NotificationInstallationLifecycleEvent =
          "registered";

        if (nextRuntimeOptions?.forceRotation) {
          lifecycleEvent = "credential_rotated";
        } else if (hadExistingSubscription) {
          lifecycleEvent = "client_updated";
        }

        try {
          await upsertBrowserNotificationInstallation(
            getOrCreateBrowserPushInstallationId(),
            {
              channel: "web_push",
              installation_name: installationName,
              lifecycle_event: lifecycleEvent,
              runtime: {
                bootstrap_version:
                  bootstrapData.compatibility.bootstrap_version,
                schema_version: bootstrapData.compatibility.schema_version,
                metadata_revision: webPushRuntimeMetadata.metadata_revision,
              },
              registration: {
                browser: {
                  browser_name: browserName,
                  browser_version: browserVersion,
                  service_worker_scope: getServiceWorkerScopePath(
                    registration.scope
                  ),
                },
                subscription: {
                  endpoint: subscriptionData.endpoint,
                  expiration_time: subscriptionData.expirationTime ?? null,
                  keys: subscriptionData.keys,
                },
              },
            }
          );
        } catch (err) {
          if (
            err instanceof NotificationInstallationsApiError &&
            err.code === "NOTIFICATION_RUNTIME_STATE_INVALID" &&
            nextRuntimeOptions?.allowRetry !== false
          ) {
            await syncInstallation({
              allowRetry: false,
              forceRotation: true,
            });
            return;
          }

          if (
            autoSync &&
            nextRuntimeOptions?.forceRotation &&
            nextRuntimeOptions?.allowRetry === false
          ) {
            setAutoSyncRegistrationGeneration((generation) => generation + 1);
          }

          throw err;
        }
      }

      await syncInstallation(runtimeOptions);
    },
    [
      autoSync,
      getSubscriptionData,
      isAuthenticated,
      refreshSubscription,
      subscribe,
      unsubscribe,
    ]
  );

  const revokeBrowserPushState = useCallback(async () => {
    const installationId = peekBrowserPushInstallationId();
    const currentSubscription = await refreshSubscription();

    if (!installationId && !currentSubscription) {
      return;
    }

    try {
      if (installationId && isAuthenticated) {
        await revokeBrowserNotificationInstallation(installationId);
      }
    } finally {
      if (installationId) {
        clearBrowserPushInstallationId();
      }

      if (currentSubscription) {
        await unsubscribe();
      }
    }
  }, [isAuthenticated, refreshSubscription, unsubscribe]);

  useEffect(() => {
    if (
      !autoSync ||
      !isAuthenticated ||
      !isSupported ||
      currentPermission !== "granted" ||
      !isPushReady
    ) {
      return;
    }

    if (skipNextAutoSyncRegistrationRef.current) {
      skipNextAutoSyncRegistrationRef.current = false;
      return;
    }

    return runBackgroundNotificationTask(() =>
      registerBrowserPushInstallation()
    );
  }, [
    autoSync,
    autoSyncRegistrationGeneration,
    currentPermission,
    isAuthenticated,
    isPushReady,
    isSupported,
    registerBrowserPushInstallation,
    runBackgroundNotificationTask,
  ]);

  useEffect(() => {
    if (!autoSync || !isPushReady || currentPermission !== "denied") {
      return;
    }

    return runBackgroundNotificationTask(() => revokeBrowserPushState());
  }, [
    autoSync,
    currentPermission,
    isPushReady,
    revokeBrowserPushState,
    runBackgroundNotificationTask,
  ]);

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

        if (result === "granted") {
          skipNextAutoSyncRegistrationRef.current = autoSync;
          await registerBrowserPushInstallation();
        }

        return result;
      } catch (err) {
        const error = toNotificationError(err);
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    }, [autoSync, isSupported, registerBrowserPushInstallation, toNotificationError]);

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
