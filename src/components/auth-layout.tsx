// SPDX-FileCopyrightText: Tailwind Labs Inc.
// SPDX-License-Identifier: LicenseRef-TailwindPlus

import type React from "react";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4 lg:p-8">
      <div className="flex flex-col w-full max-w-2xl p-8 lg:p-12 bg-white rounded-lg shadow-xs ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
        {children}
      </div>
    </main>
  );
}
