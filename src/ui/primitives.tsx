// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import {
  createContext,
  useContext,
  useId,
  useState,
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { Check, ChevronDown, Circle, Search } from "lucide-react";
import { PrefetchLink } from "@/components/PrefetchLink";
import {
  getTypeBadgeColor,
  getTypeLabel,
  type OrganizationalUnitBadgeColor,
} from "@/lib/organizationalUnitUtils";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Label } from "./label";
import { buttonVariants, type ButtonVariant, uiFocusRing } from "./styles";

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
  HTMLLabelElement,
  React.ComponentProps<typeof Label>
>(function FieldLabel({ className, ...props }, ref) {
  return (
    <Label
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

export interface CommandOption {
  value: string;
  label: string;
  disabled?: boolean;
  keywords?: string[];
}

export interface SearchableAutocompleteListboxProps {
  anchor: ReactElement;
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onValueChange?: (value: string | null) => void;
  listboxId: string;
  className?: string;
  slotPrefix: string;
  children: ReactNode;
}

export function SearchableAutocompleteListbox({
  anchor,
  open,
  onOpenChange,
  onValueChange,
  listboxId,
  className,
  slotPrefix,
  children,
}: SearchableAutocompleteListboxProps) {
  return (
    <ComboboxPrimitive.Root<string>
      open={open}
      onOpenChange={(nextOpen) => onOpenChange?.(nextOpen)}
      onValueChange={(value) => onValueChange?.(value)}
    >
      <ComboboxPrimitive.Input render={anchor} />
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          align="start"
          sideOffset={4}
          className="isolate z-50"
        >
          <ComboboxPrimitive.Popup
            data-slot={`${slotPrefix}-autocomplete-popover-content`}
            className={cn(
              "bg-popover text-popover-foreground z-50 w-(--anchor-width) overflow-hidden rounded-md border border-border shadow-lg outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              className
            )}
          >
            <ComboboxPrimitive.List
              id={listboxId}
              data-slot={`${slotPrefix}-autocomplete-listbox`}
              className="max-h-72 overflow-x-hidden overflow-y-auto"
            >
              {children}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}

export interface SearchableAutocompleteOptionProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "style"
> {
  slotPrefix: string;
  value: string;
}

export function SearchableAutocompleteOption({
  className,
  slotPrefix,
  value,
  ...props
}: SearchableAutocompleteOptionProps) {
  return (
    <ComboboxPrimitive.Item
      value={value}
      data-slot={`${slotPrefix}-autocomplete-option`}
      className={cn(
        "block w-full cursor-default border-b border-border px-3 py-2 text-left text-sm outline-none last:border-b-0 data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        className
      )}
      {...props}
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
  const [inputValue, setInputValue] = useState("");
  const selectedOption =
    options.find((option) => option.value === value) ?? null;

  return (
    <ComboboxPrimitive.Root
      items={options}
      autoHighlight
      value={selectedOption}
      inputValue={inputValue}
      disabled={disabled}
      itemToStringLabel={(option) => option.label}
      itemToStringValue={(option) => option.value}
      isItemEqualToValue={(option, selected) => option.value === selected.value}
      filter={(option, query) =>
        commandOptionFilter(option.label, query, [
          option.value,
          ...(option.keywords ?? []),
        ]) > 0
      }
      onValueChange={(option) => {
        if (option && !option.disabled) {
          onValueChange(option.value);
        }
      }}
      onInputValueChange={(nextInputValue) => setInputValue(nextInputValue)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setInputValue("");
        }
      }}
    >
      <div className="space-y-2">
        <span
          id={labelId}
          className="block text-sm font-medium text-foreground"
        >
          {label}
        </span>
        <ComboboxPrimitive.Trigger
          render={
            <Button
              variant="outline"
              className="w-full justify-between"
              aria-labelledby={labelId}
              aria-invalid={errorMessage ? true : undefined}
              aria-describedby={errorMessage ? errorId : undefined}
              disabled={disabled}
            />
          }
        >
          <span>{selectedOption?.label ?? placeholder}</span>
          <ChevronDown className="size-4 opacity-50" aria-hidden="true" />
        </ComboboxPrimitive.Trigger>
        <ComboboxPrimitive.Portal>
          <ComboboxPrimitive.Positioner
            align="start"
            sideOffset={4}
            className="isolate z-50"
          >
            <ComboboxPrimitive.Popup
              data-slot={`${slotPrefix}-command-popover-content`}
              className="bg-popover text-popover-foreground z-50 w-(--anchor-width) overflow-hidden rounded-md border border-border shadow-lg outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
            >
              <div className="flex h-9 items-center gap-2 border-b border-border px-3">
                <Search
                  className="size-4 shrink-0 opacity-50"
                  aria-hidden="true"
                />
                <ComboboxPrimitive.Input
                  data-slot="command-input"
                  aria-label={searchPlaceholder}
                  aria-invalid={errorMessage ? true : undefined}
                  aria-describedby={errorMessage ? errorId : undefined}
                  placeholder={searchPlaceholder}
                  className="placeholder:text-muted-foreground flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <ComboboxPrimitive.Empty className="py-6 text-center text-sm">
                {emptyMessage}
              </ComboboxPrimitive.Empty>
              <ComboboxPrimitive.List
                data-slot="command-list"
                className="max-h-72 overflow-x-hidden overflow-y-auto p-1"
              >
                {(option: CommandOption) => (
                  <ComboboxPrimitive.Item
                    key={option.value}
                    data-slot="command-item"
                    value={option}
                    disabled={option.disabled}
                    className="data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                    </span>
                    <ComboboxPrimitive.ItemIndicator>
                      <Check className="size-4" aria-hidden="true" />
                    </ComboboxPrimitive.ItemIndicator>
                  </ComboboxPrimitive.Item>
                )}
              </ComboboxPrimitive.List>
            </ComboboxPrimitive.Popup>
          </ComboboxPrimitive.Positioner>
        </ComboboxPrimitive.Portal>
        {errorMessage ? (
          <FieldError id={errorId}>{errorMessage}</FieldError>
        ) : null}
      </div>
    </ComboboxPrimitive.Root>
  );
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

  return entries.some((entry) =>
    entry
      .split(/[\s,./()_-]+/)
      .some((word) => word.startsWith(normalizedSearch))
  )
    ? 0.8
    : 0;
}

export function RadioGroup({
  className,
  onValueChange,
  ...props
}: Omit<RadioGroupPrimitive.Props, "onValueChange"> & {
  onValueChange?: (value: string) => void;
}) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      onValueChange={(value) => onValueChange?.(value)}
      {...props}
    />
  );
}

export const RadioGroupItem = forwardRef<
  HTMLButtonElement,
  RadioPrimitive.Root.Props
>(function RadioGroupItem({ className, ...props }, ref) {
  return (
    <RadioPrimitive.Root
      ref={ref}
      data-slot="radio-group-item"
      className={cn(
        "border-input text-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        render={<Circle className="size-2.5 fill-current" aria-hidden="true" />}
      />
    </RadioPrimitive.Root>
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

export function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

export function DialogPortal(props: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal {...props} />;
}

export const DialogOverlay = forwardRef<
  HTMLDivElement,
  DialogPrimitive.Backdrop.Props
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Backdrop
      ref={ref}
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-40 bg-black/50 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0",
        className
      )}
      {...props}
    />
  );
});

export const DialogContent = forwardRef<
  HTMLDivElement,
  DialogPrimitive.Popup.Props & {
    size?: keyof typeof dialogSizes;
  }
>(function DialogContent({ className, children, size = "md", ...props }, ref) {
  return (
    <DialogPrimitive.Popup
      ref={ref}
      data-slot="dialog-content"
      className={cn(
        "bg-background text-foreground fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-x-hidden overflow-y-auto rounded-lg border border-border p-6 shadow-lg duration-200 overscroll-contain outline-none data-ending-style:opacity-0 data-ending-style:scale-95 data-starting-style:opacity-0 data-starting-style:scale-95",
        dialogSizes[size],
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Popup>
  );
});

export const DialogTitle = forwardRef<
  HTMLHeadingElement,
  DialogPrimitive.Title.Props
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
  HTMLParagraphElement,
  DialogPrimitive.Description.Props
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
  ...props
}: Omit<ProgressPrimitive.Root.Props, "style" | "value"> & {
  value: number;
  max?: number;
}) {
  const boundedMax = max > 0 ? max : 100;
  const boundedValue = Math.min(Math.max(value, 0), boundedMax);
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={boundedValue}
      max={boundedMax}
      className={cn("relative w-full", className)}
      {...props}
    >
      <ProgressPrimitive.Track
        data-slot="progress-track"
        className="bg-primary/20 relative h-2 w-full overflow-hidden rounded-full"
      >
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className="h-full bg-primary transition-all"
        />
      </ProgressPrimitive.Track>
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
  onOpenChange,
  onValueChange,
  listboxId,
  className,
  children,
}: EmployeeAutocompleteListboxProps) {
  return (
    <SearchableAutocompleteListbox
      anchor={anchor}
      open={open}
      onOpenChange={onOpenChange}
      onValueChange={onValueChange}
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
  onOpenChange?: (open: boolean) => void;
  onValueChange?: (value: string | null) => void;
  listboxId: string;
  className?: string;
  children: ReactNode;
}

export interface EmployeeAutocompleteOptionProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "style"
> {
  value: string;
}

export function EmployeeAutocompleteOption({
  className,
  ...props
}: EmployeeAutocompleteOptionProps) {
  return (
    <SearchableAutocompleteOption
      className={className}
      slotPrefix="employee"
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
