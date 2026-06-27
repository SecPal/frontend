// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import type React from "react";
import { createContext, forwardRef, useContext } from "react";
import type { LinkProps as RouterLinkProps } from "react-router-dom";
import { cn } from "@/lib/utils";
import { PrefetchLink } from "@/components/PrefetchLink";

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

interface NavbarItemBaseProps {
  current?: boolean;
  className?: string;
  children: React.ReactNode;
}

export interface NavbarItemButtonProps
  extends
    NavbarItemBaseProps,
    Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      "className" | "children"
    > {
  href?: never;
}

export interface NavbarItemLinkProps
  extends
    NavbarItemBaseProps,
    Omit<RouterLinkProps, "to" | "className" | "children"> {
  href: string;
}

export type NavbarItemProps = NavbarItemButtonProps | NavbarItemLinkProps;

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

interface SidebarItemBaseProps {
  current?: boolean;
  className?: string;
  children: React.ReactNode;
}

export interface SidebarItemButtonProps
  extends
    SidebarItemBaseProps,
    Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      "className" | "children"
    > {
  href?: never;
}

export interface SidebarItemLinkProps
  extends
    SidebarItemBaseProps,
    Omit<RouterLinkProps, "to" | "className" | "children"> {
  href: string;
}

export type SidebarItemProps = SidebarItemButtonProps | SidebarItemLinkProps;

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

type DropdownAnchor =
  | "top"
  | "top start"
  | "top end"
  | "right"
  | "right start"
  | "right end"
  | "bottom"
  | "bottom start"
  | "bottom end"
  | "left"
  | "left start"
  | "left end";

function parseAnchor(anchor: DropdownAnchor): {
  side: "top" | "right" | "bottom" | "left";
  align: "start" | "center" | "end";
} {
  const [side, align] = anchor.split(" ") as [
    "top" | "right" | "bottom" | "left",
    "start" | "end" | undefined,
  ];
  return { side, align: align ?? "center" };
}

export function Dropdown(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>
) {
  return <DropdownMenuPrimitive.Root {...props} />;
}

export function DropdownButton<T extends React.ElementType = "button">({
  as,
  children,
  plain,
  outline,
  color,
  ...props
}: {
  as?: T;
  className?: string;
  children: React.ReactNode;
  plain?: boolean;
  outline?: boolean;
  color?: string;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "children">) {
  const Component = as ?? "button";
  void plain;
  void outline;
  void color;

  return (
    <DropdownMenuPrimitive.Trigger asChild>
      <Component {...props}>{children}</Component>
    </DropdownMenuPrimitive.Trigger>
  );
}

export function DropdownMenu({
  anchor = "bottom",
  className,
  children,
  ...props
}: {
  anchor?: DropdownAnchor;
  className?: string;
  children: React.ReactNode;
} & Omit<
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>,
  "asChild" | "className" | "children" | "side" | "align"
>) {
  const { side, align } = parseAnchor(anchor);

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        {...props}
        side={side}
        align={align}
        sideOffset={8}
        collisionPadding={8}
        data-slot="app-dropdown-menu"
        className={cn(
          "z-50 max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] w-max min-w-48 overflow-y-auto rounded-md border border-zinc-200 bg-white p-1 text-zinc-950 shadow-lg outline-none",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
          "dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
          className
        )}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

type DropdownItemProps = { className?: string; children: React.ReactNode } & (
  | ({ href?: never } & React.ButtonHTMLAttributes<HTMLButtonElement>)
  | ({ href: string } & Omit<RouterLinkProps, "to" | "className">)
);

export function DropdownItem({
  className,
  children,
  ...props
}: DropdownItemProps) {
  const classes = cn(
    "group relative flex w-full cursor-default select-none items-center rounded-sm px-3 py-2 text-left text-base/6 text-zinc-950 outline-none transition-colors sm:text-sm/6",
    "focus:bg-blue-600 focus:text-white data-[highlighted]:bg-blue-600 data-[highlighted]:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
    "*:data-[slot=icon]:mr-2.5 *:data-[slot=icon]:size-5 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:text-zinc-500 group-focus:*:data-[slot=icon]:text-white group-data-[highlighted]:*:data-[slot=icon]:text-white sm:*:data-[slot=icon]:mr-2 sm:*:data-[slot=icon]:size-4",
    "*:data-[slot=avatar]:mr-2.5 *:data-[slot=avatar]:-ml-1 *:data-[slot=avatar]:size-6 sm:*:data-[slot=avatar]:mr-2 sm:*:data-[slot=avatar]:size-5",
    "dark:text-zinc-50 dark:*:data-[slot=icon]:text-zinc-400",
    className
  );

  if ("href" in props && typeof props.href === "string") {
    const { href, ...linkProps } = props;
    return (
      <DropdownMenuPrimitive.Item asChild>
        <PrefetchLink {...linkProps} to={href} className={classes}>
          {children}
        </PrefetchLink>
      </DropdownMenuPrimitive.Item>
    );
  }

  return (
    <DropdownMenuPrimitive.Item asChild>
      <button {...props} type={props.type ?? "button"} className={classes}>
        {children}
      </button>
    </DropdownMenuPrimitive.Item>
  );
}

export function DropdownHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return <div {...props} className={cn("px-3 pt-2.5 pb-1", className)} />;
}

export function DropdownSection({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <DropdownMenuPrimitive.Group {...props} className={cn("py-1", className)} />
  );
}

export function DropdownHeading({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <DropdownMenuPrimitive.Label
      {...props}
      className={cn(
        "px-3 pt-2 pb-1 text-sm/5 font-medium text-zinc-500 sm:text-xs/5 dark:text-zinc-400",
        className
      )}
    />
  );
}

export function DropdownDivider({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <DropdownMenuPrimitive.Separator
      {...props}
      className={cn("mx-3 my-1 h-px bg-zinc-950/5 dark:bg-white/10", className)}
    />
  );
}

export function DropdownLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      data-slot="label"
      className={cn("min-w-0 flex-1", className)}
    />
  );
}

export function DropdownDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="description"
      {...props}
      className={cn(
        "ml-7 text-sm/5 text-zinc-500 group-data-[highlighted]:text-white sm:text-xs/5 dark:text-zinc-400",
        className
      )}
    />
  );
}

export function DropdownShortcut({
  keys,
  className,
  ...props
}: {
  keys: string | string[];
  className?: string;
} & React.ComponentPropsWithoutRef<"kbd">) {
  return (
    <kbd
      {...props}
      className={cn("ml-auto flex pl-6 font-sans text-zinc-400", className)}
    >
      {(Array.isArray(keys) ? keys : keys.split("")).map((char, index) => (
        <span
          key={`${char}-${index}`}
          className={cn(
            "min-w-[2ch] text-center capitalize group-data-[highlighted]:text-white",
            index > 0 && char.length > 1 && "pl-1"
          )}
        >
          {char}
        </span>
      ))}
    </kbd>
  );
}
