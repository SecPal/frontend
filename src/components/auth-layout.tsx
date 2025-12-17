// SPDX-FileCopyrightText: Tailwind Labs Inc.
// SPDX-License-Identifier: LicenseRef-TailwindPlus

import type React from "react";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col p-4 lg:p-8 lg:justify-center lg:items-center">
      <div className="flex flex-col flex-1 w-full max-w-2xl p-8 lg:flex-none lg:rounded-lg lg:bg-white lg:p-12 lg:shadow-xs lg:ring-1 lg:ring-zinc-950/5 dark:lg:bg-zinc-900 dark:lg:ring-white/10">
        {children}
      </div>
    </main>
  );
}
