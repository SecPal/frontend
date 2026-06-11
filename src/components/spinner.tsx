// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Spinner as UiSpinner } from "@/ui";
import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export function Spinner({
  size = "md",
  className,
  "aria-label": ariaLabel = "Loading...",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <UiSpinner
      aria-label={ariaLabel}
      className={cn(sizeClasses[size], className)}
    />
  );
}

export function SpinnerContainer({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      {children || <Spinner />}
    </div>
  );
}
