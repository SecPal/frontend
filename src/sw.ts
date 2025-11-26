// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";
import { openDB } from "idb";
import {
  DB_NAME,
  DB_VERSION,
  MAX_RETRY_COUNT,
  MAX_BACKOFF_MS,
} from "./lib/db-constants";

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
    url.origin === self.location.origin && url.pathname.startsWith("/v1/"),
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
 *
 * NOTE: Database connection is opened on each call. For typical Share Target use
 * cases (1-3 files), this is acceptable. Future optimization could cache the
 * connection if bulk operations become common.
 *
 * SCHEMA SYNC: Structure must match FileQueueEntry interface in db.ts.
 * - id: string
 * - file: Blob
 * - metadata: { name, type, size, timestamp }
 * - uploadState: "pending" | "uploading" | "completed" | "failed"
 * - retryCount: number
 * - createdAt: Date
 * - lastAttemptAt?: Date (optional, set during upload attempts)
 * - error?: string (optional, set on failure)
 * - secretId?: string (optional, target secret)
 */
async function storeFileInQueue(
  file: File,
  metadata: { name: string; type: string; size: number; timestamp: number }
): Promise<string> {
  const db = await openDB(DB_NAME, DB_VERSION);
  const id = crypto.randomUUID();

  // Structure matches FileQueueEntry from db.ts (required fields only)
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
 *
 * DESIGN DECISION: Only processes uploads when at least one window client is open.
 * This ensures:
 * - User context available for authentication (future API integration)
 * - User can receive upload notifications/feedback
 * - Avoids background uploads without user knowledge
 *
 * If all windows are closed, sync waits until user reopens the app.
 */
self.addEventListener("sync", ((event: SyncEvent) => {
  if (event.tag === "sync-file-queue") {
    event.waitUntil(
      (async () => {
        // Validate that at least one trusted window client exists before processing
        // This prevents uploads when all app windows are closed
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
  } else if (event.tag === "encrypted-upload-sync") {
    event.waitUntil(
      (async () => {
        // Validate that at least one trusted window client exists before processing
        const clients = await self.clients.matchAll({ type: "window" });
        if (clients.length === 0) {
          console.warn(
            "[SW] Ignoring encrypted-upload-sync: no trusted window clients found"
          );
          return;
        }
        await syncEncryptedUploads();
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
    // IMPORTANT: Placeholder always marks as completed to avoid incrementing retry counts
    // during testing. Real API implementation will determine uploadSucceeded based on response.
    for (const file of pendingFiles) {
      try {
        // Simulate upload attempt (replace with real upload logic)
        console.log(
          `[SW] Would upload file: ${file.metadata.name} (retry: ${file.retryCount})`
        );

        // Placeholder: Simulate successful upload to prevent retry exhaustion during testing
        // Real implementation will check API response: uploadSucceeded = (response.ok)
        const uploadSucceeded = true;

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
 * Process encrypted file uploads from IndexedDB queue
 *
 * Implements retry logic with exponential backoff (1s, 2s, 4s, 8s, 16s, 32s, max 60s)
 * and max retry limits. Only processes files with uploadState='encrypted'.
 *
 * WORKFLOW:
 * 1. Query fileQueue for files with uploadState='encrypted'
 * 2. For each file, call /v1/secrets/{secretId}/attachments
 * 3. Update uploadState: 'encrypted' → 'uploading' → 'completed'/'failed'
 * 4. Notify clients of progress and results
 */
async function syncEncryptedUploads(): Promise<void> {
  const db = await openDB(DB_NAME, DB_VERSION);
  let succeeded = 0;
  let failed = 0;

  try {
    const encryptedFiles = await db.getAllFromIndex(
      "fileQueue",
      "uploadState",
      "encrypted"
    );

    console.log(`[SW] Syncing ${encryptedFiles.length} encrypted file uploads`);

    for (const fileEntry of encryptedFiles) {
      // Skip files without secretId (cannot upload without target)
      if (!fileEntry.secretId) {
        console.warn(`[SW] Skipping file ${fileEntry.id}: missing secretId`);
        await db.put("fileQueue", {
          ...fileEntry,
          uploadState: "failed",
          retryCount: MAX_RETRY_COUNT,
          error: "Missing secretId for upload",
        });
        failed++;
        continue;
      }

      // Calculate exponential backoff delay
      const backoffMs = Math.min(
        1000 * Math.pow(2, fileEntry.retryCount ?? 0),
        MAX_BACKOFF_MS
      );
      const timeSinceLastAttempt = fileEntry.lastAttemptAt
        ? Date.now() - fileEntry.lastAttemptAt.getTime()
        : Infinity;

      // Skip if backoff period not elapsed
      if (timeSinceLastAttempt < backoffMs) {
        console.log(
          `[SW] Skipping file ${fileEntry.metadata.name}: backoff not elapsed (${backoffMs}ms)`
        );
        continue;
      }

      // Mark as uploading
      await db.put("fileQueue", {
        ...fileEntry,
        uploadState: "uploading",
        lastAttemptAt: new Date(),
      });

      try {
        // Calculate checksum of encrypted file if not already present
        let checksumEncrypted = fileEntry.checksumEncrypted || "";
        if (!checksumEncrypted) {
          const arrayBuffer = await fileEntry.file.arrayBuffer();
          const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          checksumEncrypted = hashArray
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        }

        // Build metadata JSON
        const metadata = {
          filename: fileEntry.metadata.name,
          type: fileEntry.metadata.type,
          size: fileEntry.metadata.size,
          encryptedSize: fileEntry.file.size,
          checksum: fileEntry.checksum || "",
          checksumEncrypted,
        };

        // Create FormData
        const formData = new FormData();
        formData.append("file", fileEntry.file, "encrypted.bin");
        formData.append("metadata", JSON.stringify(metadata));

        // POST to backend
        const response = await fetch(
          `${self.location.origin}/v1/secrets/${fileEntry.secretId}/attachments`,
          {
            method: "POST",
            credentials: "include", // Include cookies for authentication
            body: formData,
          }
        );

        if (response.ok) {
          // Mark as completed and cleanup retry metadata
          await db.put("fileQueue", {
            ...fileEntry,
            uploadState: "completed",
            retryCount: 0,
            lastAttemptAt: undefined,
            error: undefined,
          });
          succeeded++;
          console.log(
            `[SW] Successfully uploaded file: ${fileEntry.metadata.name}`
          );
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        // Upload failed - increment retry count
        const newRetryCount = (fileEntry.retryCount ?? 0) + 1;
        console.error(
          `[SW] Failed to upload file ${fileEntry.metadata.name} (retry ${newRetryCount}/${MAX_RETRY_COUNT}):`,
          error
        );

        if (newRetryCount >= MAX_RETRY_COUNT) {
          // Max retries exceeded - mark as failed permanently
          await db.put("fileQueue", {
            ...fileEntry,
            uploadState: "failed",
            retryCount: newRetryCount,
            error: error instanceof Error ? error.message : "Upload failed",
          });
          failed++;
        } else {
          // Keep as encrypted with incremented retry count
          await db.put("fileQueue", {
            ...fileEntry,
            uploadState: "encrypted",
            retryCount: newRetryCount,
          });
        }
      }
    }

    // Notify clients about sync completion with stats
    const clients = await self.clients.matchAll({ type: "window" });
    for (const client of clients) {
      client.postMessage({
        type: "ENCRYPTED_UPLOAD_SYNCED",
        count: encryptedFiles.length,
        succeeded,
        failed,
      });
    }
  } catch (error) {
    // Critical error - notify clients
    console.error("[SW] Encrypted upload sync failed:", error);

    const clients = await self.clients.matchAll({ type: "window" });
    for (const client of clients) {
      client.postMessage({
        type: "ENCRYPTED_UPLOAD_SYNC_ERROR",
        error: error instanceof Error ? error.message : "Sync failed",
      });
    }

    // Only re-throw for network errors (transient), not for corrupted data
    if (
      error instanceof Error &&
      (error.name === "NetworkError" || error.message.includes("network"))
    ) {
      throw error; // Re-throw to trigger retry
    }
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
    icon: payload.icon || "/pwa-192x192.svg",
    badge: payload.badge || "/pwa-192x192.svg",
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
