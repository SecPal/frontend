// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { forwardRef } from "react";
import { Textarea as UiTextarea } from "@/ui";
import { cn } from "@/lib/utils";

type TextareaProps = React.ComponentPropsWithoutRef<"textarea"> & {
  invalid?: boolean;
  resizable?: boolean;
  "data-invalid"?: boolean | "true" | "false";
};

export const Textarea = forwardRef(function Textarea(
  {
    className,
    invalid,
    resizable = true,
    "data-invalid": dataInvalid,
    ...props
  }: TextareaProps,
  ref: React.ForwardedRef<HTMLTextAreaElement>
) {
  const isInvalid = invalid || dataInvalid === true || dataInvalid === "true";

  return (
    <UiTextarea
      ref={ref}
      data-slot="control"
      aria-invalid={props["aria-invalid"] ?? (isInvalid || undefined)}
      data-invalid={isInvalid || undefined}
      className={cn(
        "text-base/6 sm:text-sm/6",
        resizable ? "resize-y" : "resize-none",
        "data-[invalid=true]:border-red-600 data-[invalid=true]:ring-red-600",
        className
      )}
      {...props}
    />
  );
});
