// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { forwardRef } from "react";
import type { LinkProps as RouterLinkProps } from "react-router-dom";
import { cn } from "@/lib/utils";
import { PrefetchLink } from "./PrefetchLink";

function TouchTarget({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span
        className="pointer-fine:hidden absolute top-1/2 left-1/2 size-[max(100%,2.75rem)] -translate-x-1/2 -translate-y-1/2"
        aria-hidden="true"
      />
      {children}
    </>
  );
}

export function Navbar({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"nav">) {
  return (
    <nav
      {...props}
      data-slot="app-navbar"
      className={cn("flex flex-1 items-center gap-4 py-2.5", className)}
    />
  );
}

export function NavbarDivider({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-hidden="true"
      {...props}
      className={cn("h-6 w-px bg-zinc-950/10 dark:bg-white/10", className)}
    />
  );
}

export function NavbarSection({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      data-slot="app-navbar-section"
      className={cn("flex items-center gap-3", className)}
    />
  );
}

export function NavbarSpacer({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-hidden="true"
      {...props}
      className={cn("-ml-4 flex-1", className)}
    />
  );
}

type NavbarItemProps = {
  current?: boolean;
  className?: string;
  children: React.ReactNode;
} & (
  | ({ href?: never } & React.ButtonHTMLAttributes<HTMLButtonElement>)
  | ({ href: string } & Omit<RouterLinkProps, "to" | "className">)
);

export const NavbarItem = forwardRef<
  HTMLAnchorElement | HTMLButtonElement,
  NavbarItemProps
>(function NavbarItem({ current, className, children, ...props }, ref) {
  const classes = cn(
    "relative flex min-w-0 items-center gap-3 rounded-md p-2 text-left text-base/6 font-medium text-zinc-950 transition-colors sm:text-sm/5",
    "*:data-[slot=icon]:size-6 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:text-zinc-500 sm:*:data-[slot=icon]:size-5",
    "*:not-nth-2:last:data-[slot=icon]:ml-auto *:not-nth-2:last:data-[slot=icon]:size-5 sm:*:not-nth-2:last:data-[slot=icon]:size-4",
    "*:data-[slot=avatar]:-m-0.5 *:data-[slot=avatar]:size-7 sm:*:data-[slot=avatar]:size-6",
    "hover:bg-zinc-950/5 hover:*:data-[slot=icon]:text-zinc-950 data-[state=open]:bg-zinc-950/5",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
    "data-[current=true]:bg-zinc-950/5 data-[current=true]:*:data-[slot=icon]:text-zinc-950",
    "dark:text-white dark:*:data-[slot=icon]:text-zinc-400 dark:hover:bg-white/5 dark:hover:*:data-[slot=icon]:text-white dark:data-[state=open]:bg-white/5 dark:data-[current=true]:bg-white/5 dark:data-[current=true]:*:data-[slot=icon]:text-white dark:focus-visible:ring-offset-zinc-950"
  );

  const indicator = current ? (
    <span className="absolute inset-x-2 -bottom-2.5 h-0.5 rounded-full bg-zinc-950 dark:bg-white" />
  ) : null;

  if ("href" in props && typeof props.href === "string") {
    const { href, ...linkProps } = props;
    return (
      <span className={cn("relative", className)}>
        {indicator}
        <PrefetchLink
          {...linkProps}
          to={href}
          className={classes}
          data-current={current ? "true" : undefined}
          ref={ref as React.ForwardedRef<HTMLAnchorElement>}
        >
          <TouchTarget>{children}</TouchTarget>
        </PrefetchLink>
      </span>
    );
  }

  return (
    <span className={cn("relative", className)}>
      {indicator}
      <button
        {...props}
        type={props.type ?? "button"}
        className={classes}
        data-current={current ? "true" : undefined}
        ref={ref as React.ForwardedRef<HTMLButtonElement>}
      >
        <TouchTarget>{children}</TouchTarget>
      </button>
    </span>
  );
});

export function NavbarLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"span">) {
  return <span {...props} className={cn("truncate", className)} />;
}
