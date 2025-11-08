// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect } from "react";

/**
 * Data structure for shared content received via Share Target API
 * Note: File sharing is not yet implemented. The hook currently only handles
 * text-based sharing (title, text, url). File support planned for Issue #101.
 */
export interface SharedData {
  title?: string;
  text?: string;
  url?: string;
  // files?: File[]; // Planned for future implementation (Issue #101)
}

interface UseShareTargetReturn {
  isSharing: boolean;
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
  const [isSharing, setIsSharing] = useState(false);
  const [sharedData, setSharedData] = useState<SharedData | null>(null);

  useEffect(() => {
    // Only run in browser
    if (typeof window === "undefined") return;

    const handleShareTarget = () => {
      try {
        const url = new URL(window.location.href);

        // Check if this is a share target navigation
        if (url.pathname === "/share" && url.searchParams.size > 0) {
          setIsSharing(true);

          // Parse share data with explicit null/empty checks
          const title = url.searchParams.get("title");
          const text = url.searchParams.get("text");
          const urlParam = url.searchParams.get("url");

          const data: SharedData = {
            title: title !== null && title !== "" ? title : undefined,
            text: text !== null && text !== "" ? text : undefined,
            url: urlParam !== null && urlParam !== "" ? urlParam : undefined,
          };

          // Handle files from POST request (if available)
          // Note: Files are typically handled via formData in the Service Worker
          // This is a simplified client-side version for GET-based sharing

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

          setIsSharing(false);
        }
      } catch (error) {
        console.error("Failed to process share target:", error);
        setIsSharing(false);
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
  };

  return {
    isSharing,
    sharedData,
    clearSharedData,
  };
}
