// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  Omit<
    React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>,
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
        "group peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
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
