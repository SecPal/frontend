// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ComponentPropsWithoutRef,
  type ForwardedRef,
  type FormHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "./utils";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950";

const controlBase =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm transition-colors placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-600 aria-invalid:ring-red-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-400 dark:focus-visible:ring-offset-zinc-950";

type LoginButtonVariant = "default" | "secondary" | "outline" | "ghost";

const loginButtonVariants: Record<LoginButtonVariant, string> = {
  default:
    "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200",
  secondary:
    "bg-zinc-100 text-zinc-950 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700",
  outline:
    "border border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-800",
  ghost:
    "text-zinc-950 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800",
};

const statusMessageVariants = {
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200",
  warning:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200",
  info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200",
  neutral:
    "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300",
} satisfies Record<string, string>;

export function LoginShell({
  className,
  ...props
}: ComponentPropsWithoutRef<"main">) {
  return (
    <main
      className={cn(
        "flex min-h-svh flex-col bg-white p-4 dark:bg-zinc-900 lg:items-center lg:justify-center lg:bg-zinc-50 lg:p-8 dark:lg:bg-zinc-950",
        className
      )}
      {...props}
    />
  );
}

export function LoginCard({
  className,
  ...props
}: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn(
        "flex w-full max-w-2xl flex-1 flex-col bg-white p-8 text-zinc-950 dark:bg-zinc-900 dark:text-zinc-50 lg:flex-none lg:rounded-md lg:border lg:border-zinc-200 lg:p-12 lg:shadow-sm dark:lg:border-zinc-800",
        className
      )}
      {...props}
    />
  );
}

export function LoginCardHeader({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("flex items-center justify-between gap-4", className)}
      {...props}
    />
  );
}

export function LoginCardTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<"h1">) {
  return (
    <h1
      className={cn(
        "text-3xl font-bold text-zinc-950 dark:text-zinc-50",
        className
      )}
      {...props}
    />
  );
}

export function LoginForm({
  className,
  ...props
}: FormHTMLAttributes<HTMLFormElement>) {
  return <form className={cn("mt-10 space-y-8", className)} {...props} />;
}

export const LoginButton = forwardRef(function LoginButton(
  {
    className,
    variant = "default",
    type = "button",
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: LoginButtonVariant;
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
        loginButtonVariants[variant],
        className
      )}
      {...props}
    />
  );
});

export const LoginInput = forwardRef(function LoginInput(
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

export function LoginField({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("space-y-2", className)} {...props} />;
}

export function LoginFieldGroup({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("space-y-6", className)} {...props} />;
}

export function LoginFieldLabel({
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

export function LoginFieldDescription({
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

export function LoginFieldError({
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

export function LoginStatusMessage({
  className,
  variant = "neutral",
  live = "polite",
  title,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<"div">, "title"> & {
  variant?: keyof typeof statusMessageVariants;
  live?: "off" | "polite" | "assertive";
  title?: ReactNode;
}) {
  return (
    <div
      role="alert"
      aria-live={live}
      className={cn(
        "rounded-md border p-4 text-sm",
        statusMessageVariants[variant],
        className
      )}
      {...props}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      <div className={cn(title && "mt-1")}>{children}</div>
    </div>
  );
}

export function LoginOtpInput({
  value,
  onChange,
  length = 6,
  idPrefix = "login-otp",
  disabled = false,
  "aria-label": ariaLabel = "One-time code",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  idPrefix?: string;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}) {
  const cells = Array.from({ length }, (_, index) => value[index] ?? "");

  function updateCell(index: number, nextCellValue: string) {
    const nextCharacter = nextCellValue.slice(-1);
    const nextCells = cells.slice();
    nextCells[index] = nextCharacter;
    onChange(nextCells.join("").slice(0, length));
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex gap-2", className)}
    >
      {cells.map((cellValue, index) => (
        <LoginInput
          key={`${idPrefix}-${index}`}
          id={`${idPrefix}-${index}`}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : undefined}
          aria-label={`${ariaLabel} digit ${index + 1}`}
          className="h-12 w-10 text-center text-base font-semibold"
          value={cellValue}
          maxLength={1}
          disabled={disabled}
          onChange={(event) => updateCell(index, event.target.value)}
          onPaste={(event) => {
            const pastedCode = event.clipboardData
              .getData("text")
              .replace(/\s+/g, "")
              .slice(0, length);

            if (pastedCode.length > 1) {
              event.preventDefault();
              onChange(pastedCode);
            }
          }}
        />
      ))}
    </div>
  );
}
