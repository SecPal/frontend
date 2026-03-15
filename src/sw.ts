// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope;

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

/**
 * Navigation fallback: serve cached index.html for SPA navigation
 * This enables offline navigation and page reloads
 */
const navigationHandler = createHandlerBoundToURL("/index.html");
const navigationRoute = new NavigationRoute(navigationHandler, {
  // Exclude API routes and special paths
  denylist: [/^\/v1\//, /^\/__/],
});
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
    data: {
      url: payload.url || "/",
      ...payload.data,
    },
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
  const urlToOpen = event.notification.data?.url || "/";

  // Validate URL is safe to navigate to (security: prevent phishing)
  let targetUrl: URL;
  try {
    targetUrl = new URL(urlToOpen, self.location.origin);

    // Only allow same-origin URLs
    if (targetUrl.origin !== self.location.origin) {
      console.warn("[SW] Blocked external URL in notification:", urlToOpen);
      return;
    }
  } catch (err) {
    console.error("[SW] Invalid URL in notification data:", urlToOpen, err);
    return;
  }

  event.waitUntil(
    (async () => {
      // Check if there's already a window open
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Focus existing window if found
      for (const client of clients) {
        const clientUrl = new URL(client.url);

        // If window is already on target URL, focus it
        if (clientUrl.pathname === targetUrl.pathname) {
          return client.focus();
        }
      }

      // If there's any window open, navigate it to target URL
      if (clients.length > 0) {
        const client = clients[0];
        if (client) {
          await client.navigate(targetUrl.toString());
          return client.focus();
        }
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
  }
});
