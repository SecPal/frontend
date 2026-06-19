// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { NativeRuntimePwaGuard } from "./components/NativeRuntimePwaGuard";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { AuthProvider } from "./contexts/AuthContext";
import { useAuth } from "./hooks/useAuth";
import { useRecoverableLazyComponent } from "./hooks/useRecoverableLazyComponent";
import { isRouteAuthBootstrapPending } from "./components/routeGuardAuth";
import {
  LoginRouteLoadingState,
  LoginRouteVaultLockedState,
} from "./components/LoginRouteState";
import { PublicRouteLoader } from "./components/PublicRouteLoader";
import { RouteBootstrapRecoveryState } from "./components/RouteGuardState";
import { loadAuthenticatedAppModule } from "./lib/lazyAppModules";
import { isRecoverableLazyModuleError } from "./lib/lazyModuleErrors";

const LOGIN_ROUTE_BOOTSTRAP_INTERACTIVE_DELAY_MS = 1000;

import { Login } from "./pages/Login";

const OnboardingComplete = lazy(() =>
  import("./pages/Onboarding/OnboardingComplete").then((module) => ({
    default: module.OnboardingComplete,
  }))
);

function AuthenticatedAppSlot({
  onSignInAgain,
}: {
  onSignInAgain: () => void;
}) {
  const { Component, error, isLoading, retry } = useRecoverableLazyComponent(
    loadAuthenticatedAppModule
  );

  if (error) {
    if (isRecoverableLazyModuleError(error)) {
      return (
        <RouteBootstrapRecoveryState
          onRetry={retry}
          onSignInAgain={onSignInAgain}
          reason="network"
        />
      );
    }

    throw error;
  }

  if (isLoading || !Component) {
    return <PublicRouteLoader />;
  }

  return <Component />;
}

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

  if (isRouteAuthBootstrapPending(auth)) {
    return <LoginRouteBootstrapGate />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Login />;
}

function LoginRouteBootstrapGate() {
  const [showInteractiveLogin, setShowInteractiveLogin] = useState(false);

  useEffect(() => {
    const timeoutId = globalThis.setTimeout(() => {
      setShowInteractiveLogin(true);
    }, LOGIN_ROUTE_BOOTSTRAP_INTERACTIVE_DELAY_MS);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, []);

  return showInteractiveLogin ? <Login /> : <LoginRouteLoadingState />;
}

function AuthenticatedAppRoute() {
  const auth = useAuth();
  const {
    bootstrapRecoveryReason,
    isAuthenticated,
    isVaultLocked = false,
    logout,
    retryBootstrap,
    unlock,
  } = auth;

  if (isRouteAuthBootstrapPending(auth)) {
    return <PublicRouteLoader />;
  }

  if (isVaultLocked) {
    if (!unlock) {
      return <Navigate to="/login" replace />;
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

  if (!isVaultLocked && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AuthenticatedAppSlot onSignInAgain={logout} />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NativeRuntimePwaGuard />
        <UpdatePrompt />
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
