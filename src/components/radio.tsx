// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  RadioGroup as UiRadioGroup,
  RadioGroupItem as UiRadioGroupItem,
} from "@/ui";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { wireFieldChildren } from "./field-wiring";
import { Description, ErrorMessage, Label } from "./fieldset";

export function RadioGroup({
  className,
  onChange,
  ...props
}: Omit<
  React.ComponentPropsWithoutRef<typeof UiRadioGroup>,
  "onValueChange"
> & {
  onChange?: (value: string) => void;
}) {
  return (
    <UiRadioGroup
      data-slot="control"
      {...props}
      onValueChange={onChange}
      className={cn(
        "space-y-3 **:data-[slot=label]:font-normal",
        "has-data-[slot=description]:space-y-6 has-data-[slot=description]:**:data-[slot=label]:font-medium",
        className
      )}
    />
  );
}

export function RadioField({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const generatedId = useId();

  return (
    <div
      data-slot="field"
      {...props}
      className={cn(
        "grid grid-cols-[1.125rem_1fr] gap-x-4 gap-y-1 sm:grid-cols-[1rem_1fr]",
        "*:data-[slot=control]:col-start-1 *:data-[slot=control]:row-start-1 *:data-[slot=control]:mt-0.75 sm:*:data-[slot=control]:mt-1",
        "*:data-[slot=label]:col-start-2 *:data-[slot=label]:row-start-1",
        "*:data-[slot=description]:col-start-2 *:data-[slot=description]:row-start-2",
        "has-data-[slot=description]:**:data-[slot=label]:font-medium",
        className
      )}
    >
      {wireFieldChildren({
        children,
        generatedId,
        labelType: Label,
        helperTypes: [Label, Description, ErrorMessage],
      })}
    </div>
  );
}

export function Radio({
  className,
  color,
  ...props
}: React.ComponentPropsWithoutRef<typeof UiRadioGroupItem> & {
  color?: string;
}) {
  void color;

  return (
    <UiRadioGroupItem
      data-slot="control"
      {...props}
      className={cn("group", className)}
    />
  );
}
