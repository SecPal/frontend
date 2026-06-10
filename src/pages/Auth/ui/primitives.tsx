// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type ComponentPropsWithoutRef,
  type ForwardedRef,
  type FormHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { OTPInput, OTPInputContext, REGEXP_ONLY_DIGITS } from "input-otp";
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
        "relative flex min-h-svh flex-col items-center justify-center gap-6 bg-white p-6 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 md:p-10",
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
        "w-full max-w-sm text-zinc-950 dark:text-zinc-50",
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
      className={cn("flex flex-col items-center gap-2 text-center", className)}
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
        "text-xl font-bold text-zinc-950 dark:text-zinc-50",
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
  return <form className={cn("flex flex-col gap-6", className)} {...props} />;
}

export function LoginFieldSeparator({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="login-field-separator"
      role="separator"
      className={cn(
        "relative my-2 h-5 text-center text-sm text-zinc-500 dark:text-zinc-400",
        className
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-zinc-200 dark:bg-zinc-800"
      />
      {children ? (
        <span className="relative mx-auto inline-block bg-white px-2 dark:bg-zinc-950">
          {children}
        </span>
      ) : null}
    </div>
  );
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

const LoginDialogContext = createContext<{
  titleId: string;
  descriptionId: string;
} | null>(null);

export function LoginDialog({
  size = "md",
  className,
  children,
  open,
  onClose,
  ...props
}: {
  size?: keyof typeof dialogSizes;
  className?: string;
  children: ReactNode;
  open: boolean;
  onClose: () => void;
} & Omit<ComponentPropsWithoutRef<"div">, "className" | "role">) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <LoginDialogContext.Provider value={{ titleId, descriptionId }}>
      <div {...props}>
        <div className="fixed inset-0 z-40 bg-zinc-950/40 dark:bg-zinc-950/70" />
      </div>
      <div
        className="fixed inset-0 z-50 flex min-h-svh items-end justify-center overflow-y-auto p-4 sm:items-center sm:p-6"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "w-full rounded-lg border border-zinc-200 bg-white p-6 text-zinc-950 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
            dialogSizes[size],
            className
          )}
        >
          {children}
        </div>
      </div>
    </LoginDialogContext.Provider>
  );
}

export function LoginDialogTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<"h2">) {
  const dialogContext = useContext(LoginDialogContext);

  return (
    <h2
      id={dialogContext?.titleId}
      className={cn("text-lg font-semibold tracking-normal", className)}
      {...props}
    />
  );
}

export function LoginDialogDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<"p">) {
  const dialogContext = useContext(LoginDialogContext);

  return (
    <p
      id={dialogContext?.descriptionId}
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

export function LoginInputOtp({
  containerClassName,
  className,
  ...props
}: ComponentProps<typeof OTPInput> & { containerClassName?: string }) {
  return (
    <OTPInput
      data-slot="login-input-otp"
      containerClassName={cn(
        "flex items-center gap-2 has-[:disabled]:opacity-50",
        containerClassName
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

export function LoginInputOtpGroup({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="login-input-otp-group"
      className={cn("flex items-center", className)}
      {...props}
    />
  );
}

export function LoginInputOtpSlot({
  index,
  className,
  ...props
}: ComponentPropsWithoutRef<"div"> & { index: number }) {
  const context = useContext(OTPInputContext);
  const slot = context?.slots[index];
  const char = slot?.char ?? "";
  const hasFakeCaret = slot?.hasFakeCaret ?? false;
  const isActive = slot?.isActive ?? false;

  return (
    <div
      data-slot="login-input-otp-slot"
      data-active={isActive || undefined}
      className={cn(
        "relative flex h-12 w-10 items-center justify-center border border-zinc-300 bg-white text-base font-semibold text-zinc-950 shadow-sm transition-all outline-none first:rounded-l-md last:rounded-r-md [&:not(:first-child)]:border-l-0 aria-invalid:border-red-600 data-[active]:z-10 data-[active]:border-blue-600 data-[active]:ring-2 data-[active]:ring-blue-600 data-[active]:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:data-[active]:ring-offset-zinc-950",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-pulse bg-zinc-950 dark:bg-zinc-50" />
        </div>
      ) : null}
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
  return (
    <LoginInputOtp
      id={idPrefix}
      value={value}
      onChange={onChange}
      maxLength={length}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete="one-time-code"
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      containerClassName={className}
    >
      <LoginInputOtpGroup>
        {Array.from({ length }, (_, index) => (
          <LoginInputOtpSlot key={`${idPrefix}-${index}`} index={index} />
        ))}
      </LoginInputOtpGroup>
    </LoginInputOtp>
  );
}
