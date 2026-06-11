// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  Children,
  forwardRef,
  isValidElement,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ForwardedRef,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp, Circle } from "lucide-react";
import { cn } from "./utils";

const controlBase =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm transition-colors placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-600 aria-invalid:ring-red-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-400 dark:focus-visible:ring-offset-zinc-950";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950";

type ButtonVariant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive";

const buttonVariants: Record<ButtonVariant, string> = {
  default:
    "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200",
  secondary:
    "bg-zinc-100 text-zinc-950 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700",
  outline:
    "border border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-800",
  ghost:
    "text-zinc-950 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800",
  destructive: "bg-red-600 text-white hover:bg-red-700",
};

export const Button = forwardRef(function Button(
  {
    className,
    variant = "default",
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
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        focusRing,
        buttonVariants[variant],
        className
      )}
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
      className={cn(controlBase, className)}
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
      className={cn(controlBase, "min-h-24 resize-y", className)}
      {...props}
    />
  );
});

const emptySelectValue = "__onboarding_select_empty__";

function toRadixSelectValue(value: unknown) {
  const stringValue = value === undefined ? undefined : String(value);
  return stringValue === "" ? emptySelectValue : stringValue;
}

function fromRadixSelectValue(value: string) {
  return value === emptySelectValue ? "" : value;
}

type OnboardingSelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

function getSelectOptions(children: ReactNode): OnboardingSelectOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<ComponentPropsWithoutRef<"option">>(child) ||
      child.type !== "option"
    ) {
      return [];
    }

    const label = child.props.children;
    const value =
      child.props.value === undefined ? String(label ?? "") : child.props.value;

    return [
      {
        value: String(value),
        label,
        disabled: child.props.disabled,
      },
    ];
  });
}

function createSelectChangeEvent({
  id,
  name,
  value,
}: {
  id?: string;
  name?: string;
  value: string;
}) {
  const target = {
    id,
    name,
    value,
  } as EventTarget & HTMLSelectElement;

  return {
    target,
    currentTarget: target,
  } as ChangeEvent<HTMLSelectElement>;
}

export const Select = forwardRef(function Select(
  {
    className,
    children,
    value,
    defaultValue,
    onChange,
    disabled,
    required,
    name,
    id,
    "aria-label": ariaLabel,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    ...props
  }: Omit<
    ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>,
    "children" | "defaultValue" | "onChange" | "value"
  > & {
    children?: ReactNode;
    value?: string | number;
    defaultValue?: string | number;
    name?: string;
    required?: boolean;
    onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  },
  ref: ForwardedRef<ElementRef<typeof SelectPrimitive.Trigger>>
) {
  const options = getSelectOptions(children);
  const selectedValue =
    value === undefined ? undefined : toRadixSelectValue(value);
  const initialValue =
    defaultValue === undefined ? undefined : toRadixSelectValue(defaultValue);
  const [uncontrolledValue, setUncontrolledValue] = useState(initialValue);
  const currentValue = selectedValue ?? uncontrolledValue;
  const emptyOption = options.find((option) => option.value === "");

  return (
    <SelectPrimitive.Root
      value={selectedValue}
      defaultValue={initialValue}
      disabled={disabled}
      required={required}
      name={name}
      onValueChange={(nextValue) => {
        if (value === undefined) {
          setUncontrolledValue(nextValue);
        }

        onChange?.(
          createSelectChangeEvent({
            id,
            name,
            value: fromRadixSelectValue(nextValue),
          })
        );
      }}
    >
      <SelectPrimitive.Trigger
        ref={ref}
        id={id}
        data-slot="onboarding-select-trigger"
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        aria-required={required || undefined}
        value={fromRadixSelectValue(currentValue ?? "")}
        className={cn(
          controlBase,
          "flex h-10 items-center justify-between gap-2 [&>span]:line-clamp-1",
          className
        )}
        {...props}
      >
        <SelectPrimitive.Value placeholder={emptyOption?.label} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown
            className="size-4 opacity-50"
            aria-hidden="true"
            data-slot="onboarding-select-trigger-icon"
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          data-slot="onboarding-select-content"
          position="popper"
          className="relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-zinc-200 bg-white text-zinc-950 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
        >
          <SelectPrimitive.ScrollUpButton
            data-slot="onboarding-select-scroll-up"
            className="flex cursor-default items-center justify-center py-1"
          >
            <ChevronUp className="size-4" aria-hidden="true" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport
            data-slot="onboarding-select-viewport"
            className="h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] p-1"
          >
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={toRadixSelectValue(option.value) ?? option.value}
                disabled={option.disabled}
                data-slot="onboarding-select-item"
                data-value={option.value}
                className="relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-8 pl-2 text-sm text-zinc-950 outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-zinc-100 data-[disabled]:opacity-50 dark:text-zinc-50 dark:data-[highlighted]:bg-zinc-800"
              >
                <span className="absolute right-2 flex size-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="size-4" aria-hidden="true" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>
                  {option.label}
                </SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton
            data-slot="onboarding-select-scroll-down"
            className="flex cursor-default items-center justify-center py-1"
          >
            <ChevronDown className="size-4" aria-hidden="true" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
});

export const Checkbox = forwardRef(function Checkbox(
  {
    className,
    onChange,
    ...props
  }: Omit<
    ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>,
    "onChange" | "onCheckedChange"
  > & {
    onChange?: InputHTMLAttributes<HTMLInputElement>["onChange"];
  },
  ref: ForwardedRef<ElementRef<typeof CheckboxPrimitive.Root>>
) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      data-slot="onboarding-checkbox"
      className={cn(
        "peer flex size-4 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-600 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-visible:ring-offset-zinc-950 dark:data-[state=checked]:border-blue-500 dark:data-[state=checked]:bg-blue-500",
        className
      )}
      onCheckedChange={(checked) => {
        if (checked === "indeterminate") {
          return;
        }

        const target = {
          checked,
          value: props.value,
          name: props.name,
          id: props.id,
        } as EventTarget & HTMLInputElement;

        onChange?.({
          target,
          currentTarget: target,
        } as ChangeEvent<HTMLInputElement>);
      }}
      {...props}
    >
      <CheckboxPrimitive.Indicator asChild>
        <Check className="size-3.5" aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

export function RadioGroup({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="onboarding-radio-group"
      className={cn("grid gap-3", className)}
      {...props}
    />
  );
}

export const RadioGroupItem = forwardRef(function RadioGroupItem(
  {
    className,
    ...props
  }: ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>,
  ref: ForwardedRef<ElementRef<typeof RadioGroupPrimitive.Item>>
) {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      data-slot="onboarding-radio-group-item"
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white text-blue-600 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-600 data-[state=checked]:border-blue-600 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-visible:ring-offset-zinc-950 dark:data-[state=checked]:border-blue-500",
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

export const Alert = forwardRef(function Alert(
  { className, ...props }: ComponentPropsWithoutRef<"div">,
  ref: ForwardedRef<HTMLDivElement>
) {
  return (
    <div
      ref={ref}
      role="alert"
      className={cn(
        "rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
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
  return <h2 className={cn("font-medium", className)} {...props} />;
}

export function AlertDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<"p">) {
  return (
    <p
      className={cn("mt-1 text-zinc-600 dark:text-zinc-300", className)}
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
      className={cn(
        "rounded-md border border-zinc-200 bg-white text-zinc-950 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
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
  return <div className={cn("space-y-1.5 p-6", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<"h2">) {
  return <h2 className={cn("text-lg font-semibold", className)} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<"p">) {
  return (
    <p
      className={cn("text-sm text-zinc-600 dark:text-zinc-300", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("flex items-center justify-end gap-2 p-6 pt-0", className)}
      {...props}
    />
  );
}

export function OnboardingAuthShell({
  className,
  ...props
}: ComponentPropsWithoutRef<"main">) {
  return (
    <main
      data-slot="onboarding-auth-shell"
      className={cn(
        "min-h-dvh bg-white px-4 py-6 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 sm:px-6 lg:px-8",
        className
      )}
      {...props}
    />
  );
}

export function OnboardingAuthCard({
  className,
  ...props
}: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      data-slot="onboarding-auth-card"
      className={cn(
        "mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-2xl flex-col justify-center rounded-md border border-zinc-200 bg-white p-6 text-zinc-950 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 sm:p-8 lg:p-10",
        className
      )}
      {...props}
    />
  );
}

export function OnboardingAuthHeader({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="onboarding-auth-header"
      className={cn("flex items-center justify-between gap-4", className)}
      {...props}
    />
  );
}

export function Badge({
  className,
  ...props
}: ComponentPropsWithoutRef<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-transparent bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
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
      data-slot="onboarding-progress"
      value={boundedValue}
      max={boundedMax}
      className={cn(
        "relative h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800",
        className
      )}
      style={style}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="onboarding-progress-indicator"
        className="h-full rounded-full bg-blue-600 transition-all duration-300 dark:bg-blue-500"
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export function Field({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("space-y-2", className)} {...props} />;
}

export function FieldGroup({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("space-y-6", className)} {...props} />;
}

export const FieldLabel = forwardRef(function FieldLabel(
  { className, ...props }: ComponentPropsWithoutRef<typeof LabelPrimitive.Root>,
  ref: ForwardedRef<ElementRef<typeof LabelPrimitive.Root>>
) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      data-slot="onboarding-field-label"
      className={cn(
        "text-sm font-medium text-zinc-950 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-zinc-50",
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
      className={cn("text-sm text-zinc-600 dark:text-zinc-300", className)}
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
      className={cn(
        "text-sm font-medium text-red-600 dark:text-red-500",
        className
      )}
      {...props}
    />
  );
}

export function FormSection({
  className,
  ...props
}: ComponentPropsWithoutRef<"section">) {
  return <section className={cn("space-y-6", className)} {...props} />;
}

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
          data-slot="onboarding-autocomplete-listbox"
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
      data-slot="onboarding-autocomplete-option"
      data-highlighted={highlighted ? "" : undefined}
      className={cn(
        "block w-full px-3 py-2 text-left text-sm text-zinc-950 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800",
        "border-b border-zinc-100 last:border-b-0 dark:border-zinc-800",
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
      (element) => !contentRef.current?.contains(element)
    );
    const triggerIndex = focusableElements.indexOf(triggerRef.current);
    const nextElement =
      triggerIndex >= 0 ? focusableElements[triggerIndex + 1] : undefined;

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
                // When opening from a closed state, keep the active option at the
                // first item so initial keyboard focus matches the visual order.
                // Only advance when the popover is already open.
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
            data-slot="onboarding-command-popover-content"
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
        {errorMessage && <FieldError id={errorId}>{errorMessage}</FieldError>}
      </div>
    </PopoverPrimitive.Root>
  );
}
