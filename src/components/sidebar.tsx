// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { createContext, forwardRef, useContext } from "react";
import type { LinkProps as RouterLinkProps } from "react-router-dom";
import { cn } from "@/lib/utils";
import { PrefetchLink } from "./PrefetchLink";

const SidebarCloseContext = createContext<(() => void) | null>(null);

export function SidebarCloseProvider({
  close,
  children,
}: React.PropsWithChildren<{ close: () => void }>) {
  return (
    <SidebarCloseContext.Provider value={close}>
      {children}
    </SidebarCloseContext.Provider>
  );
}

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

export function Sidebar({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"nav">) {
  return (
    <nav
      {...props}
      data-slot="app-sidebar"
      className={cn("flex h-full min-h-0 flex-col", className)}
    />
  );
}

export function SidebarHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      data-slot="app-sidebar-header"
      className={cn(
        "flex flex-col border-b border-zinc-950/5 p-4 dark:border-white/5 [&>[data-slot=section]+[data-slot=section]]:mt-2.5",
        className
      )}
    />
  );
}

export function SidebarBody({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      data-slot="app-sidebar-body"
      className={cn(
        "flex flex-1 flex-col overflow-y-auto p-4 [&>[data-slot=section]+[data-slot=section]]:mt-8",
        className
      )}
    />
  );
}

export function SidebarFooter({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      data-slot="app-sidebar-footer"
      className={cn(
        "flex flex-col border-t border-zinc-950/5 p-4 dark:border-white/5 [&>[data-slot=section]+[data-slot=section]]:mt-2.5",
        className
      )}
    />
  );
}

export function SidebarSection({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      data-slot="section"
      className={cn("flex flex-col gap-0.5", className)}
    />
  );
}

export function SidebarDivider({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"hr">) {
  return (
    <hr
      {...props}
      className={cn(
        "my-4 border-t border-zinc-950/5 lg:-mx-4 dark:border-white/5",
        className
      )}
    />
  );
}

export function SidebarSpacer({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-hidden="true"
      {...props}
      className={cn("mt-8 flex-1", className)}
    />
  );
}

export function SidebarHeading({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"h3">) {
  return (
    <h3
      {...props}
      className={cn(
        "mb-1 px-2 text-xs/6 font-medium text-zinc-500 dark:text-zinc-400",
        className
      )}
    />
  );
}

type SidebarItemProps = {
  current?: boolean;
  className?: string;
  children: React.ReactNode;
} & (
  | ({ href?: never } & React.ButtonHTMLAttributes<HTMLButtonElement>)
  | ({ href: string } & Omit<RouterLinkProps, "to" | "className">)
);

export const SidebarItem = forwardRef<
  HTMLAnchorElement | HTMLButtonElement,
  SidebarItemProps
>(function SidebarItem({ current, className, children, ...props }, ref) {
  const closeSidebar = useContext(SidebarCloseContext);
  const classes = cn(
    "relative flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left text-base/6 font-medium text-zinc-950 transition-colors sm:py-2 sm:text-sm/5",
    "*:data-[slot=icon]:size-6 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:text-zinc-500 sm:*:data-[slot=icon]:size-5",
    "*:last:data-[slot=icon]:ml-auto *:last:data-[slot=icon]:size-5 sm:*:last:data-[slot=icon]:size-4",
    "*:data-[slot=avatar]:-m-0.5 *:data-[slot=avatar]:size-7 sm:*:data-[slot=avatar]:size-6",
    "hover:bg-zinc-950/5 hover:*:data-[slot=icon]:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
    "data-[current=true]:bg-zinc-950/5 data-[current=true]:*:data-[slot=icon]:text-zinc-950",
    "dark:text-white dark:*:data-[slot=icon]:text-zinc-400 dark:hover:bg-white/5 dark:hover:*:data-[slot=icon]:text-white dark:data-[current=true]:*:data-[slot=icon]:text-white dark:focus-visible:ring-offset-zinc-950"
  );

  const indicator = current ? (
    <span className="absolute inset-y-2 -left-4 w-0.5 rounded-full bg-zinc-950 dark:bg-white" />
  ) : null;

  if ("href" in props && typeof props.href === "string") {
    const { href, onClick: linkOnClick, ...linkProps } = props;
    return (
      <span className={cn("relative", className)}>
        {indicator}
        <PrefetchLink
          {...linkProps}
          to={href}
          className={classes}
          data-current={current ? "true" : undefined}
          ref={ref as React.ForwardedRef<HTMLAnchorElement>}
          onClick={(event) => {
            linkOnClick?.(event);
            if (!event.defaultPrevented) {
              closeSidebar?.();
            }
          }}
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

export function SidebarLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"span">) {
  return <span {...props} className={cn("truncate", className)} />;
}
