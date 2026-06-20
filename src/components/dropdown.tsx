// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import type React from "react";
import type { LinkProps as RouterLinkProps } from "react-router-dom";
import { cn } from "@/lib/utils";
import { PrefetchLink } from "./PrefetchLink";

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
