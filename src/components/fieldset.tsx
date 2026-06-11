// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useId } from "react";
import { Field as UiField, FieldDescription, FieldError, FieldLabel } from "@/ui";
import { cn } from "@/lib/utils";
import { wireFieldChildren } from "./field-wiring";

export function Fieldset({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"fieldset">) {
  return (
    <fieldset
      {...props}
      className={cn(
        "*:data-[slot=text]:mt-1 [&>*+[data-slot=control]]:mt-6",
        className
      )}
    />
  );
}

export function Legend({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"legend">) {
  return (
    <legend
      data-slot="legend"
      {...props}
      className={cn(
        "text-base/6 font-semibold text-zinc-950 sm:text-sm/6 dark:text-white",
        className
      )}
    />
  );
}

export function FieldGroup({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="control"
      {...props}
      className={cn("space-y-8", className)}
    />
  );
}

export function Field({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const generatedId = useId();

  return (
    <UiField
      {...props}
      className={cn(
        "[&>[data-slot=label]+[data-slot=control]]:mt-3",
        "[&>[data-slot=label]+[data-slot=description]]:mt-1",
        "[&>[data-slot=description]+[data-slot=control]]:mt-3",
        "[&>[data-slot=control]+[data-slot=description]]:mt-3",
        "[&>[data-slot=control]+[data-slot=error]]:mt-3",
        "*:data-[slot=label]:font-medium",
        className
      )}
    >
      {wireFieldChildren({
        children,
        generatedId,
        labelType: Label,
        helperTypes: [Label, Description, ErrorMessage],
      })}
    </UiField>
  );
}

export function Label({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof FieldLabel>) {
  return (
    <FieldLabel
      data-slot="label"
      {...props}
      className={cn(
        "text-base/6 text-zinc-950 select-none sm:text-sm/6 dark:text-white",
        className
      )}
    />
  );
}

export function Description({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"p">) {
  return (
    <FieldDescription
      data-slot="description"
      {...props}
      className={cn(
        "text-base/6 text-zinc-500 sm:text-sm/6 dark:text-zinc-400",
        className
      )}
    />
  );
}

export function ErrorMessage({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"p">) {
  return (
    <FieldError
      data-slot="error"
      {...props}
      className={cn(
        "text-base/6 text-red-600 sm:text-sm/6 dark:text-red-500",
        className
      )}
    />
  );
}
