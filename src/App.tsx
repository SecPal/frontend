// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { Link } from "./components/link";
import { Footer } from "./components/Footer";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { SyncStatusIndicator } from "./components/SyncStatusIndicator";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { ShareTarget } from "./pages/ShareTarget";
import { SecretList } from "./pages/Secrets/SecretList";
import { SecretDetail } from "./pages/Secrets/SecretDetail";
import { SecretCreate } from "./pages/Secrets/SecretCreate";
import { SecretEdit } from "./pages/Secrets/SecretEdit";
import { getApiBaseUrl } from "./config";

function Home() {
  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold mb-4">
        <Trans>Welcome to SecPal</Trans>
      </h2>
      <p className="text-lg mb-6">
        <Trans>SecPal - a guard's best friend</Trans>
      </p>
      <nav className="space-x-4">
        <Link href="/about" className="text-blue-600 hover:underline">
          <Trans>About</Trans>
        </Link>
        <Link href="/secrets" className="text-blue-600 hover:underline">
          <Trans>Secrets</Trans>
        </Link>
      </nav>
    </div>
  );
}

function About() {
  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold mb-4">
        <Trans>About SecPal</Trans>
      </h2>
      <p className="text-lg mb-6">
        <Trans>
          SecPal - a guard's best friend. An offline-first progressive web app
          for security personnel, combining digital guard books with modern
          service management.
        </Trans>
      </p>
      <nav>
        <Link href="/" className="text-blue-600 hover:underline">
          <Trans>Back to Home</Trans>
        </Link>
      </nav>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="flex min-h-screen flex-col">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/about"
              element={
                <ProtectedRoute>
                  <About />
                </ProtectedRoute>
              }
            />
            <Route
              path="/share"
              element={
                <ProtectedRoute>
                  <ShareTarget />
                </ProtectedRoute>
              }
            />
            <Route
              path="/secrets"
              element={
                <ProtectedRoute>
                  <SecretList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/secrets/new"
              element={
                <ProtectedRoute>
                  <SecretCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/secrets/:id"
              element={
                <ProtectedRoute>
                  <SecretDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/secrets/:id/edit"
              element={
                <ProtectedRoute>
                  <SecretEdit />
                </ProtectedRoute>
              }
            />
          </Routes>
          <Footer />
          <OfflineIndicator />
          <SyncStatusIndicator apiBaseUrl={getApiBaseUrl()} />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
