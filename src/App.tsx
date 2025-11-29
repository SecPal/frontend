// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { ApplicationLayout } from "./components/application-layout";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { SyncStatusIndicator } from "./components/SyncStatusIndicator";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { ShareTarget } from "./pages/ShareTarget";
import { SecretList } from "./pages/Secrets/SecretList";
import { SecretDetail } from "./pages/Secrets/SecretDetail";
import { SecretCreate } from "./pages/Secrets/SecretCreate";
import { SecretEdit } from "./pages/Secrets/SecretEdit";
import { Heading } from "./components/heading";
import { Text } from "./components/text";
import { Button } from "./components/button";
import { getApiBaseUrl } from "./config";

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
        </Routes>
        <OfflineIndicator />
        <SyncStatusIndicator apiBaseUrl={getApiBaseUrl()} />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
