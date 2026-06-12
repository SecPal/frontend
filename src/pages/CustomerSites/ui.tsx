// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  AlertDescription,
  Badge as UiBadge,
  Button,
  type ButtonVariant,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Textarea,
  buttonVariants,
  cn,
  uiFocusRing,
} from "@/ui";

type BadgeColor = "red" | "amber" | "lime" | "blue" | "zinc";

const badgeColors = {
  red: "bg-red-500/15 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  amber:
    "bg-amber-400/20 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400",
  lime: "bg-lime-400/20 text-lime-700 dark:bg-lime-400/10 dark:text-lime-300",
  blue: "bg-blue-500/15 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  zinc: "bg-zinc-600/10 text-zinc-700 dark:bg-white/5 dark:text-zinc-400",
} satisfies Record<BadgeColor, string>;

export {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Textarea,
};

export function PageTitle({
  level = 1,
  className,
  ...props
}: ComponentPropsWithoutRef<"h1"> & { level?: 1 | 2 }) {
  const Component = level === 1 ? "h1" : "h2";

  return (
    <Component
      data-slot="customer-site-heading"
      className={cn(
        level === 1
          ? "text-2xl font-semibold tracking-normal text-zinc-950 dark:text-zinc-50"
          : "text-base font-semibold tracking-normal text-zinc-950 dark:text-zinc-50",
        className
      )}
      {...props}
    />
  );
}

export function PageText({
  className,
  ...props
}: ComponentPropsWithoutRef<"p">) {
  return (
    <p
      data-slot="customer-site-text"
      className={cn("text-sm text-zinc-600 dark:text-zinc-300", className)}
      {...props}
    />
  );
}

export const PageLink = forwardRef<
  HTMLAnchorElement,
  ComponentPropsWithoutRef<typeof Link>
>(function PageLink({ className, ...props }, ref) {
  return (
    <Link
      ref={ref}
      data-slot="customer-site-link"
      className={cn(
        "font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400",
        uiFocusRing,
        className
      )}
      {...props}
    />
  );
});

export const LinkButton = forwardRef<
  HTMLAnchorElement,
  ComponentPropsWithoutRef<typeof Link> & { variant?: ButtonVariant }
>(function LinkButton({ className, variant, ...props }, ref) {
  return (
    <Link
      ref={ref}
      data-slot="customer-site-link-button"
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  );
});

export function StatusBadge({
  color = "zinc",
  className,
  ...props
}: ComponentPropsWithoutRef<"span"> & { color?: BadgeColor }) {
  return (
    <UiBadge
      data-slot="customer-site-status-badge"
      className={cn(badgeColors[color], className)}
      {...props}
    />
  );
}

export function DataTable({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="customer-site-table-shell"
      className={cn(
        "overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800",
        className
      )}
      {...props}
    />
  );
}

export function Table({
  className,
  ...props
}: ComponentPropsWithoutRef<"table">) {
  return (
    <table
      data-slot="customer-site-table"
      className={cn(
        "min-w-full divide-y divide-zinc-200 text-left text-sm text-zinc-950 dark:divide-zinc-800 dark:text-zinc-50",
        className
      )}
      {...props}
    />
  );
}

export function TableHead(props: ComponentPropsWithoutRef<"thead">) {
  return <thead data-slot="customer-site-table-head" {...props} />;
}

export function TableBody({
  className,
  ...props
}: ComponentPropsWithoutRef<"tbody">) {
  return (
    <tbody
      data-slot="customer-site-table-body"
      className={cn("divide-y divide-zinc-100 dark:divide-zinc-800", className)}
      {...props}
    />
  );
}

export function TableRow({
  className,
  ...props
}: ComponentPropsWithoutRef<"tr">) {
  return (
    <tr
      data-slot="customer-site-table-row"
      className={cn("bg-white dark:bg-zinc-950", className)}
      {...props}
    />
  );
}

export function TableHeader({
  className,
  ...props
}: ComponentPropsWithoutRef<"th">) {
  return (
    <th
      data-slot="customer-site-table-header"
      className={cn(
        "px-4 py-3 text-xs font-medium uppercase tracking-normal text-zinc-500 dark:text-zinc-400",
        className
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: ComponentPropsWithoutRef<"td">) {
  return (
    <td
      data-slot="customer-site-table-cell"
      className={cn("px-4 py-4 align-middle", className)}
      {...props}
    />
  );
}

export function DescriptionList({
  className,
  ...props
}: ComponentPropsWithoutRef<"dl">) {
  return (
    <dl
      data-slot="customer-site-description-list"
      className={cn(
        "grid grid-cols-1 text-sm sm:grid-cols-[minmax(10rem,16rem)_1fr]",
        className
      )}
      {...props}
    />
  );
}

export function DescriptionTerm({
  className,
  ...props
}: ComponentPropsWithoutRef<"dt">) {
  return (
    <dt
      data-slot="customer-site-description-term"
      className={cn(
        "border-t border-zinc-100 py-3 font-medium text-zinc-500 first:border-t-0 dark:border-zinc-800 dark:text-zinc-400 sm:first:border-t",
        className
      )}
      {...props}
    />
  );
}

export function DescriptionDetails({
  className,
  ...props
}: ComponentPropsWithoutRef<"dd">) {
  return (
    <dd
      data-slot="customer-site-description-details"
      className={cn(
        "border-t border-zinc-100 pt-0 pb-3 text-zinc-950 first:border-t-0 dark:border-zinc-800 dark:text-zinc-50 sm:py-3 sm:first:border-t",
        className
      )}
      {...props}
    />
  );
}

export function FormCheckboxField({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="customer-site-checkbox-field"
      className={cn("flex items-center gap-3", className)}
      {...props}
    />
  );
}
