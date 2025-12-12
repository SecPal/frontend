// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { ApplicationLayout } from "./components/application-layout";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { SyncStatusIndicator } from "./components/SyncStatusIndicator";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RouteLoader } from "./components/RouteLoader";
import { Heading } from "./components/heading";
import { Text } from "./components/text";
import { Button } from "./components/button";
import { getApiBaseUrl } from "./config";

// Lazy load route components for better performance
// Login page is eagerly loaded as it's the first page users see
import { Login } from "./pages/Login";

// All other routes are lazy loaded to reduce initial bundle size
const ShareTarget = lazy(() => import("./pages/ShareTarget"));
const SecretList = lazy(() => import("./pages/Secrets/SecretList"));
const SecretDetail = lazy(() => import("./pages/Secrets/SecretDetail"));
const SecretCreate = lazy(() => import("./pages/Secrets/SecretCreate"));
const SecretEdit = lazy(() => import("./pages/Secrets/SecretEdit"));
const OrganizationPage = lazy(
  () => import("./pages/Organization/OrganizationPage")
);
const CustomersPage = lazy(() => import("./pages/Organization/CustomersPage"));
const ObjectsPage = lazy(() => import("./pages/Organization/ObjectsPage"));
const GuardBooksPage = lazy(
  () => import("./pages/Organization/GuardBooksPage")
);
const SettingsPage = lazy(() => import("./pages/Settings/SettingsPage"));
const ProfilePage = lazy(() => import("./pages/Profile/ProfilePage"));
const EmployeeList = lazy(() => import("./pages/Employees/EmployeeList"));
const EmployeeDetail = lazy(() => import("./pages/Employees/EmployeeDetail"));
const EmployeeCreate = lazy(() => import("./pages/Employees/EmployeeCreate"));
const OnboardingWizard = lazy(
  () => import("./pages/Onboarding/OnboardingWizard")
);

function Home() {
  return (
    <>
      <Heading>
        <Trans>Welcome to SecPal</Trans>
      </Heading>
      <Text className="mt-2">
        <Trans>SecPal - a guard's best friend</Trans>
      </Text>
      <div className="mt-8 flex gap-4">
        <Button href="/secrets">
          <Trans>View Secrets</Trans>
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
          SecPal - a guard's best friend. An offline-first progressive web app
          for security personnel, combining digital guard books with modern
          service management.
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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <UpdatePrompt />
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <ApplicationLayout>
                    <Home />
                  </ApplicationLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/about"
              element={
                <ProtectedRoute>
                  <ApplicationLayout>
                    <About />
                  </ApplicationLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/share"
              element={
                <ProtectedRoute>
                  <ApplicationLayout>
                    <ShareTarget />
                  </ApplicationLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/secrets"
              element={
                <ProtectedRoute>
                  <ApplicationLayout>
                    <SecretList />
                  </ApplicationLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/secrets/new"
              element={
                <ProtectedRoute>
                  <ApplicationLayout>
                    <SecretCreate />
                  </ApplicationLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/secrets/:id"
              element={
                <ProtectedRoute>
                  <ApplicationLayout>
                    <SecretDetail />
                  </ApplicationLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/secrets/:id/edit"
              element={
                <ProtectedRoute>
                  <ApplicationLayout>
                    <SecretEdit />
                  </ApplicationLayout>
                </ProtectedRoute>
              }
            />
            {/* Organization Routes */}
            <Route
              path="/organization"
              element={
                <ProtectedRoute>
                  <ApplicationLayout>
                    <OrganizationPage />
                  </ApplicationLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute>
                  <ApplicationLayout>
                    <CustomersPage />
                  </ApplicationLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:customerId/objects"
              element={
                <ProtectedRoute>
                  <ApplicationLayout>
                    <ObjectsPage />
                  </ApplicationLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:customerId/objects/:objectId/guard-books"
              element={
                <ProtectedRoute>
                  <ApplicationLayout>
                    <GuardBooksPage />
                  </ApplicationLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:customerId/objects/:objectId/areas/:areaId/guard-books"
              element={
                <ProtectedRoute>
                  <ApplicationLayout>
                    <GuardBooksPage />
                  </ApplicationLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/guard-books"
              element={
                <ProtectedRoute>
                  <ApplicationLayout>
                    <GuardBooksPage />
                  </ApplicationLayout>
                </ProtectedRoute>
              }
            />
            {/* Employee Management Routes */}
            <Route
              path="/employees"
              element={
                <ProtectedRoute>
                  <ApplicationLayout>
                    <EmployeeList />
                  </ApplicationLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/employees/create"
              element={
                <ProtectedRoute>
                  <ApplicationLayout>
                    <EmployeeCreate />
                  </ApplicationLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/employees/:id"
              element={
                <ProtectedRoute>
                  <ApplicationLayout>
                    <EmployeeDetail />
                  </ApplicationLayout>
                </ProtectedRoute>
              }
            />
            {/* Onboarding Route */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <ApplicationLayout>
                    <OnboardingWizard />
                  </ApplicationLayout>
                </ProtectedRoute>
              }
            />
            {/* User Routes */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <ApplicationLayout>
                    <SettingsPage />
                  </ApplicationLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ApplicationLayout>
                    <ProfilePage />
                  </ApplicationLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
        <OfflineIndicator />
        <SyncStatusIndicator apiBaseUrl={getApiBaseUrl()} />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
