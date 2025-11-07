// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect } from "react";

export interface SharedData {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
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
        // This is a simplified client-side version

        setSharedData(data);

        // Clean up URL without the share parameters (preserve hash)
        const cleanUrl =
          window.location.pathname === "/share"
            ? "/"
            : window.location.pathname;
        window.history.replaceState({}, "", cleanUrl + window.location.hash);

        setIsSharing(false);
      }
    };

    handleShareTarget();
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
