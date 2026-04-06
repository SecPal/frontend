// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type React from "react";
import type { User } from "../contexts/auth-context";
import { RouteEmailVerificationState } from "./RouteGuardState";

interface EmailVerificationGateProps {
  children: React.ReactNode | (() => React.ReactNode);
  onRetry: () => void;
  onSignInAgain: () => void;
  user: User | null;
}

export function EmailVerificationGate({
  children,
  onRetry,
  onSignInAgain,
  user,
}: EmailVerificationGateProps) {
  if (user?.emailVerified === false) {
    return (
      <RouteEmailVerificationState
        email={user.email}
        onRetry={onRetry}
        onSignInAgain={onSignInAgain}
      />
    );
  }

  return <>{typeof children === "function" ? children() : children}</>;
}
