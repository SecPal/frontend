// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
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
import { SecPalRuntimeBootstrap, type SecPalRuntimeInfo } from "./native";
import { Login, type LoginRuntimeBootstrapSummary } from "./pages/Login";
import { SourcePage } from "./pages/SourcePage";

const LOGIN_ROUTE_BOOTSTRAP_INTERACTIVE_DELAY_MS = 1000;

interface NativeRuntimeBootstrapContextValue {
  readonly loginRuntimeBootstrap: LoginRuntimeBootstrapSummary | null;
  readonly returnToRuntimeDiscovery: () => Promise<void>;
}

const NativeRuntimeBootstrapContext =
  createContext<NativeRuntimeBootstrapContextValue>({
    loginRuntimeBootstrap: null,
    returnToRuntimeDiscovery: async () => undefined,
  });

function useNativeRuntimeBootstrapContext() {
  return useContext(NativeRuntimeBootstrapContext);
}

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
  const { loginRuntimeBootstrap, returnToRuntimeDiscovery } =
    useNativeRuntimeBootstrapContext();
  const {
    bootstrapRecoveryReason,
    isAuthenticated,
    isVaultLocked = false,
    logout,
    retryBootstrap,
    unlock,
  } = auth;
  const handleSwitchRuntimeBootstrap = useCallback(async () => {
    await logout();
    await returnToRuntimeDiscovery();
  }, [logout, returnToRuntimeDiscovery]);

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

  return (
    <Login
      runtimeBootstrap={loginRuntimeBootstrap}
      onSwitchRuntimeBootstrap={handleSwitchRuntimeBootstrap}
    />
  );
}

function LoginRouteBootstrapGate() {
  const [showInteractiveLogin, setShowInteractiveLogin] = useState(false);
  const { logout } = useAuth();
  const { loginRuntimeBootstrap, returnToRuntimeDiscovery } =
    useNativeRuntimeBootstrapContext();
  const handleSwitchRuntimeBootstrap = useCallback(async () => {
    await logout();
    await returnToRuntimeDiscovery();
  }, [logout, returnToRuntimeDiscovery]);

  useEffect(() => {
    const timeoutId = globalThis.setTimeout(() => {
      setShowInteractiveLogin(true);
    }, LOGIN_ROUTE_BOOTSTRAP_INTERACTIVE_DELAY_MS);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, []);

  return showInteractiveLogin ? (
    <Login
      runtimeBootstrap={loginRuntimeBootstrap}
      onSwitchRuntimeBootstrap={handleSwitchRuntimeBootstrap}
    />
  ) : (
    <LoginRouteLoadingState />
  );
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

function normalizePathname(pathname: string): string {
  return pathname !== "/" && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}

function toLoginRuntimeBootstrapSummary(
  bootstrap: {
    apiOrigin: string;
    instanceDisplayName: string;
    features?: {
      passwordLoginEnabled: boolean;
      passkeyLoginEnabled: boolean;
    };
  } | null
): LoginRuntimeBootstrapSummary | null {
  if (!bootstrap) {
    return null;
  }

  return {
    apiOrigin: bootstrap.apiOrigin,
    instanceDisplayName: bootstrap.instanceDisplayName,
    features: bootstrap.features,
  };
}

function NativeRuntimeDiscoveryGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { pathname } = useLocation();
  const [runtimeInfo, setRuntimeInfo] = useState<SecPalRuntimeInfo | null>(
    null
  );
  const [loginRuntimeBootstrap, setLoginRuntimeBootstrap] =
    useState<LoginRuntimeBootstrapSummary | null>(null);
  const [isDiscoveryRequired, setIsDiscoveryRequired] = useState(false);
  const [isCheckingRuntime, setIsCheckingRuntime] = useState(true);
  const normalizedPathname = normalizePathname(pathname);
  const bypassRuntimeDiscovery = normalizedPathname === "/source";

  const requireRuntimeDiscovery = useCallback(async () => {
    const nextRuntimeInfo = await SecPalRuntimeBootstrap.getRuntimeInfo();

    setLoginRuntimeBootstrap(null);

    if (nextRuntimeInfo?.clientPlatform === "android") {
      setRuntimeInfo(nextRuntimeInfo);
      setIsDiscoveryRequired(true);
    } else {
      setRuntimeInfo(null);
      setIsDiscoveryRequired(false);
    }
  }, []);

  const returnToRuntimeDiscovery = useCallback(async () => {
    await SecPalRuntimeBootstrap.clearRuntimeBootstrap();
    await requireRuntimeDiscovery();
  }, [requireRuntimeDiscovery]);

  useEffect(() => {
    let isMounted = true;

    async function checkRuntimeBootstrap() {
      try {
        const bootstrapState =
          await SecPalRuntimeBootstrap.getRuntimeBootstrap();

        if (!isMounted) {
          return;
        }

        if (!bootstrapState) {
          setLoginRuntimeBootstrap(null);
          setIsDiscoveryRequired(false);
          setRuntimeInfo(null);
          setIsCheckingRuntime(false);
          return;
        }

        if (bootstrapState.configured) {
          setLoginRuntimeBootstrap(
            toLoginRuntimeBootstrapSummary(bootstrapState.bootstrap ?? null)
          );
          setIsDiscoveryRequired(false);
          setRuntimeInfo(null);
          setIsCheckingRuntime(false);
          return;
        }

        const nextRuntimeInfo = await SecPalRuntimeBootstrap.getRuntimeInfo();

        if (!isMounted) {
          return;
        }

        if (nextRuntimeInfo?.clientPlatform === "android") {
          setLoginRuntimeBootstrap(null);
          setRuntimeInfo(nextRuntimeInfo);
          setIsDiscoveryRequired(true);
        } else {
          setLoginRuntimeBootstrap(null);
          setRuntimeInfo(null);
          setIsDiscoveryRequired(false);
        }
      } catch {
        if (isMounted) {
          setLoginRuntimeBootstrap(null);
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

  if (bypassRuntimeDiscovery) {
    return (
      <NativeRuntimeBootstrapContext.Provider
        value={{ loginRuntimeBootstrap, returnToRuntimeDiscovery }}
      >
        {children}
      </NativeRuntimeBootstrapContext.Provider>
    );
  }

  if (isCheckingRuntime) {
    return <PublicRouteLoader />;
  }

  if (isDiscoveryRequired && runtimeInfo) {
    return (
      <RuntimeDiscoveryFlow
        runtimeInfo={runtimeInfo}
        onConfigured={() => {
          void SecPalRuntimeBootstrap.getRuntimeBootstrap()
            .then((bootstrapState) => {
              setLoginRuntimeBootstrap(
                bootstrapState?.configured
                  ? toLoginRuntimeBootstrapSummary(
                      bootstrapState.bootstrap ?? null
                    )
                  : null
              );
            })
            .catch(() => {
              setLoginRuntimeBootstrap(null);
            });
          setIsDiscoveryRequired(false);
          setRuntimeInfo(null);
        }}
      />
    );
  }

  return (
    <NativeRuntimeBootstrapContext.Provider
      value={{ loginRuntimeBootstrap, returnToRuntimeDiscovery }}
    >
      {children}
    </NativeRuntimeBootstrapContext.Provider>
  );
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
