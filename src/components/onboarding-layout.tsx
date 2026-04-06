// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useNavigate } from "react-router-dom";
import { Trans } from "@lingui/macro";
import type React from "react";
import { AuthLayout } from "./auth-layout";
import { Button } from "./button";
import { Logo } from "./Logo";
import { useAuth } from "../hooks/useAuth";
import { getAuthTransport } from "../services/authTransport";

export function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    logout();

    try {
      await getAuthTransport().logout();
    } catch (error) {
      console.error("Logout API call failed:", error);
    } finally {
      navigate("/login");
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
      <div className="pt-8">{children}</div>
    </AuthLayout>
  );
}
