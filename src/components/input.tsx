// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { forwardRef } from "react";
import { Input as UiInput } from "@/ui";
import { cn } from "@/lib/utils";

export function InputGroup({
  children,
  className,
}: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      data-slot="control"
      className={cn(
        "relative isolate block",
        "has-[[data-slot=icon]:first-child]:[&_input]:pl-10 has-[[data-slot=icon]:last-child]:[&_input]:pr-10 sm:has-[[data-slot=icon]:first-child]:[&_input]:pl-8 sm:has-[[data-slot=icon]:last-child]:[&_input]:pr-8",
        "*:data-[slot=icon]:pointer-events-none *:data-[slot=icon]:absolute *:data-[slot=icon]:top-3 *:data-[slot=icon]:z-10 *:data-[slot=icon]:size-5 sm:*:data-[slot=icon]:top-2.5 sm:*:data-[slot=icon]:size-4",
        "[&>[data-slot=icon]:first-child]:left-3 sm:[&>[data-slot=icon]:first-child]:left-2.5 [&>[data-slot=icon]:last-child]:right-3 sm:[&>[data-slot=icon]:last-child]:right-2.5",
        "*:data-[slot=icon]:text-zinc-500 dark:*:data-[slot=icon]:text-zinc-400",
        className
      )}
    >
      {children}
    </span>
  );
}

type InputProps = React.ComponentPropsWithoutRef<"input"> & {
  invalid?: boolean;
  "data-invalid"?: boolean | "true" | "false";
};

export const Input = forwardRef(function Input(
  { className, invalid, "data-invalid": dataInvalid, ...props }: InputProps,
  ref: React.ForwardedRef<HTMLInputElement>
) {
  const isInvalid = invalid || dataInvalid === true || dataInvalid === "true";

  return (
    <UiInput
      ref={ref}
      data-slot="control"
      aria-invalid={props["aria-invalid"] ?? (isInvalid || undefined)}
      data-invalid={isInvalid || undefined}
      className={cn(
        "h-10 px-3 py-2 text-base/6 sm:text-sm/6",
        "data-[invalid=true]:border-red-600 data-[invalid=true]:ring-red-600",
        className
      )}
      {...props}
    />
  );
});
