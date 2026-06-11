// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  createContext,
  forwardRef,
  useContext,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  AlertDescription,
  Badge as UiBadge,
  Button,
  type ButtonVariant,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  Field,
  FieldDescription,
  FieldError,
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

type BadgeColor =
  | "red"
  | "orange"
  | "amber"
  | "yellow"
  | "lime"
  | "green"
  | "rose"
  | "sky"
  | "zinc";

const badgeColors = {
  red: "bg-red-500/15 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  orange:
    "bg-orange-500/15 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
  amber:
    "bg-amber-400/20 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400",
  yellow:
    "bg-yellow-400/20 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-300",
  lime: "bg-lime-400/20 text-lime-700 dark:bg-lime-400/10 dark:text-lime-300",
  green:
    "bg-green-500/15 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  rose: "bg-rose-400/15 text-rose-700 dark:bg-rose-400/10 dark:text-rose-400",
  sky: "bg-sky-500/15 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  zinc: "bg-zinc-600/10 text-zinc-700 dark:bg-white/5 dark:text-zinc-400",
} satisfies Record<BadgeColor, string>;

export {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  Field,
  FieldDescription,
  FieldError,
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
}: ComponentPropsWithoutRef<"h1"> & { level?: 1 | 2 | 3 }) {
  const Component = level === 1 ? "h1" : level === 2 ? "h2" : "h3";

  return (
    <Component
      data-slot="employee-heading"
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
      data-slot="employee-text"
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
      data-slot="employee-link"
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
      data-slot="employee-link-button"
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
      data-slot="employee-status-badge"
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
      data-slot="employee-table-shell"
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
      data-slot="employee-table"
      className={cn(
        "min-w-full divide-y divide-zinc-200 text-left text-sm text-zinc-950 dark:divide-zinc-800 dark:text-zinc-50",
        className
      )}
      {...props}
    />
  );
}

export function TableHead(props: ComponentPropsWithoutRef<"thead">) {
  return <thead data-slot="employee-table-head" {...props} />;
}

export function TableBody({
  className,
  ...props
}: ComponentPropsWithoutRef<"tbody">) {
  return (
    <tbody
      data-slot="employee-table-body"
      className={cn("divide-y divide-zinc-100 dark:divide-zinc-800", className)}
      {...props}
    />
  );
}

const TableRowLinkContext = createContext<{ to?: string; title?: string }>({});

export function TableRow({
  className,
  to,
  title,
  ...props
}: ComponentPropsWithoutRef<"tr"> & { to?: string; title?: string }) {
  return (
    <TableRowLinkContext.Provider value={{ to, title }}>
      <tr
        data-slot="employee-table-row"
        className={cn(
          "bg-white dark:bg-zinc-950",
          to &&
            "hover:bg-zinc-50 has-[[data-row-link]:focus-visible]:outline-2 has-[[data-row-link]:focus-visible]:-outline-offset-2 has-[[data-row-link]:focus-visible]:outline-blue-600 dark:hover:bg-zinc-900",
          className
        )}
        {...props}
      />
    </TableRowLinkContext.Provider>
  );
}

export function TableHeader({
  className,
  ...props
}: ComponentPropsWithoutRef<"th">) {
  return (
    <th
      data-slot="employee-table-header"
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
  children,
  ...props
}: ComponentPropsWithoutRef<"td">) {
  const { to, title } = useContext(TableRowLinkContext);
  const [cellRef, setCellRef] = useState<HTMLTableCellElement | null>(null);

  return (
    <td
      ref={to ? setCellRef : undefined}
      data-slot="employee-table-cell"
      className={cn("relative px-4 py-4 align-middle", className)}
      {...props}
    >
      {to ? (
        <Link
          data-row-link
          to={to}
          aria-label={title}
          tabIndex={cellRef?.previousElementSibling === null ? 0 : -1}
          className="absolute inset-0 focus-visible:outline-none"
        />
      ) : null}
      {children}
    </td>
  );
}

export function DescriptionList({
  className,
  ...props
}: ComponentPropsWithoutRef<"dl">) {
  return (
    <dl
      data-slot="employee-description-list"
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
      data-slot="employee-description-term"
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
      data-slot="employee-description-details"
      className={cn(
        "border-t border-zinc-100 pt-0 pb-3 text-zinc-950 first:border-t-0 dark:border-zinc-800 dark:text-zinc-50 sm:py-3 sm:first:border-t",
        className
      )}
      {...props}
    />
  );
}
