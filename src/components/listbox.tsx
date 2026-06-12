// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui";
import { cn } from "@/lib/utils";

const EMPTY_VALUE = "__secpal_empty_listbox_value__";

function toRadixValue(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value === "" ? EMPTY_VALUE : value;
}

function fromRadixValue<T extends string>(value: string): T {
  return (value === EMPTY_VALUE ? "" : value) as T;
}

export function Listbox<T extends string>({
  className,
  placeholder,
  autoFocus,
  "aria-label": ariaLabel,
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  ...props
}: {
  className?: string;
  placeholder?: React.ReactNode;
  autoFocus?: boolean;
  "aria-label"?: string;
  children?: React.ReactNode;
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  disabled?: boolean;
}) {
  void props;

  return (
    <Select
      value={toRadixValue(value)}
      defaultValue={toRadixValue(defaultValue)}
      disabled={disabled}
      onValueChange={(nextValue) => onChange?.(fromRadixValue<T>(nextValue))}
    >
      <SelectTrigger
        data-slot="control"
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        className={cn("min-h-10", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

export function ListboxOption<T extends string>({
  children,
  className,
  value,
  disabled,
}: {
  className?: string;
  children?: React.ReactNode;
  value: T;
  disabled?: boolean;
}) {
  return (
    <SelectItem
      value={toRadixValue(value) as string}
      disabled={disabled}
      className={cn("gap-2", className)}
    >
      {children}
    </SelectItem>
  );
}

export function ListboxLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      {...props}
      className={cn("ml-2.5 truncate first:ml-0 sm:ml-2 sm:first:ml-0", className)}
    />
  );
}

export function ListboxDescription({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      {...props}
      className={cn(
        "flex flex-1 overflow-hidden text-zinc-500 data-[highlighted]:text-white before:w-2 before:min-w-0 before:shrink dark:text-zinc-400",
        className
      )}
    >
      <span className="flex-1 truncate">{children}</span>
    </span>
  );
}
