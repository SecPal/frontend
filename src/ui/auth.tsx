// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  Fragment,
  forwardRef,
  useContext,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ForwardedRef,
  type FormHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import { Minus } from "lucide-react";
import { OTPInput, OTPInputContext, REGEXP_ONLY_DIGITS } from "input-otp";
import {
  Dialog as AppDialog,
  DialogContent as AppDialogContent,
  DialogDescription as AppDialogDescription,
  DialogOverlay as AppDialogOverlay,
  DialogPortal as AppDialogPortal,
  DialogTitle as AppDialogTitle,
  FieldLabel as AppFieldLabel,
} from "./primitives";
import { Alert as AppAlert, AlertTitle as AppAlertTitle } from "./alert";
import { Button as AppButton } from "./button";
import { Input as AppInput } from "./input";
import { Spinner as AppSpinner } from "./loading";
import {
  Select as AppSelect,
  SelectContent as AppSelectContent,
  SelectGroup as AppSelectGroup,
  SelectItem as AppSelectItem,
  SelectTrigger as AppSelectTrigger,
  SelectValue as AppSelectValue,
} from "./select";
import { cn } from "@/lib/utils";
import type { ButtonVariant } from "./styles";

export type LoginButtonVariant = NonNullable<
  Exclude<ButtonVariant, "destructive">
>;

const statusMessageVariants = {
  error: {
    alertClassName: "border-destructive/30 bg-destructive/10 text-foreground",
    titleClassName: "text-destructive",
    descriptionClassName: "text-destructive",
  },
  warning: {
    alertClassName: "border-amber-500/30 bg-amber-500/10 text-foreground",
    titleClassName: "text-foreground",
    descriptionClassName: "text-foreground",
  },
  info: {
    alertClassName: "border-primary/30 bg-primary/10 text-primary",
    titleClassName: "text-primary",
    descriptionClassName: "text-primary",
  },
  neutral: {
    alertClassName: "border-border bg-muted text-muted-foreground",
    titleClassName: "text-muted-foreground",
    descriptionClassName: "text-muted-foreground",
  },
} satisfies Record<
  string,
  {
    alertClassName: string;
    titleClassName: string;
    descriptionClassName: string;
  }
>;

export function LoginShell({
  className,
  ...props
}: ComponentPropsWithoutRef<"main">) {
  return (
    <main
      className={cn(
        // `overflow-x-clip` is the page-level safety net: even if a child
        // (long German compound word, a misbehaving extension overlay,
        // sub-pixel-rounded transforms, etc.) sneaks past its container, the
        // shell never offers a horizontal page scrollbar. `clip` is preferred
        // over `hidden` because it does not form a scroll-containing block,
        // so `position: sticky` descendants and Radix Portal overlays keep
        // working unchanged.
        //
        // The shell intentionally does NOT vertically center its children;
        // consumers compose the centered card + bottom footer as siblings in
        // normal flow (`flex-1` for the centered region, footer afterwards).
        // A `justify-center` shell with an absolute footer overlaps the card
        // on short landscape viewports (≈320px) because absolute positioning
        // leaves the flex flow and `pb-*` padding only buys a fixed amount
        // of breathing room.
        "relative flex min-h-[var(--app-shell-min-height)] flex-col items-center overflow-x-clip bg-background px-6 pt-[calc(1.5rem+var(--app-safe-area-inset-top))] pb-6 text-foreground md:px-10 md:pt-[calc(2.5rem+var(--app-safe-area-inset-top))] md:pb-10",
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
      className={cn("w-full max-w-sm text-foreground", className)}
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
        "relative hidden min-h-svh overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between",
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
      className={cn("text-xl font-bold text-foreground", className)}
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
        "relative my-2 h-5 text-center text-sm text-muted-foreground",
        className
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border"
      />
      {children ? (
        <span className="relative mx-auto inline-block bg-background px-2">
          {children}
        </span>
      ) : null}
    </div>
  );
}

export const LoginButton = forwardRef(function LoginButton(
  {
    className,
    variant,
    type = "button",
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: LoginButtonVariant;
  },
  ref: ForwardedRef<HTMLButtonElement>
) {
  return (
    <AppButton
      ref={ref}
      type={type}
      variant={variant}
      className={className}
      {...props}
    />
  );
});

export const LoginInput = forwardRef(function LoginInput(
  { className, type = "text", ...props }: InputHTMLAttributes<HTMLInputElement>,
  ref: ForwardedRef<HTMLInputElement>
) {
  return <AppInput ref={ref} type={type} className={className} {...props} />;
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

export const LoginFieldLabel = forwardRef<
  ElementRef<typeof LabelPrimitive.Root>,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function LoginFieldLabel({ className, ...props }, ref) {
  return <AppFieldLabel ref={ref} className={className} {...props} />;
});

export function LoginFieldDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<"p">) {
  // `break-words` lets long German compound words (e.g.
  // "Wiederherstellungscode", "Authentifizierungscode") wrap mid-word
  // instead of overflowing the field when the container is narrow
  // (small mobile viewports, narrow dialogs).
  return (
    <p
      className={cn("text-sm break-words text-muted-foreground", className)}
      {...props}
    />
  );
}

export function LoginFieldError({
  className,
  ...props
}: ComponentPropsWithoutRef<"p">) {
  // Localized backend errors can carry long German compound words
  // ("MFA-Verifizierung", "Wiederherstellungscode") and recovery URLs;
  // `break-words` keeps them inside the field box on narrow viewports.
  return (
    <p
      className={cn(
        "text-sm font-medium break-words text-destructive",
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
  // `role="alert"` carries an implicit `aria-live="assertive"` (WAI-ARIA 1.2
  // §6.3). When the caller requests polite announcements the implicit value
  // must not be overridden by an explicit `aria-live="polite"` on the same
  // node — that combination is self-contradicting and screen readers honour
  // the explicit attribute, silently downgrading urgent alerts to queued
  // announcements. Derive the role from `live` so the two attributes are
  // always consistent: assertive → `role="alert"`, polite/off → `role="status"`.
  const role = live === "assertive" ? "alert" : "status";
  const variantStyles = statusMessageVariants[variant];
  return (
    <AppAlert
      role={role}
      aria-live={live}
      className={cn(
        "rounded-md p-4 text-sm break-words",
        variantStyles.alertClassName,
        className
      )}
      {...props}
    >
      {title ? (
        <AppAlertTitle className={variantStyles.titleClassName}>
          {title}
        </AppAlertTitle>
      ) : null}
      <div
        data-slot="alert-description"
        className={cn(
          "col-start-2 grid justify-items-start gap-1 text-sm break-words [&_p]:leading-relaxed",
          variantStyles.descriptionClassName,
          title && "mt-1"
        )}
      >
        {children}
      </div>
    </AppAlert>
  );
}

export const LoginSelect = AppSelect;
export const LoginSelectGroup = AppSelectGroup;
export const LoginSelectValue = AppSelectValue;
export const LoginSelectTrigger = AppSelectTrigger;
export const LoginSelectContent = AppSelectContent;
export const LoginSelectItem = AppSelectItem;

export function LoginDialog({
  size = "md",
  className,
  children,
  open,
  onClose,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AppDialog open={open} onClose={onClose}>
      <AppDialogPortal>
        <AppDialogOverlay data-slot="login-dialog-overlay" />
        <AppDialogContent
          data-slot="login-dialog-content"
          size={size}
          className={className}
        >
          {children}
        </AppDialogContent>
      </AppDialogPortal>
    </AppDialog>
  );
}

export const LoginDialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function LoginDialogTitle({ className, ...props }, ref) {
  return (
    <AppDialogTitle
      ref={ref}
      data-slot="login-dialog-title"
      className={cn(
        "text-lg font-semibold tracking-normal break-words",
        className
      )}
      {...props}
    />
  );
});

export const LoginDialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function LoginDialogDescription({ className, ...props }, ref) {
  return (
    <AppDialogDescription
      ref={ref}
      data-slot="login-dialog-description"
      className={cn(
        "mt-2 text-sm break-words text-muted-foreground",
        className
      )}
      {...props}
    />
  );
});

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
  onFocus,
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
      noScriptCSSFallback={null}
      onFocus={(event) => {
        onFocus?.(event);
        // Keep the OTP cells visible above mobile soft keyboards. The
        // dialog is `position: fixed; top: 50%`, so the browser's native
        // auto-scroll-on-focus cannot move it; we instead scroll the
        // visible slot row into the center of its scroll container (the
        // dialog body). Delayed via setTimeout so the browser has time
        // to (a) finish opening the keyboard, (b) shrink the visual
        // viewport per `interactive-widget=resizes-content`, and (c)
        // re-center the dialog before we measure where the cells are.
        // `data-input-otp-container` is input-otp's wrapper around the
        // visible slot cluster, which is the meaningful scroll target
        // (the hidden `<input>` itself is `position: absolute; inset: 0`
        // and has no observable bounding rect of its own).
        const input = event.currentTarget;
        const target = (input.closest("[data-input-otp-container]") ??
          input) as HTMLElement;
        window.setTimeout(() => {
          target.scrollIntoView({ block: "center", behavior: "smooth" });
        }, 200);
      }}
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
        "relative flex h-12 w-10 items-center justify-center border border-input bg-background text-base font-semibold text-foreground shadow-sm transition-all outline-none first:rounded-l-md last:rounded-r-md [&:not(:first-child)]:border-l-0 aria-invalid:border-destructive data-[active]:z-10 data-[active]:border-ring data-[active]:ring-2 data-[active]:ring-ring/50 data-[active]:ring-offset-2 data-[active]:ring-offset-background",
        className
      )}
      {...props}
    >
      {char}
      {hasFakeCaret ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-px animate-pulse bg-foreground" />
        </div>
      ) : null}
    </div>
  );
}

export function LoginInputOtpSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="login-input-otp-separator"
      role="separator"
      aria-hidden="true"
      className={cn("flex items-center text-muted-foreground", className)}
      {...props}
    >
      <Minus className="h-4 w-4" />
    </div>
  );
}

export function LoginOtpInput({
  value,
  onChange,
  length = 6,
  idPrefix = "login-otp",
  disabled = false,
  pattern = REGEXP_ONLY_DIGITS,
  inputMode = "numeric",
  groups,
  textTransform = "none",
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  idPrefix?: string;
  disabled?: boolean;
  /**
   * Regex source string (input-otp's per-character pattern). Defaults to
   * digits-only (`REGEXP_ONLY_DIGITS`); pass `REGEXP_ONLY_DIGITS_AND_CHARS`
   * for alphanumeric inputs such as recovery codes.
   */
  pattern?: string;
  /**
   * HTML `inputMode` for the hidden input. Defaults to `"numeric"`; switch to
   * `"text"` for alphanumeric inputs so mobile keyboards do not lock to the
   * number pad.
   */
  inputMode?: ComponentProps<typeof OTPInput>["inputMode"];
  /**
   * Slot grouping. Defaults to `[length]` (single group). Pass e.g. `[4, 4]`
   * to render two groups of four slots separated by `LoginInputOtpSeparator`
   * (mirrors the shadcn `input-otp` "Pattern" example).
   */
  groups?: readonly number[];
  /**
   * Visual + value text-transform applied to the OTP value. Defaults to
   * `"none"`. Use `"uppercase"` for case-insensitive codes such as recovery
   * codes so the user sees uppercase letters regardless of caps-lock state
   * and the value that reaches the consumer is already normalized.
   */
  textTransform?: "none" | "uppercase";
  "aria-label": string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  className?: string;
}) {
  const slotGroups: readonly number[] =
    groups && groups.length > 0 ? groups : [length];
  const totalSlots = slotGroups.reduce((sum, n) => sum + n, 0);
  // Slot grouping must add up to `length` so OTPInput's maxLength and the
  // rendered slots stay in sync; fall back to a single group when callers
  // accidentally pass a mismatching `groups` array.
  const useFallbackGroup = totalSlots !== length;
  const effectiveGroups: readonly number[] = useFallbackGroup
    ? [length]
    : slotGroups;

  const handleChange = (next: string) => {
    onChange(textTransform === "uppercase" ? next.toUpperCase() : next);
  };

  // Strip common autofill/SMS formatting before `input-otp` validates the
  // paste against `pattern`. Without this, pasting "123 456" or "123-456"
  // (typical TOTP SMS or password-manager copy) fails the digits-only
  // regex on the whole string and the field stays empty. Whitespace and
  // hyphens are never meaningful in either TOTP or recovery codes; the
  // uppercase normalization keeps recovery codes case-insensitive on paste
  // (mirrors the on-type behavior of `handleChange`).
  const pasteTransformer = (pasted: string) => {
    const stripped = pasted.replace(/[\s\-_]+/g, "");
    return textTransform === "uppercase" ? stripped.toUpperCase() : stripped;
  };

  // Pre-compute absolute slot offset for each group up front. A render-phase
  // accumulator (`let cursor += groupLength`) would also work but trips the
  // React 19 immutability lint, and a `reduce` accumulator keeps the inner
  // `.map` callback pure.
  const groupOffsets = effectiveGroups.reduce<number[]>(
    (offsets, groupLength) => {
      const last = offsets.length > 0 ? offsets[offsets.length - 1]! : 0;
      offsets.push(last + groupLength);
      return offsets;
    },
    [0]
  );
  const autoComplete = inputMode === "numeric" ? "one-time-code" : "off";

  return (
    <LoginInputOtp
      id={idPrefix}
      value={value}
      onChange={handleChange}
      pasteTransformer={pasteTransformer}
      maxLength={length}
      pattern={pattern}
      inputMode={inputMode}
      autoComplete={autoComplete}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-invalid={ariaInvalid}
      containerClassName={cn("justify-center", className)}
    >
      {effectiveGroups.map((groupLength, groupIndex) => {
        const offset = groupOffsets[groupIndex]!;
        const slots = Array.from({ length: groupLength }, (_, slotIndex) => {
          const absoluteIndex = offset + slotIndex;
          return (
            <LoginInputOtpSlot
              key={`${idPrefix}-${absoluteIndex}`}
              index={absoluteIndex}
              aria-invalid={ariaInvalid}
              className={
                textTransform === "uppercase" ? "uppercase" : undefined
              }
            />
          );
        });

        return (
          <Fragment key={`${idPrefix}-group-${groupIndex}`}>
            {groupIndex > 0 ? <LoginInputOtpSeparator /> : null}
            <LoginInputOtpGroup>{slots}</LoginInputOtpGroup>
          </Fragment>
        );
      })}
    </LoginInputOtp>
  );
}

export function LoginSpinner({
  className,
  "aria-label": ariaLabel,
  ...props
}: Omit<ComponentProps<typeof AppSpinner>, "aria-label"> & {
  "aria-label": string;
}) {
  return (
    <AppSpinner
      data-slot="login-spinner"
      aria-label={ariaLabel}
      className={className}
      {...props}
    />
  );
}

export function LoginEmpty({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="login-empty"
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border border-dashed border-border p-6 text-center text-balance md:p-12",
        className
      )}
      {...props}
    />
  );
}

export function LoginEmptyHeader({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="login-empty-header"
      className={cn(
        "flex max-w-sm flex-col items-center gap-2 text-center",
        className
      )}
      {...props}
    />
  );
}

const loginEmptyMediaVariants = cva(
  "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export function LoginEmptyMedia({
  className,
  variant = "default",
  ...props
}: ComponentPropsWithoutRef<"div"> &
  VariantProps<typeof loginEmptyMediaVariants>) {
  return (
    <div
      data-slot="login-empty-media"
      data-variant={variant ?? undefined}
      className={cn(loginEmptyMediaVariants({ variant, className }))}
      {...props}
    />
  );
}

export function LoginEmptyTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="login-empty-title"
      className={cn(
        "text-lg font-medium tracking-tight break-words text-foreground",
        className
      )}
      {...props}
    />
  );
}

export function LoginEmptyDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<"p">) {
  return (
    <p
      data-slot="login-empty-description"
      className={cn(
        "text-sm/relaxed break-words text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-foreground",
        className
      )}
      {...props}
    />
  );
}

export function LoginEmptyContent({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="login-empty-content"
      className={cn(
        "flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance",
        className
      )}
      {...props}
    />
  );
}
