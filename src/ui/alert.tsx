// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import * as React from "react";
import { cn } from "@/lib/utils";

export const Alert = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(function Alert({ className, role, ...props }, ref) {
  const resolvedRole =
    role ??
    (typeof className === "string" && className.includes("destructive")
      ? "alert"
      : undefined);

  return (
    <div
      ref={ref}
      role={resolvedRole}
      data-slot="alert"
      className={cn(
        "relative grid w-full grid-cols-[0_1fr] rounded-lg border border-border px-4 py-3 text-sm text-card-foreground [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:top-4 [&>svg]:left-4 [&>svg~*]:pl-7",
        className
      )}
      {...props}
    />
  );
});

export function AlertTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"h2">) {
  return (
    <h2
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-normal",
        className
      )}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"p">) {
  return (
    <p
      data-slot="alert-description"
      className={cn(
        "text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  );
}
