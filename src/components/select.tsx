// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { uiControlBase } from "@/ui/styles";

type SelectProps = React.ComponentPropsWithoutRef<"select"> & {
  invalid?: boolean;
  "data-invalid"?: boolean | "true" | "false";
};

export const Select = forwardRef(function Select(
  {
    className,
    multiple,
    invalid,
    "data-invalid": dataInvalid,
    ...props
  }: SelectProps,
  ref: React.ForwardedRef<HTMLSelectElement>
) {
  const isInvalid = invalid || dataInvalid === true || dataInvalid === "true";

  return (
    <span
      data-slot="control"
      className={cn("relative block w-full", className)}
    >
      <select
        ref={ref}
        multiple={multiple}
        aria-invalid={props["aria-invalid"] ?? (isInvalid || undefined)}
        data-invalid={isInvalid || undefined}
        className={cn(
          uiControlBase,
          "h-10 appearance-none pr-9 text-base/6 sm:text-sm/6",
          multiple && "h-auto pr-3",
          "data-[invalid=true]:border-red-600 data-[invalid=true]:ring-red-600",
          "dark:[&_*]:bg-zinc-950 dark:[&_*]:text-zinc-50"
        )}
        {...props}
      />
      {!multiple && (
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 dark:text-zinc-400">
          <ChevronDown className="size-4" aria-hidden="true" />
        </span>
      )}
    </span>
  );
});
