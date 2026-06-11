// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Check, X } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { wireFieldChildren } from "./field-wiring";
import { Description, ErrorMessage, Label } from "./fieldset";

export function SwitchGroup({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="control"
      {...props}
      className={cn(
        "space-y-3 **:data-[slot=label]:font-normal",
        "has-data-[slot=description]:space-y-6 has-data-[slot=description]:**:data-[slot=label]:font-medium",
        className
      )}
    />
  );
}

export function SwitchField({
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
        "grid grid-cols-[1fr_auto] gap-x-8 gap-y-1 sm:grid-cols-[1fr_auto]",
        "*:data-[slot=control]:col-start-2 *:data-[slot=control]:self-start sm:*:data-[slot=control]:mt-0.5",
        "*:data-[slot=label]:col-start-1 *:data-[slot=label]:row-start-1",
        "*:data-[slot=description]:col-start-1 *:data-[slot=description]:row-start-2",
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

type SwitchProps = Omit<
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>,
  "onChange" | "onCheckedChange"
> & {
  color?: string;
  showIcons?: boolean;
  onChange?: (checked: boolean) => void;
};

export function Switch({
  className,
  color,
  showIcons = false,
  onChange,
  ...props
}: SwitchProps) {
  void color;

  return (
    <SwitchPrimitive.Root
      data-slot="control"
      {...props}
      className={cn(
        "group relative inline-flex h-6 w-10 shrink-0 cursor-default items-center rounded-full border border-transparent bg-zinc-200 p-[3px] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-zinc-950 sm:h-5 sm:w-8 dark:bg-zinc-800 dark:focus-visible:ring-offset-zinc-950 dark:data-[state=checked]:bg-zinc-50",
        className
      )}
      onCheckedChange={onChange}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none relative block size-4.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-4 sm:size-3.5 sm:data-[state=checked]:translate-x-3 dark:data-[state=checked]:bg-zinc-950"
        )}
      >
        {showIcons && (
          <>
            <X
              aria-hidden="true"
              className="absolute inset-0 m-auto size-3 text-zinc-400 opacity-100 transition-opacity group-data-[state=checked]:opacity-0 dark:text-zinc-600"
            />
            <Check
              aria-hidden="true"
              className="absolute inset-0 m-auto size-3 text-zinc-950 opacity-0 transition-opacity group-data-[state=checked]:opacity-100 dark:text-zinc-50"
            />
          </>
        )}
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
}
