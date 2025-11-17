// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback } from "react";

/**
 * Data structure for shared content received via Share Target API
 */
export interface SharedData {
  title?: string;
  text?: string;
  url?: string;
  files?: SharedFile[];
}

export interface SharedFile {
  id?: string; // Queue ID (from IndexedDB)
  name: string;
  type: string;
  size: number;
  dataUrl?: string; // Base64 data URL for image previews
}

interface UseShareTargetReturn {
  sharedData: SharedData | null;
  clearSharedData: () => void;
}

/**
 * Hook for handling data shared to the PWA from other apps
 * Automatically detects when the app is opened via Share Target API
 *
 * @example
 * ```tsx
 * const { isSharing, sharedData, clearSharedData } = useShareTarget();
 *
 * useEffect(() => {
 *   if (sharedData) {
 *     // Handle the shared data
 *     processSharedData(sharedData);
 *     clearSharedData();
 *   }
 * }, [sharedData]);
 * ```
 */
export function useShareTarget(): UseShareTargetReturn {
  const [sharedData, setSharedData] = useState<SharedData | null>(null);

  /**
   * Handle Service Worker messages for shared files
   *
   * Memoized with empty deps: URL is read on-demand when message arrives,
   * which is correct behavior since we want the current URL at message time.
   */
  const handleServiceWorkerMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type === "SHARE_TARGET_FILES") {
      const { shareId, files } = event.data;

      // Parse URL parameters for text data
      const url = new URL(window.location.href);
      const urlShareId = url.searchParams.get("share_id");

      // Only process if shareId matches (prevents stale messages)
      if (urlShareId === shareId) {
        const title = url.searchParams.get("title");
        const text = url.searchParams.get("text");
        const urlParam = url.searchParams.get("url");

        const data: SharedData = {
          title: title !== null && title !== "" ? title : undefined,
          text: text !== null && text !== "" ? text : undefined,
          url: urlParam !== null && urlParam !== "" ? urlParam : undefined,
          files: files as SharedFile[] | undefined,
        };

        setSharedData(data);

        // Clean up URL without the share parameters (preserve hash)
        if (window.history?.replaceState) {
          window.history.replaceState(
            {},
            "",
            window.location.pathname === "/share"
              ? "/" + window.location.hash
              : window.location.pathname + window.location.hash
          );
        }
      }
    }
  }, []);

  /**
   * Handle share target navigation (URL params)
   *
   * Memoized with empty deps: Reads URL on-demand when called (mount or popstate).
   * This is intentional - we want to read the URL at the time of the event, not
   * create a new handler when URL changes.
   */
  const handleShareTarget = useCallback(() => {
    try {
      const url = new URL(window.location.href);

      // Check if this is a share target navigation
      if (url.pathname === "/share" && url.searchParams.size > 0) {
        // Parse share data with explicit null/empty checks
        const title = url.searchParams.get("title");
        const text = url.searchParams.get("text");
        const urlParam = url.searchParams.get("url");

        // Files are now handled via Service Worker messages
        // This fallback handles cases where SW message hasn't arrived yet
        const data: SharedData = {
          title: title !== null && title !== "" ? title : undefined,
          text: text !== null && text !== "" ? text : undefined,
          url: urlParam !== null && urlParam !== "" ? urlParam : undefined,
          files: undefined, // Will be populated by SW message
        };

        // Only set if we have text data (files come later via SW)
        if (data.title || data.text || data.url) {
          setSharedData((prev) => ({
            ...prev,
            ...data,
          }));
        }
      }
    } catch (error) {
      console.error("Failed to process share target:", error);
    }
  }, []);

  useEffect(() => {
    // Only run in browser
    if (typeof window === "undefined") return;

    // Handle share target on mount and navigation events (popstate)
    // Handler is memoized and reads URL at event time (not stale)
    // setState here is safe: triggered by external system (Share Target API navigation)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleShareTarget();

    // Listen for Service Worker messages
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener(
        "message",
        handleServiceWorkerMessage
      );
    }

    // Listen for navigation events (popstate) to detect URL changes for multiple shares
    window.addEventListener("popstate", handleShareTarget);

    // Clean up event listeners on unmount
    return () => {
      window.removeEventListener("popstate", handleShareTarget);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener(
          "message",
          handleServiceWorkerMessage
        );
      }
    };
  }, [handleShareTarget, handleServiceWorkerMessage]);

  const clearSharedData = () => {
    setSharedData(null);
  };

  return {
    sharedData,
    clearSharedData,
  };
}
