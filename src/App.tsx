// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { lazy, Suspense, useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
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
import { RuntimeDiscoveryFlow } from "./components/RuntimeDiscoveryFlow";
import { loadAuthenticatedAppModule } from "./lib/lazyAppModules";
import { isRecoverableLazyModuleError } from "./lib/lazyModuleErrors";
import {
  SecPalRuntimeBootstrap,
  type SecPalRuntimeInfo,
} from "./native";

const LOGIN_ROUTE_BOOTSTRAP_INTERACTIVE_DELAY_MS = 1000;

import { Login } from "./pages/Login";
import { SourcePage } from "./pages/SourcePage";

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
        <>
          <UpdatePrompt />
          <RouteBootstrapRecoveryState
            onRetry={retry}
            onSignInAgain={onSignInAgain}
            reason="network"
          />
        </>
      );
    }

    throw error;
  }

  if (isLoading || !Component) {
    return (
      <>
        <UpdatePrompt />
        <PublicRouteLoader />
      </>
    );
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
    return (
      <>
        <UpdatePrompt />
        <PublicRouteLoader />
      </>
    );
  }

  if (isVaultLocked) {
    if (!unlock) {
      return <Navigate to="/login" replace />;
    }

    return (
      <>
        <UpdatePrompt />
        <LoginRouteVaultLockedState onUnlock={unlock} onSignInAgain={logout} />
      </>
    );
  }

  if (bootstrapRecoveryReason) {
    return (
      <>
        <UpdatePrompt />
        <RouteBootstrapRecoveryState
          onRetry={retryBootstrap}
          onSignInAgain={logout}
          reason={bootstrapRecoveryReason}
        />
      </>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AuthenticatedAppSlot onSignInAgain={logout} />;
}

function PublicRouteUpdatePrompt() {
  const { pathname } = useLocation();
  const normalizedPathname =
    pathname !== "/" && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  const isPublicRoute =
    normalizedPathname === "/login" ||
    normalizedPathname === "/source" ||
    normalizedPathname === "/onboarding/complete";

  if (!isPublicRoute) {
    return null;
  }

  return <UpdatePrompt />;
}

function NativeRuntimeDiscoveryGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [runtimeInfo, setRuntimeInfo] = useState<SecPalRuntimeInfo | null>(null);
  const [isDiscoveryRequired, setIsDiscoveryRequired] = useState(false);
  const [isCheckingRuntime, setIsCheckingRuntime] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkRuntimeBootstrap() {
      try {
        const bootstrapState =
          await SecPalRuntimeBootstrap.getRuntimeBootstrap();

        if (!isMounted) {
          return;
        }

        if (!bootstrapState || bootstrapState.configured) {
          setIsDiscoveryRequired(false);
          setRuntimeInfo(null);
          setIsCheckingRuntime(false);
          return;
        }

        const nextRuntimeInfo =
          await SecPalRuntimeBootstrap.getRuntimeInfo();

        if (!isMounted) {
          return;
        }

        if (nextRuntimeInfo?.clientPlatform === "android") {
          setRuntimeInfo(nextRuntimeInfo);
          setIsDiscoveryRequired(true);
        } else {
          setRuntimeInfo(null);
          setIsDiscoveryRequired(false);
        }
      } catch {
        if (isMounted) {
          setRuntimeInfo(null);
          setIsDiscoveryRequired(false);
        }
      } finally {
        if (isMounted) {
          setIsCheckingRuntime(false);
        }
      }
    }

    void checkRuntimeBootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isCheckingRuntime) {
    return <PublicRouteLoader />;
  }

  if (isDiscoveryRequired && runtimeInfo) {
    return (
      <RuntimeDiscoveryFlow
        runtimeInfo={runtimeInfo}
        onConfigured={() => {
          setIsDiscoveryRequired(false);
          setRuntimeInfo(null);
        }}
      />
    );
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NativeRuntimePwaGuard />
        <PublicRouteUpdatePrompt />
        <NativeRuntimeDiscoveryGate>
          <Suspense fallback={<PublicRouteLoader />}>
            <Routes>
              <Route path="/login" element={<LoginRoute />} />
              <Route path="/source" element={<SourcePage />} />
              <Route
                path="/onboarding/complete"
                element={<OnboardingComplete />}
              />
              <Route path="*" element={<AuthenticatedAppRoute />} />
            </Routes>
          </Suspense>
        </NativeRuntimeDiscoveryGate>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
