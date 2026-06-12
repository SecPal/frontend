// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Navigate, Routes, Route } from "react-router-dom";
import { Trans } from "@lingui/react/macro";
import { ApplicationLayout } from "./components/application-layout";
import { NativeRuntimePwaGuard } from "./components/NativeRuntimePwaGuard";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { AuthProvider } from "./contexts/AuthContext";
import { useNotifications } from "./hooks/useNotifications";
import { useAuth } from "./hooks/useAuth";
import {
  AppAccessRoute,
  OnboardingOnlyRoute,
} from "./components/OnboardingAccessRoute";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { FeatureRoute } from "./components/FeatureRoute";
import { RouteLoader } from "./components/RouteLoader";
import {
  isRouteAuthBootstrapPending,
  isRouteAuthSnapshotRevalidating,
} from "./components/routeGuardAuth";
import {
  RouteNotFoundState,
  RouteLoadingState,
  RouteVaultLockedState,
} from "./components/RouteGuardState";
import { OnboardingLayout } from "./components/onboarding-layout";
import { buttonVariants } from "./ui";
import { RouteContentFallback } from "./components/RouteContentFallback";
import { routeModuleLoaders } from "./routeModules";

// Lazy load route components for better performance
// Login page is eagerly loaded as it's the first page users see
import { Login } from "./pages/Login";

// All other routes are lazy loaded to reduce initial bundle size
const SettingsPage = lazy(routeModuleLoaders.settings);
const ProfilePage = lazy(routeModuleLoaders.profile);
const EmployeeList = lazy(routeModuleLoaders.employeeList);
const EmployeeDetail = lazy(routeModuleLoaders.employeeDetail);
const EmployeeCreate = lazy(routeModuleLoaders.employeeCreate);
const EmployeeEdit = lazy(routeModuleLoaders.employeeEdit);
const EmployeeContactsEdit = lazy(routeModuleLoaders.employeeContactsEdit);
const OnboardingWizard = lazy(routeModuleLoaders.onboardingWizard);
const OnboardingComplete = lazy(routeModuleLoaders.onboardingComplete);
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
      <h1 className="text-2xl/8 font-semibold tracking-normal text-zinc-950 sm:text-xl/8 dark:text-white">
        <Trans>Welcome to SecPal</Trans>
      </h1>
      <p className="mt-2 text-base/6 text-zinc-500 sm:text-sm/6 dark:text-zinc-400">
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
      <h1 className="text-2xl/8 font-semibold tracking-normal text-zinc-950 sm:text-xl/8 dark:text-white">
        <Trans>About SecPal</Trans>
      </h1>
      <p className="mt-4 text-base/6 text-zinc-500 sm:text-sm/6 dark:text-zinc-400">
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
  const auth = useAuth();

  if (isRouteAuthSnapshotRevalidating(auth)) {
    return (
      <AppAccessRoute>
        <ApplicationLayout>
          <RouteContentFallback />
        </ApplicationLayout>
      </AppAccessRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppAccessRoute>
        <ApplicationLayout>{children}</ApplicationLayout>
      </AppAccessRoute>
    </ProtectedRoute>
  );
}

/**
 * Authenticated app routing policy outside onboarding:
 * - Self-service routes remain directly accessible to any authenticated user.
 * - Hidden feature areas resolve to the same in-app not-found state as unknown URLs.
 * - Action-specific routes inside a known feature show explicit access denied.
 * - Legacy aliases redirect to the canonical route once the feature is available.
 */
function AppFeatureRoute(props: React.ComponentProps<typeof FeatureRoute>) {
  const auth = useAuth();

  if (isRouteAuthSnapshotRevalidating(auth)) {
    return (
      <AppAccessRoute>
        <ApplicationLayout>
          <RouteContentFallback />
        </ApplicationLayout>
      </AppAccessRoute>
    );
  }

  return (
    <AppAccessRoute>
      <FeatureRoute
        {...props}
        missingFeatureElement={<HiddenAppRouteState />}
      />
    </AppAccessRoute>
  );
}

function NotificationLifecycleCoordinator() {
  useNotifications({ autoSync: true });

  return null;
}

function LoginRoute() {
  const auth = useAuth();
  const {
    isAuthenticated,
    isVaultLocked = false,
    logout,
    unlock,
  } = auth;

  if (isRouteAuthBootstrapPending(auth)) {
    return <RouteLoadingState />;
  }

  if (isVaultLocked) {
    if (!unlock) {
      return <Navigate to="/" replace />;
    }

    return <RouteVaultLockedState onUnlock={unlock} onSignInAgain={logout} />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Login />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NotificationLifecycleCoordinator />
        <NativeRuntimePwaGuard />
        <UpdatePrompt />
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            {/* Onboarding Complete - PUBLIC route (no auth required) */}
            <Route
              path="/onboarding/complete"
              element={<OnboardingComplete />}
            />
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
            {/* Customer & Site Management Routes - NEW (Epic #210) */}
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
            {/* Organizational Unit Management Route - INTERNAL Company Structure */}
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
            {/* Employee Management Routes - Requires Organizational Access */}
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
            {/* Onboarding Route */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
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
                <ProtectedRoute>
                  <OnboardingOnlyRoute>
                    <OnboardingLayout>
                      <OnboardingSubmitted />
                    </OnboardingLayout>
                  </OnboardingOnlyRoute>
                </ProtectedRoute>
              }
            />
            {/* Activity Log Route - explicit permission access */}
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
            {/* User Routes */}
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
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
