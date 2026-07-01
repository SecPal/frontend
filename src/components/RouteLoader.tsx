// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { PageSkeleton } from "@/ui/loading";
import { Skeleton } from "@/ui/skeleton";
import { Logo } from "./Logo";

export function RouteLoader() {
  const { i18n } = useLingui();

  return (
    <div
      className="relative isolate flex min-h-[var(--app-shell-min-height)] w-full flex-col bg-background"
      data-slot="app-shell-loader"
    >
      <header className="flex items-center px-4 pt-[var(--app-safe-area-inset-top)]">
        <div className="flex min-h-14 min-w-0 flex-1 items-center gap-4 border-b border-border">
          <Logo size="32" />
          <div className="hidden gap-3 lg:flex" aria-hidden="true">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="ml-auto">
            <Skeleton className="size-8 rounded-full" />
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col bg-background">
        <div className="grow p-6 lg:p-10">
          <div className="mx-auto max-w-6xl">
            <PageSkeleton
              loadingLabel={i18n._(msg`Loading application`)}
              sections={2}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
