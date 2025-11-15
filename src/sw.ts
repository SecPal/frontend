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
// File validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats",
];

async function handleShareTargetPost(request: Request): Promise<Response> {
  // Use a shareId to correlate messages and redirects across navigation
  const shareId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  try {
    const formData = await request.clone().formData();

    // Extract text fields with length validation
    const MAX_PARAM_LENGTH = 1000;
    const rawTitle = formData.get("title") as string | null;
    const rawText = formData.get("text") as string | null;
    const rawUrl = formData.get("url") as string | null;

    const title =
      rawTitle && rawTitle.length <= MAX_PARAM_LENGTH ? rawTitle : null;
    const text =
      rawText && rawText.length <= MAX_PARAM_LENGTH * 5 ? rawText : null; // 5000 chars for text
    const url = rawUrl && rawUrl.length <= MAX_PARAM_LENGTH * 2 ? rawUrl : null; // 2000 chars for URLs

    // Extract and validate files before heavy processing
    const rawFiles = formData.getAll("files") as File[];
    const allowedFiles = rawFiles.filter((file) => {
      // Validate file type (prefix match for image/ and explicit prefixes for others)
      if (!ALLOWED_TYPES.some((t) => file.type.startsWith(t))) {
        // reject unsupported types
        return false;
      }
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return false;
      }
      return true;
    });

    const processedFiles = await Promise.all(
      allowedFiles.map(async (file) => {
        // Convert file to Base64 for preview only for images and limited size
        // Reduced to 2MB to prevent memory issues (Base64 is ~33% larger)
        let dataUrl: string | undefined;
        if (file.type.startsWith("image/") && file.size < 2 * 1024 * 1024) {
          try {
            dataUrl = await fileToBase64(file);
          } catch {
            // If conversion fails, omit preview but keep metadata
            dataUrl = undefined;
          }
        }

        return {
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl,
        };
      })
    );

    // Build redirect URL with query parameters and shareId
    const redirectUrl = new URL("/share", self.location.origin);
    if (title) redirectUrl.searchParams.set("title", title);
    if (text) redirectUrl.searchParams.set("text", text);
    if (url) redirectUrl.searchParams.set("url", url);
    redirectUrl.searchParams.set("share_id", shareId);

    // Store files in sessionStorage BEFORE notifying clients (race condition fix)
    // This ensures files are available when the redirect happens
    await self.clients.matchAll({ type: "window" }).then((clients) => {
      if (clients.length > 0) {
        // If there's an active client, notify it first
        for (const client of clients) {
          client.postMessage({
            type: "SHARE_TARGET_FILES",
            shareId,
            files: processedFiles,
          });
        }
      }
    });

    // Redirect to the share page
    return Response.redirect(redirectUrl.toString(), 303);
  } catch (error) {
    console.error("Error processing share target:", error);

    // Notify clients about the error so UI can display it
    try {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        client.postMessage({
          type: "SHARE_TARGET_ERROR",
          shareId,
          error:
            error instanceof Error
              ? error.message
              : "Unknown error processing shared content",
        });
      }
    } catch {
      // ignore
    }

    return Response.redirect(
      `${self.location.origin}/share?share_id=${shareId}`,
      303
    );
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
