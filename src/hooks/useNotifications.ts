// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { useState, useCallback, useContext, useEffect, useRef } from "react";
import { AuthContext } from "../contexts/auth-context";
import {
  urlBase64ToUint8Array,
  usePushSubscription,
} from "./usePushSubscription";
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
  isBrowserPushLogoutInProgress,
  peekBrowserPushInstallationId,
  getServiceWorkerScopePath,
} from "../lib/browserPushState";
import type {
  BrowserPushBootstrapData,
  NotificationInstallationLifecycleEvent,
} from "@/types/api";

export type NotificationPermissionState = "default" | "granted" | "denied";

export class NotificationDeploymentUnavailableError extends Error {
  constructor() {
    super("Web push notifications are not available for this deployment");
    this.name = "NotificationDeploymentUnavailableError";
  }
}

function getNotificationPermissionState(): NotificationPermissionState {
  return typeof window !== "undefined" && "Notification" in window
    ? Notification.permission
    : "default";
}

function toUint8Array(
  bufferSource: BufferSource | null | undefined
): Uint8Array | null {
  if (!bufferSource) {
    return null;
  }

  if (bufferSource instanceof ArrayBuffer) {
    return new Uint8Array(bufferSource);
  }

  return new Uint8Array(
    bufferSource.buffer,
    bufferSource.byteOffset,
    bufferSource.byteLength
  );
}

function hasDifferentApplicationServerKey(
  subscription: PushSubscription | null,
  vapidPublicKey: string
): boolean {
  if (!subscription) {
    return false;
  }

  const currentApplicationServerKey = toUint8Array(
    subscription.options?.applicationServerKey ?? null
  );

  if (!currentApplicationServerKey) {
    return false;
  }

  const expectedApplicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

  if (
    currentApplicationServerKey.byteLength !==
    expectedApplicationServerKey.byteLength
  ) {
    return true;
  }

  return currentApplicationServerKey.some(
    (byte, index) => byte !== expectedApplicationServerKey[index]
  );
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

interface BrowserPushRegistrationOptions {
  bootstrapData?: BrowserPushBootstrapData | null;
  forceRotation?: boolean;
  allowRetry?: boolean;
  isTaskActive?: () => boolean;
}

const MAX_AUTO_SYNC_ROTATION_RECOVERY_ATTEMPTS = 1;

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
  const isAuthenticatedRef = useRef(isAuthenticated);
  const autoSync = options.autoSync === true;
  const [autoSyncRegistrationGeneration, setAutoSyncRegistrationGeneration] =
    useState(0);
  const skipAutoSyncGenerationRef = useRef<number | null>(null);
  const autoSyncRotationRecoveryAttemptsRef = useRef(0);
  const currentPermission = getNotificationPermissionState();

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const toNotificationError = useCallback((err: unknown): Error => {
    return err instanceof NotificationInstallationsApiError ||
      err instanceof Error
      ? err
      : new Error(String(err));
  }, []);

  const runBackgroundNotificationTask = useCallback(
    (task: (isTaskActive: () => boolean) => Promise<void>) => {
      let isActive = true;
      const isTaskActive = () => isActive;

      const execute = async () => {
        setIsLoading(true);
        setError(null);

        try {
          await task(isTaskActive);
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
    async (runtimeOptions?: BrowserPushRegistrationOptions) => {
      async function syncInstallation(
        nextRuntimeOptions?: BrowserPushRegistrationOptions
      ): Promise<void> {
        const canContinue = () =>
          isAuthenticatedRef.current &&
          !isBrowserPushLogoutInProgress() &&
          (nextRuntimeOptions?.isTaskActive?.() ?? true);

        if (!canContinue()) {
          return;
        }

        const bootstrapData =
          nextRuntimeOptions?.bootstrapData ??
          (await getBrowserPushBootstrapData());
        const webPushRuntimeMetadata =
          bootstrapData?.notification_channels?.web_push;

        if (!bootstrapData || !webPushRuntimeMetadata) {
          throw new NotificationDeploymentUnavailableError();
        }

        if (!canContinue()) {
          return;
        }

        let currentSubscription = await refreshSubscription();
        const hadExistingSubscription = currentSubscription !== null;
        const forceRotation =
          nextRuntimeOptions?.forceRotation === true ||
          hasDifferentApplicationServerKey(
            currentSubscription,
            webPushRuntimeMetadata.public_runtime_metadata.vapid_public_key
          );

        if (!canContinue()) {
          return;
        }

        if (forceRotation && currentSubscription) {
          await unsubscribe();
          currentSubscription = null;
        }

        if (!canContinue()) {
          return;
        }

        let createdSubscription = false;

        if (!currentSubscription) {
          currentSubscription = await subscribe(
            webPushRuntimeMetadata.public_runtime_metadata.vapid_public_key
          );
          createdSubscription = true;
        }

        if (!canContinue()) {
          if (createdSubscription) {
            try {
              await unsubscribe();
            } catch {
              // Best-effort rollback for subscriptions created after logout.
            }
          }

          return;
        }

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

        if (forceRotation) {
          lifecycleEvent = "credential_rotated";
        } else if (hadExistingSubscription) {
          lifecycleEvent = "client_updated";
        }

        try {
          const installationId = getOrCreateBrowserPushInstallationId();

          await upsertBrowserNotificationInstallation(installationId, {
            channel: "web_push",
            installation_name: installationName,
            lifecycle_event: lifecycleEvent,
            runtime: {
              bootstrap_version: bootstrapData.compatibility.bootstrap_version,
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
          });
          autoSyncRotationRecoveryAttemptsRef.current = 0;
        } catch (err) {
          if (
            err instanceof NotificationInstallationsApiError &&
            err.code === "NOTIFICATION_RUNTIME_STATE_INVALID" &&
            nextRuntimeOptions?.allowRetry !== false
          ) {
            await syncInstallation({
              allowRetry: false,
              forceRotation: true,
              isTaskActive: nextRuntimeOptions?.isTaskActive,
            });
            return;
          }

          if (
            autoSync &&
            forceRotation &&
            nextRuntimeOptions?.allowRetry === false &&
            autoSyncRotationRecoveryAttemptsRef.current <
              MAX_AUTO_SYNC_ROTATION_RECOVERY_ATTEMPTS
          ) {
            autoSyncRotationRecoveryAttemptsRef.current += 1;
            setAutoSyncRegistrationGeneration((generation) => generation + 1);
          }

          throw err;
        }
      }

      await syncInstallation(runtimeOptions);
    },
    [autoSync, getSubscriptionData, refreshSubscription, subscribe, unsubscribe]
  );

  const revokeBrowserPushState = useCallback(async () => {
    const installationId = peekBrowserPushInstallationId();
    const currentSubscription = await refreshSubscription();
    let revokeError: unknown = null;
    let unsubscribeError: unknown = null;
    let revokeSucceeded = false;

    if (!installationId && !currentSubscription) {
      return;
    }

    try {
      if (installationId && isAuthenticatedRef.current) {
        await revokeBrowserNotificationInstallation(installationId);
        revokeSucceeded = true;
      }
    } catch (error) {
      revokeError = error;
    } finally {
      if (installationId && revokeSucceeded) {
        clearBrowserPushInstallationId();
      }

      if (currentSubscription) {
        try {
          await unsubscribe();
        } catch (error) {
          unsubscribeError = error;
        }
      }
    }

    if (revokeError) {
      if (unsubscribeError) {
        throw new AggregateError(
          [revokeError, unsubscribeError],
          "Failed to fully revoke browser push state"
        );
      }

      throw revokeError;
    }

    if (unsubscribeError) {
      throw unsubscribeError;
    }
  }, [refreshSubscription, unsubscribe]);

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

    if (skipAutoSyncGenerationRef.current !== null) {
      if (
        skipAutoSyncGenerationRef.current === autoSyncRegistrationGeneration
      ) {
        skipAutoSyncGenerationRef.current = null;
        return;
      }

      skipAutoSyncGenerationRef.current = null;
    }

    return runBackgroundNotificationTask((isTaskActive) =>
      registerBrowserPushInstallation({ isTaskActive })
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
    if (
      !autoSync ||
      !isAuthenticated ||
      !isPushReady ||
      currentPermission !== "denied"
    ) {
      return;
    }

    return runBackgroundNotificationTask(() => revokeBrowserPushState());
  }, [
    autoSync,
    currentPermission,
    isAuthenticated,
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
          if (autoSync) {
            skipAutoSyncGenerationRef.current = autoSyncRegistrationGeneration;
          }

          try {
            await registerBrowserPushInstallation();
          } catch (err) {
            if (
              autoSync &&
              skipAutoSyncGenerationRef.current ===
                autoSyncRegistrationGeneration
            ) {
              skipAutoSyncGenerationRef.current = null;
            }

            throw err;
          }
        }

        return result;
      } catch (err) {
        const error = toNotificationError(err);
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    }, [
      autoSync,
      autoSyncRegistrationGeneration,
      isSupported,
      registerBrowserPushInstallation,
      toNotificationError,
    ]);

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
