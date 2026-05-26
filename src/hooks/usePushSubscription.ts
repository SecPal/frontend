// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback, useRef } from "react";

export interface PushSubscriptionData {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface UsePushSubscriptionOptions {
  vapidPublicKey?: string;
}

interface UsePushSubscriptionReturn {
  subscription: PushSubscription | null;
  isSubscribed: boolean;
  isSupported: boolean;
  isReady: boolean;
  isLoading: boolean;
  error: Error | null;
  subscribe: (overrideVapidPublicKey?: string) => Promise<PushSubscription>;
  unsubscribe: () => Promise<void>;
  getSubscriptionData: () => PushSubscriptionData | null;
  refreshSubscription: () => Promise<PushSubscription | null>;
}

/**
 * Convert base64 VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

/**
 * Hook for managing push notification subscriptions
 * Handles VAPID-based push subscription lifecycle
 *
 * @example
 * ```tsx
 * const { subscribe, unsubscribe, isSubscribed } = usePushSubscription();
 *
 * const handleSubscribe = async () => {
 *   try {
 *     const subscription = await subscribe();
 *     // Send subscription to backend
 *     await fetch('/api/push/subscribe', {
 *       method: 'POST',
 *       body: JSON.stringify(subscription.toJSON())
 *     });
 *   } catch (error) {
 *     console.error('Subscription failed:', error);
 *   }
 * };
 * ```
 */
export function usePushSubscription(
  options: UsePushSubscriptionOptions = {}
): UsePushSubscriptionReturn {
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null
  );
  const subscriptionRef = useRef<PushSubscription | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Check if push notifications are supported
  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    navigator.serviceWorker !== undefined &&
    "PushManager" in window;

  const setTrackedSubscription = useCallback(
    (nextSubscription: PushSubscription | null) => {
      subscriptionRef.current = nextSubscription;
      setSubscription(nextSubscription);
    },
    []
  );

  const refreshSubscription = useCallback(async (): Promise<PushSubscription | null> => {
    if (!isSupported) {
      setTrackedSubscription(null);
      setIsReady(true);
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();

      setTrackedSubscription(existingSubscription);
      return existingSubscription;
    } catch (err) {
      console.error("Failed to load push subscription:", err);
      setTrackedSubscription(null);
      return null;
    } finally {
      setIsReady(true);
    }
  }, [isSupported, setTrackedSubscription]);

  // Load existing subscription on mount
  useEffect(() => {
    if (!isSupported) {
      setIsReady(true);
      return;
    }

    void refreshSubscription();

    if (typeof navigator.serviceWorker.addEventListener !== "function") {
      return;
    }

    const handleControllerChange = () => {
      setIsReady(false);
      void refreshSubscription();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange
    );

    return () => {
      if (typeof navigator.serviceWorker.removeEventListener === "function") {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          handleControllerChange
        );
      }
    };
  }, [isSupported, refreshSubscription]);

  /**
   * Subscribe to push notifications
   */
  const subscribe = useCallback(async (overrideVapidPublicKey?: string): Promise<PushSubscription> => {
    if (!isSupported) {
      const err = new Error("Push notifications are not supported");
      setError(err);
      throw err;
    }

    if (subscriptionRef.current) {
      const err = new Error("Already subscribed");
      setError(err);
      throw err;
    }

    const vapidPublicKey = overrideVapidPublicKey ?? options.vapidPublicKey;

    if (!vapidPublicKey) {
      const err = new Error("VAPID public key is required");
      setError(err);
      throw err;
    }

    setIsLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const applicationServerKey = urlBase64ToUint8Array(
        vapidPublicKey
      ) as BufferSource;

      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      setTrackedSubscription(newSubscription);
      return newSubscription;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, options.vapidPublicKey, setTrackedSubscription]);

  /**
   * Unsubscribe from push notifications
   */
  const unsubscribe = useCallback(async (): Promise<void> => {
    const currentSubscription = subscriptionRef.current;

    if (!currentSubscription) {
      const err = new Error("Not subscribed");
      setError(err);
      throw err;
    }

    setIsLoading(true);
    setError(null);

    try {
      await currentSubscription.unsubscribe();
      setTrackedSubscription(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [setTrackedSubscription]);

  /**
   * Get subscription data in format suitable for backend API
   */
  const getSubscriptionData = useCallback((): PushSubscriptionData | null => {
    const currentSubscription = subscriptionRef.current;

    if (!currentSubscription) return null;

    const json = currentSubscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return null;
    }
    return {
      endpoint: json.endpoint,
      expirationTime:
        currentSubscription.expirationTime ?? json.expirationTime ?? null,
      keys: {
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
    };
  }, []);

  return {
    subscription,
    isSubscribed: subscription !== null,
    isSupported,
    isReady,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    getSubscriptionData,
    refreshSubscription,
  };
}
