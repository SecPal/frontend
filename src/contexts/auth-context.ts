// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createContext } from "react";
import type {
  Employee,
  EmployeeOnboardingWorkflowStatus,
  EmployeeStatus,
} from "@/types/api";

export type AuthUserId = string;
export type AuthBootstrapRecoveryReason = "timeout" | "network";

export interface User {
  id: AuthUserId;
  name: string;
  email: string;
  emailVerified?: boolean;
  roles?: string[];
  permissions?: string[];
  hasOrganizationalScopes?: boolean;
  hasCustomerAccess?: boolean;
  hasSiteAccess?: boolean;
  employeeStatus?: EmployeeStatus;
  onboardingWorkflowStatus?: EmployeeOnboardingWorkflowStatus;
  employee?: Employee | null; // User's employee record (if they are an employee)
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  bootstrapRecoveryReason: AuthBootstrapRecoveryReason | null;
  login: (user: User) => Promise<void>;
  logout: () => void;
  retryBootstrap: () => void;
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
