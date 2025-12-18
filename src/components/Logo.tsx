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

export function Logo({ className = "", size = "64" }: LogoProps) {
  return (
    <div role="img" aria-label="SecPal" className={className}>
      <img
        src={`/logo-light-${size}.png`}
        alt=""
        aria-hidden="true"
        className="dark:hidden"
        width={size}
        height={size}
      />
      <img
        src={`/logo-dark-${size}.png`}
        alt=""
        aria-hidden="true"
        className="hidden dark:block"
        width={size}
        height={size}
      />
    </div>
  );
}
