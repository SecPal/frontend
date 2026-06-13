// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  createContext,
  forwardRef,
  useId,
  useContext,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Check, ChevronDown, X } from "lucide-react";
import { PrefetchLink } from "../../components/PrefetchLink";
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

export function Fieldset({
  className,
  ...props
}: ComponentPropsWithoutRef<"fieldset">) {
  return (
    <fieldset
      data-slot="employee-fieldset"
      className={cn("space-y-6", className)}
      {...props}
    />
  );
}

export function Legend({
  className,
  ...props
}: ComponentPropsWithoutRef<"legend">) {
  return (
    <legend
      data-slot="employee-legend"
      className={cn(
        "text-base font-semibold tracking-normal text-zinc-950 dark:text-zinc-50",
        className
      )}
      {...props}
    />
  );
}

export const Switch = forwardRef<
  ElementRef<typeof SwitchPrimitive.Root>,
  Omit<
    ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>,
    "onChange" | "onCheckedChange"
  > & {
    showIcons?: boolean;
    onChange?: (checked: boolean) => void;
  }
>(function Switch({ className, showIcons = false, onChange, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      data-slot="employee-switch"
      className={cn(
        "group relative inline-flex h-6 w-10 shrink-0 cursor-default items-center rounded-full border border-transparent bg-zinc-200 p-[3px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-zinc-950 sm:h-5 sm:w-8 dark:bg-zinc-800 dark:focus-visible:ring-offset-zinc-950 dark:data-[state=checked]:bg-zinc-50",
        className
      )}
      onCheckedChange={(checked) => onChange?.(checked === true)}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none relative block size-4.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-4 sm:size-3.5 sm:data-[state=checked]:translate-x-3 dark:data-[state=checked]:bg-zinc-950">
        {showIcons ? (
          <>
            <X
              aria-hidden="true"
              className="absolute inset-0 m-auto size-3 text-zinc-400 opacity-100 transition-opacity group-data-[state=checked]:opacity-0 dark:text-zinc-600"
            />
            <Check
              aria-hidden="true"
              className="absolute inset-0 m-auto size-3 text-zinc-950 opacity-0 transition-opacity group-data-[state=checked]:opacity-100 dark:text-zinc-50"
            />
          </>
        ) : null}
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
});

export interface CommandOption {
  value: string;
  label: string;
  disabled?: boolean;
  keywords?: string[];
}

export function AutocompleteListbox({
  anchor,
  open,
  listboxId,
  className,
  children,
}: {
  anchor: ReactElement;
  open: boolean;
  listboxId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <PopoverPrimitive.Root open={open}>
      <PopoverPrimitive.Anchor asChild>{anchor}</PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          id={listboxId}
          role="listbox"
          align="start"
          sideOffset={4}
          data-slot="employee-autocomplete-listbox"
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

export function AutocompleteOption({
  className,
  highlighted = false,
  type = "button",
  tabIndex = -1,
  ...props
}: ComponentPropsWithoutRef<"button"> & {
  highlighted?: boolean;
}) {
  return (
    <button
      type={type}
      tabIndex={tabIndex}
      role="option"
      aria-selected={highlighted}
      data-slot="employee-autocomplete-option"
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

export function CommandPopover({
  label,
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled = false,
  errorMessage,
}: {
  label: string;
  options: CommandOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  disabled?: boolean;
  errorMessage?: string;
}) {
  const labelId = useId();
  const listboxId = useId();
  const errorId = useId();
  const optionIdPrefix = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
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

  function focusNextElementAfterTrigger() {
    if (!triggerRef.current) {
      return;
    }

    const focusableElements = getFocusableElements(document).filter(
      (element) =>
        !contentRef.current?.contains(element) && element !== triggerRef.current
    );
    const triggerIndex = Array.from(document.querySelectorAll<HTMLElement>("*"))
      .filter(
        (element) =>
          focusableElements.includes(element) || element === triggerRef.current
      )
      .indexOf(triggerRef.current);
    const nextElement =
      triggerIndex >= 0
        ? focusableElements[triggerIndex]
        : focusableElements[0];

    nextElement?.focus();
  }

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
    closePopover();

    if (isLeavingStart) {
      triggerRef.current?.focus();
      return;
    }

    focusNextElementAfterTrigger();
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
            data-slot="employee-command-popover-content"
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
  ComponentPropsWithoutRef<typeof PrefetchLink>
>(function PageLink({ className, ...props }, ref) {
  return (
    <PrefetchLink
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
  ComponentPropsWithoutRef<typeof PrefetchLink> & { variant?: ButtonVariant }
>(function LinkButton({ className, variant, ...props }, ref) {
  return (
    <PrefetchLink
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
        <PrefetchLink
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
