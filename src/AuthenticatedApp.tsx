// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { lazy, Suspense } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { Trans } from "@lingui/react/macro";
import { ApplicationLayout } from "./components/application-layout";
import { UpdatePrompt } from "./components/UpdatePrompt";
import {
  AppAccessRoute,
  OnboardingOnlyRoute,
} from "./components/OnboardingAccessRoute";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { FeatureRoute } from "./components/FeatureRoute";
import { RouteLoader } from "./components/RouteLoader";
import { RouteNotFoundState } from "./components/RouteGuardState";
import { OnboardingLayout } from "./components/onboarding-layout";
import { buttonVariants } from "./ui/styles";
import { RouteContentFallback } from "./components/RouteContentFallback";
import { routeModuleLoaders } from "./routeModules";
import { useNotifications } from "./hooks/useNotifications";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { isAndroidSurface } from "./platform/appSurface";

const SettingsPage = lazy(routeModuleLoaders.settings);
const ProfilePage = lazy(routeModuleLoaders.profile);
const EmployeeList = lazy(routeModuleLoaders.employeeList);
const EmployeeDetail = lazy(routeModuleLoaders.employeeDetail);
const EmployeeCreate = lazy(routeModuleLoaders.employeeCreate);
const EmployeeEdit = lazy(routeModuleLoaders.employeeEdit);
const EmployeeContactsEdit = lazy(routeModuleLoaders.employeeContactsEdit);
const OnboardingWizard = lazy(routeModuleLoaders.onboardingWizard);
const OnboardingSubmitted = lazy(routeModuleLoaders.onboardingSubmitted);
const OrganizationPage = lazy(routeModuleLoaders.organization);
const CustomersPage = lazy(routeModuleLoaders.customers);
const CustomerCreate = lazy(routeModuleLoaders.customerCreate);
const CustomerDetail = lazy(routeModuleLoaders.customerDetail);
const CustomerEdit = lazy(routeModuleLoaders.customerEdit);
const SitesPage = lazy(routeModuleLoaders.sites);
const SiteCreate = lazy(routeModuleLoaders.siteCreate);
const SiteDetail = lazy(routeModuleLoaders.siteDetail);
const SiteEdit = lazy(routeModuleLoaders.siteEdit);
const ActivityLogList = lazy(routeModuleLoaders.activityLogs);
const AndroidProvisioningPage = lazy(routeModuleLoaders.androidProvisioning);

function Home() {
  return (
    <>
      <h1 className="text-foreground text-2xl/8 font-semibold tracking-normal sm:text-xl/8">
        <Trans>Welcome to SecPal</Trans>
      </h1>
      <p className="text-muted-foreground mt-2 text-base/6 sm:text-sm/6">
        <Trans>SecPal – A guard’s best friend</Trans>
      </p>
      <div className="mt-8 flex gap-4">
        <Link to="/profile" className={buttonVariants()}>
          <Trans>View Profile</Trans>
        </Link>
        <Link to="/about" className={buttonVariants({ variant: "outline" })}>
          <Trans>About</Trans>
        </Link>
      </div>
    </>
  );
}

function About() {
  return (
    <>
      <h1 className="text-foreground text-2xl/8 font-semibold tracking-normal sm:text-xl/8">
        <Trans>About SecPal</Trans>
      </h1>
      <p className="text-muted-foreground mt-4 text-base/6 sm:text-sm/6">
        <Trans>
          SecPal – operations software for German private security services.
        </Trans>
      </p>
      <div className="mt-8">
        <Link to="/" className={buttonVariants({ variant: "outline" })}>
          <Trans>Back to Home</Trans>
        </Link>
      </div>
    </>
  );
}

function HiddenAppRouteState() {
  return (
    <ApplicationLayout>
      <RouteNotFoundState />
    </ApplicationLayout>
  );
}

function AppLayoutRoute({ children }: { children: React.ReactNode }) {
  return (
    <AppAccessRoute>
      <ProtectedRoute
        revalidatingFallback={
          <ApplicationLayout>
            <RouteContentFallback />
          </ApplicationLayout>
        }
      >
        <ApplicationLayout>{children}</ApplicationLayout>
      </ProtectedRoute>
    </AppAccessRoute>
  );
}

function AppFeatureRoute(props: React.ComponentProps<typeof FeatureRoute>) {
  return (
    <AppAccessRoute>
      <FeatureRoute
        {...props}
        missingFeatureElement={<HiddenAppRouteState />}
        revalidatingFallback={
          <ApplicationLayout>
            <RouteContentFallback />
          </ApplicationLayout>
        }
      />
    </AppAccessRoute>
  );
}

function NotificationLifecycleCoordinator() {
  useNotifications({ autoSync: true });
  return null;
}

export default function AuthenticatedApp() {
  return (
    <>
      <NotificationLifecycleCoordinator />
      <Suspense
        fallback={
          <>
            <UpdatePrompt />
            <RouteLoader />
          </>
        }
      >
        <Routes>
          <Route
            path="/"
            element={
              <AppLayoutRoute>
                <Home />
              </AppLayoutRoute>
            }
          />
          <Route
            path="/about"
            element={
              <AppLayoutRoute>
                <About />
              </AppLayoutRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <AppFeatureRoute feature="customers">
                <ApplicationLayout>
                  <CustomersPage />
                </ApplicationLayout>
              </AppFeatureRoute>
            }
          />
          <Route
            path="/customers/new"
            element={
              <AppFeatureRoute
                feature="customers"
                requiredAction={(capabilities) =>
                  capabilities.actions.customers.create
                }
              >
                <ApplicationLayout>
                  <CustomerCreate />
                </ApplicationLayout>
              </AppFeatureRoute>
            }
          />
          <Route
            path="/customers/:id"
            element={
              <AppFeatureRoute feature="customers">
                <ApplicationLayout>
                  <CustomerDetail />
                </ApplicationLayout>
              </AppFeatureRoute>
            }
          />
          <Route
            path="/customers/:id/edit"
            element={
              <AppFeatureRoute
                feature="customers"
                requiredAction={(capabilities) =>
                  capabilities.actions.customers.update
                }
              >
                <ApplicationLayout>
                  <CustomerEdit />
                </ApplicationLayout>
              </AppFeatureRoute>
            }
          />
          <Route
            path="/sites"
            element={
              <AppFeatureRoute feature="sites">
                <ApplicationLayout>
                  <SitesPage />
                </ApplicationLayout>
              </AppFeatureRoute>
            }
          />
          <Route
            path="/sites/customer/:customerId"
            element={
              <AppFeatureRoute feature="sites">
                <ApplicationLayout>
                  <SitesPage />
                </ApplicationLayout>
              </AppFeatureRoute>
            }
          />
          <Route
            path="/sites/new"
            element={
              <AppFeatureRoute
                feature="sites"
                requiredAction={(capabilities) =>
                  capabilities.actions.sites.create
                }
              >
                <ApplicationLayout>
                  <SiteCreate />
                </ApplicationLayout>
              </AppFeatureRoute>
            }
          />
          <Route
            path="/sites/new/customer/:customerId"
            element={
              <AppFeatureRoute
                feature="sites"
                requiredAction={(capabilities) =>
                  capabilities.actions.sites.create
                }
              >
                <ApplicationLayout>
                  <SiteCreate />
                </ApplicationLayout>
              </AppFeatureRoute>
            }
          />
          {isAndroidSurface ? (
            <Route
              path="/android-provisioning"
              element={
                <AppFeatureRoute feature="androidProvisioning">
                  <ApplicationLayout>
                    <AndroidProvisioningPage />
                  </ApplicationLayout>
                </AppFeatureRoute>
              }
            />
          ) : null}
          <Route
            path="/sites/:id"
            element={
              <AppFeatureRoute feature="sites">
                <ApplicationLayout>
                  <SiteDetail />
                </ApplicationLayout>
              </AppFeatureRoute>
            }
          />
          <Route
            path="/sites/:id/edit"
            element={
              <AppFeatureRoute
                feature="sites"
                requiredAction={(capabilities) =>
                  capabilities.actions.sites.update
                }
              >
                <ApplicationLayout>
                  <SiteEdit />
                </ApplicationLayout>
              </AppFeatureRoute>
            }
          />
          <Route
            path="/organization"
            element={
              <AppFeatureRoute feature="organization">
                <ApplicationLayout>
                  <OrganizationPage />
                </ApplicationLayout>
              </AppFeatureRoute>
            }
          />
          <Route
            path="/organizational-units"
            element={
              <AppFeatureRoute feature="organization">
                <Navigate to="/organization" replace />
              </AppFeatureRoute>
            }
          />
          <Route
            path="/employees"
            element={
              <AppFeatureRoute feature="employees">
                <ApplicationLayout>
                  <EmployeeList />
                </ApplicationLayout>
              </AppFeatureRoute>
            }
          />
          <Route
            path="/employees/create"
            element={
              <AppFeatureRoute
                feature="employees"
                requiredAction={(capabilities) =>
                  capabilities.actions.employees.create
                }
              >
                <ApplicationLayout>
                  <EmployeeCreate />
                </ApplicationLayout>
              </AppFeatureRoute>
            }
          />
          <Route
            path="/employees/:id/edit"
            element={
              <AppFeatureRoute
                feature="employees"
                requiredAction={(capabilities) =>
                  capabilities.actions.employees.update
                }
              >
                <ApplicationLayout>
                  <EmployeeEdit />
                </ApplicationLayout>
              </AppFeatureRoute>
            }
          />
          <Route
            path="/employees/:id/edit/contacts"
            element={
              <AppFeatureRoute
                feature="employees"
                requiredAction={(capabilities) =>
                  capabilities.actions.employees.update
                }
              >
                <ApplicationLayout>
                  <EmployeeContactsEdit />
                </ApplicationLayout>
              </AppFeatureRoute>
            }
          />
          <Route
            path="/employees/:id"
            element={
              <AppFeatureRoute feature="employees">
                <ApplicationLayout>
                  <EmployeeDetail />
                </ApplicationLayout>
              </AppFeatureRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute
                revalidatingFallback={
                  <OnboardingOnlyRoute>
                    <OnboardingLayout>
                      <RouteContentFallback />
                    </OnboardingLayout>
                  </OnboardingOnlyRoute>
                }
              >
                <OnboardingOnlyRoute>
                  <OnboardingLayout>
                    <OnboardingWizard />
                  </OnboardingLayout>
                </OnboardingOnlyRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding/submitted"
            element={
              <ProtectedRoute
                revalidatingFallback={
                  <OnboardingOnlyRoute>
                    <OnboardingLayout>
                      <RouteContentFallback />
                    </OnboardingLayout>
                  </OnboardingOnlyRoute>
                }
              >
                <OnboardingOnlyRoute>
                  <OnboardingLayout>
                    <OnboardingSubmitted />
                  </OnboardingLayout>
                </OnboardingOnlyRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/activity-logs"
            element={
              <AppFeatureRoute feature="activityLogs">
                <ApplicationLayout>
                  <ActivityLogList />
                </ApplicationLayout>
              </AppFeatureRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <AppLayoutRoute>
                <SettingsPage />
              </AppLayoutRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <AppLayoutRoute>
                <ProfilePage />
              </AppLayoutRoute>
            }
          />
          <Route
            path="*"
            element={
              <AppLayoutRoute>
                <RouteNotFoundState />
              </AppLayoutRoute>
            }
          />
        </Routes>
      </Suspense>
      <OfflineIndicator />
    </>
  );
}
