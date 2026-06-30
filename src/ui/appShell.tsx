// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Menu, X } from "lucide-react";
import type React from "react";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { LinkProps as RouterLinkProps } from "react-router-dom";
import { PrefetchLink } from "@/components/PrefetchLink";
import { cn } from "@/lib/utils";
import { Button } from "./primitives";

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

interface SidebarContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (openProp === undefined) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [onOpenChange, openProp]
  );

  const contextValue = useMemo<SidebarContextValue>(
    () => ({
      open,
      setOpen,
      toggleSidebar: () => setOpen(!open),
    }),
    [open, setOpen]
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            "--sidebar-width": "16rem",
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          "group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex min-h-svh w-full",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function Sidebar({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"nav">) {
  return (
    <nav
      data-slot="sidebar"
      data-sidebar="sidebar"
      className={cn(
        "flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground",
        className
      )}
      {...props}
    />
  );
}

export function SidebarHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn(
        "flex flex-col border-b border-sidebar-border p-4 [&>[data-sidebar=group]+[data-sidebar=group]]:mt-2.5",
        className
      )}
      {...props}
    />
  );
}

export function SidebarContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-y-auto p-4 [&>[data-sidebar=group]+[data-sidebar=group]]:mt-8",
        className
      )}
      {...props}
    />
  );
}

export function SidebarFooter({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn(
        "flex flex-col border-t border-sidebar-border p-4 [&>[data-sidebar=group]+[data-sidebar=group]]:mt-2.5",
        className
      )}
      {...props}
    />
  );
}

export function SidebarGroup({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col", className)}
      {...props}
    />
  );
}

export function SidebarGroupContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn("w-full text-sm", className)}
      {...props}
    />
  );
}

export function SidebarGroupLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"h3">) {
  return (
    <h3
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      className={cn(
        "mb-1 px-2 text-xs/6 font-medium text-sidebar-foreground/70",
        className
      )}
      {...props}
    />
  );
}

export function SidebarMenu({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn("flex w-full min-w-0 flex-col gap-0.5", className)}
      {...props}
    />
  );
}

export function SidebarMenuItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  );
}

interface SidebarMenuButtonBaseProps {
  current?: boolean;
  className?: string;
  children: React.ReactNode;
}

export interface SidebarMenuButtonButtonProps
  extends
    SidebarMenuButtonBaseProps,
    Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      "className" | "children"
    > {
  href?: never;
}

export interface SidebarMenuButtonLinkProps
  extends
    SidebarMenuButtonBaseProps,
    Omit<RouterLinkProps, "to" | "className" | "children"> {
  href: string;
}

export type SidebarMenuButtonProps =
  SidebarMenuButtonButtonProps | SidebarMenuButtonLinkProps;

export const SidebarMenuButton = forwardRef<
  HTMLAnchorElement | HTMLButtonElement,
  SidebarMenuButtonProps
>(function SidebarMenuButton({ current, className, children, ...props }, ref) {
  const closeSidebar = useContext(SidebarCloseContext);
  const classes = cn(
    "peer/menu-button relative flex w-full items-center gap-3 overflow-hidden rounded-md px-2 py-2.5 text-left text-base/6 font-medium text-sidebar-foreground transition-colors sm:py-2 sm:text-sm/5",
    "*:data-[slot=icon]:size-6 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:text-sidebar-foreground/60 sm:*:data-[slot=icon]:size-5",
    "*:last:data-[slot=icon]:ml-auto *:last:data-[slot=icon]:size-5 sm:*:last:data-[slot=icon]:size-4",
    "*:data-[slot=avatar]:-m-0.5 *:data-[slot=avatar]:size-7 sm:*:data-[slot=avatar]:size-6",
    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:*:data-[slot=icon]:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:*:data-[slot=icon]:text-sidebar-accent-foreground",
    className
  );

  const indicator = current ? (
    <span className="absolute inset-y-2 -left-4 w-0.5 rounded-full bg-sidebar-primary" />
  ) : null;

  if ("href" in props && typeof props.href === "string") {
    const { href, onClick: linkOnClick, ...linkProps } = props;
    return (
      <span className="relative">
        {indicator}
        <PrefetchLink
          {...linkProps}
          to={href}
          data-slot="sidebar-menu-button"
          data-sidebar="menu-button"
          data-size="default"
          data-active={current ? "true" : undefined}
          className={classes}
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
    <span className="relative">
      {indicator}
      <button
        {...props}
        type={props.type ?? "button"}
        data-slot="sidebar-menu-button"
        data-sidebar="menu-button"
        data-size="default"
        data-active={current ? "true" : undefined}
        className={classes}
        ref={ref as React.ForwardedRef<HTMLButtonElement>}
      >
        <TouchTarget>{children}</TouchTarget>
      </button>
    </span>
  );
});

export function SidebarMenuLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      data-slot="sidebar-menu-label"
      className={cn("truncate", className)}
      {...props}
    />
  );
}

export function SidebarMenuSpacer({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"li">) {
  return (
    <li
      aria-hidden="true"
      data-slot="sidebar-menu-spacer"
      className={cn("mt-8 flex-1", className)}
      {...props}
    />
  );
}

export const SidebarTrigger = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Button>
>(function SidebarTrigger({ className, onClick, children, ...props }, ref) {
  const context = useContext(SidebarContext);

  return (
    <Button
      ref={ref}
      data-slot="sidebar-trigger"
      variant="ghost"
      className={cn("relative size-10 p-2", className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          context?.toggleSidebar();
        }
      }}
      {...props}
    >
      {children ?? <Menu data-slot="icon" aria-hidden="true" />}
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
});

export function SidebarInset({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "relative flex min-w-0 flex-1 flex-col bg-background",
        className
      )}
      {...props}
    />
  );
}

export function Sheet(
  props: React.ComponentProps<typeof DialogPrimitive.Root>
) {
  return <DialogPrimitive.Root {...props} />;
}

export function SheetTrigger(
  props: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>
) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

export function SheetClose(
  props: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />;
}

export function SheetPortal(
  props: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Portal>
) {
  return <DialogPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

export const SheetOverlay = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function SheetOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  );
});

type SheetSide = "top" | "right" | "bottom" | "left";

export const SheetContent = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: SheetSide;
    showCloseButton?: boolean;
  }
>(function SheetContent(
  { side = "right", className, children, showCloseButton = true, ...props },
  ref
) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DialogPrimitive.Content
        ref={ref}
        data-slot="sheet-content"
        className={cn(
          "bg-background fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:duration-300 data-[state=open]:duration-500",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <SheetClose className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none">
            <X className="size-4" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </SheetClose>
        ) : null}
      </DialogPrimitive.Content>
    </SheetPortal>
  );
});

export function SheetTitle(
  props: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
) {
  return <DialogPrimitive.Title data-slot="sheet-title" {...props} />;
}

export function SheetDescription(
  props: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
) {
  return (
    <DialogPrimitive.Description data-slot="sheet-description" {...props} />
  );
}

export function DropdownMenu(
  props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>
) {
  return <DropdownMenuPrimitive.Root {...props} />;
}

export function DropdownMenuTrigger(
  props: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>
) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  );
}

type DropdownMenuAnchor =
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

function parseDropdownMenuAnchor(anchor: DropdownMenuAnchor): {
  side: "top" | "right" | "bottom" | "left";
  align: "start" | "center" | "end";
} {
  const [side, align] = anchor.split(" ") as [
    "top" | "right" | "bottom" | "left",
    "start" | "end" | undefined,
  ];
  return { side, align: align ?? "center" };
}

export const DropdownMenuContent = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & {
    anchor?: DropdownMenuAnchor;
  }
>(function DropdownMenuContent(
  { anchor = "bottom", className, sideOffset = 4, children, ...props },
  ref
) {
  const { side, align } = parseDropdownMenuAnchor(anchor);

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        data-slot="dropdown-menu-content"
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(
          "bg-popover text-popover-foreground z-50 max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] min-w-48 origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md outline-hidden",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
});

type DropdownMenuItemProps = {
  className?: string;
  children: React.ReactNode;
} & (
  | ({ href?: never } & React.ButtonHTMLAttributes<HTMLButtonElement>)
  | ({ href: string } & Omit<RouterLinkProps, "to" | "className">)
);

export function DropdownMenuItem({
  className,
  children,
  ...props
}: DropdownMenuItemProps) {
  const classes = cn(
    "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[data-slot=icon]:!text-destructive relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
    "*:data-[slot=icon]:size-4 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:text-muted-foreground",
    "*:data-[slot=avatar]:-ml-0.5 *:data-[slot=avatar]:size-6",
    className
  );

  if ("href" in props && typeof props.href === "string") {
    const { href, ...linkProps } = props;
    return (
      <DropdownMenuPrimitive.Item asChild>
        <PrefetchLink
          {...linkProps}
          to={href}
          data-slot="dropdown-menu-item"
          className={classes}
        >
          {children}
        </PrefetchLink>
      </DropdownMenuPrimitive.Item>
    );
  }

  return (
    <DropdownMenuPrimitive.Item asChild>
      <button
        {...props}
        type={props.type ?? "button"}
        data-slot="dropdown-menu-item"
        className={classes}
      >
        {children}
      </button>
    </DropdownMenuPrimitive.Item>
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn("px-2 py-1.5 text-sm font-medium", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

export function DropdownMenuGroup(
  props: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Group>
) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  );
}

export function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "text-muted-foreground ml-auto text-xs tracking-widest",
        className
      )}
      {...props}
    />
  );
}

export function Navbar({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"nav">) {
  return (
    <nav
      data-slot="navigation-menu"
      className={cn("flex flex-1 items-center gap-4 py-2.5", className)}
      {...props}
    />
  );
}

export function NavbarSection({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="navigation-menu-list"
      className={cn("flex items-center gap-3", className)}
      {...props}
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
      className={cn("-ml-4 flex-1", className)}
      {...props}
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
    "relative flex min-w-0 items-center gap-3 rounded-md p-2 text-left text-base/6 font-medium text-foreground transition-colors sm:text-sm/5",
    "*:data-[slot=icon]:size-6 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:text-muted-foreground sm:*:data-[slot=icon]:size-5",
    "*:not-nth-2:last:data-[slot=icon]:ml-auto *:not-nth-2:last:data-[slot=icon]:size-5 sm:*:not-nth-2:last:data-[slot=icon]:size-4",
    "*:data-[slot=avatar]:-m-0.5 *:data-[slot=avatar]:size-7 sm:*:data-[slot=avatar]:size-6",
    "hover:bg-accent hover:text-accent-foreground hover:*:data-[slot=icon]:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "data-[current=true]:bg-accent data-[current=true]:text-accent-foreground data-[current=true]:*:data-[slot=icon]:text-accent-foreground",
    className
  );

  const indicator = current ? (
    <span className="absolute inset-x-2 -bottom-2.5 h-0.5 rounded-full bg-primary" />
  ) : null;

  if ("href" in props && typeof props.href === "string") {
    const { href, ...linkProps } = props;
    return (
      <span className="relative">
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
    <span className="relative">
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
  return <span className={cn("truncate", className)} {...props} />;
}
