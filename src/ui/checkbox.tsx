// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Checkbox = React.forwardRef<
  HTMLButtonElement,
  Omit<CheckboxPrimitive.Root.Props, "onCheckedChange"> & {
    onCheckedChange?: (checked: boolean) => void;
  }
>(function Checkbox({ className, onCheckedChange, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      nativeButton
      render={<button type="button" />}
      data-slot="checkbox"
      onCheckedChange={(checked) => onCheckedChange?.(checked)}
      className={cn(
        "peer border-input dark:bg-input/30 data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary data-checked:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-3.5" aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
