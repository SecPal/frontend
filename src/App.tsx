// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { Trans } from "@lingui/react/macro";
import { ApplicationLayout } from "./components/application-layout";
import { NativeRuntimePwaGuard } from "./components/NativeRuntimePwaGuard";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { AuthProvider } from "./contexts/AuthContext";
import {
  AppAccessRoute,
  OnboardingOnlyRoute,
} from "./components/OnboardingAccessRoute";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { FeatureRoute } from "./components/FeatureRoute";
import { RouteLoader } from "./components/RouteLoader";
import { RouteNotFoundState } from "./components/RouteGuardState";
import { OnboardingLayout } from "./components/onboarding-layout";
import { Heading } from "./components/heading";
import { Text } from "./components/text";
import { Button } from "./components/button";

// Lazy load route components for better performance
// Login page is eagerly loaded as it's the first page users see
import { Login } from "./pages/Login";

// All other routes are lazy loaded to reduce initial bundle size
const SettingsPage = lazy(() => import("./pages/Settings/SettingsPage"));
const ProfilePage = lazy(() => import("./pages/Profile/ProfilePage"));
const EmployeeList = lazy(() => import("./pages/Employees/EmployeeList"));
const EmployeeDetail = lazy(() => import("./pages/Employees/EmployeeDetail"));
const EmployeeCreate = lazy(() => import("./pages/Employees/EmployeeCreate"));
const EmployeeEdit = lazy(() => import("./pages/Employees/EmployeeEdit"));
const OnboardingWizard = lazy(
  () => import("./pages/Onboarding/OnboardingWizard")
);
const OnboardingComplete = lazy(() =>
  import("./pages/Onboarding/OnboardingComplete").then((m) => ({
    default: m.OnboardingComplete,
  }))
);
const OrganizationPage = lazy(
  () => import("./pages/Organization/OrganizationPage")
);
const CustomersPage = lazy(() => import("./pages/Customers/CustomersPage"));
const CustomerCreate = lazy(() => import("./pages/Customers/CustomerCreate"));
const CustomerDetail = lazy(() => import("./pages/Customers/CustomerDetail"));
const CustomerEdit = lazy(() => import("./pages/Customers/CustomerEdit"));
const SitesPage = lazy(() => import("./pages/Sites/SitesPage"));
const SiteCreate = lazy(() => import("./pages/Sites/SiteCreate"));
const SiteDetail = lazy(() => import("./pages/Sites/SiteDetail"));
const SiteEdit = lazy(() => import("./pages/Sites/SiteEdit"));
const ActivityLogList = lazy(
  () => import("./pages/ActivityLog/ActivityLogList")
);
const AndroidProvisioningPage = lazy(
  () => import("./pages/AndroidProvisioning/AndroidProvisioningPage")
);

function Home() {
  return (
    <>
      <Heading>
        <Trans>Welcome to SecPal</Trans>
      </Heading>
      <Text className="mt-2">
        <Trans>SecPal – A guard’s best friend</Trans>
      </Text>
      <div className="mt-8 flex gap-4">
        <Button href="/profile">
          <Trans>View Profile</Trans>
        </Button>
        <Button href="/about" outline>
          <Trans>About</Trans>
        </Button>
      </div>
    </>
  );
}

function About() {
  return (
    <>
      <Heading>
        <Trans>About SecPal</Trans>
      </Heading>
      <Text className="mt-4">
        <Trans>
          SecPal – operations software for German private security services.
        </Trans>
      </Text>
      <div className="mt-8">
        <Button href="/" outline>
          <Trans>Back to Home</Trans>
        </Button>
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
  return (
    <AppAccessRoute>
      <FeatureRoute
        {...props}
        missingFeatureElement={<HiddenAppRouteState />}
      />
    </AppAccessRoute>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NativeRuntimePwaGuard />
        <UpdatePrompt />
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
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
            {/* Activity Log Route - Admin/Manager access via permissions */}
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
