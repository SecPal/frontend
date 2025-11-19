// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useRef } from "react";

/**
 * Prefetch resources on idle or hover for improved perceived performance
 *
 * Implements intelligent prefetching strategies:
 * - On idle: Prefetch when browser has spare CPU cycles
 * - On hover: Prefetch when user hovers over link (anticipate click)
 *
 * @example
 * ```tsx
 * const { prefetchOnIdle, prefetchOnHover } = usePrefetch();
 *
 * // Prefetch when browser is idle
 * useEffect(() => {
 *   prefetchOnIdle('/api/v1/secrets');
 * }, []);
 *
 * // Prefetch when user hovers over link
 * <Link to="/secrets/123" {...prefetchOnHover('/api/v1/secrets/123')}>
 *   View Secret
 * </Link>
 * ```
 */
export const usePrefetch = () => {
  const prefetchedUrls = useRef<Set<string>>(new Set());

  /**
   * Prefetch resource when browser is idle
   *
   * Uses requestIdleCallback to avoid blocking main thread
   *
   * @param url - URL to prefetch
   * @param options - Fetch options
   */
  const prefetchOnIdle = useCallback((url: string, options?: RequestInit) => {
    // Avoid prefetching same URL multiple times
    if (prefetchedUrls.current.has(url)) {
      return;
    }

    if ("requestIdleCallback" in window) {
      requestIdleCallback(
        () => {
          const fetchOptions: RequestInit = { ...options };
          // Only add priority if supported (experimental API)
          if ("priority" in Request.prototype) {
            (fetchOptions as RequestInit & { priority: string }).priority =
              "low";
          }
          fetch(url, fetchOptions)
            .then(() => {
              prefetchedUrls.current.add(url);
              if (import.meta.env.DEV) {
                console.log(`[Prefetch] Prefetched on idle: ${url}`);
              }
            })
            .catch((error) => {
              if (import.meta.env.DEV) {
                console.warn(`[Prefetch] Failed to prefetch ${url}:`, error);
              }
            });
        },
        { timeout: 2000 }
      );
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        fetch(url, options)
          .then(() => {
            prefetchedUrls.current.add(url);
          })
          .catch(() => {
            // Silently fail - prefetch is best-effort
          });
      }, 100);
    }
  }, []);

  /**
   * Prefetch resource on hover (anticipate user click)
   *
   * Returns event handlers for React elements
   *
   * @param url - URL to prefetch
   * @returns Object with onMouseEnter and onTouchStart handlers
   */
  const prefetchOnHover = useCallback((url: string) => {
    // Avoid prefetching same URL multiple times
    if (prefetchedUrls.current.has(url)) {
      return {};
    }

    const prefetch = () => {
      // Use <link rel="prefetch"> for better browser optimization
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = url;
      link.as = "fetch";
      document.head.appendChild(link);

      prefetchedUrls.current.add(url);
      if (import.meta.env.DEV) {
        console.log(`[Prefetch] Prefetched on hover: ${url}`);
      }

      // Clean up link after 5 seconds
      setTimeout(() => {
        try {
          if (link.parentNode === document.head) {
            document.head.removeChild(link);
          }
        } catch {
          // Link already removed or never added; ignore
        }
      }, 5000);
    };

    return {
      onMouseEnter: prefetch,
      onTouchStart: prefetch, // Also trigger on touch for mobile
    };
  }, []);

  /**
   * Prefetch multiple URLs in batch
   *
   * @param urls - Array of URLs to prefetch
   * @param options - Fetch options
   */
  const prefetchBatch = useCallback(
    (urls: string[], options?: RequestInit) => {
      urls.forEach((url) => prefetchOnIdle(url, options));
    },
    [prefetchOnIdle]
  );

  /**
   * Clear prefetch cache (for testing/debugging)
   */
  const clearPrefetchCache = useCallback(() => {
    prefetchedUrls.current.clear();
    if (import.meta.env.DEV) {
      console.log("[Prefetch] Cleared prefetch cache");
    }
  }, []);

  return {
    prefetchOnIdle,
    prefetchOnHover,
    prefetchBatch,
    clearPrefetchCache,
  };
};
