// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import type React from "react";
import { AuthLayout } from "./auth-layout";
import { Button } from "./button";
import { Logo } from "./Logo";
import { useAuth } from "../hooks/useAuth";
import { getAuthTransport } from "../services/authTransport";

const LOGOUT_TIMEOUT_MS = 8000;

async function logoutWithTimeout(logoutRequest: Promise<void>) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      logoutRequest.then(() => "completed" as const),
      new Promise<"timed-out">((resolve) => {
        timeoutId = setTimeout(() => resolve("timed-out"), LOGOUT_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

export function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { i18n } = useLingui();
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleLogout = async () => {
    setLogoutError(null);

    try {
      await logoutWithTimeout(getAuthTransport().logout());
      logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout API call failed:", error);
      setLogoutError(
        i18n._(
          msg`We could not complete the sign out request. Please try again.`
        )
      );
    }
  };

  return (
    <AuthLayout>
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <Logo size="32" />
        <Button outline onClick={() => void handleLogout()}>
          <Trans>Sign out</Trans>
        </Button>
      </div>
      {logoutError && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {logoutError}
        </p>
      )}
      <div className="pt-8">{children}</div>
    </AuthLayout>
  );
}
