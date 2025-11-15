// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect } from "react";

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

  useEffect(() => {
    // Only run in browser
    if (typeof window === "undefined") return;

    const handleShareTarget = () => {
      try {
        const url = new URL(window.location.href);

        // Check if this is a share target navigation
        if (url.pathname === "/share" && url.searchParams.size > 0) {
          // Parse share data with explicit null/empty checks
          const title = url.searchParams.get("title");
          const text = url.searchParams.get("text");
          const urlParam = url.searchParams.get("url");

          // Parse files from sessionStorage (set by Service Worker for POST requests)
          const filesJson = sessionStorage.getItem("share-target-files");
          let files: SharedFile[] | undefined;

          if (filesJson) {
            try {
              files = JSON.parse(filesJson) as SharedFile[];
            } catch (error) {
              console.error("Failed to parse shared files:", error);
            }
          }

          const data: SharedData = {
            title: title !== null && title !== "" ? title : undefined,
            text: text !== null && text !== "" ? text : undefined,
            url: urlParam !== null && urlParam !== "" ? urlParam : undefined,
            files,
          };

          setSharedData(data);

          // Clean up URL without the share parameters (preserve hash)
          // Only update history if replaceState is available
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
      } catch (error) {
        console.error("Failed to process share target:", error);
      }
    };

    handleShareTarget();

    // Listen for navigation events (popstate) to detect URL changes for multiple shares
    window.addEventListener("popstate", handleShareTarget);

    // Clean up event listener on unmount
    return () => {
      window.removeEventListener("popstate", handleShareTarget);
    };
  }, []);

  const clearSharedData = () => {
    setSharedData(null);
    // Also clear files from sessionStorage
    sessionStorage.removeItem("share-target-files");
  };

  return {
    sharedData,
    clearSharedData,
  };
}
