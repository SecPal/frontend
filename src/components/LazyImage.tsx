// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useState, useEffect, useRef } from "react";
import clsx from "clsx";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /**
   * Image source URL (loaded lazily)
   */
  src: string;

  /**
   * Alternative text for accessibility
   */
  alt: string;

  /**
   * Placeholder image to show while loading (optional)
   *
   * Use a lightweight data URL or static asset
   */
  placeholder?: string;

  /**
   * Root margin for Intersection Observer (default: "200px")
   *
   * Triggers loading when image is within this distance from viewport
   */
  rootMargin?: string;

  /**
   * Callback fired when image successfully loads
   */
  onLoad?: () => void;

  /**
   * Callback fired when image fails to load
   */
  onError?: () => void;
}

/**
 * Lazy-loaded image component with Intersection Observer
 *
 * Features:
 * - Only loads images when they enter viewport (or near viewport)
 * - Shows placeholder during loading
 * - Blur-up effect on load
 * - Supports all standard img attributes
 * - Accessible (proper alt text)
 *
 * @example
 * ```tsx
 * <LazyImage
 *   src="/images/large-photo.jpg"
 *   alt="Description"
 *   placeholder="data:image/svg+xml;base64,..."
 *   className="w-full h-64 object-cover"
 * />
 * ```
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  placeholder,
  rootMargin = "200px",
  onLoad,
  onError,
  className,
  ...props
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [imageSrc, setImageSrc] = useState(placeholder || "");
  const [shouldLoad, setShouldLoad] = useState(
    !("IntersectionObserver" in window)
  );
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (shouldLoad && !loaded && !error) {
      const tempImg = new Image();
      tempImg.src = src;

      tempImg.onload = () => {
        setImageSrc(src);
        setLoaded(true);
        onLoad?.();
      };

      tempImg.onerror = () => {
        setError(true);
        onError?.();
      };
    }
  }, [shouldLoad, loaded, error, src, onLoad, onError]);

  useEffect(() => {
    if (!imgRef.current || !("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            // Stop observing once we've detected intersection
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin,
        threshold: 0.01,
      }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin]);

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={clsx(className, "transition-opacity duration-300", {
        "opacity-0": !loaded && !error,
        "opacity-100": loaded,
        "opacity-50": error,
      })}
      {...props}
    />
  );
};
