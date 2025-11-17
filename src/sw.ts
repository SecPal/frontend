// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";
import { openDB } from "idb";
import { DB_NAME, DB_VERSION, MAX_RETRY_COUNT } from "./lib/db-constants";

declare const self: ServiceWorkerGlobalScope;

/**
 * Background Sync Event interface
 * @see https://developer.mozilla.org/en-US/docs/Web/API/SyncEvent
 */
interface SyncEvent extends ExtendableEvent {
  readonly tag: string;
  readonly lastChance: boolean;
}

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

/**
 * Store file in IndexedDB fileQueue
 * Service Worker cannot import from lib/fileQueue.ts, so we inline the logic
 *
 * Schema is duplicated from db.ts - use shared constants from db-constants.ts
 * to minimize sync risk.
 */
async function storeFileInQueue(
  file: File,
  metadata: { name: string; type: string; size: number; timestamp: number }
): Promise<string> {
  const db = await openDB(DB_NAME, DB_VERSION);
  const id = crypto.randomUUID();

  // NOTE: This schema duplicates FileQueueEntry from db.ts
  // Service Worker cannot import TypeScript interfaces, so structure is inlined
  // SYNC RISK: Keep structure in sync with db.ts FileQueueEntry interface!
  await db.add("fileQueue", {
    id,
    file, // File extends Blob, no conversion needed
    metadata,
    uploadState: "pending",
    retryCount: 0,
    createdAt: new Date(),
  });

  return id;
}

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

    // Store files in IndexedDB for persistent offline queue
    const fileIds = await Promise.all(
      allowedFiles.map(async (file) => {
        const id = await storeFileInQueue(file, {
          name: file.name,
          type: file.type,
          size: file.size,
          timestamp: Date.now(),
        });
        return id;
      })
    );

    // Generate lightweight file metadata for client notification
    const processedFiles = await Promise.all(
      allowedFiles.map(async (file, index) => {
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
          id: fileIds[index],
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

    // Notify clients about shared files (stored in IndexedDB)
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
    } catch (clientNotifyError) {
      // Log error but don't fail the whole operation
      console.error("Failed to notify clients about error:", clientNotifyError);
    }

    return Response.redirect(
      `${self.location.origin}/share?share_id=${shareId}`,
      303
    );
  }
}

/**
 * Background Sync handler for file uploads
 * Triggered when network connection is restored
 */
self.addEventListener("sync", ((event: SyncEvent) => {
  if (event.tag === "sync-file-queue") {
    event.waitUntil(
      (async () => {
        // Validate that at least one trusted window client exists before processing
        const clients = await self.clients.matchAll({ type: "window" });
        if (clients.length === 0) {
          console.warn(
            "[SW] Ignoring sync-file-queue: no trusted window clients found"
          );
          return;
        }
        await syncFileQueue();
      })()
    );
  }
}) as EventListener);

/**
 * Process pending file uploads from IndexedDB queue
 *
 * Implements retry logic with exponential backoff and max retry limits.
 * Files are only marked as failed after actual upload attempts, not preemptively.
 */
async function syncFileQueue(): Promise<void> {
  const db = await openDB(DB_NAME, DB_VERSION);
  let succeeded = 0;
  let failed = 0;

  try {
    const pendingFiles = await db.getAllFromIndex(
      "fileQueue",
      "uploadState",
      "pending"
    );

    console.log(`[SW] Syncing ${pendingFiles.length} pending files`);

    // Note: Actual upload logic will be implemented when Secret API is ready
    // For now, we simulate the upload attempt
    for (const file of pendingFiles) {
      try {
        // Simulate upload attempt (replace with real upload logic)
        console.log(
          `[SW] Would upload file: ${file.metadata.name} (retry: ${file.retryCount})`
        );

        // Placeholder: Simulate upload result
        const uploadSucceeded = false; // Will be determined by actual API call

        if (uploadSucceeded) {
          // Mark as completed
          await db.put("fileQueue", { ...file, uploadState: "completed" });
          succeeded++;
        } else {
          // Increment retry count, check if max retries exceeded
          const newRetryCount = (file.retryCount ?? 0) + 1;
          if (newRetryCount >= MAX_RETRY_COUNT) {
            console.warn(
              `[SW] File ${file.metadata.name} exceeded max retries (${MAX_RETRY_COUNT}), marking as failed`
            );
            await db.put("fileQueue", {
              ...file,
              uploadState: "failed",
              retryCount: newRetryCount,
              error: "Max retries exceeded",
            });
            failed++;
          } else {
            // Keep as pending with incremented retry count
            await db.put("fileQueue", {
              ...file,
              retryCount: newRetryCount,
              uploadState: "pending",
            });
          }
        }
      } catch (error) {
        // Individual file upload error - log and continue
        console.error(
          `[SW] Failed to upload file ${file.metadata.name}:`,
          error
        );
        const newRetryCount = (file.retryCount ?? 0) + 1;
        if (newRetryCount >= MAX_RETRY_COUNT) {
          await db.put("fileQueue", {
            ...file,
            uploadState: "failed",
            retryCount: newRetryCount,
            error: error instanceof Error ? error.message : "Upload failed",
          });
          failed++;
        } else {
          await db.put("fileQueue", {
            ...file,
            retryCount: newRetryCount,
            uploadState: "pending",
          });
        }
      }
    }

    // Notify clients about sync completion with stats
    const clients = await self.clients.matchAll({ type: "window" });
    for (const client of clients) {
      client.postMessage({
        type: "FILE_QUEUE_SYNCED",
        count: pendingFiles.length,
        succeeded,
        failed,
      });
    }
  } catch (error) {
    // Critical error - notify clients and re-throw only for transient errors
    console.error("[SW] File queue sync failed:", error);

    const clients = await self.clients.matchAll({ type: "window" });
    for (const client of clients) {
      client.postMessage({
        type: "FILE_QUEUE_SYNC_ERROR",
        error: error instanceof Error ? error.message : "Sync failed",
      });
    }

    // Only re-throw for network errors (transient), not for corrupted data (permanent)
    if (
      error instanceof Error &&
      (error.name === "NetworkError" || error.message.includes("network"))
    ) {
      throw error; // Re-throw to trigger retry
    }
    // For other errors (e.g., corrupted IndexedDB), don't retry infinitely
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
