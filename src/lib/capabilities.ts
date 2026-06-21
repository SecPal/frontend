// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { User } from "../contexts/auth-context";

const CUSTOMER_FEATURE_VIEW_PERMISSIONS = [
  "customers.read",
  "customers.*",
] as const;

const SITE_FEATURE_VIEW_PERMISSIONS = ["sites.read", "sites.*"] as const;

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

const ANDROID_PROVISIONING_FEATURE_PERMISSIONS = [
  "android_enrollment.read",
  "android_enrollment.write",
  "android_enrollment.*",
] as const;

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

const EMPLOYEE_CONFIRM_ONBOARDING_PERMISSIONS = [
  "onboarding.confirm",
  "onboarding.*",
] as const;

const ANDROID_PROVISIONING_CREATE_PERMISSIONS = [
  "android_enrollment.write",
  "android_enrollment.*",
] as const;

const ANDROID_PROVISIONING_REVOKE_PERMISSIONS = [
  "android_enrollment.write",
  "android_enrollment.*",
] as const;

export interface ResourceActionCapabilities {
  create: boolean;
  update: boolean;
  delete: boolean;
}

export interface EmployeeActionCapabilities extends ResourceActionCapabilities {
  activate: boolean;
  confirmOnboarding: boolean;
  terminate: boolean;
}

export interface AndroidProvisioningActionCapabilities {
  create: boolean;
  revoke: boolean;
}

export interface UserActionCapabilities {
  androidProvisioning: AndroidProvisioningActionCapabilities;
  customers: ResourceActionCapabilities;
  objects: ResourceActionCapabilities;
  sites: ResourceActionCapabilities;
  employees: EmployeeActionCapabilities;
}

export interface UserCapabilities {
  home: boolean;
  profile: boolean;
  settings: boolean;
  organization: boolean;
  customers: boolean;
  objects: boolean;
  sites: boolean;
  employees: boolean;
  activityLogs: boolean;
  androidProvisioning: boolean;
  actions: UserActionCapabilities;
}

export type RestrictedFeature = Exclude<
  keyof UserCapabilities,
  "home" | "profile" | "settings" | "actions"
>;

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
  const hasCustomerAccess = user?.hasCustomerAccess ?? false;
  const hasSiteAccess = user?.hasSiteAccess ?? false;
  const canCreateCustomers =
    isAuthenticated && hasAnyUserPermission(user, CUSTOMER_CREATE_PERMISSIONS);
  const canUpdateCustomers =
    isAuthenticated && hasAnyUserPermission(user, CUSTOMER_UPDATE_PERMISSIONS);
  const canDeleteCustomers =
    isAuthenticated && hasAnyUserPermission(user, CUSTOMER_DELETE_PERMISSIONS);
  const canCreateSites =
    isAuthenticated && hasAnyUserPermission(user, SITE_CREATE_PERMISSIONS);
  const canUpdateSites =
    isAuthenticated && hasAnyUserPermission(user, SITE_UPDATE_PERMISSIONS);
  const canDeleteSites =
    isAuthenticated && hasAnyUserPermission(user, SITE_DELETE_PERMISSIONS);
  const canCreateEmployees =
    isAuthenticated &&
    hasOrganizationalScopes &&
    hasAnyUserPermission(user, EMPLOYEE_CREATE_PERMISSIONS);
  const canUpdateEmployees =
    isAuthenticated &&
    hasOrganizationalScopes &&
    hasAnyUserPermission(user, EMPLOYEE_UPDATE_PERMISSIONS);
  const canDeleteEmployees =
    isAuthenticated &&
    hasOrganizationalScopes &&
    hasAnyUserPermission(user, EMPLOYEE_DELETE_PERMISSIONS);
  const canActivateEmployees =
    isAuthenticated &&
    hasOrganizationalScopes &&
    hasAnyUserPermission(user, EMPLOYEE_ACTIVATE_PERMISSIONS);
  const canTerminateEmployees =
    isAuthenticated &&
    hasOrganizationalScopes &&
    hasAnyUserPermission(user, EMPLOYEE_TERMINATE_PERMISSIONS);
  const canConfirmEmployeeOnboarding =
    isAuthenticated &&
    hasOrganizationalScopes &&
    hasAnyUserPermission(user, EMPLOYEE_CONFIRM_ONBOARDING_PERMISSIONS);
  const canAccessAndroidProvisioning =
    isAuthenticated &&
    hasOrganizationalScopes &&
    hasAnyUserPermission(user, ANDROID_PROVISIONING_FEATURE_PERMISSIONS);
  const canCreateAndroidProvisioningSessions =
    isAuthenticated &&
    hasOrganizationalScopes &&
    hasAnyUserPermission(user, ANDROID_PROVISIONING_CREATE_PERMISSIONS);
  const canRevokeAndroidProvisioningSessions =
    isAuthenticated &&
    hasOrganizationalScopes &&
    hasAnyUserPermission(user, ANDROID_PROVISIONING_REVOKE_PERMISSIONS);

  return {
    home: isAuthenticated,
    profile: isAuthenticated,
    settings: isAuthenticated,
    organization: isAuthenticated && hasOrganizationalScopes,
    customers:
      isAuthenticated &&
      (hasCustomerAccess ||
        hasAnyUserPermission(user, CUSTOMER_FEATURE_VIEW_PERMISSIONS)),
    objects:
      isAuthenticated &&
      (hasSiteAccess ||
        hasAnyUserPermission(user, SITE_FEATURE_VIEW_PERMISSIONS)),
    sites:
      isAuthenticated &&
      (hasSiteAccess ||
        hasAnyUserPermission(user, SITE_FEATURE_VIEW_PERMISSIONS)),
    employees:
      isAuthenticated &&
      hasOrganizationalScopes &&
      hasAnyUserPermission(user, EMPLOYEE_FEATURE_PERMISSIONS),
    activityLogs:
      isAuthenticated &&
      hasAnyUserPermission(user, ACTIVITY_LOG_FEATURE_PERMISSIONS),
    androidProvisioning: canAccessAndroidProvisioning,
    actions: {
      androidProvisioning: {
        create: canCreateAndroidProvisioningSessions,
        revoke: canRevokeAndroidProvisioningSessions,
      },
      customers: {
        create: canCreateCustomers,
        update: canUpdateCustomers,
        delete: canDeleteCustomers,
      },
      objects: {
        create: canCreateSites,
        update: canUpdateSites,
        delete: canDeleteSites,
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
        confirmOnboarding: canConfirmEmployeeOnboarding,
        terminate: canTerminateEmployees,
      },
    },
  };
}
