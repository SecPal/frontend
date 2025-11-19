// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback } from "react";

export interface PushSubscriptionData {
  endpoint: string;
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
  isLoading: boolean;
  error: Error | null;
  subscribe: () => Promise<PushSubscription>;
  unsubscribe: () => Promise<void>;
  getSubscriptionData: () => PushSubscriptionData | null;
}

/**
 * Default VAPID public key (will be replaced with real key from backend)
 * This is a placeholder - in production, this should come from the backend API
 */
const DEFAULT_VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const vapidPublicKey = options.vapidPublicKey || DEFAULT_VAPID_PUBLIC_KEY;

  // Check if push notifications are supported
  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    navigator.serviceWorker !== undefined &&
    "PushManager" in window;

  // Load existing subscription on mount
  useEffect(() => {
    if (!isSupported) return;

    const loadSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();
        setSubscription(existingSub);
      } catch (err) {
        console.error("Failed to load push subscription:", err);
      }
    };

    loadSubscription();
  }, [isSupported]);

  /**
   * Subscribe to push notifications
   */
  const subscribe = useCallback(async (): Promise<PushSubscription> => {
    if (!isSupported) {
      const err = new Error("Push notifications are not supported");
      setError(err);
      throw err;
    }

    if (subscription) {
      const err = new Error("Already subscribed");
      setError(err);
      throw err;
    }

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

      setSubscription(newSubscription);
      return newSubscription;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, subscription, vapidPublicKey]);

  /**
   * Unsubscribe from push notifications
   */
  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!subscription) {
      const err = new Error("Not subscribed");
      setError(err);
      throw err;
    }

    setIsLoading(true);
    setError(null);

    try {
      await subscription.unsubscribe();
      setSubscription(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [subscription]);

  /**
   * Get subscription data in format suitable for backend API
   */
  const getSubscriptionData = useCallback((): PushSubscriptionData | null => {
    if (!subscription) return null;

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return null;
    }
    return {
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
    };
  }, [subscription]);

  return {
    subscription,
    isSubscribed: subscription !== null,
    isSupported,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    getSubscriptionData,
  };
}
