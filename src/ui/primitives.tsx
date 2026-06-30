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
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Loader2,
  X,
} from "lucide-react";
import { getCspNonce } from "@/lib/cspNonce";
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
          "bg-popover text-popover-foreground relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
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
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
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
        "bg-background text-foreground fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-x-hidden overflow-y-auto rounded-lg border p-6 shadow-lg duration-200 overscroll-contain data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
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
  { className, role = "alert", ...props }: ComponentPropsWithoutRef<"div">,
  ref: ForwardedRef<HTMLDivElement>
) {
  return (
    <div
      ref={ref}
      role={role}
      data-slot="alert"
      className={cn(
        "relative grid w-full grid-cols-[0_1fr] rounded-lg border px-4 py-3 text-sm text-card-foreground [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:top-4 [&>svg]:left-4 [&>svg~*]:pl-7",
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
        "bg-card text-card-foreground flex flex-col gap-6 rounded-lg border py-6 shadow-sm",
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
        "relative flex size-8 shrink-0 overflow-hidden text-sm font-medium uppercase",
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
            "bg-muted flex size-full items-center justify-center",
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
      className={cn("[&_tr]:border-b", className)}
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
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
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
        "border-t py-3 font-medium text-muted-foreground first:border-t-0 sm:first:border-t",
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
        "border-t pt-0 pb-3 text-foreground first:border-t-0 sm:py-3 sm:first:border-t",
        className
      )}
      {...props}
    />
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
            className="rounded-lg border bg-card p-6 text-card-foreground"
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
          "rounded-lg border bg-card p-6 text-card-foreground",
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
        "rounded-lg border bg-card p-6 text-card-foreground",
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
              <th key={index} scope="col" className="border-b px-2 py-2">
                <Skeleton className="h-4 w-24" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }, (_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columnCount }, (_, columnIndex) => (
                <td key={columnIndex} className="border-b px-2 py-4">
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
