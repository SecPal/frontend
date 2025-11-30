// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createContext } from "react";

export interface User {
  id: number;
  name: string;
  email: string;
  roles?: string[];
  permissions?: string[];
  hasOrganizationalScopes?: boolean;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User) => void;
  logout: () => void;
  /**
   * Check if user has a specific role
   */
  hasRole: (role: string) => boolean;
  /**
   * Check if user has a specific permission.
   * Supports wildcard matching (e.g., "employees.*" matches "employees.read").
   */
  hasPermission: (permission: string) => boolean;
  /**
   * Check if user has any organizational scopes (for org/customer management)
   */
  hasOrganizationalAccess: () => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);
