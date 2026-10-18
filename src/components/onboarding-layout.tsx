// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useNavigate } from "react-router";
import { Trans } from "@lingui/react/macro";
import { Suspense, type ReactNode } from "react";
import { Logo } from "./Logo";
import { Footer } from "./Footer";
import { PublicPageHeader } from "./PublicPageHeader";
import { UpdatePrompt } from "./UpdatePrompt";
import { useAuth } from "../hooks/useAuth";
import { getAuthTransport } from "../services/authTransport";
import { Button } from "@/ui/button";
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
    <main className="flex min-h-[var(--app-shell-min-height)] flex-col bg-background text-foreground">
      <PublicPageHeader>
        <header className="flex items-center justify-between gap-4">
          <Logo size="32" />
          <Button variant="outline" onClick={() => void handleLogout()}>
            <Trans>Sign out</Trans>
          </Button>
        </header>
      </PublicPageHeader>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-4 sm:px-6 lg:px-8 lg:pb-8">
        <div className="flex-1">
          <UpdatePrompt className="mx-auto mb-6 max-w-4xl rounded-md" />
          <Suspense fallback={<RouteContentFallback />}>{children}</Suspense>
        </div>
        <div className="pt-8">
          <Footer />
        </div>
      </div>
    </main>
  );
}
