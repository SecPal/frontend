// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  Dialog as HeadlessDialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle as HeadlessDialogTitle,
  Description as HeadlessDescription,
} from "@headlessui/react";
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
        "grid min-h-svh bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 lg:grid-cols-2",
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
        "flex min-h-svh w-full flex-col bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50",
        className
      )}
      {...props}
    />
  );
}

export function LoginBrandPanel({
  className,
  ...props
}: ComponentPropsWithoutRef<"aside">) {
  return (
    <aside
      className={cn(
        "relative hidden min-h-svh overflow-hidden bg-zinc-950 text-white lg:flex lg:flex-col lg:justify-between",
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

export function LoginFormActions({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("space-y-3", className)} {...props} />;
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

const dialogSizes = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
} satisfies Record<string, string>;

export function LoginDialog({
  size = "md",
  className,
  children,
  ...props
}: {
  size?: keyof typeof dialogSizes;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<typeof HeadlessDialog>, "as" | "className">) {
  return (
    <HeadlessDialog {...props}>
      <DialogBackdrop
        transition
        className="fixed inset-0 z-40 bg-zinc-950/40 transition-opacity duration-150 data-closed:opacity-0 dark:bg-zinc-950/70"
      />
      <div className="fixed inset-0 z-50 flex min-h-svh items-end justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
        <DialogPanel
          transition
          className={cn(
            "w-full rounded-lg border border-zinc-200 bg-white p-6 text-zinc-950 shadow-lg transition duration-150 data-closed:translate-y-4 data-closed:opacity-0 data-enter:ease-out data-leave:ease-in sm:data-closed:translate-y-0 sm:data-closed:scale-95 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
            dialogSizes[size],
            className
          )}
        >
          {children}
        </DialogPanel>
      </div>
    </HeadlessDialog>
  );
}

export function LoginDialogTitle({
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<typeof HeadlessDialogTitle>, "as">) {
  return (
    <HeadlessDialogTitle
      className={cn("text-lg font-semibold tracking-normal", className)}
      {...props}
    />
  );
}

export function LoginDialogDescription({
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<typeof HeadlessDescription>, "as">) {
  return (
    <HeadlessDescription
      className={cn("mt-2 text-sm text-zinc-600 dark:text-zinc-300", className)}
      {...props}
    />
  );
}

export function LoginDialogBody({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("mt-6", className)} {...props} />;
}

export function LoginDialogActions({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "mt-8 flex flex-col-reverse items-stretch justify-end gap-3 sm:flex-row sm:items-center sm:[&>*]:w-auto",
        className
      )}
      {...props}
    />
  );
}

function sanitizeOtpDigits(value: string, length: number) {
  return value.replace(/\D/g, "").slice(0, length);
}

export function LoginOtpInput({
  value,
  onChange,
  length = 6,
  idPrefix = "login-otp",
  disabled = false,
  "aria-label": ariaLabel = "One-time code",
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  idPrefix?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  className?: string;
}) {
  const normalizedValue = sanitizeOtpDigits(value, length);
  const cells = Array.from(
    { length },
    (_, index) => normalizedValue[index] ?? ""
  );

  function updateCell(index: number, nextCellValue: string) {
    const nextDigits = sanitizeOtpDigits(nextCellValue, length);
    const nextCells = cells.slice();
    if (nextDigits.length > 1) {
      nextDigits.split("").forEach((digit, digitIndex) => {
        if (index + digitIndex < length) {
          nextCells[index + digitIndex] = digit;
        }
      });
    } else {
      nextCells[index] = nextDigits;
    }
    onChange(nextCells.join("").slice(0, length));
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
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
          pattern="[0-9]*"
          disabled={disabled}
          onChange={(event) => updateCell(index, event.target.value)}
          onPaste={(event) => {
            const pastedCode = event.clipboardData
              .getData("text")
              .replace(/\s+/g, "");

            if (pastedCode.length > 1) {
              event.preventDefault();
              updateCell(index, pastedCode);
            }
          }}
        />
      ))}
    </div>
  );
}
