// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useState } from "react";
import { AuthContext, type User } from "./auth-context";
import { authStorage } from "../services/storage";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    return authStorage.getUser();
  });

  const [isLoading] = useState(false);

  const login = (newUser: User) => {
    authStorage.setUser(newUser);
    setUser(newUser);
  };

  const logout = () => {
    authStorage.clear();
    setUser(null);
  };

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
