// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  forwardRef,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ForwardedRef,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Command as CommandPrimitive } from "cmdk";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { PrefetchLink } from "@/components/PrefetchLink";
import { getCspNonce } from "@/lib/cspNonce";
import {
  getTypeBadgeColor,
  getTypeLabel,
  type OrganizationalUnitBadgeColor,
} from "@/lib/organizationalUnitUtils";
import { cn } from "@/lib/utils";
import {
  buttonVariants,
  type ButtonVariant,
  uiControlBase,
  uiFocusRing,
} from "./styles";

export const Button = forwardRef(function Button(
  {
    className,
    variant,
    type = "button",
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
  },
  ref: ForwardedRef<HTMLButtonElement>
) {
  return (
    <button
      ref={ref}
      type={type}
      data-slot="button"
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  );
});

export const Input = forwardRef(function Input(
  { className, type = "text", ...props }: InputHTMLAttributes<HTMLInputElement>,
  ref: ForwardedRef<HTMLInputElement>
) {
  return (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(uiControlBase, className)}
      {...props}
    />
  );
});

export const Textarea = forwardRef(function Textarea(
  { className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>,
  ref: ForwardedRef<HTMLTextAreaElement>
) {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(uiControlBase, "min-h-24 resize-y", className)}
      {...props}
    />
  );
});

export function Field({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div data-slot="field" className={cn("space-y-2", className)} {...props} />
  );
}

export function FieldGroup({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn("space-y-6", className)}
      {...props}
    />
  );
}

export const FieldLabel = forwardRef<
  ElementRef<typeof LabelPrimitive.Root>,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function FieldLabel({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      data-slot="field-label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none text-foreground group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});

export function FieldDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export function FieldError({
  className,
  ...props
}: ComponentPropsWithoutRef<"p">) {
  return (
    <p
      data-slot="field-error"
      className={cn("text-sm font-medium text-destructive", className)}
      {...props}
    />
  );
}

function setForwardedRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }

  if (ref) {
    ref.current = value;
  }
}

export const Command = forwardRef<
  ElementRef<typeof CommandPrimitive>,
  ComponentPropsWithoutRef<typeof CommandPrimitive>
>(function Command({ className, ...props }, ref) {
  return (
    <CommandPrimitive
      ref={ref}
      data-slot="command"
      className={cn(
        "bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md",
        className
      )}
      {...props}
    />
  );
});

export const CommandInput = forwardRef<
  ElementRef<typeof CommandPrimitive.Input>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(function CommandInput({ className, ...props }, ref) {
  const inputRef = useCallback(
    (node: ElementRef<typeof CommandPrimitive.Input> | null) => {
      if (node) {
        node.setAttribute("role", "searchbox");
      }
      setForwardedRef(ref, node);
    },
    [ref]
  );

  return (
    <div
      data-slot="command-input-wrapper"
      className="flex h-9 items-center gap-2 border-b border-border px-3"
    >
      <Search className="size-4 shrink-0 opacity-50" aria-hidden="true" />
      <CommandPrimitive.Input
        ref={inputRef}
        data-slot="command-input"
        className={cn(
          "placeholder:text-muted-foreground flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  );
});

export const CommandList = forwardRef<
  ElementRef<typeof CommandPrimitive.List>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(function CommandList({ className, ...props }, ref) {
  const listRef = useCallback(
    (node: ElementRef<typeof CommandPrimitive.List> | null) => {
      if (node && props.id) {
        node.id = props.id;
      }
      setForwardedRef(ref, node);
    },
    [props.id, ref]
  );

  return (
    <CommandPrimitive.List
      ref={listRef}
      data-slot="command-list"
      className={cn("max-h-72 overflow-x-hidden overflow-y-auto", className)}
      {...props}
    />
  );
});

export const CommandEmpty = forwardRef<
  ElementRef<typeof CommandPrimitive.Empty>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(function CommandEmpty({ className, ...props }, ref) {
  return (
    <CommandPrimitive.Empty
      ref={ref}
      data-slot="command-empty"
      className={cn("py-6 text-center text-sm", className)}
      {...props}
    />
  );
});

export const CommandGroup = forwardRef<
  ElementRef<typeof CommandPrimitive.Group>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(function CommandGroup({ className, ...props }, ref) {
  return (
    <CommandPrimitive.Group
      ref={ref}
      data-slot="command-group"
      className={cn(
        "text-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium",
        className
      )}
      {...props}
    />
  );
});

export const CommandSeparator = forwardRef<
  ElementRef<typeof CommandPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(function CommandSeparator({ className, ...props }, ref) {
  return (
    <CommandPrimitive.Separator
      ref={ref}
      data-slot="command-separator"
      className={cn("bg-border -mx-1 h-px", className)}
      {...props}
    />
  );
});

export const CommandItem = forwardRef<
  ElementRef<typeof CommandPrimitive.Item>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(function CommandItem({ className, id, ...props }, ref) {
  const itemRef = useCallback(
    (node: ElementRef<typeof CommandPrimitive.Item> | null) => {
      if (node && id) {
        node.id = id;
      }
      setForwardedRef(ref, node);
    },
    [id, ref]
  );

  return (
    <CommandPrimitive.Item
      ref={itemRef}
      data-slot="command-item"
      className={cn(
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      id={id}
      {...props}
    />
  );
});

export function CommandShortcut({
  className,
  ...props
}: ComponentPropsWithoutRef<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "text-muted-foreground ml-auto text-xs tracking-widest",
        className
      )}
      {...props}
    />
  );
}

const emptyCommandValue = "__secpal_empty_command_value__";

function toCommandValue(value: string) {
  return value === "" ? emptyCommandValue : value;
}

function fromCommandValue(value: string) {
  return value === emptyCommandValue ? "" : value;
}

function commandOptionFilter(
  value: string,
  search: string,
  keywords: string[] = []
) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return 1;
  }

  const entries = [value, ...keywords].map((entry) =>
    entry.trim().toLowerCase()
  );

  if (entries.some((entry) => entry === normalizedSearch)) {
    return 1;
  }

  if (entries.some((entry) => entry.startsWith(normalizedSearch))) {
    return 0.9;
  }

  if (
    entries.some((entry) =>
      entry
        .split(/[\s,./()_-]+/)
        .some((word) => word.startsWith(normalizedSearch))
    )
  ) {
    return 0.8;
  }

  return 0;
}

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
          align="start"
          sideOffset={4}
          data-slot={`${slotPrefix}-autocomplete-popover-content`}
          className={cn(
            "z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            className
          )}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <Command
            shouldFilter={false}
            data-prefixed-slot={`${slotPrefix}-autocomplete-command`}
          >
            <CommandList
              id={listboxId}
              data-slot={`${slotPrefix}-autocomplete-listbox`}
            >
              {children}
            </CommandList>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export interface SearchableAutocompleteOptionProps extends ComponentPropsWithoutRef<"button"> {
  highlighted?: boolean;
  slotPrefix: string;
}

export function SearchableAutocompleteOption({
  className,
  highlighted = false,
  slotPrefix,
  type: _type,
  value,
  ...props
}: SearchableAutocompleteOptionProps) {
  void _type;

  const commandValue = typeof value === "string" ? value : undefined;
  const commandItemProps = props as ComponentPropsWithoutRef<
    typeof CommandItem
  >;

  return (
    <CommandItem
      forceMount
      value={commandValue}
      data-slot={`${slotPrefix}-autocomplete-option`}
      data-highlighted={highlighted ? "" : undefined}
      className={cn(
        "block w-full border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-accent",
        highlighted && "bg-accent text-accent-foreground",
        className
      )}
      {...commandItemProps}
    />
  );
}

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
  const errorId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeFocusTargetRef = useRef<"trigger" | "next" | null>(null);
  const [open, setOpen] = useState(false);

  const selectedOption = options.find((option) => option.value === value);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
  }

  function selectOption(commandValue: string) {
    const optionValue = fromCommandValue(commandValue);
    const option = options.find((candidate) => candidate.value === optionValue);

    if (!option || option.disabled) {
      return;
    }

    onValueChange(option.value);
    closeFocusTargetRef.current = "trigger";
    setOpen(false);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
    }
  }

  function focusNextElementAfterTrigger() {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const focusableElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => !contentRef.current?.contains(element));
    const triggerIndex = focusableElements.indexOf(trigger);
    const nextElement =
      triggerIndex >= 0 ? focusableElements[triggerIndex + 1] : undefined;

    (nextElement ?? trigger).focus();
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <div className="space-y-2">
        <span
          id={labelId}
          className="block text-sm font-medium text-foreground"
        >
          {label}
        </span>
        <PopoverPrimitive.Trigger asChild>
          <Button
            ref={triggerRef}
            variant="outline"
            className="w-full justify-between"
            aria-labelledby={labelId}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-invalid={errorMessage ? true : undefined}
            aria-describedby={errorMessage ? errorId : undefined}
            disabled={disabled}
            role="combobox"
            onKeyDown={handleTriggerKeyDown}
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
            className="z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              inputRef.current?.focus();
            }}
            onCloseAutoFocus={(event) => {
              const closeFocusTarget = closeFocusTargetRef.current;

              if (!closeFocusTarget) {
                return;
              }

              event.preventDefault();
              closeFocusTargetRef.current = null;
              window.requestAnimationFrame(() => {
                if (closeFocusTarget === "next") {
                  focusNextElementAfterTrigger();
                  return;
                }

                triggerRef.current?.focus();
              });
            }}
          >
            <Command
              label={searchPlaceholder}
              filter={commandOptionFilter}
              loop
              data-prefixed-slot={`${slotPrefix}-command`}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeFocusTargetRef.current = "trigger";
                  setOpen(false);
                }
              }}
            >
              <CommandInput
                ref={inputRef}
                aria-invalid={errorMessage ? true : undefined}
                aria-describedby={errorMessage ? errorId : undefined}
                placeholder={searchPlaceholder}
                onKeyDown={(event) => {
                  if (event.key === "Tab") {
                    event.preventDefault();
                    closeFocusTargetRef.current = event.shiftKey
                      ? "trigger"
                      : "next";
                    setOpen(false);
                  }
                }}
              />
              <CommandList>
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => {
                    const commandValue = toCommandValue(option.value);

                    return (
                      <CommandItem
                        key={commandValue}
                        value={commandValue}
                        keywords={[
                          option.label,
                          option.value,
                          ...(option.keywords ?? []),
                        ]}
                        disabled={option.disabled}
                        data-current={option.value === value ? "" : undefined}
                        onSelect={selectOption}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {option.label}
                        </span>
                        {option.value === value ? (
                          <Check className="size-4" aria-hidden="true" />
                        ) : null}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
        {errorMessage ? (
          <FieldError id={errorId}>{errorMessage}</FieldError>
        ) : null}
      </div>
    </PopoverPrimitive.Root>
  );
}

export function Select(props: ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root {...props} />;
}

export function SelectGroup(
  props: ComponentProps<typeof SelectPrimitive.Group>
) {
  return <SelectPrimitive.Group {...props} />;
}

export function SelectValue(
  props: ComponentProps<typeof SelectPrimitive.Value>
) {
  return <SelectPrimitive.Value {...props} />;
}

export const SelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(function SelectTrigger({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      data-slot="select-trigger"
      className={cn(
        uiControlBase,
        "flex h-10 items-center justify-between gap-2 whitespace-nowrap data-[placeholder]:text-muted-foreground [&>span]:line-clamp-1 [&_svg:not([class*='text-'])]:text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown
          className="size-4 opacity-50"
          aria-hidden="true"
          data-slot="select-trigger-icon"
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

const SelectScrollUpButton = forwardRef<
  ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(function SelectScrollUpButton({ className, ...props }, ref) {
  return (
    <SelectPrimitive.ScrollUpButton
      ref={ref}
      data-slot="select-scroll-up"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronUp className="size-4" aria-hidden="true" />
    </SelectPrimitive.ScrollUpButton>
  );
});

const SelectScrollDownButton = forwardRef<
  ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(function SelectScrollDownButton({ className, ...props }, ref) {
  return (
    <SelectPrimitive.ScrollDownButton
      ref={ref}
      data-slot="select-scroll-down"
      className={cn(
        "flex cursor-default items-center justify-center py-1",
        className
      )}
      {...props}
    >
      <ChevronDown className="size-4" aria-hidden="true" />
    </SelectPrimitive.ScrollDownButton>
  );
});

export const SelectContent = forwardRef<
  ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(function SelectContent(
  { className, children, position = "popper", onCloseAutoFocus, ...props },
  ref
) {
  const cspNonce = getCspNonce();

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        data-slot="select-content"
        position={position}
        className={cn(
          "bg-popover text-popover-foreground relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-border shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className
        )}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (!event.defaultPrevented && isJsdomRuntime()) {
            event.preventDefault();
          }
        }}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          nonce={cspNonce}
          data-slot="select-viewport"
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

export const SelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(function SelectItem({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      data-slot="select-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-4" aria-hidden="true" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});

export const Checkbox = forwardRef<
  ElementRef<typeof CheckboxPrimitive.Root>,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      data-slot="checkbox"
      className={cn(
        "peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator asChild>
        <Check className="size-3.5" aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

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
      data-slot="switch"
      className={cn(
        "group peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onCheckedChange={(checked) => onChange?.(checked === true)}
      {...props}
    >
      <SwitchPrimitive.Thumb className="bg-background pointer-events-none relative block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0">
        {showIcons ? (
          <>
            <X
              aria-hidden="true"
              className="absolute inset-0 m-auto size-3 text-muted-foreground opacity-100 transition-opacity group-data-[state=checked]:opacity-0"
            />
            <Check
              aria-hidden="true"
              className="absolute inset-0 m-auto size-3 text-foreground opacity-0 transition-opacity group-data-[state=checked]:opacity-100"
            />
          </>
        ) : null}
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
});

export function RadioGroup({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      {...props}
    />
  );
}

export const RadioGroupItem = forwardRef<
  ElementRef<typeof RadioGroupPrimitive.Item>,
  ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(function RadioGroupItem({ className, ...props }, ref) {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      data-slot="radio-group-item"
      className={cn(
        "border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator asChild>
        <Circle className="size-2.5 fill-current" aria-hidden="true" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});

const dialogSizes = {
  xs: "sm:max-w-xs",
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
  "3xl": "sm:max-w-3xl",
  "4xl": "sm:max-w-4xl",
  "5xl": "sm:max-w-5xl",
} satisfies Record<string, string>;

function isJsdomRuntime() {
  return (
    typeof navigator !== "undefined" &&
    navigator.userAgent.toLowerCase().includes("jsdom")
  );
}

export function Dialog({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      {children}
    </DialogPrimitive.Root>
  );
}

export function DialogPortal(
  props: ComponentProps<typeof DialogPrimitive.Portal>
) {
  return <DialogPrimitive.Portal {...props} />;
}

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-40 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  );
});

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    size?: keyof typeof dialogSizes;
  }
>(function DialogContent({ className, children, size = "md", ...props }, ref) {
  return (
    <DialogPrimitive.Content
      ref={ref}
      data-slot="dialog-content"
      className={cn(
        "bg-background text-foreground fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-x-hidden overflow-y-auto rounded-lg border border-border p-6 shadow-lg duration-200 overscroll-contain data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        dialogSizes[size],
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  );
});

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      data-slot="dialog-title"
      className={cn(
        "text-lg leading-none font-semibold break-words",
        className
      )}
      {...props}
    />
  );
});

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      data-slot="dialog-description"
      className={cn(
        "mt-2 text-sm break-words text-muted-foreground",
        className
      )}
      {...props}
    />
  );
});

export function DialogBody({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div data-slot="dialog-body" className={cn("mt-6", className)} {...props} />
  );
}

export function DialogActions({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="dialog-actions"
      className={cn(
        "mt-8 flex flex-col-reverse items-stretch justify-end gap-3 sm:flex-row sm:items-center sm:[&>*]:w-auto",
        className
      )}
      {...props}
    />
  );
}

export const Alert = forwardRef(function Alert(
  { className, role, ...props }: ComponentPropsWithoutRef<"div">,
  ref: ForwardedRef<HTMLDivElement>
) {
  const resolvedRole =
    role ??
    (typeof className === "string" && className.includes("destructive")
      ? "alert"
      : undefined);

  return (
    <div
      ref={ref}
      role={resolvedRole}
      data-slot="alert"
      className={cn(
        "relative grid w-full grid-cols-[0_1fr] rounded-lg border border-border px-4 py-3 text-sm text-card-foreground [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:top-4 [&>svg]:left-4 [&>svg~*]:pl-7",
        className
      )}
      {...props}
    />
  );
});

export function AlertTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<"h2">) {
  return (
    <h2
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-normal",
        className
      )}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<"p">) {
  return (
    <p
      data-slot="alert-description"
      className={cn(
        "text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  ...props
}: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-lg border border-border py-6 shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<"h2">) {
  return (
    <h2
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  );
}

export function CardFooter({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center justify-end gap-2 px-6 [.border-t]:pt-6",
        className
      )}
      {...props}
    />
  );
}

export interface AvatarProps extends ComponentPropsWithoutRef<"span"> {
  src?: string | null;
  square?: boolean;
  initials?: string;
  alt?: string;
}

export function Avatar({
  src = null,
  square = false,
  initials,
  alt = "",
  className,
  ...props
}: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      {...props}
      className={cn(
        "bg-muted text-muted-foreground relative flex size-8 shrink-0 overflow-hidden text-sm font-medium uppercase",
        square ? "rounded-[20%]" : "rounded-full",
        className
      )}
    >
      {src ? (
        <AvatarPrimitive.Image
          data-slot="avatar-image"
          className={cn(
            "aspect-square size-full object-cover",
            square ? "rounded-[20%]" : "rounded-full"
          )}
          src={src}
          alt={alt}
        />
      ) : (
        <AvatarPrimitive.Fallback
          data-slot="avatar-fallback"
          aria-hidden={alt ? undefined : "true"}
          title={alt || undefined}
          className={cn(
            "bg-inherit text-inherit flex size-full items-center justify-center",
            square ? "rounded-[20%]" : "rounded-full"
          )}
        >
          {initials}
        </AvatarPrimitive.Fallback>
      )}
    </AvatarPrimitive.Root>
  );
}

export function Badge({
  className,
  ...props
}: ComponentPropsWithoutRef<"span">) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border border-transparent bg-primary px-2 py-0.5 text-xs font-medium whitespace-nowrap text-primary-foreground transition-[color,box-shadow] focus-visible:ring-[3px] [&>svg]:size-3",
        className
      )}
      {...props}
    />
  );
}

export function Progress({
  className,
  value,
  max = 100,
  style,
  ...props
}: ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
  value: number;
  max?: number;
}) {
  const boundedMax = max > 0 ? max : 100;
  const boundedValue = Math.min(Math.max(value, 0), boundedMax);
  const percentage = (boundedValue / boundedMax) * 100;

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={boundedValue}
      max={boundedMax}
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      style={style}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 bg-primary transition-all"
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export function DataTable({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="table-shell"
      className={cn("relative w-full overflow-x-auto", className)}
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
      data-slot="table"
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  );
}

export function TableHead({
  className,
  ...props
}: ComponentPropsWithoutRef<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b [&_tr]:border-border", className)}
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: ComponentPropsWithoutRef<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
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
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b border-border transition-colors",
        className
      )}
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
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
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
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
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
      data-slot="description-list"
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
      data-slot="description-term"
      className={cn(
        "border-t border-border py-3 font-medium text-muted-foreground first:border-t-0 sm:first:border-t",
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
      data-slot="description-details"
      className={cn(
        "border-t border-border pt-0 pb-3 text-foreground first:border-t-0 sm:py-3 sm:first:border-t",
        className
      )}
      {...props}
    />
  );
}

type CustomerSiteBadgeColor = "red" | "amber" | "lime" | "blue" | "zinc";

const customerSiteBadgeColors = {
  red: "bg-red-500/15 text-foreground dark:bg-red-500/10",
  amber: "bg-amber-400/20 text-foreground dark:bg-amber-400/10",
  lime: "bg-lime-400/20 text-foreground dark:bg-lime-400/10",
  blue: "bg-blue-500/15 text-foreground dark:bg-blue-500/10",
  zinc: "bg-muted text-muted-foreground",
} satisfies Record<CustomerSiteBadgeColor, string>;

const organizationalUnitBadgeColors = {
  blue: "bg-primary/10 text-primary",
  green: "bg-emerald-500/10 text-foreground",
  purple: "bg-purple-500/10 text-foreground",
  orange: "bg-orange-500/10 text-foreground",
  zinc: "bg-muted text-muted-foreground",
} satisfies Record<OrganizationalUnitBadgeColor, string>;

export interface CustomerSitePageTitleProps extends ComponentPropsWithoutRef<"h1"> {
  level?: 1 | 2;
}

export function CustomerSitePageTitle({
  level = 1,
  className,
  ...props
}: CustomerSitePageTitleProps) {
  const Component = level === 1 ? "h1" : "h2";

  return (
    <Component
      data-slot="customer-site-heading"
      className={cn(
        level === 1
          ? "text-foreground text-2xl font-semibold tracking-normal"
          : "text-foreground text-base font-semibold tracking-normal",
        className
      )}
      {...props}
    />
  );
}

export interface CustomerSitePageTextProps extends ComponentPropsWithoutRef<"p"> {
  className?: string;
}

export function CustomerSitePageText({
  className,
  ...props
}: CustomerSitePageTextProps) {
  return (
    <p
      data-slot="customer-site-text"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export const CustomerSitePageLink = forwardRef<
  HTMLAnchorElement,
  CustomerSitePageLinkProps
>(function CustomerSitePageLink({ className, ...props }, ref) {
  return (
    <PrefetchLink
      ref={ref}
      data-slot="customer-site-link"
      className={cn(
        "text-primary font-medium underline-offset-4 hover:underline",
        uiFocusRing,
        className
      )}
      {...props}
    />
  );
});

export interface CustomerSitePageLinkProps extends ComponentPropsWithoutRef<
  typeof PrefetchLink
> {
  className?: string;
}

export interface CustomerSiteLinkButtonProps extends ComponentPropsWithoutRef<
  typeof PrefetchLink
> {
  variant?: ButtonVariant;
}

export const CustomerSiteLinkButton = forwardRef<
  HTMLAnchorElement,
  CustomerSiteLinkButtonProps
>(function CustomerSiteLinkButton({ className, variant, ...props }, ref) {
  return (
    <PrefetchLink
      ref={ref}
      data-slot="customer-site-link-button"
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  );
});

export interface CustomerSiteStatusBadgeProps extends ComponentPropsWithoutRef<"span"> {
  color?: CustomerSiteBadgeColor;
}

export function CustomerSiteStatusBadge({
  color = "zinc",
  className,
  ...props
}: CustomerSiteStatusBadgeProps) {
  return (
    <Badge
      data-slot="customer-site-status-badge"
      className={cn(customerSiteBadgeColors[color], className)}
      {...props}
    />
  );
}

export interface OrganizationalUnitTypeBadgeProps extends ComponentPropsWithoutRef<"span"> {
  type: string;
}

export function OrganizationalUnitTypeBadge({
  type,
  className,
  ...props
}: OrganizationalUnitTypeBadgeProps) {
  return (
    <Badge
      className={cn(
        organizationalUnitBadgeColors[getTypeBadgeColor(type)],
        className
      )}
      {...props}
    >
      {getTypeLabel(type)}
    </Badge>
  );
}

export interface CustomerSiteFormCheckboxFieldProps extends ComponentPropsWithoutRef<"div"> {
  className?: string;
}

export function CustomerSiteFormCheckboxField({
  className,
  ...props
}: CustomerSiteFormCheckboxFieldProps) {
  return (
    <div
      data-slot="customer-site-checkbox-field"
      className={cn("flex items-center gap-3", className)}
      {...props}
    />
  );
}

type EmployeeBadgeColor =
  | "red"
  | "orange"
  | "amber"
  | "yellow"
  | "lime"
  | "green"
  | "rose"
  | "sky"
  | "zinc";

const employeeBadgeColors = {
  red: "bg-red-500/15 text-foreground dark:bg-red-500/10",
  orange: "bg-orange-500/15 text-foreground dark:bg-orange-500/10",
  amber: "bg-amber-400/20 text-foreground dark:bg-amber-400/10",
  yellow: "bg-yellow-400/20 text-foreground dark:bg-yellow-400/10",
  lime: "bg-lime-400/20 text-foreground dark:bg-lime-400/10",
  green: "bg-green-500/15 text-foreground dark:bg-green-500/10",
  rose: "bg-rose-400/15 text-foreground dark:bg-rose-400/10",
  sky: "bg-sky-500/15 text-foreground dark:bg-sky-500/10",
  zinc: "bg-muted text-muted-foreground",
} satisfies Record<EmployeeBadgeColor, string>;

export interface EmployeeFieldsetProps extends ComponentPropsWithoutRef<"fieldset"> {
  className?: string;
}

export function EmployeeFieldset({
  className,
  ...props
}: EmployeeFieldsetProps) {
  return (
    <fieldset
      data-slot="employee-fieldset"
      className={cn("space-y-6", className)}
      {...props}
    />
  );
}

export interface EmployeeLegendProps extends ComponentPropsWithoutRef<"legend"> {
  className?: string;
}

export function EmployeeLegend({ className, ...props }: EmployeeLegendProps) {
  return (
    <legend
      data-slot="employee-legend"
      className={cn(
        "text-foreground text-base font-semibold tracking-normal",
        className
      )}
      {...props}
    />
  );
}

export function EmployeeAutocompleteListbox({
  anchor,
  open,
  listboxId,
  className,
  children,
}: EmployeeAutocompleteListboxProps) {
  return (
    <SearchableAutocompleteListbox
      anchor={anchor}
      open={open}
      listboxId={listboxId}
      className={className}
      slotPrefix="employee"
    >
      {children}
    </SearchableAutocompleteListbox>
  );
}

export interface EmployeeAutocompleteListboxProps {
  anchor: ReactElement;
  open: boolean;
  listboxId: string;
  className?: string;
  children: ReactNode;
}

export interface EmployeeAutocompleteOptionProps extends ComponentPropsWithoutRef<"button"> {
  highlighted?: boolean;
}

export function EmployeeAutocompleteOption({
  className,
  highlighted = false,
  type = "button",
  tabIndex = -1,
  ...props
}: EmployeeAutocompleteOptionProps) {
  return (
    <SearchableAutocompleteOption
      className={className}
      highlighted={highlighted}
      slotPrefix="employee"
      type={type}
      tabIndex={tabIndex}
      {...props}
    />
  );
}

export function EmployeeCommandPopover({
  label,
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled = false,
  errorMessage,
}: EmployeeCommandPopoverProps) {
  return (
    <SearchableCommandPopover
      label={label}
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      disabled={disabled}
      errorMessage={errorMessage}
      slotPrefix="employee"
    />
  );
}

export interface EmployeeCommandPopoverProps {
  label: string;
  options: CommandOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  disabled?: boolean;
  errorMessage?: string;
}

export interface EmployeePageTitleProps extends ComponentPropsWithoutRef<"h1"> {
  level?: 1 | 2 | 3;
}

export function EmployeePageTitle({
  level = 1,
  className,
  ...props
}: EmployeePageTitleProps) {
  const Component = level === 1 ? "h1" : level === 2 ? "h2" : "h3";

  return (
    <Component
      data-slot="employee-heading"
      className={cn(
        level === 1
          ? "text-foreground text-2xl font-semibold tracking-normal"
          : "text-foreground text-base font-semibold tracking-normal",
        className
      )}
      {...props}
    />
  );
}

export interface EmployeePageTextProps extends ComponentPropsWithoutRef<"p"> {
  className?: string;
}

export function EmployeePageText({
  className,
  ...props
}: EmployeePageTextProps) {
  return (
    <p
      data-slot="employee-text"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export const EmployeePageLink = forwardRef<
  HTMLAnchorElement,
  EmployeePageLinkProps
>(function EmployeePageLink({ className, ...props }, ref) {
  return (
    <PrefetchLink
      ref={ref}
      data-slot="employee-link"
      className={cn(
        "text-primary font-medium underline-offset-4 hover:underline",
        uiFocusRing,
        className
      )}
      {...props}
    />
  );
});

export interface EmployeePageLinkProps extends ComponentPropsWithoutRef<
  typeof PrefetchLink
> {
  className?: string;
}

export interface EmployeeLinkButtonProps extends ComponentPropsWithoutRef<
  typeof PrefetchLink
> {
  variant?: ButtonVariant;
}

export const EmployeeLinkButton = forwardRef<
  HTMLAnchorElement,
  EmployeeLinkButtonProps
>(function EmployeeLinkButton({ className, variant, ...props }, ref) {
  return (
    <PrefetchLink
      ref={ref}
      data-slot="employee-link-button"
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  );
});

export interface EmployeeStatusBadgeProps extends ComponentPropsWithoutRef<"span"> {
  color?: EmployeeBadgeColor;
}

export function EmployeeStatusBadge({
  color = "zinc",
  className,
  ...props
}: EmployeeStatusBadgeProps) {
  return (
    <Badge
      data-slot="employee-status-badge"
      className={cn(employeeBadgeColors[color], className)}
      {...props}
    />
  );
}

export interface EmployeeDataTableProps extends ComponentPropsWithoutRef<"div"> {
  className?: string;
}

export function EmployeeDataTable({
  className,
  ...props
}: EmployeeDataTableProps) {
  return (
    <div
      data-slot="employee-table-shell"
      className={cn(
        "overflow-x-auto rounded-md border border-border",
        className
      )}
      {...props}
    />
  );
}

export interface EmployeeTableProps extends ComponentPropsWithoutRef<"table"> {
  className?: string;
}

export function EmployeeTable({ className, ...props }: EmployeeTableProps) {
  return (
    <table
      data-slot="employee-table"
      className={cn(
        "min-w-full divide-y divide-border text-left text-sm text-foreground",
        className
      )}
      {...props}
    />
  );
}

export interface EmployeeTableHeadProps extends ComponentPropsWithoutRef<"thead"> {
  className?: string;
}

export function EmployeeTableHead(props: EmployeeTableHeadProps) {
  return <thead data-slot="employee-table-head" {...props} />;
}

export interface EmployeeTableBodyProps extends ComponentPropsWithoutRef<"tbody"> {
  className?: string;
}

export function EmployeeTableBody({
  className,
  ...props
}: EmployeeTableBodyProps) {
  return (
    <tbody
      data-slot="employee-table-body"
      className={cn("divide-y divide-border", className)}
      {...props}
    />
  );
}

const EmployeeTableRowLinkContext = createContext<{
  to?: string;
  title?: string;
}>({});

export interface EmployeeTableRowProps extends ComponentPropsWithoutRef<"tr"> {
  to?: string;
  title?: string;
}

export function EmployeeTableRow({
  className,
  to,
  title,
  ...props
}: EmployeeTableRowProps) {
  return (
    <EmployeeTableRowLinkContext.Provider value={{ to, title }}>
      <tr
        data-slot="employee-table-row"
        className={cn(
          "bg-background",
          to &&
            "hover:bg-muted/50 has-[[data-row-link]:focus-visible]:outline-ring has-[[data-row-link]:focus-visible]:outline-2 has-[[data-row-link]:focus-visible]:-outline-offset-2",
          className
        )}
        {...props}
      />
    </EmployeeTableRowLinkContext.Provider>
  );
}

export interface EmployeeTableHeaderProps extends ComponentPropsWithoutRef<"th"> {
  className?: string;
}

export function EmployeeTableHeader({
  className,
  ...props
}: EmployeeTableHeaderProps) {
  return (
    <th
      data-slot="employee-table-header"
      className={cn(
        "text-muted-foreground px-4 py-3 text-xs font-medium uppercase tracking-normal",
        className
      )}
      {...props}
    />
  );
}

export interface EmployeeTableCellProps extends ComponentPropsWithoutRef<"td"> {
  className?: string;
}

export function EmployeeTableCell({
  className,
  children,
  ...props
}: EmployeeTableCellProps) {
  const { to, title } = useContext(EmployeeTableRowLinkContext);
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

export const Skeleton = forwardRef(function Skeleton(
  {
    className,
    "aria-hidden": ariaHidden = true,
    ...props
  }: ComponentPropsWithoutRef<"div">,
  ref: ForwardedRef<HTMLDivElement>
) {
  return (
    <div
      ref={ref}
      aria-hidden={ariaHidden}
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-accent", className)}
      {...props}
    />
  );
});

function boundedCount(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function SkeletonStatus({ loadingLabel }: { loadingLabel: string }) {
  return <span className="sr-only">{loadingLabel}</span>;
}

function SectionSkeletonContent({
  rows,
  showHeader,
}: {
  rows: number;
  showHeader: boolean;
}) {
  return (
    <div data-slot="section-skeleton-content" aria-hidden="true">
      {showHeader ? (
        <div className="mb-5 space-y-2">
          <Skeleton className="h-5 w-48 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
      ) : null}
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton
            key={index}
            className={cn(
              "h-4",
              index === rows - 1 ? "w-2/3 max-w-full" : "w-full"
            )}
          />
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton({
  className,
  loadingLabel,
  sections = 3,
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  loadingLabel: string;
  sections?: number;
}) {
  const sectionCount = boundedCount(sections, 3);

  return (
    <div
      {...props}
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
      aria-live="polite"
      data-slot="page-skeleton"
      className={cn("space-y-8", className)}
    >
      <SkeletonStatus loadingLabel={loadingLabel} />
      <div aria-hidden="true" className="space-y-3">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: sectionCount }, (_, index) => (
          <div
            key={index}
            className="rounded-lg border border-border bg-card p-6 text-card-foreground"
          >
            <SectionSkeletonContent rows={4} showHeader />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectionSkeleton({
  className,
  loadingLabel,
  rows = 4,
  showHeader = true,
  decorative = false,
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  loadingLabel: string;
  rows?: number;
  showHeader?: boolean;
  /**
   * When a page composes several section skeletons that share the same
   * loading state, only the first one should announce. Mark the rest as
   * decorative so they render the same visual placeholder without
   * stacking additional `role="status"`/`aria-live` regions and the
   * sr-only label text — which assistive tech may otherwise repeat once
   * per region with the same `loadingLabel`.
   */
  decorative?: boolean;
}) {
  if (decorative) {
    return (
      <div
        {...props}
        aria-hidden="true"
        data-slot="section-skeleton"
        className={cn(
          "rounded-lg border border-border bg-card p-6 text-card-foreground",
          className
        )}
      >
        <SectionSkeletonContent
          rows={boundedCount(rows, 4)}
          showHeader={showHeader}
        />
      </div>
    );
  }

  return (
    <div
      {...props}
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
      aria-live="polite"
      data-slot="section-skeleton"
      className={cn(
        "rounded-lg border border-border bg-card p-6 text-card-foreground",
        className
      )}
    >
      <SkeletonStatus loadingLabel={loadingLabel} />
      <SectionSkeletonContent
        rows={boundedCount(rows, 4)}
        showHeader={showHeader}
      />
    </div>
  );
}

export function TableSkeleton({
  className,
  loadingLabel,
  columns = 4,
  rows = 5,
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  loadingLabel: string;
  columns?: number;
  rows?: number;
}) {
  const columnCount = boundedCount(columns, 4);
  const rowCount = boundedCount(rows, 5);

  return (
    <div
      {...props}
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
      aria-live="polite"
      data-slot="table-skeleton"
      className={cn("overflow-x-auto", className)}
    >
      <SkeletonStatus loadingLabel={loadingLabel} />
      <table
        aria-hidden="true"
        className="w-full caption-bottom text-left text-sm text-foreground"
      >
        <thead className="text-muted-foreground">
          <tr>
            {Array.from({ length: columnCount }, (_, index) => (
              <th
                key={index}
                scope="col"
                className="border-b border-border px-2 py-2"
              >
                <Skeleton className="h-4 w-24" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }, (_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columnCount }, (_, columnIndex) => (
                <td
                  key={columnIndex}
                  className="border-b border-border px-2 py-4"
                >
                  <Skeleton
                    className={cn("h-4", columnIndex === 0 ? "w-32" : "w-24")}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FormSkeleton({
  className,
  loadingLabel,
  fields = 4,
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  loadingLabel: string;
  fields?: number;
}) {
  const fieldCount = boundedCount(fields, 4);

  return (
    <div
      {...props}
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
      aria-live="polite"
      data-slot="form-skeleton"
      className={cn("space-y-6", className)}
    >
      <SkeletonStatus loadingLabel={loadingLabel} />
      <div aria-hidden="true" className="space-y-5">
        {Array.from({ length: fieldCount }, (_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <div className="flex justify-end gap-3">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
    </div>
  );
}

export function LoadingRegion({
  className,
  loading,
  loadingLabel,
  children,
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  loading: boolean;
  loadingLabel: string;
}) {
  return (
    <div
      {...props}
      aria-busy={loading || undefined}
      data-slot="loading-region"
      className={cn("relative", className)}
    >
      {children}
      {loading ? (
        <span
          role="status"
          aria-label={loadingLabel}
          aria-live="polite"
          className="sr-only"
        >
          {loadingLabel}
        </span>
      ) : null}
    </div>
  );
}

export function Spinner({
  className,
  "aria-label": ariaLabel,
  ...props
}: Omit<ComponentProps<typeof Loader2>, "aria-label"> & {
  "aria-label": string;
}) {
  return (
    <Loader2
      role="status"
      aria-label={ariaLabel}
      data-slot="spinner"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}
