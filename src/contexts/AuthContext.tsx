// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useState, useEffect, useCallback } from "react";
import { AuthContext, type User } from "./auth-context";
import { authStorage } from "../services/storage";
import { sessionEvents } from "../services/sessionEvents";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    return authStorage.getUser();
  });

  const [isLoading] = useState(false);

  const login = useCallback((newUser: User) => {
    authStorage.setUser(newUser);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    authStorage.clear();
    setUser(null);
  }, []);

  // Subscribe to session:expired events
  // This handles 401 responses from API calls (when online)
  useEffect(() => {
    const unsubscribe = sessionEvents.on("session:expired", () => {
      // Check authStorage instead of user state to avoid adding user as dependency.
      // Adding user would cause re-subscription on every user change, which is unnecessary.
      // authStorage and user state are always in sync via login/logout functions.
      if (authStorage.getUser()) {
        logout();
      }
    });

    return unsubscribe;
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
