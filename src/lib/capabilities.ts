// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { User } from "../contexts/auth-context";

const ELEVATED_UI_ROLES = ["Admin", "Manager", "HR"] as const;

const CUSTOMER_FEATURE_PERMISSIONS = [
  "customers.read",
  "customers.create",
  "customers.update",
  "customers.delete",
  "customers.*",
  "sites.read",
  "sites.create",
  "sites.update",
  "sites.delete",
  "sites.*",
  "assignments.create",
  "assignments.update",
  "assignments.delete",
  "assignments.*",
] as const;

const EMPLOYEE_FEATURE_PERMISSIONS = [
  "employee.read",
  "employee.write",
  "employee.create",
  "employee.update",
  "employee.delete",
  "employee.activate",
  "employee.*",
  "employees.read",
  "employees.write",
  "employees.create",
  "employees.update",
  "employees.delete",
  "employees.activate",
  "employees.*",
] as const;

const ACTIVITY_LOG_FEATURE_PERMISSIONS = ["activity_log.read"] as const;

export interface UserCapabilities {
  home: boolean;
  profile: boolean;
  settings: boolean;
  organization: boolean;
  customers: boolean;
  sites: boolean;
  employees: boolean;
  activityLogs: boolean;
}

export type RestrictedFeature = Exclude<
  keyof UserCapabilities,
  "home" | "profile" | "settings"
>;

export function hasUserRole(
  user: User | null | undefined,
  role: string
): boolean {
  return user?.roles?.includes(role) ?? false;
}

export function hasAnyUserRole(
  user: User | null | undefined,
  roles: readonly string[]
): boolean {
  return roles.some((role) => hasUserRole(user, role));
}

export function hasUserPermission(
  user: User | null | undefined,
  permission: string
): boolean {
  if (!user?.permissions?.length) {
    return false;
  }

  if (user.permissions.includes(permission)) {
    return true;
  }

  if (!permission.includes(".")) {
    return false;
  }

  const [resource] = permission.split(".");

  return user.permissions.includes(`${resource}.*`);
}

export function hasAnyUserPermission(
  user: User | null | undefined,
  permissions: readonly string[]
): boolean {
  return permissions.some((permission) => hasUserPermission(user, permission));
}

export function getUserCapabilities(
  user: User | null | undefined
): UserCapabilities {
  const isAuthenticated = user !== null && user !== undefined;
  const hasOrganizationalScopes = user?.hasOrganizationalScopes ?? false;
  const hasElevatedUiRole = hasAnyUserRole(user, ELEVATED_UI_ROLES);

  return {
    home: isAuthenticated,
    profile: isAuthenticated,
    settings: isAuthenticated,
    organization:
      isAuthenticated && hasOrganizationalScopes && hasElevatedUiRole,
    customers:
      isAuthenticated &&
      (hasElevatedUiRole ||
        hasAnyUserPermission(user, CUSTOMER_FEATURE_PERMISSIONS)),
    sites:
      isAuthenticated &&
      (hasElevatedUiRole ||
        hasAnyUserPermission(user, CUSTOMER_FEATURE_PERMISSIONS)),
    employees:
      isAuthenticated &&
      hasOrganizationalScopes &&
      (hasElevatedUiRole ||
        hasAnyUserPermission(user, EMPLOYEE_FEATURE_PERMISSIONS)),
    activityLogs:
      isAuthenticated &&
      hasAnyUserPermission(user, ACTIVITY_LOG_FEATURE_PERMISSIONS),
  };
}
