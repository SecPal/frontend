// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  forwardRef,
  useId,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type ComponentPropsWithoutRef,
  type ForwardedRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "./utils";

const controlBase =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm transition-colors placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-600 aria-invalid:ring-red-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-400";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

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

export const Select = forwardRef(function Select(
  { className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>,
  ref: ForwardedRef<HTMLSelectElement>
) {
  return (
    <select ref={ref} className={cn(controlBase, className)} {...props}>
      {children}
    </select>
  );
});

export const Checkbox = forwardRef(function Checkbox(
  { className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">,
  ref: ForwardedRef<HTMLInputElement>
) {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "size-4 rounded border-zinc-300 text-blue-600 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950",
        className
      )}
      {...props}
    />
  );
});

export function RadioGroup({
  className,
  ...props
}: ComponentPropsWithoutRef<"fieldset">) {
  return <fieldset className={cn("space-y-3", className)} {...props} />;
}

export function RadioGroupItem({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <input
      type="radio"
      className={cn(
        "size-4 border-zinc-300 text-blue-600 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950",
        className
      )}
      {...props}
    />
  );
}

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
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  value: number;
  max?: number;
}) {
  const boundedMax = max > 0 ? max : 100;
  const boundedValue = Math.min(Math.max(value, 0), boundedMax);
  const percentage = (boundedValue / boundedMax) * 100;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={boundedMax}
      aria-valuenow={boundedValue}
      className={cn(
        "relative h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800",
        className
      )}
      {...props}
    >
      <div
        className="h-full rounded-full bg-blue-600 transition-all duration-300 dark:bg-blue-500"
        style={{ width: `${percentage}%` }}
      />
    </div>
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

export function FieldLabel({
  className,
  ...props
}: ComponentPropsWithoutRef<"label">) {
  return (
    <label
      className={cn(
        "text-sm font-medium text-zinc-950 dark:text-zinc-50",
        className
      )}
      {...props}
    />
  );
}

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

export function CommandPopover({
  label,
  options,
  value,
  onValueChange,
  placeholder = "Select option",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found",
  disabled = false,
  errorMessage,
}: {
  label: string;
  options: CommandOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  errorMessage?: string;
}) {
  const labelId = useId();
  const listboxId = useId();
  const errorId = useId();
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

  function selectOption(option: CommandOption) {
    if (option.disabled) {
      return;
    }

    onValueChange(option.value);
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
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

  return (
    <div className="relative space-y-2">
      <span
        id={labelId}
        className="block text-sm font-medium text-zinc-950 dark:text-zinc-50"
      >
        {label}
      </span>
      <Button
        variant="outline"
        className="w-full justify-between"
        aria-labelledby={labelId}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={errorMessage ? true : undefined}
        aria-describedby={errorMessage ? errorId : undefined}
        disabled={disabled}
        role="combobox"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            moveActiveIndex(1);
          }
        }}
      >
        <span>{selectedOption?.label ?? placeholder}</span>
        <span aria-hidden="true">⌄</span>
      </Button>
      {open && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <Input
            autoFocus
            role="searchbox"
            value={query}
            placeholder={searchPlaceholder}
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
                setOpen(false);
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
        </div>
      )}
      {errorMessage && <FieldError id={errorId}>{errorMessage}</FieldError>}
    </div>
  );
}
