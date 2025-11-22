// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useState } from "react";
import { AuthContext, type User } from "./auth-context";
import { authStorage } from "../services/storage";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    return authStorage.getUser();
  });

  const [token, setToken] = useState<string | null>(() => {
    return authStorage.getToken();
  });

  const [isLoading] = useState(false);

  const login = (newToken: string, newUser: User) => {
    authStorage.setToken(newToken);
    authStorage.setUser(newUser);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    authStorage.clear();
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
