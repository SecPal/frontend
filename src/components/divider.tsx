// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { cn } from "@/lib/utils";

export function Divider({
  soft = false,
  className,
  ...props
}: { soft?: boolean } & React.ComponentPropsWithoutRef<"hr">) {
  return (
    <hr
      role="presentation"
      {...props}
      className={cn(
        "w-full border-t",
        soft && "border-zinc-950/5 dark:border-white/5",
        !soft && "border-zinc-950/10 dark:border-white/10",
        className
      )}
    />
  );
}
