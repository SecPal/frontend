// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { cn } from "@/lib/utils";

/**
 * SecPal Logo Component
 *
 * Simple, clean logo display with automatic dark mode support.
 * - Light mode: Dark shield on transparent background
 * - Dark mode: White shield on transparent background
 *
 * No padding, no background - just the pure logo.
 */

interface LogoProps {
  className?: string;
  size?: "16" | "32" | "48" | "64";
}

const LOGO_SIZE_CLASS = {
  "16": "w-4",
  "32": "w-8",
  "48": "w-12",
  "64": "w-16",
} as const;

const LIGHT_LOGO_RASTER = {
  src: "/logo-light-128.png",
  width: 128,
  height: 119,
} as const;

const DARK_LOGO_RASTER = {
  src: "/logo-dark-128.png",
  width: 128,
  height: 118,
} as const;

export function Logo({ className = "", size = "64" }: LogoProps) {
  const sizeClassName = LOGO_SIZE_CLASS[size];

  return (
    <div role="img" aria-label="SecPal" className={className}>
      <img
        src={LIGHT_LOGO_RASTER.src}
        alt=""
        aria-hidden="true"
        className={cn("h-auto dark:hidden", sizeClassName)}
        width={LIGHT_LOGO_RASTER.width}
        height={LIGHT_LOGO_RASTER.height}
        decoding="async"
      />
      <img
        src={DARK_LOGO_RASTER.src}
        alt=""
        aria-hidden="true"
        className={cn("hidden h-auto dark:block", sizeClassName)}
        width={DARK_LOGO_RASTER.width}
        height={DARK_LOGO_RASTER.height}
        decoding="async"
      />
    </div>
  );
}
