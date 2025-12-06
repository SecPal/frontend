// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import clsx from "clsx";

/**
 * Spinner component for loading states
 *
 * A minimal, non-intrusive loading indicator that can be used
 * in various contexts (dialogs, lazy loading, etc.)
 */
export function Spinner({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-2",
    lg: "h-12 w-12 border-2",
  };

  return (
    <div
      className={clsx(
        "animate-spin rounded-full border-transparent border-t-blue-600 dark:border-t-blue-400",
        sizeClasses[size],
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

/**
 * Centered spinner container for full-page/section loading
 */
export function SpinnerContainer({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-center justify-center", className)}>
      {children || <Spinner />}
    </div>
  );
}
