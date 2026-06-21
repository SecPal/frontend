// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ComponentType } from "react";

type RouteModule = { default: ComponentType };
type RouteModuleLoader = () => Promise<RouteModule>;

export const routeModuleLoaders = {
  settings: () => import("./pages/Settings/SettingsPage"),
  profile: () => import("./pages/Profile/ProfilePage"),
  employeeList: () => import("./pages/Employees/EmployeeList"),
  employeeDetail: () => import("./pages/Employees/EmployeeDetail"),
  employeeCreate: () => import("./pages/Employees/EmployeeCreate"),
  employeeEdit: () => import("./pages/Employees/EmployeeEdit"),
  employeeContactsEdit: () => import("./pages/Employees/EmployeeContactsEdit"),
  onboardingWizard: () => import("./pages/Onboarding/OnboardingWizard"),
  onboardingComplete: () =>
    import("./pages/Onboarding/OnboardingComplete").then((module) => ({
      default: module.OnboardingComplete,
    })),
  onboardingSubmitted: () => import("./pages/Onboarding/OnboardingSubmitted"),
  organization: () => import("./pages/Organization/OrganizationPage"),
  customers: () => import("./pages/Customers/CustomersPage"),
  customerCreate: () => import("./pages/Customers/CustomerCreate"),
  customerDetail: () => import("./pages/Customers/CustomerDetail"),
  customerEdit: () => import("./pages/Customers/CustomerEdit"),
  objects: () => import("./pages/Sites/SitesPage"),
  objectCreate: () => import("./pages/Sites/SiteCreate"),
  objectDetail: () => import("./pages/Sites/SiteDetail"),
  objectEdit: () => import("./pages/Sites/SiteEdit"),
  sites: () => import("./pages/Sites/SitesPage"),
  siteCreate: () => import("./pages/Sites/SiteCreate"),
  siteDetail: () => import("./pages/Sites/SiteDetail"),
  siteEdit: () => import("./pages/Sites/SiteEdit"),
  activityLogs: () => import("./pages/ActivityLog/ActivityLogList"),
  androidProvisioning: () =>
    import("./pages/AndroidProvisioning/AndroidProvisioningPage"),
} satisfies Record<string, RouteModuleLoader>;

export type RouteModuleKey = keyof typeof routeModuleLoaders;
