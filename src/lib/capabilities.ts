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

const CUSTOMER_CREATE_PERMISSIONS = [
  "customers.create",
  "customers.*",
] as const;
const CUSTOMER_UPDATE_PERMISSIONS = [
  "customers.update",
  "customers.*",
] as const;
const CUSTOMER_DELETE_PERMISSIONS = [
  "customers.delete",
  "customers.*",
] as const;

const SITE_CREATE_PERMISSIONS = ["sites.create", "sites.*"] as const;
const SITE_UPDATE_PERMISSIONS = ["sites.update", "sites.*"] as const;
const SITE_DELETE_PERMISSIONS = ["sites.delete", "sites.*"] as const;

const EMPLOYEE_CREATE_PERMISSIONS = [
  "employee.write",
  "employee.create",
  "employee.*",
  "employees.write",
  "employees.create",
  "employees.*",
] as const;

const EMPLOYEE_UPDATE_PERMISSIONS = [
  "employee.write",
  "employee.update",
  "employee.*",
  "employees.write",
  "employees.update",
  "employees.*",
] as const;

const EMPLOYEE_DELETE_PERMISSIONS = [
  "employee.write",
  "employee.delete",
  "employee.*",
  "employees.write",
  "employees.delete",
  "employees.*",
] as const;

const EMPLOYEE_ACTIVATE_PERMISSIONS = [
  "employee.write",
  "employee.activate",
  "employee.*",
  "employees.write",
  "employees.activate",
  "employees.*",
] as const;

const EMPLOYEE_TERMINATE_PERMISSIONS = [
  "employee.write",
  "employee.terminate",
  "employee.*",
  "employees.write",
  "employees.terminate",
  "employees.*",
] as const;

export interface ResourceActionCapabilities {
  create: boolean;
  update: boolean;
  delete: boolean;
}

export interface EmployeeActionCapabilities extends ResourceActionCapabilities {
  activate: boolean;
  terminate: boolean;
}

export interface UserActionCapabilities {
  customers: ResourceActionCapabilities;
  sites: ResourceActionCapabilities;
  employees: EmployeeActionCapabilities;
}

export interface UserCapabilities {
  home: boolean;
  profile: boolean;
  settings: boolean;
  organization: boolean;
  customers: boolean;
  sites: boolean;
  employees: boolean;
  activityLogs: boolean;
  actions: UserActionCapabilities;
}

export type RestrictedFeature = Exclude<
  keyof UserCapabilities,
  "home" | "profile" | "settings" | "actions"
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
  const canCreateCustomers =
    isAuthenticated &&
    (hasElevatedUiRole ||
      hasAnyUserPermission(user, CUSTOMER_CREATE_PERMISSIONS));
  const canUpdateCustomers =
    isAuthenticated &&
    (hasElevatedUiRole ||
      hasAnyUserPermission(user, CUSTOMER_UPDATE_PERMISSIONS));
  const canDeleteCustomers =
    isAuthenticated &&
    (hasElevatedUiRole ||
      hasAnyUserPermission(user, CUSTOMER_DELETE_PERMISSIONS));
  const canCreateSites =
    isAuthenticated &&
    (hasElevatedUiRole || hasAnyUserPermission(user, SITE_CREATE_PERMISSIONS));
  const canUpdateSites =
    isAuthenticated &&
    (hasElevatedUiRole || hasAnyUserPermission(user, SITE_UPDATE_PERMISSIONS));
  const canDeleteSites =
    isAuthenticated &&
    (hasElevatedUiRole || hasAnyUserPermission(user, SITE_DELETE_PERMISSIONS));
  const canCreateEmployees =
    isAuthenticated &&
    hasOrganizationalScopes &&
    (hasElevatedUiRole ||
      hasAnyUserPermission(user, EMPLOYEE_CREATE_PERMISSIONS));
  const canUpdateEmployees =
    isAuthenticated &&
    hasOrganizationalScopes &&
    (hasElevatedUiRole ||
      hasAnyUserPermission(user, EMPLOYEE_UPDATE_PERMISSIONS));
  const canDeleteEmployees =
    isAuthenticated &&
    hasOrganizationalScopes &&
    (hasElevatedUiRole ||
      hasAnyUserPermission(user, EMPLOYEE_DELETE_PERMISSIONS));
  const canActivateEmployees =
    isAuthenticated &&
    hasOrganizationalScopes &&
    (hasElevatedUiRole ||
      hasAnyUserPermission(user, EMPLOYEE_ACTIVATE_PERMISSIONS));
  const canTerminateEmployees =
    isAuthenticated &&
    hasOrganizationalScopes &&
    (hasElevatedUiRole ||
      hasAnyUserPermission(user, EMPLOYEE_TERMINATE_PERMISSIONS));

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
    actions: {
      customers: {
        create: canCreateCustomers,
        update: canUpdateCustomers,
        delete: canDeleteCustomers,
      },
      sites: {
        create: canCreateSites,
        update: canUpdateSites,
        delete: canDeleteSites,
      },
      employees: {
        create: canCreateEmployees,
        update: canUpdateEmployees,
        delete: canDeleteEmployees,
        activate: canActivateEmployees,
        terminate: canTerminateEmployees,
      },
    },
  };
}
