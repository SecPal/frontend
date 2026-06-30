// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useNavigate } from "react-router-dom";
import { Trans } from "@lingui/react/macro";
import { Suspense, type ReactNode } from "react";
import { Logo } from "./Logo";
import { useAuth } from "../hooks/useAuth";
import { getAuthTransport } from "../services/authTransport";
import { Button } from "@/ui";
import { RouteContentFallback } from "./RouteContentFallback";

export const LOGOUT_TIMEOUT_MS = 8000;

async function logoutWithTimeout(logoutRequest: Promise<void>): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    await Promise.race([
      logoutRequest,
      new Promise<void>((resolve) => {
        timeoutId = setTimeout(resolve, LOGOUT_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

export function OnboardingLayout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logoutWithTimeout(getAuthTransport().logout());
    } catch (error) {
      console.error("Logout API call failed:", error);
    } finally {
      try {
        await Promise.resolve(logout());
      } catch (error) {
        console.error("Local logout cleanup failed:", error);
      }
      navigate("/login");
    }
  };

  return (
    <main className="flex min-h-svh flex-col bg-white p-4 dark:bg-zinc-900 lg:items-center lg:justify-center lg:bg-zinc-50 lg:p-8 dark:lg:bg-zinc-950">
      <div className="flex w-full max-w-4xl flex-1 flex-col lg:flex-none">
        <header className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800">
          <Logo size="32" />
          <Button variant="outline" onClick={() => void handleLogout()}>
            <Trans>Sign out</Trans>
          </Button>
        </header>
        <div className="pt-8">
          <Suspense fallback={<RouteContentFallback />}>{children}</Suspense>
        </div>
      </div>
    </main>
  );
}
