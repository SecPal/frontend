// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";
import {
  isAuthSessionChangedMessage,
  readOfflineSessionState,
  shouldRedirectOpenClientsForAuthSessionChangedMessage,
  writeOfflineSessionState,
  type AuthSessionChangedMessage,
} from "./lib/offlineSessionState";
import {
  createNotificationData,
  focusOrNavigateClient,
  getNotificationNavigationTarget,
} from "./lib/notificationNavigation";
import {
  redirectProtectedWindowClientsToLogin,
  shouldRedirectLoggedOutNavigation,
} from "./lib/serviceWorkerAuthRedirect";

declare const self: ServiceWorkerGlobalScope;

async function redirectProtectedClientsToLogin(): Promise<void> {
  const windowClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  await redirectProtectedWindowClientsToLogin(
    windowClients,
    self.location.origin
  );
}

async function handleAuthSessionChanged(
  message: AuthSessionChangedMessage
): Promise<void> {
  try {
    await writeOfflineSessionState(message.isAuthenticated);
  } catch (error) {
    console.error("[SW] Failed to persist offline auth session state:", error);
  }

  if (shouldRedirectOpenClientsForAuthSessionChangedMessage(message)) {
    try {
      await redirectProtectedClientsToLogin();
    } catch (error) {
      console.error(
        "[SW] Failed to redirect protected clients to login:",
        error
      );
    }
  }
}

// Take control of all pages immediately
clientsClaim();

// Cleanup old caches
cleanupOutdatedCaches();

// Precache all build assets (injected by Vite PWA plugin)
precacheAndRoute(self.__WB_MANIFEST);

// Cache static assets with CacheFirst strategy
registerRoute(
  ({ request }) =>
    request.destination === "image" ||
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font",
  new CacheFirst({
    cacheName: "static-assets",
  })
);

const navigationHandler = new NetworkFirst({
  cacheName: "html-shell",
});
const navigationRoute = new NavigationRoute(
  async (context) => {
    let sessionState = null;

    try {
      sessionState = await readOfflineSessionState();
    } catch {
      // If the Cache API fails, default to allowing navigation (fail-open).
    }

    const pathname = new URL(context.request.url).pathname;

    if (
      shouldRedirectLoggedOutNavigation(
        pathname,
        sessionState?.isAuthenticated ?? null
      )
    ) {
      return Response.redirect(
        new URL("/login", self.location.origin).toString(),
        302
      );
    }

    return navigationHandler.handle(context);
  },
  {
    // Exclude API routes and special paths
    denylist: [/^\/v1\//, /^\/__/],
  }
);
registerRoute(navigationRoute);

/**
 * Push notification payload interface
 */
interface PushNotificationData {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  requireInteraction?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  data?: Record<string, unknown>;
}

/**
 * Handle push notifications from backend
 * Displays notification with actions (Open, Dismiss)
 */
self.addEventListener("push", (event: PushEvent) => {
  if (!event.data) {
    console.warn("[SW] Push event received but no data");
    return;
  }

  let payload: PushNotificationData;
  try {
    payload = event.data.json();
  } catch (error) {
    console.error("[SW] Failed to parse push notification data:", error);
    return;
  }

  const notificationOptions: NotificationOptions & {
    actions?: Array<{ action: string; title: string }>;
  } = {
    body: payload.body,
    icon: payload.icon || "/pwa-192x192.png",
    badge: payload.badge || "/pwa-192x192.png",
    tag: payload.tag || "default",
    requireInteraction: payload.requireInteraction || false,
    data: createNotificationData(payload),
    actions: payload.actions || [
      { action: "open", title: "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, notificationOptions)
  );
});

/**
 * Handle notification click events
 * Routes user to appropriate page based on notification data
 */
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  // Handle action buttons
  if (event.action === "dismiss") {
    return;
  }

  // Get target URL from notification data
  const urlToOpen = getNotificationNavigationTarget(event.notification.data);

  // Validate URL is safe to navigate to (security: prevent phishing)
  let targetUrl: URL;
  try {
    targetUrl = new URL(urlToOpen, self.location.origin);

    // Only allow same-origin URLs
    if (targetUrl.origin !== self.location.origin) {
      console.warn("[SW] Blocked external URL in notification:", urlToOpen);
      return;
    }
  } catch (error) {
    console.error("[SW] Invalid URL in notification data:", urlToOpen, error);
    return;
  }

  event.waitUntil(
    (async () => {
      // Check if there's already a window open
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      const client = await focusOrNavigateClient(clients, targetUrl);

      if (client) {
        return client;
      }

      // Otherwise, open new window
      return self.clients.openWindow(targetUrl.toString());
    })()
  );
});

/**
 * Listen for messages from clients
 */
self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (isAuthSessionChangedMessage(event.data)) {
    event.waitUntil(handleAuthSessionChanged(event.data));
  }
});
