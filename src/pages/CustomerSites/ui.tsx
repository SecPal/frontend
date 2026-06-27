// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { PrefetchLink } from "../../components/PrefetchLink";
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
  DataTable,
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
  DataTable,
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
  ComponentPropsWithoutRef<typeof PrefetchLink>
>(function PageLink({ className, ...props }, ref) {
  return (
    <PrefetchLink
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
  ComponentPropsWithoutRef<typeof PrefetchLink> & { variant?: ButtonVariant }
>(function LinkButton({ className, variant, ...props }, ref) {
  return (
    <PrefetchLink
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
