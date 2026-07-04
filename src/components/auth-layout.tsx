// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import type React from "react";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[var(--app-shell-min-height)] bg-background px-4 pt-[calc(1.5rem+var(--app-safe-area-inset-top))] pb-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[var(--app-auth-card-min-height)] w-full max-w-2xl flex-col justify-center rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm sm:p-8 lg:p-10">
        {children}
      </div>
    </main>
  );
}
