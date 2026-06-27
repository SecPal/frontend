// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";
import { Button, FieldError, Input } from "./primitives";
import { cn } from "@/lib/utils";

export interface CommandOption {
  value: string;
  label: string;
  disabled?: boolean;
  keywords?: string[];
}

export interface SearchableAutocompleteListboxProps {
  anchor: ReactElement;
  open: boolean;
  listboxId: string;
  className?: string;
  slotPrefix: string;
  children: ReactNode;
}

export function SearchableAutocompleteListbox({
  anchor,
  open,
  listboxId,
  className,
  slotPrefix,
  children,
}: SearchableAutocompleteListboxProps) {
  return (
    <PopoverPrimitive.Root open={open}>
      <PopoverPrimitive.Anchor asChild>{anchor}</PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          id={listboxId}
          role="listbox"
          align="start"
          sideOffset={4}
          data-slot={`${slotPrefix}-autocomplete-listbox`}
          className={cn(
            "z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border border-zinc-200 bg-white text-zinc-950 shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
            className
          )}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/**
 * Must be rendered as a descendant of a `SearchableAutocompleteListbox`
 * (which provides the required `role="listbox"` owner). Using this component
 * in isolation will produce an orphaned `role="option"` — an ARIA violation.
 */
export interface SearchableAutocompleteOptionProps extends ComponentPropsWithoutRef<"button"> {
  highlighted?: boolean;
  slotPrefix: string;
}

export function SearchableAutocompleteOption({
  className,
  highlighted = false,
  slotPrefix,
  type = "button",
  tabIndex = -1,
  ...props
}: SearchableAutocompleteOptionProps) {
  return (
    <button
      type={type}
      tabIndex={tabIndex}
      role="option"
      aria-selected={highlighted}
      data-slot={`${slotPrefix}-autocomplete-option`}
      data-highlighted={highlighted ? "" : undefined}
      className={cn(
        "block w-full border-b border-zinc-100 px-3 py-2 text-left text-sm text-zinc-950 last:border-b-0 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-800",
        highlighted && "bg-zinc-100 dark:bg-zinc-800",
        className
      )}
      {...props}
    />
  );
}

const commandPopoverFocusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type PendingFocusTarget = HTMLElement | "trigger" | null;

export interface SearchableCommandPopoverProps {
  label: string;
  options: CommandOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  disabled?: boolean;
  errorMessage?: string;
  slotPrefix: string;
}

export function SearchableCommandPopover({
  label,
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled = false,
  errorMessage,
  slotPrefix,
}: SearchableCommandPopoverProps) {
  const labelId = useId();
  const listboxId = useId();
  const errorId = useId();
  const optionIdPrefix = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pendingFocusTargetRef = useRef<PendingFocusTarget>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedOption = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      [option.label, option.value, ...(option.keywords ?? [])].some((entry) =>
        entry.toLowerCase().includes(normalizedQuery)
      )
    );
  }, [options, query]);

  function getOptionId(index: number) {
    return `${optionIdPrefix}-option-${index}`;
  }

  const activeOptionId =
    open && activeIndex < filteredOptions.length
      ? getOptionId(activeIndex)
      : undefined;

  function resetCommandState() {
    setQuery("");
    setActiveIndex(0);
  }

  function closePopover() {
    setOpen(false);
    resetCommandState();
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      resetCommandState();
    }
  }

  function selectOption(option: CommandOption) {
    if (option.disabled) {
      return;
    }

    onValueChange(option.value);
    closePopover();
  }

  function moveActiveIndex(direction: 1 | -1) {
    if (filteredOptions.length === 0) {
      return;
    }

    setActiveIndex((currentIndex) => {
      let nextIndex = currentIndex;

      for (let step = 0; step < filteredOptions.length; step += 1) {
        nextIndex =
          (nextIndex + direction + filteredOptions.length) %
          filteredOptions.length;

        if (!filteredOptions[nextIndex]?.disabled) {
          return nextIndex;
        }
      }

      return currentIndex;
    });
  }

  function getFocusableElements(root: ParentNode) {
    return Array.from(
      root.querySelectorAll<HTMLElement>(commandPopoverFocusableSelector)
    ).filter((element) => element.tabIndex >= 0);
  }

  function getNextFocusableElementAfterTrigger() {
    if (!triggerRef.current) {
      return null;
    }

    const focusableElements = getFocusableElements(document).filter(
      (element) =>
        !contentRef.current?.contains(element) &&
        (element === triggerRef.current || !element.hasAttribute("inert"))
    );
    return (
      focusableElements.find(
        (element) =>
          element !== triggerRef.current &&
          Boolean(
            triggerRef.current?.compareDocumentPosition(element) &
            Node.DOCUMENT_POSITION_FOLLOWING
          )
      ) ?? triggerRef.current
    );
  }

  useEffect(() => {
    if (open || !pendingFocusTargetRef.current) {
      return;
    }

    if (pendingFocusTargetRef.current === "trigger") {
      triggerRef.current?.focus();
    } else {
      pendingFocusTargetRef.current.focus();
    }
    pendingFocusTargetRef.current = null;
  }, [open]);

  function handleContentKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = getFocusableElements(event.currentTarget);
    const currentIndex = focusableElements.indexOf(
      document.activeElement as HTMLElement
    );

    if (currentIndex < 0) {
      return;
    }

    const isLeavingStart = event.shiftKey && currentIndex === 0;
    const isLeavingEnd =
      !event.shiftKey && currentIndex === focusableElements.length - 1;

    if (!isLeavingStart && !isLeavingEnd) {
      return;
    }

    event.preventDefault();
    if (isLeavingStart) {
      pendingFocusTargetRef.current = "trigger";
      closePopover();
      return;
    }

    const nextElement = getNextFocusableElementAfterTrigger();
    pendingFocusTargetRef.current =
      nextElement && nextElement !== triggerRef.current
        ? nextElement
        : "trigger";
    closePopover();
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <div className="space-y-2">
        <span
          id={labelId}
          className="block text-sm font-medium text-zinc-950 dark:text-zinc-50"
        >
          {label}
        </span>
        <PopoverPrimitive.Trigger asChild>
          <Button
            ref={triggerRef}
            variant="outline"
            className="w-full justify-between"
            aria-labelledby={labelId}
            aria-controls={listboxId}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-invalid={errorMessage ? true : undefined}
            aria-describedby={errorMessage ? errorId : undefined}
            aria-activedescendant={activeOptionId}
            disabled={disabled}
            role="combobox"
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                if (open) {
                  moveActiveIndex(1);
                } else {
                  setOpen(true);
                }
              }
            }}
          >
            <span>{selectedOption?.label ?? placeholder}</span>
            <ChevronDown className="size-4 opacity-50" aria-hidden="true" />
          </Button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            ref={contentRef}
            align="start"
            sideOffset={4}
            data-slot={`${slotPrefix}-command-popover-content`}
            className="z-50 w-[var(--radix-popover-trigger-width)] rounded-md border border-zinc-200 bg-white p-2 text-zinc-950 shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              searchInputRef.current?.focus();
            }}
            onKeyDown={handleContentKeyDown}
          >
            <Input
              ref={searchInputRef}
              role="searchbox"
              aria-label={searchPlaceholder}
              value={query}
              placeholder={searchPlaceholder}
              aria-activedescendant={activeOptionId}
              aria-controls={listboxId}
              aria-invalid={errorMessage ? true : undefined}
              aria-describedby={errorMessage ? errorId : undefined}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  moveActiveIndex(1);
                }

                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  moveActiveIndex(-1);
                }

                if (event.key === "Enter") {
                  event.preventDefault();
                  const activeOption = filteredOptions[activeIndex];

                  if (activeOption) {
                    selectOption(activeOption);
                  }
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  closePopover();
                }
              }}
            />
            <div
              id={listboxId}
              role="listbox"
              className="mt-2 max-h-60 overflow-auto"
            >
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300">
                  {emptyMessage}
                </div>
              ) : (
                filteredOptions.map((option, index) => (
                  <button
                    key={option.value}
                    id={getOptionId(index)}
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    data-selected={option.value === value ? "" : undefined}
                    disabled={option.disabled}
                    className={cn(
                      "flex w-full items-center rounded-md px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50",
                      index === activeIndex
                        ? "bg-blue-600 text-white"
                        : "text-zinc-950 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
                    )}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectOption(option)}
                  >
                    {option.label}
                  </button>
                ))
              )}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
        {errorMessage ? (
          <FieldError id={errorId}>{errorMessage}</FieldError>
        ) : null}
      </div>
    </PopoverPrimitive.Root>
  );
}
