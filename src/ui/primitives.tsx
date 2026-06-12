// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ForwardedRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonVariant, uiControlBase } from "./styles";

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
      data-slot="ui-button"
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
      data-slot="ui-input"
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
      data-slot="ui-textarea"
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
    <div
      data-slot="ui-field"
      className={cn("space-y-2", className)}
      {...props}
    />
  );
}

export function FieldGroup({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="ui-field-group"
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
      data-slot="ui-field-label"
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
      data-slot="ui-field-description"
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
      data-slot="ui-field-error"
      className={cn(
        "text-sm font-medium text-red-600 dark:text-red-500",
        className
      )}
      {...props}
    />
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
      data-slot="ui-select-trigger"
      className={cn(
        uiControlBase,
        "flex h-10 items-center justify-between gap-2 [&>span]:line-clamp-1",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown
          className="size-4 opacity-50"
          aria-hidden="true"
          data-slot="ui-select-trigger-icon"
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
      data-slot="ui-select-scroll-up"
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
      data-slot="ui-select-scroll-down"
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
  { className, children, position = "popper", ...props },
  ref
) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        data-slot="ui-select-content"
        position={position}
        className={cn(
          "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-zinc-200 bg-white text-zinc-950 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          data-slot="ui-select-viewport"
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
      data-slot="ui-select-item"
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

export const Checkbox = forwardRef<
  ElementRef<typeof CheckboxPrimitive.Root>,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      data-slot="ui-checkbox"
      className={cn(
        "peer flex size-4 shrink-0 items-center justify-center rounded border border-zinc-300 bg-white text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-600 data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 dark:border-zinc-700 dark:bg-zinc-950 dark:focus-visible:ring-offset-zinc-950 dark:data-[state=checked]:border-blue-500 dark:data-[state=checked]:bg-blue-500",
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

export function RadioGroup({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="ui-radio-group"
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
      data-slot="ui-radio-group-item"
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
      data-slot="ui-dialog-overlay"
      className={cn(
        "fixed inset-0 z-40 bg-zinc-950/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 dark:bg-zinc-950/70",
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
      data-slot="ui-dialog-content"
      className={cn(
        "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-x-hidden overflow-y-auto rounded-lg border border-zinc-200 bg-white p-6 text-zinc-950 shadow-lg duration-200 overscroll-contain data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
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
      data-slot="ui-dialog-title"
      className={cn(
        "text-lg font-semibold tracking-normal break-words",
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
      data-slot="ui-dialog-description"
      className={cn(
        "mt-2 text-sm break-words text-zinc-600 dark:text-zinc-300",
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
    <div
      data-slot="ui-dialog-body"
      className={cn("mt-6", className)}
      {...props}
    />
  );
}

export function DialogActions({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="ui-dialog-actions"
      className={cn(
        "mt-8 flex flex-col-reverse items-stretch justify-end gap-3 sm:flex-row sm:items-center sm:[&>*]:w-auto",
        className
      )}
      {...props}
    />
  );
}

export const Alert = forwardRef(function Alert(
  { className, role = "alert", ...props }: ComponentPropsWithoutRef<"div">,
  ref: ForwardedRef<HTMLDivElement>
) {
  return (
    <div
      ref={ref}
      role={role}
      data-slot="ui-alert"
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
  return (
    <h2
      data-slot="ui-alert-title"
      className={cn("font-medium", className)}
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
      data-slot="ui-alert-description"
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
      data-slot="ui-card"
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
  return (
    <div
      data-slot="ui-card-header"
      className={cn("space-y-1.5 p-6", className)}
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
      data-slot="ui-card-title"
      className={cn("text-lg font-semibold", className)}
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
      data-slot="ui-card-description"
      className={cn("text-sm text-zinc-600 dark:text-zinc-300", className)}
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
      data-slot="ui-card-content"
      className={cn("p-6 pt-0", className)}
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
      data-slot="ui-card-footer"
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
      data-slot="ui-badge"
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
      data-slot="ui-progress"
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
        data-slot="ui-progress-indicator"
        className="h-full rounded-full bg-blue-600 transition-all duration-300 dark:bg-blue-500"
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </ProgressPrimitive.Root>
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
      data-slot="ui-skeleton"
      className={cn(
        "animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800",
        className
      )}
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
    <div data-slot="ui-section-skeleton-content" aria-hidden="true">
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
      data-slot="ui-page-skeleton"
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
            className="rounded-md border border-zinc-200 p-6 dark:border-zinc-800"
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
  ...props
}: ComponentPropsWithoutRef<"div"> & {
  loadingLabel: string;
  rows?: number;
  showHeader?: boolean;
}) {
  return (
    <div
      {...props}
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
      aria-live="polite"
      data-slot="ui-section-skeleton"
      className={cn(
        "rounded-md border border-zinc-200 p-6 dark:border-zinc-800",
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
      data-slot="ui-table-skeleton"
      className={cn("overflow-x-auto", className)}
    >
      <SkeletonStatus loadingLabel={loadingLabel} />
      <table
        aria-hidden="true"
        className="min-w-full text-left text-sm/6 text-zinc-950 dark:text-white"
      >
        <thead className="text-zinc-500 dark:text-zinc-400">
          <tr>
            {Array.from({ length: columnCount }, (_, index) => (
              <th
                key={index}
                scope="col"
                className="border-b border-b-zinc-950/10 px-4 py-2 dark:border-b-white/10"
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
                  className="border-b border-zinc-950/5 px-4 py-4 dark:border-white/5"
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
      data-slot="ui-form-skeleton"
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
      data-slot="ui-loading-region"
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
      data-slot="ui-spinner"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}
