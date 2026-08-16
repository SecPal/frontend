// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import * as React from "react";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Switch = React.forwardRef<
  HTMLButtonElement,
  Omit<SwitchPrimitive.Root.Props, "onChange" | "onCheckedChange"> & {
    showIcons?: boolean;
    onChange?: (checked: boolean) => void;
  }
>(function Switch({ className, showIcons = false, onChange, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      nativeButton
      render={<button type="button" />}
      data-slot="switch"
      className={cn(
        "group peer data-checked:bg-primary data-unchecked:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-unchecked:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onCheckedChange={(checked) => onChange?.(checked)}
      {...props}
    >
      <SwitchPrimitive.Thumb className="bg-background pointer-events-none relative block size-4 rounded-full ring-0 transition-transform data-checked:translate-x-[calc(100%-2px)] data-unchecked:translate-x-0">
        {showIcons ? (
          <>
            <X
              aria-hidden="true"
              className="absolute inset-0 m-auto size-3 text-muted-foreground opacity-100 transition-opacity group-data-checked:opacity-0"
            />
            <Check
              aria-hidden="true"
              className="absolute inset-0 m-auto size-3 text-foreground opacity-0 transition-opacity group-data-checked:opacity-100"
            />
          </>
        ) : null}
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
});
