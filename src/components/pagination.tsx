// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Pagination({
  "aria-label": ariaLabel = "Page navigation",
  className,
  ...props
}: React.ComponentPropsWithoutRef<"nav">) {
  return (
    <nav
      aria-label={ariaLabel}
      {...props}
      className={cn("flex gap-x-2", className)}
    />
  );
}

export function PaginationPrevious({
  href = null,
  className,
  children = "Previous",
}: React.PropsWithChildren<{ href?: string | null; className?: string }>) {
  return (
    <span className={cn("grow basis-0", className)}>
      <Button
        {...(href === null ? { disabled: true } : { href })}
        plain
        aria-label="Previous page"
      >
        <ArrowLeft className="size-4" data-slot="icon" aria-hidden="true" />
        {children}
      </Button>
    </span>
  );
}

export function PaginationNext({
  href = null,
  className,
  children = "Next",
}: React.PropsWithChildren<{ href?: string | null; className?: string }>) {
  return (
    <span className={cn("flex grow basis-0 justify-end", className)}>
      <Button
        {...(href === null ? { disabled: true } : { href })}
        plain
        aria-label="Next page"
      >
        {children}
        <ArrowRight className="size-4" data-slot="icon" aria-hidden="true" />
      </Button>
    </span>
  );
}

export function PaginationList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      {...props}
      className={cn("hidden items-baseline gap-x-2 sm:flex", className)}
    />
  );
}

export function PaginationPage({
  href,
  className,
  current = false,
  children,
}: React.PropsWithChildren<{
  href: string;
  className?: string;
  current?: boolean;
}>) {
  return (
    <Button
      href={href}
      plain
      aria-label={`Page ${children}`}
      aria-current={current ? "page" : undefined}
      className={cn(
        "min-w-9 before:absolute before:-inset-px before:rounded-md",
        current && "before:bg-zinc-950/5 dark:before:bg-white/10",
        className
      )}
    >
      <span className="-mx-0.5">{children}</span>
    </Button>
  );
}

export function PaginationGap({
  className,
  children = <>&hellip;</>,
  ...props
}: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      aria-hidden="true"
      {...props}
      className={cn(
        "w-9 text-center text-sm/6 font-semibold text-zinc-950 select-none dark:text-white",
        className
      )}
    >
      {children}
    </span>
  );
}
