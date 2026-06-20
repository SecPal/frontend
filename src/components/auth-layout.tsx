// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type React from "react";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[var(--app-shell-min-height)] bg-white px-4 py-6 text-zinc-950 dark:bg-zinc-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[var(--app-auth-card-min-height)] w-full max-w-2xl flex-col justify-center rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900 sm:p-8 lg:p-10">
        {children}
      </div>
    </main>
  );
}
