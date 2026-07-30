// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import * as React from "react";
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface AlertDialogProps extends AlertDialogPrimitive.Root.Props {
  readonly open?: boolean;
}

export interface AlertDialogTriggerProps
  extends AlertDialogPrimitive.Trigger.Props {
  readonly className?: string;
}

export interface AlertDialogPortalProps
  extends AlertDialogPrimitive.Portal.Props {
  readonly container?: HTMLElement | null;
}

export interface AlertDialogCancelProps
  extends AlertDialogPrimitive.Close.Props {
  readonly className?: string;
}

export interface AlertDialogActionProps
  extends AlertDialogPrimitive.Close.Props {
  readonly className?: string;
}

export interface AlertDialogOverlayProps
  extends AlertDialogPrimitive.Backdrop.Props {
  readonly className?: string;
}

export interface AlertDialogContentProps
  extends AlertDialogPrimitive.Popup.Props {
  readonly size?: "default" | "sm";
}

export interface AlertDialogHeaderProps extends React.ComponentPropsWithoutRef<"div"> {
  readonly className?: string;
}

export interface AlertDialogFooterProps extends React.ComponentPropsWithoutRef<"div"> {
  readonly className?: string;
}

export interface AlertDialogTitleProps
  extends AlertDialogPrimitive.Title.Props {
  readonly className?: string;
}

export interface AlertDialogDescriptionProps
  extends AlertDialogPrimitive.Description.Props {
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
  HTMLButtonElement,
  AlertDialogCancelProps
>(function AlertDialogCancel(props, ref) {
  return (
    <AlertDialogPrimitive.Close
      ref={ref}
      data-slot="alert-dialog-cancel"
      render={<Button variant="outline" />}
      {...props}
    />
  );
});

export const AlertDialogAction = React.forwardRef<
  HTMLButtonElement,
  AlertDialogActionProps
>(function AlertDialogAction(props, ref) {
  return (
    <AlertDialogPrimitive.Close
      ref={ref}
      data-slot="alert-dialog-action"
      render={<Button />}
      {...props}
    />
  );
});

export const AlertDialogOverlay = React.forwardRef<
  HTMLDivElement,
  AlertDialogOverlayProps
>(function AlertDialogOverlay({ className, ...props }, ref) {
  return (
    <AlertDialogPrimitive.Backdrop
      ref={ref}
      data-slot="alert-dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0",
        className
      )}
      {...props}
    />
  );
});

export const AlertDialogContent = React.forwardRef<
  HTMLDivElement,
  AlertDialogContentProps
>(function AlertDialogContent(
  { className, children, size = "default", ...props },
  ref
) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        ref={ref}
        data-slot="alert-dialog-content"
        data-size={size}
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-6 text-foreground shadow-lg duration-200 outline-none data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
          size === "sm" ? "max-w-sm" : "max-w-lg",
          className
        )}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Popup>
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
  HTMLHeadingElement,
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
  HTMLParagraphElement,
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
