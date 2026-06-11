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
import * as SelectPrimitive from "@radix-ui/react-select";
import { cva, type VariantProps } from "class-variance-authority";
import { Check, ChevronDown, ChevronUp, Loader2, Minus } from "lucide-react";
import { OTPInput, OTPInputContext, REGEXP_ONLY_DIGITS } from "input-otp";
import { cn } from "./utils";

const controlBase =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm transition-colors placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-600 aria-invalid:ring-red-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-400 dark:focus-visible:ring-offset-zinc-950";

const loginButtonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950",
  {
    variants: {
      variant: {
        default:
          "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200",
        secondary:
          "bg-zinc-100 text-zinc-950 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700",
        outline:
          "border border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-800",
        ghost:
          "text-zinc-950 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export type LoginButtonVariant = NonNullable<
  VariantProps<typeof loginButtonVariants>["variant"]
>;

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
        "relative flex min-h-dvh flex-col items-center overflow-x-clip bg-white p-6 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 md:p-10",
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
    variant,
    type = "button",
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> &
    VariantProps<typeof loginButtonVariants>,
  ref: ForwardedRef<HTMLButtonElement>
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(loginButtonVariants({ variant }), className)}
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

export const LoginFieldLabel = forwardRef<
  ElementRef<typeof LabelPrimitive.Root>,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function LoginFieldLabel({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn(
        "text-sm font-medium text-zinc-950 peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-zinc-50",
        className
      )}
      {...props}
    />
  );
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
      className={cn(
        "text-sm break-words text-zinc-600 dark:text-zinc-300",
        className
      )}
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
        "text-sm font-medium break-words text-red-600 dark:text-red-500",
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
  return (
    <div
      role={role}
      aria-live={live}
      className={cn(
        "rounded-md border p-4 text-sm break-words",
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

export function LoginSelect(
  props: ComponentProps<typeof SelectPrimitive.Root>
) {
  return <SelectPrimitive.Root {...props} />;
}

export function LoginSelectGroup(
  props: ComponentProps<typeof SelectPrimitive.Group>
) {
  return <SelectPrimitive.Group {...props} />;
}

export function LoginSelectValue(
  props: ComponentProps<typeof SelectPrimitive.Value>
) {
  return <SelectPrimitive.Value {...props} />;
}

export const LoginSelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(function LoginSelectTrigger({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      data-slot="login-select-trigger"
      className={cn(
        "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 shadow-sm transition-colors placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-600 [&>span]:line-clamp-1 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-400 dark:focus-visible:ring-offset-zinc-950",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown
          className="size-4 opacity-50"
          aria-hidden="true"
          data-slot="login-select-trigger-icon"
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

const LoginSelectScrollUpButton = forwardRef<
  ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(function LoginSelectScrollUpButton({ className, ...props }, ref) {
  return (
    <SelectPrimitive.ScrollUpButton
      ref={ref}
      data-slot="login-select-scroll-up"
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

const LoginSelectScrollDownButton = forwardRef<
  ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(function LoginSelectScrollDownButton({ className, ...props }, ref) {
  return (
    <SelectPrimitive.ScrollDownButton
      ref={ref}
      data-slot="login-select-scroll-down"
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

export const LoginSelectContent = forwardRef<
  ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(function LoginSelectContent(
  { className, children, position = "popper", ...props },
  ref
) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        data-slot="login-select-content"
        position={position}
        className={cn(
          "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-zinc-200 bg-white text-zinc-950 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className
        )}
        {...props}
      >
        <LoginSelectScrollUpButton />
        <SelectPrimitive.Viewport
          data-slot="login-select-viewport"
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <LoginSelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

export const LoginSelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(function LoginSelectItem({ className, children, ...props }, ref) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      data-slot="login-select-item"
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pr-8 pl-2 text-sm text-zinc-950 outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-zinc-100 data-[disabled]:opacity-50 dark:text-zinc-50 dark:data-[highlighted]:bg-zinc-800",
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

const dialogSizes = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
} satisfies Record<string, string>;

export function LoginDialog({
  size = "md",
  className,
  children,
  open,
  onClose,
}: {
  size?: keyof typeof dialogSizes;
  className?: string;
  children: ReactNode;
  open: boolean;
  onClose: () => void;
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
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="login-dialog-overlay"
          className="fixed inset-0 z-40 bg-zinc-950/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 dark:bg-zinc-950/70"
        />
        <DialogPrimitive.Content
          data-slot="login-dialog-content"
          className={cn(
            "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-x-hidden overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 text-zinc-950 shadow-lg duration-200 overscroll-contain data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
            dialogSizes[size],
            className
          )}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const LoginDialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function LoginDialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
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
    <DialogPrimitive.Description
      ref={ref}
      data-slot="login-dialog-description"
      className={cn(
        "mt-2 text-sm break-words text-zinc-600 dark:text-zinc-300",
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

export function LoginInputOtpSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="login-input-otp-separator"
      role="separator"
      aria-hidden="true"
      className={cn(
        "flex items-center text-zinc-400 dark:text-zinc-500",
        className
      )}
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
  "aria-label"?: string;
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
  ...props
}: ComponentProps<typeof Loader2>) {
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      data-slot="login-spinner"
      className={cn("size-4 animate-spin", className)}
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
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border border-dashed border-zinc-200 p-6 text-center text-balance md:p-12 dark:border-zinc-800",
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
        icon: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50 [&_svg:not([class*='size-'])]:size-6",
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
        "text-lg font-medium tracking-tight break-words text-zinc-950 dark:text-zinc-50",
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
        "text-sm/relaxed break-words text-zinc-500 dark:text-zinc-400 [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-zinc-950 dark:[&>a:hover]:text-zinc-50",
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
