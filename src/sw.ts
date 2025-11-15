// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope;

// Take control of all pages immediately
clientsClaim();

// Cleanup old caches
cleanupOutdatedCaches();

// Precache all build assets (injected by Vite PWA plugin)
precacheAndRoute(self.__WB_MANIFEST);

// Cache API requests with NetworkFirst strategy
registerRoute(
  ({ url }) =>
    url.origin === self.location.origin && url.pathname.startsWith("/api/"),
  new NetworkFirst({
    cacheName: "api-cache",
    networkTimeoutSeconds: 10,
  })
);

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
 * Handle Share Target API POST requests with file uploads
 * This intercepts POST requests to /share and processes FormData files
 */
self.addEventListener("fetch", (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle POST requests to /share
  if (request.method === "POST" && url.pathname === "/share") {
    event.respondWith(handleShareTargetPost(request));
  }
});

/**
 * Process Share Target POST request with files
 * Extracts FormData, converts files to Base64, stores in sessionStorage,
 * and redirects to /share route with URL parameters
 */
async function handleShareTargetPost(request: Request): Promise<Response> {
  try {
    const formData = await request.clone().formData();

    // Extract text fields
    const title = formData.get("title") as string | null;
    const text = formData.get("text") as string | null;
    const url = formData.get("url") as string | null;

    // Extract files
    const files = formData.getAll("files") as File[];
    const processedFiles = await Promise.all(
      files.map(async (file) => {
        // Convert file to Base64 for preview (only for images, limited size)
        let dataUrl: string | undefined;
        if (file.type.startsWith("image/") && file.size < 5 * 1024 * 1024) {
          // Only process images < 5MB
          dataUrl = await fileToBase64(file);
        }

        return {
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl,
        };
      })
    );

    // Build redirect URL with query parameters
    const redirectUrl = new URL("/share", self.location.origin);
    if (title) redirectUrl.searchParams.set("title", title);
    if (text) redirectUrl.searchParams.set("text", text);
    if (url) redirectUrl.searchParams.set("url", url);

    // Store files data in a way the client can access it
    // We'll use a broadcast message since Service Workers can't directly write to sessionStorage
    const clients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

    for (const client of clients) {
      client.postMessage({
        type: "SHARE_TARGET_FILES",
        files: processedFiles,
      });
    }

    // Redirect to the share page
    return Response.redirect(redirectUrl.toString(), 303);
  } catch (error) {
    console.error("Error processing share target:", error);

    // Fallback: redirect to /share without files
    return Response.redirect(`${self.location.origin}/share`, 303);
  }
}

/**
 * Convert File to Base64 data URL
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Listen for messages from clients
 */
self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
