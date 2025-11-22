// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useNavigate } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { useAuth } from "../hooks/useAuth";
import { logout as apiLogout } from "../services/authApi";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Button } from "./button";

export function Header() {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

  const handleLogout = async () => {
    if (token) {
      try {
        await apiLogout(token);
      } catch (error) {
        console.error("Logout API call failed:", error);
        // TODO: Add user notification (toast/alert) for better UX
      }
    }
    logout();
    navigate("/login");
  };

  // Note: user is guaranteed to be non-null when Header is rendered
  // because Header is only rendered inside ProtectedRoute which checks authentication
  return (
    <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-xl font-bold">SecPal</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {user?.name}
            </span>
            <LanguageSwitcher />
            <Button onClick={handleLogout} color="red">
              <Trans>Logout</Trans>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
