// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { NativeRuntimePwaGuard } from "./components/NativeRuntimePwaGuard";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./hooks/useAuth";
import { isRouteAuthBootstrapPending } from "./components/routeGuardAuth";
import {
  LoginRouteLoadingState,
  LoginRouteVaultLockedState,
} from "./components/LoginRouteState";
import { PublicRouteLoader } from "./components/PublicRouteLoader";
import { RouteBootstrapRecoveryState } from "./components/RouteGuardState";
import { authStorage } from "./services/storage";

const LOGIN_ROUTE_BOOTSTRAP_INTERACTIVE_DELAY_MS = 1000;

import { Login } from "./pages/Login";

const AuthenticatedApp = lazy(() => import("./AuthenticatedApp"));
const OnboardingComplete = lazy(() =>
  import("./pages/Onboarding/OnboardingComplete").then((module) => ({
    default: module.OnboardingComplete,
  }))
);

function LoginRoute() {
  const auth = useAuth();
  const {
    bootstrapRecoveryReason,
    isAuthenticated,
    isVaultLocked = false,
    logout,
    retryBootstrap,
    unlock,
  } = auth;
  const [
    showInteractiveLoginDuringBootstrap,
    setShowInteractiveLoginDuringBootstrap,
  ] = useState(false);

  useEffect(() => {
    if (!isRouteAuthBootstrapPending(auth)) {
      setShowInteractiveLoginDuringBootstrap(false);
      return;
    }

    const timeoutId = globalThis.setTimeout(() => {
      setShowInteractiveLoginDuringBootstrap(true);
    }, LOGIN_ROUTE_BOOTSTRAP_INTERACTIVE_DELAY_MS);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [auth]);

  if (isVaultLocked) {
    if (!unlock) {
      return <Navigate to="/" replace />;
    }

    return (
      <LoginRouteVaultLockedState onUnlock={unlock} onSignInAgain={logout} />
    );
  }

  if (bootstrapRecoveryReason) {
    return (
      <RouteBootstrapRecoveryState
        onRetry={retryBootstrap}
        onSignInAgain={logout}
        reason={bootstrapRecoveryReason}
      />
    );
  }

  if (
    isRouteAuthBootstrapPending(auth) &&
    !showInteractiveLoginDuringBootstrap
  ) {
    return <LoginRouteLoadingState />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Login />;
}

function AuthenticatedAppRoute() {
  const auth = useAuth();
  const {
    bootstrapRecoveryReason,
    isAuthenticated,
    isVaultLocked = false,
  } = auth;

  if (isRouteAuthBootstrapPending(auth)) {
    if (!authStorage.hasStoredUser()) {
      return <Navigate to="/login" replace />;
    }

    return <PublicRouteLoader />;
  }

  if (!bootstrapRecoveryReason && !isVaultLocked && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NativeRuntimePwaGuard />
        <Suspense fallback={<PublicRouteLoader />}>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route
              path="/onboarding/complete"
              element={<OnboardingComplete />}
            />
            <Route path="*" element={<AuthenticatedAppRoute />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
