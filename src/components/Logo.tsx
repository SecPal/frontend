// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

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

const LOGO_DISPLAY_SIZE_PX = {
  "16": 16,
  "32": 32,
  "48": 48,
  "64": 64,
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
  const displayWidth = LOGO_DISPLAY_SIZE_PX[size];

  return (
    <div role="img" aria-label="SecPal" className={className}>
      <img
        src={LIGHT_LOGO_RASTER.src}
        alt=""
        aria-hidden="true"
        className="dark:hidden"
        width={LIGHT_LOGO_RASTER.width}
        height={LIGHT_LOGO_RASTER.height}
        decoding="async"
        style={{ width: `${displayWidth}px`, height: "auto" }}
      />
      <img
        src={DARK_LOGO_RASTER.src}
        alt=""
        aria-hidden="true"
        className="hidden dark:block"
        width={DARK_LOGO_RASTER.width}
        height={DARK_LOGO_RASTER.height}
        decoding="async"
        style={{ width: `${displayWidth}px`, height: "auto" }}
      />
    </div>
  );
}
