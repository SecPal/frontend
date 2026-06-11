// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { createContext, useContext, useMemo, useState } from "react";
import { Input } from "@/ui";
import { cn } from "@/lib/utils";

const ComboboxOptionContext = createContext<{
  selectedValue: unknown;
  selectValue: (value: unknown) => void;
  renderValue: (value: unknown) => string | undefined;
} | null>(null);

export function Combobox<T>({
  options,
  displayValue,
  filter,
  className,
  placeholder,
  autoFocus,
  "aria-label": ariaLabel,
  children,
  value,
  onChange,
  disabled,
}: {
  options: T[];
  displayValue: (value: T | null) => string | undefined;
  filter?: (value: T, query: string) => boolean;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  "aria-label"?: string;
  children: (value: NonNullable<T>) => React.ReactElement;
  value?: T | null;
  onChange?: (value: T | null) => void;
  disabled?: boolean;
  anchor?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(
    () =>
      query === ""
        ? options
        : options.filter((option) =>
            filter
              ? filter(option, query)
              : displayValue(option)?.toLowerCase().includes(query.toLowerCase())
          ),
    [displayValue, filter, options, query]
  );

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <ComboboxOptionContext.Provider
        value={{
          selectedValue: value,
          selectValue: (nextValue) => {
            onChange?.(nextValue as T);
            setOpen(false);
            setQuery("");
          },
          renderValue: (nextValue) => displayValue(nextValue as T),
        }}
      >
        <div data-slot="control" className={cn("relative block w-full", className)}>
          <PopoverPrimitive.Anchor asChild>
            <Input
              autoFocus={autoFocus}
              aria-label={ariaLabel}
              disabled={disabled}
              value={open ? query : displayValue(value ?? null) ?? ""}
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              placeholder={placeholder}
              className="pr-9"
            />
          </PopoverPrimitive.Anchor>
          <PopoverPrimitive.Trigger asChild>
            <button
              type="button"
              disabled={disabled}
              className="absolute inset-y-0 right-0 flex items-center px-2 text-zinc-500 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-300"
              aria-label={ariaLabel}
            >
              <ChevronsUpDown className="size-4" aria-hidden="true" />
            </button>
          </PopoverPrimitive.Trigger>
        </div>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={8}
            collisionPadding={8}
            className="z-50 max-h-96 min-w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-md border border-zinc-200 bg-white p-1 text-zinc-950 shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            {filteredOptions.map((option) => children(option as NonNullable<T>))}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </ComboboxOptionContext.Provider>
    </PopoverPrimitive.Root>
  );
}

export function ComboboxOption<T>({
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
  const context = useContext(ComboboxOptionContext);
  const selected = Object.is(context?.selectedValue, value);

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={disabled}
      className={cn(
        "group/option grid w-full cursor-default grid-cols-[1fr_1rem] items-center gap-x-2 rounded-sm px-2 py-1.5 text-left text-sm text-zinc-950 outline-none hover:bg-zinc-100 disabled:pointer-events-none disabled:opacity-50 dark:text-zinc-50 dark:hover:bg-zinc-800",
        className
      )}
      onClick={() => context?.selectValue(value)}
    >
      <span className="flex min-w-0 items-center">{children}</span>
      {selected && <Check className="size-4" aria-hidden="true" />}
    </button>
  );
}

export function ComboboxLabel({
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

export function ComboboxDescription({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      {...props}
      className={cn(
        "flex flex-1 overflow-hidden text-zinc-500 before:w-2 before:min-w-0 before:shrink dark:text-zinc-400",
        className
      )}
    >
      <span className="flex-1 truncate">{children}</span>
    </span>
  );
}
