// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { forwardRef } from "react";
import { Button as UiButton } from "@/ui";
import { cn } from "@/lib/utils";
import { Link } from "./link";

type ButtonColor =
  | "dark/zinc"
  | "light"
  | "dark/white"
  | "dark"
  | "white"
  | "zinc"
  | "indigo"
  | "cyan"
  | "red"
  | "orange"
  | "amber"
  | "yellow"
  | "lime"
  | "green"
  | "emerald"
  | "teal"
  | "sky"
  | "blue"
  | "violet"
  | "purple"
  | "fuchsia"
  | "pink"
  | "rose";

type ButtonProps = {
  color?: ButtonColor;
  outline?: boolean;
  plain?: boolean;
  className?: string;
  children: React.ReactNode;
} & (
  | ({ href?: never } & React.ButtonHTMLAttributes<HTMLButtonElement>)
  | ({ href: string } & Omit<React.ComponentPropsWithoutRef<typeof Link>, "className">)
);

const colorClasses: Partial<Record<ButtonColor, string>> = {
  red: "bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-700",
  orange:
    "bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-600 dark:text-white dark:hover:bg-orange-700",
  amber:
    "bg-amber-500 text-amber-950 hover:bg-amber-400 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300",
  yellow:
    "bg-yellow-400 text-yellow-950 hover:bg-yellow-300 dark:bg-yellow-300 dark:text-yellow-950 dark:hover:bg-yellow-200",
  lime: "bg-lime-500 text-lime-950 hover:bg-lime-400 dark:bg-lime-400 dark:text-lime-950 dark:hover:bg-lime-300",
  green:
    "bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:text-white dark:hover:bg-green-700",
  emerald:
    "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-700",
  teal: "bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-600 dark:text-white dark:hover:bg-teal-700",
  cyan: "bg-cyan-400 text-cyan-950 hover:bg-cyan-300 dark:bg-cyan-300 dark:text-cyan-950 dark:hover:bg-cyan-200",
  sky: "bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-700",
  blue: "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700",
  indigo:
    "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-600 dark:text-white dark:hover:bg-indigo-700",
  violet:
    "bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-600 dark:text-white dark:hover:bg-violet-700",
  purple:
    "bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-600 dark:text-white dark:hover:bg-purple-700",
  fuchsia:
    "bg-fuchsia-600 text-white hover:bg-fuchsia-700 dark:bg-fuchsia-600 dark:text-white dark:hover:bg-fuchsia-700",
  pink: "bg-pink-600 text-white hover:bg-pink-700 dark:bg-pink-600 dark:text-white dark:hover:bg-pink-700",
  rose: "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600 dark:text-white dark:hover:bg-rose-700",
  white:
    "bg-white text-zinc-950 hover:bg-zinc-100 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200",
  light:
    "bg-white text-zinc-950 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700",
  zinc: "bg-zinc-700 text-white hover:bg-zinc-800 dark:bg-zinc-600 dark:text-white dark:hover:bg-zinc-500",
};

function getVariant({
  color,
  outline,
  plain,
}: Pick<ButtonProps, "color" | "outline" | "plain">) {
  if (outline) {
    return "outline" as const;
  }
  if (plain) {
    return "ghost" as const;
  }
  if (color && color in colorClasses) {
    return "default" as const;
  }
  return "default" as const;
}

function getClasses({
  className,
  color,
  outline,
  plain,
}: Pick<ButtonProps, "className" | "color" | "outline" | "plain">) {
  return cn(
    "relative isolate cursor-default",
    color && !outline && !plain ? colorClasses[color] : undefined,
    className
  );
}

export const Button = forwardRef(function Button(
  { color, outline, plain, className, children, ...props }: ButtonProps,
  ref: React.ForwardedRef<HTMLElement>
) {
  const classes = getClasses({ className, color, outline, plain });
  const variant = getVariant({ color, outline, plain });

  if ("href" in props && typeof props.href === "string") {
    const { href, ...linkProps } = props;
    return (
      <Link
        {...linkProps}
        href={href}
        className={cn(
          "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
          outline &&
            "border border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-800",
          plain &&
            "text-zinc-950 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800",
          !outline &&
            !plain &&
            !color &&
            "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200",
          classes
        )}
        ref={ref as React.ForwardedRef<HTMLAnchorElement>}
      >
        <TouchTarget>{children}</TouchTarget>
      </Link>
    );
  }

  return (
    <UiButton
      {...props}
      variant={variant}
      className={classes}
      ref={ref as React.ForwardedRef<HTMLButtonElement>}
    >
      <TouchTarget>{children}</TouchTarget>
    </UiButton>
  );
});

export function TouchTarget({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span
        className="absolute top-1/2 left-1/2 size-[max(100%,2.75rem)] -translate-x-1/2 -translate-y-1/2 pointer-fine:hidden"
        aria-hidden="true"
      />
      {children}
    </>
  );
}
