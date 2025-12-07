// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Page } from "@playwright/test";

/**
 * Utility functions for testing offline functionality
 */

/**
 * Go offline and verify offline indicator is shown
 */
export async function goOffline(page: Page): Promise<void> {
  await page.context().setOffline(true);
  // Wait for offline indicator to appear
  await page.waitForTimeout(500);
}

/**
 * Go back online
 */
export async function goOnline(page: Page): Promise<void> {
  await page.context().setOffline(false);
  await page.waitForTimeout(500);
}

/**
 * Pre-cache a page by visiting it while online
 */
export async function precachePage(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  // Give service worker time to cache
  await page.waitForTimeout(1000);
}

/**
 * Pre-cache multiple pages
 */
export async function precachePages(page: Page, urls: string[]): Promise<void> {
  for (const url of urls) {
    await precachePage(page, url);
  }
}

/**
 * Clear all caches (Service Worker + IndexedDB)
 */
export async function clearAllCaches(page: Page): Promise<void> {
  await page.evaluate(async () => {
    // Clear Service Worker caches
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }

    // Clear IndexedDB
    if ("indexedDB" in window) {
      const databases = await indexedDB.databases();
      databases.forEach((db) => {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
        }
      });
    }

    // Clear localStorage
    localStorage.clear();

    // Clear sessionStorage
    sessionStorage.clear();
  });

  await page.waitForTimeout(500);
}

/**
 * Wait for service worker to be ready
 */
export async function waitForServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if ("serviceWorker" in navigator) {
      await navigator.serviceWorker.ready;
    }
  });
}

/**
 * Check if service worker is active
 */
export async function isServiceWorkerActive(page: Page): Promise<boolean> {
  return await page.evaluate(async () => {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      return registration.active !== null;
    }
    return false;
  });
}

/**
 * Get cached organizational units count from IndexedDB
 */
export async function getCachedOrgUnitsCount(page: Page): Promise<number> {
  return await page.evaluate(async () => {
    return new Promise<number>((resolve) => {
      const request = indexedDB.open("secpal-db");

      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("organizationalUnitCache")) {
          resolve(0);
          return;
        }

        const transaction = db.transaction(
          "organizationalUnitCache",
          "readonly"
        );
        const store = transaction.objectStore("organizationalUnitCache");
        const countRequest = store.count();

        countRequest.onsuccess = () => {
          resolve(countRequest.result);
        };

        countRequest.onerror = () => {
          resolve(0);
        };
      };

      request.onerror = () => {
        resolve(0);
      };
    });
  });
}

/**
 * Get cached secrets count from IndexedDB
 */
export async function getCachedSecretsCount(page: Page): Promise<number> {
  return await page.evaluate(async () => {
    return new Promise<number>((resolve) => {
      const request = indexedDB.open("secpal-db");

      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("secretCache")) {
          resolve(0);
          return;
        }

        const transaction = db.transaction("secretCache", "readonly");
        const store = transaction.objectStore("secretCache");
        const countRequest = store.count();

        countRequest.onsuccess = () => {
          resolve(countRequest.result);
        };

        countRequest.onerror = () => {
          resolve(0);
        };
      };

      request.onerror = () => {
        resolve(0);
      };
    });
  });
}

/**
 * Simulate slow network conditions
 */
export async function simulateSlowNetwork(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: (50 * 1024) / 8, // 50kb/s
    uploadThroughput: (20 * 1024) / 8, // 20kb/s
    latency: 500, // 500ms latency
  });
}

/**
 * Disable network throttling
 */
export async function disableNetworkThrottling(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: -1,
    uploadThroughput: -1,
    latency: 0,
  });
}

/**
 * Block specific API endpoints
 */
export async function blockApiEndpoint(
  page: Page,
  pattern: string
): Promise<void> {
  await page.route(pattern, (route) => {
    route.abort("failed");
  });
}

/**
 * Unblock all routes
 */
export async function unblockAllRoutes(page: Page): Promise<void> {
  await page.unroute("**/*");
}
