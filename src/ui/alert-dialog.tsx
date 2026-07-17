// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";

export interface AlertDialogProps extends React.ComponentPropsWithoutRef<
  typeof AlertDialogPrimitive.Root
> {
  readonly open?: boolean;
}

export interface AlertDialogTriggerProps extends React.ComponentPropsWithoutRef<
  typeof AlertDialogPrimitive.Trigger
> {
  readonly asChild?: boolean;
}

export interface AlertDialogPortalProps extends React.ComponentPropsWithoutRef<
  typeof AlertDialogPrimitive.Portal
> {
  readonly container?: HTMLElement | null;
}

export interface AlertDialogCancelProps extends React.ComponentPropsWithoutRef<
  typeof AlertDialogPrimitive.Cancel
> {
  readonly className?: string;
}

export interface AlertDialogActionProps extends React.ComponentPropsWithoutRef<
  typeof AlertDialogPrimitive.Action
> {
  readonly className?: string;
}

export interface AlertDialogOverlayProps extends React.ComponentPropsWithoutRef<
  typeof AlertDialogPrimitive.Overlay
> {
  readonly className?: string;
}

export interface AlertDialogContentProps extends React.ComponentPropsWithoutRef<
  typeof AlertDialogPrimitive.Content
> {
  readonly size?: "default" | "sm";
}

export interface AlertDialogHeaderProps extends React.ComponentPropsWithoutRef<"div"> {
  readonly className?: string;
}

export interface AlertDialogFooterProps extends React.ComponentPropsWithoutRef<"div"> {
  readonly className?: string;
}

export interface AlertDialogTitleProps extends React.ComponentPropsWithoutRef<
  typeof AlertDialogPrimitive.Title
> {
  readonly className?: string;
}

export interface AlertDialogDescriptionProps extends React.ComponentPropsWithoutRef<
  typeof AlertDialogPrimitive.Description
> {
  readonly className?: string;
}

export function AlertDialog(props: AlertDialogProps) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

export function AlertDialogTrigger(props: AlertDialogTriggerProps) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  );
}

export function AlertDialogPortal(props: AlertDialogPortalProps) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  );
}

export const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  AlertDialogCancelProps
>(function AlertDialogCancel(props, ref) {
  return (
    <AlertDialogPrimitive.Cancel
      ref={ref}
      data-slot="alert-dialog-cancel"
      {...props}
    />
  );
});

export const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  AlertDialogActionProps
>(function AlertDialogAction(props, ref) {
  return (
    <AlertDialogPrimitive.Action
      ref={ref}
      data-slot="alert-dialog-action"
      {...props}
    />
  );
});

export const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  AlertDialogOverlayProps
>(function AlertDialogOverlay({ className, ...props }, ref) {
  return (
    <AlertDialogPrimitive.Overlay
      ref={ref}
      data-slot="alert-dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  );
});

export const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  AlertDialogContentProps
>(function AlertDialogContent(
  { className, children, size = "default", ...props },
  ref
) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        ref={ref}
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-6 text-foreground shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          size === "sm" ? "max-w-sm" : "max-w-lg",
          className
        )}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
});

export function AlertDialogHeader({
  className,
  ...props
}: AlertDialogHeaderProps) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

export function AlertDialogFooter({
  className,
  ...props
}: AlertDialogFooterProps) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

export const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  AlertDialogTitleProps
>(function AlertDialogTitle({ className, ...props }, ref) {
  return (
    <AlertDialogPrimitive.Title
      ref={ref}
      data-slot="alert-dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  );
});

export const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  AlertDialogDescriptionProps
>(function AlertDialogDescription({ className, ...props }, ref) {
  return (
    <AlertDialogPrimitive.Description
      ref={ref}
      data-slot="alert-dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
});
