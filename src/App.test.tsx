// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import App from "./App";
import { AuthApiError } from "./services/authApi";
import { sanitizePersistedAuthUser } from "./services/authState";
import { authStorage } from "./services/storage";
import { createRecoverableLazyModuleError } from "./lib/lazyModuleErrors";

const ROUTE_NAVIGATION_TIMEOUT_MS = 20_000;

const {
  mockGetCurrentUser,
  mockFetchCsrfToken,
  mockAuthStorage,
  mockLoadAuthenticatedAppModule,
  mockUpdatePrompt,
} = vi.hoisted(() => {
  let storedUser: unknown = null;
  let vaultPresent = false;
  let vaultLocked = false;
  let logoutBarrier = false;
  let skipVaultTableCleanup = false;

  return {
    mockGetCurrentUser: vi.fn(),
    mockFetchCsrfToken: vi.fn(),
    mockLoadAuthenticatedAppModule: vi.fn(() => import("./AuthenticatedApp")),
    mockUpdatePrompt: vi.fn(() => <div data-testid="update-prompt" />),
    mockAuthStorage: {
      hasStoredUser: vi.fn(
        () =>
          !logoutBarrier &&
          !vaultLocked &&
          (vaultPresent || storedUser !== null)
      ),
      hasVaultLock: vi.fn(() => vaultLocked),
      // Mirror production: persisted users live in the offline vault, so the
      // synchronous snapshot is always null once a vault record exists.
      getUserSnapshot: vi.fn(() => {
        if (logoutBarrier || vaultLocked || vaultPresent) {
          return null;
        }

        return storedUser;
      }),
      getUser: vi.fn(async () => {
        if (logoutBarrier || vaultLocked) {
          return null;
        }

        return storedUser;
      }),
      setUser: vi.fn(async (user: unknown) => {
        storedUser = user;
        vaultPresent = true;
        vaultLocked = false;
        logoutBarrier = false;
      }),
      lockVault: vi.fn(() => {
        vaultLocked = true;
        logoutBarrier = false;
      }),
      unlockVault: vi.fn(async () => {
        vaultLocked = false;
        return storedUser;
      }),
      removeUser: vi.fn(async () => {
        storedUser = null;
        vaultPresent = false;
        vaultLocked = false;
        logoutBarrier = false;
      }),
      clear: vi.fn(async () => {
        storedUser = null;
        vaultPresent = false;
        vaultLocked = false;
        logoutBarrier = false;
        skipVaultTableCleanup = false;
      }),
      hasLogoutBarrier: vi.fn(() => logoutBarrier),
      shouldSkipBarrierVaultTableCleanup: vi.fn(() => skipVaultTableCleanup),
      setSkipBarrierVaultTableCleanup: vi.fn((shouldSkip: boolean) => {
        skipVaultTableCleanup = shouldSkip;
      }),
      beginSensitiveLogoutBarrierCleanup: vi.fn(() => {
        logoutBarrier = true;
        skipVaultTableCleanup = true;
        return "test-logout-barrier-owner";
      }),
      completeStaleSensitiveLogoutBarrierCleanup: vi.fn(() => {
        skipVaultTableCleanup = false;
      }),
      endSensitiveLogoutBarrierCleanup: vi.fn(() => {
        skipVaultTableCleanup = false;
      }),
      waitForInFlightVaultTableCleanup: vi.fn(async () => undefined),
    },
  };
});

vi.mock("./services/authApi", async () => {
  const actual = await vi.importActual("./services/authApi");
  return {
    ...actual,
    getCurrentUser: mockGetCurrentUser,
  };
});

vi.mock("./services/csrf", async () => {
  const actual = await vi.importActual("./services/csrf");
  return {
    ...actual,
    fetchCsrfToken: mockFetchCsrfToken,
  };
});

vi.mock("./services/storage", () => ({
  authStorage: mockAuthStorage,
}));

vi.mock("./lib/lazyAppModules", async () => {
  const actual = await vi.importActual("./lib/lazyAppModules");
  return {
    ...actual,
    loadAuthenticatedAppModule: mockLoadAuthenticatedAppModule,
  };
});

vi.mock("./components/UpdatePrompt", () => ({
  UpdatePrompt: mockUpdatePrompt,
}));

vi.mock("./platform/appSurface", async () => {
  const actual = await vi.importActual<typeof import("./platform/appSurface")>(
    "./platform/appSurface"
  );

  return {
    ...actual,
    isAndroidMockSurface: false,
  };
});

// Block all real network requests: lazy-loaded page components call their
// data APIs on mount, and those pending fetch Promises accumulate in the
// Node.js event loop, stalling the microtask queue and pushing the auth
// bootstrap past BOOTSTRAP_REVALIDATION_TIMEOUT_MS. Failing immediately
// prevents that backlog without affecting the auth behaviour under test.
// Using spyOn (not stubGlobal) so it is not undone by unstubGlobals: true
// between tests.
const fetchSpy = vi
  .spyOn(globalThis, "fetch")
  .mockRejectedValue(new TypeError("fetch is not available in App.test.tsx"));

function createAndroidRuntimeBootstrapBridge({
  configured = false,
  getRuntimeBootstrap = vi.fn().mockResolvedValue(
    configured
      ? {
          configured: true,
          bootstrap: {
            instanceDisplayName: "SecPal Demo",
            apiOrigin: "https://api.secpal.dev",
            rawApiBaseUrl: "https://api.secpal.dev/v1",
            minimumSupportedAppVersion: "1.4.0",
            minimumSupportedAppBuild: 10400,
            androidPush: {
              provider: "fcm",
              metadataRevision: 3,
              publicClientMetadata: {
                apiKey: "public-client-api-key-demo-1234567890",
                projectId: "secpal-demo-push",
                applicationId: "1:1234567890:android:abcdef1234567890",
                senderId: "1234567890",
              },
            },
            features: {
              passwordLoginEnabled: true,
              passkeyLoginEnabled: true,
              managedAndroidEnrollment: false,
            },
          },
        }
      : { configured: false }
  ),
  getRuntimeInfo = vi.fn().mockResolvedValue({
    clientPlatform: "android",
    appVersion: "1.4.0",
    appBuild: 10400,
  }),
  login = vi.fn(),
  getCurrentUser = vi.fn().mockResolvedValue({
    id: "42",
    name: "Configured User",
    email: "configured.user@secpal.dev",
    emailVerified: true,
  }),
  setRuntimeBootstrap = vi.fn().mockResolvedValue(undefined),
  clearRuntimeBootstrap = vi.fn().mockResolvedValue(undefined),
  logout = vi.fn().mockResolvedValue(undefined),
}: {
  configured?: boolean;
  getRuntimeBootstrap?: ReturnType<typeof vi.fn>;
  getRuntimeInfo?: ReturnType<typeof vi.fn>;
  login?: ReturnType<typeof vi.fn>;
  getCurrentUser?: ReturnType<typeof vi.fn>;
  setRuntimeBootstrap?: ReturnType<typeof vi.fn>;
  clearRuntimeBootstrap?: ReturnType<typeof vi.fn>;
  logout?: ReturnType<typeof vi.fn>;
} = {}) {
  const bridge = {
    login,
    getCurrentUser,
    getRuntimeBootstrap,
    getRuntimeInfo,
    setRuntimeBootstrap,
    clearRuntimeBootstrap,
    logout,
  };

  (
    globalThis as typeof globalThis & {
      SecPalNativeAuthBridge?: typeof bridge;
    }
  ).SecPalNativeAuthBridge = bridge;

  return bridge;
}

async function selectDiscoveryLanguage(
  user: ReturnType<typeof userEvent.setup>,
  language: "English" | "Deutsch"
) {
  await user.click(screen.getByLabelText(/select language/i));
  await user.click(await screen.findByRole("option", { name: language }));
}

function createBootstrapResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      client_platform: "android",
      api_base_url: "https://api.secpal.dev/v1",
      instance: {
        display_name: "SecPal Demo",
      },
      compatibility: {
        bootstrap_version: "v1",
        schema_version: 3,
        minimum_supported_app_version: "1.4.0",
        minimum_supported_app_build: 10400,
      },
      features: {
        password_login: true,
        passkey_login: true,
        managed_android_enrollment: false,
        notification_channels: {
          android_fcm: true,
          web_push: false,
        },
      },
      notification_channels: {
        android_fcm: {
          channel: "android_fcm",
          metadata_revision: 3,
          public_runtime_metadata: {
            api_key: "public-client-api-key-demo-1234567890",
            project_id: "secpal-demo-push",
            application_id: "1:1234567890:android:abcdef1234567890",
            sender_id: "1234567890",
          },
        },
      },
      ...overrides,
    },
  };
}

function setXsrfCookie(token = "test-xsrf-token"): void {
  document.cookie = `XSRF-TOKEN=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
}

function clearXsrfCookie(): void {
  document.cookie =
    "XSRF-TOKEN=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
}

// Helper to render with I18n and wait for async updates
async function renderWithI18n(component: React.ReactElement) {
  let result!: ReturnType<typeof render>;

  await act(async () => {
    result = render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
    // Wait for microtasks queued during initial render/effects to settle.
    await Promise.resolve();
  });

  return result;
}

async function confirmRuntimeInstanceSwitch(
  user: ReturnType<typeof userEvent.setup>
) {
  await user.click(
    await screen.findByRole("button", { name: /switch instance/i })
  );
  await user.click(
    await screen.findByRole("button", { name: /switch instance/i })
  );
}

async function waitForPathname(pathname: string) {
  await waitFor(
    () => {
      expect(window.location.pathname).toBe(pathname);
    },
    { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
  );
}

async function seedPersistedAuthUser(user: Record<string, unknown>) {
  const persistedUser = sanitizePersistedAuthUser(user);

  if (!persistedUser) {
    throw new Error("Failed to seed persisted auth user for test");
  }

  setXsrfCookie();
  await authStorage.setUser(persistedUser);
  mockGetCurrentUser.mockResolvedValue(persistedUser);

  return persistedUser;
}

describe("App", () => {
  // Pre-load all lazily-imported route modules once before any test runs.
  // Without this, each test that renders a route with a lazy component creates
  // a pending Suspense thenable. Over 19+ tests these accumulate in the
  // microtask queue and can delay the auth-bootstrap Promise resolution past
  // BOOTSTRAP_REVALIDATION_TIMEOUT_MS, causing redirect tests to time out.
  beforeAll(async () => {
    await Promise.all([
      import("./pages/Settings/SettingsPage"),
      import("./pages/Profile/ProfilePage"),
      import("./pages/Employees/EmployeeList"),
      import("./pages/Employees/EmployeeDetail"),
      import("./pages/Employees/EmployeeCreate"),
      import("./pages/Employees/EmployeeEdit"),
      import("./pages/Employees/EmployeeContactsEdit"),
      import("./pages/Onboarding/OnboardingWizard"),
      import("./pages/Onboarding/OnboardingComplete"),
      import("./pages/Organization/OrganizationPage"),
      import("./pages/Customers/CustomersPage"),
      import("./pages/Customers/CustomerCreate"),
      import("./pages/Customers/CustomerDetail"),
      import("./pages/Customers/CustomerEdit"),
      import("./pages/Sites/SitesPage"),
      import("./pages/Sites/SiteCreate"),
      import("./pages/Sites/SiteDetail"),
      import("./pages/Sites/SiteEdit"),
      import("./pages/ActivityLog/ActivityLogList"),
      import("./pages/AndroidProvisioning/AndroidProvisioningPage"),
    ]);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await authStorage.clear();
    mockAuthStorage.clear.mockClear();
    localStorage.clear();
    sessionStorage.clear();
    delete (globalThis as { SecPalNativeAuthBridge?: unknown })
      .SecPalNativeAuthBridge;
    clearXsrfCookie();
    setXsrfCookie();
    window.history.replaceState({}, "", "/login");
    i18n.load("en", {});
    i18n.activate("en");
    fetchSpy.mockRejectedValue(
      new TypeError("fetch is not available in App.test.tsx")
    );
    mockFetchCsrfToken.mockResolvedValue(undefined);
    mockLoadAuthenticatedAppModule.mockReset();
    mockLoadAuthenticatedAppModule.mockImplementation(
      () => import("./AuthenticatedApp")
    );
    mockGetCurrentUser.mockRejectedValue(
      Object.assign(new Error("No mock auth user available for bootstrap"), {
        code: "HTTP_401",
      })
    );
  });

  it("renders login page when not authenticated", async () => {
    await renderWithI18n(<App />);
    expect(
      screen.getByRole("heading", { name: /SecPal/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("shows Android runtime discovery before login when no runtime bootstrap is configured", async () => {
    createAndroidRuntimeBootstrapBridge({ configured: false });

    await renderWithI18n(<App />);

    expect(
      await screen.findByLabelText(/instance url|instanz-url/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/instance url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/language/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /legal/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Powered by SecPal – A guard's best friend",
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("secpal-instance-discovery-locale")
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue to login/i })
    ).toBeDisabled();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it("keeps the public source route reachable before Android runtime discovery is configured", async () => {
    window.history.replaceState({}, "", "/source");
    createAndroidRuntimeBootstrapBridge({ configured: false });
    clearXsrfCookie();

    await renderWithI18n(<App />);

    expect(
      await screen.findByRole("heading", { name: /agpl v3\+/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /enter your instance url/i })
    ).not.toBeInTheDocument();
  });

  it("keeps the public onboarding completion route reachable before Android runtime discovery is configured", async () => {
    window.history.replaceState({}, "", "/onboarding/complete");
    createAndroidRuntimeBootstrapBridge({ configured: false });
    clearXsrfCookie();

    await renderWithI18n(<App />);

    expect(
      await screen.findByRole("heading", { name: /invalid link/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /enter your instance url/i })
    ).not.toBeInTheDocument();
  });

  it("requires Android runtime discovery when the native bootstrap read fails", async () => {
    createAndroidRuntimeBootstrapBridge({
      getRuntimeBootstrap: vi
        .fn()
        .mockRejectedValue(new Error("Runtime bootstrap is unreadable")),
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByRole("heading", { name: /enter your instance url/i })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it("requires Android runtime discovery when bootstrap state is unavailable for an Android runtime", async () => {
    createAndroidRuntimeBootstrapBridge({
      getRuntimeBootstrap: vi.fn().mockResolvedValue(null),
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByRole("heading", { name: /enter your instance url/i })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it("clears stale authenticated state before Android runtime discovery starts", async () => {
    createAndroidRuntimeBootstrapBridge({ configured: false });
    await seedPersistedAuthUser({
      id: "42",
      name: "Stale Runtime User",
      email: "stale.runtime.user@secpal.dev",
      emailVerified: true,
    });
    mockAuthStorage.clear.mockClear();

    await renderWithI18n(<App />);

    expect(
      await screen.findByRole("heading", { name: /enter your instance url/i })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(mockAuthStorage.clear).toHaveBeenCalled();
    });
    expect(mockLoadAuthenticatedAppModule).not.toHaveBeenCalled();
  });

  it("switches discovery UI language immediately when the user changes it", async () => {
    const user = userEvent.setup();
    createAndroidRuntimeBootstrapBridge({ configured: false });

    await renderWithI18n(<App />);

    await selectDiscoveryLanguage(user, "Deutsch");

    expect(
      await screen.findByRole("heading", { name: /instanz-url eingeben/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /instanz prüfen/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /weiter zur anmeldung/i })
    ).toBeInTheDocument();
  });

  it("shows Android discovery errors in the selected language", async () => {
    const user = userEvent.setup();
    createAndroidRuntimeBootstrapBridge({ configured: false });
    fetchSpy.mockRejectedValue(new TypeError("Failed to fetch"));

    await renderWithI18n(<App />);

    await selectDiscoveryLanguage(user, "Deutsch");
    await user.type(
      screen.getByLabelText(/instanz-url/i),
      "https://api.secpal.dev"
    );
    await user.click(screen.getByRole("button", { name: /instanz prüfen/i }));

    expect(
      await screen.findByText(
        "Die Instanz konnte nicht erreicht werden. Prüfen Sie die URL mit Ihrer Führungskraft."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Could not reach that instance. Check the URL with your supervisor."
      )
    ).not.toBeInTheDocument();
  });

  it("validates, summarizes, and confirms an Android runtime bootstrap before login", async () => {
    const user = userEvent.setup();
    const bridge = createAndroidRuntimeBootstrapBridge({ configured: false });
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(createBootstrapResponse()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await renderWithI18n(<App />);

    await user.type(
      await screen.findByLabelText(/instance url/i),
      "https://api.secpal.dev"
    );
    await selectDiscoveryLanguage(user, "Deutsch");
    await user.click(
      screen.getByRole("button", { name: /check instance|instanz prüfen/i })
    );

    expect(
      await screen.findByRole("heading", { name: /secpal demo/i })
    ).toBeInTheDocument();
    expect(screen.getByText("https://api.secpal.dev")).toBeInTheDocument();

    const request = fetchSpy.mock.calls[0]?.[0] as Request;
    const url = new URL(request.url);
    expect(url.pathname).toBe("/v1/bootstrap");
    expect(url.searchParams.get("client_platform")).toBe("android");
    expect(url.searchParams.get("app_version")).toBe("1.4.0");
    expect(url.searchParams.get("app_build")).toBe("10400");
    expect(request.headers.get("Accept-Language")).toBe("de");

    await user.click(
      screen.getByRole("button", {
        name: /continue to login|weiter zur anmeldung/i,
      })
    );

    await waitFor(() => {
      expect(bridge.setRuntimeBootstrap).toHaveBeenCalledWith({
        instanceDisplayName: "SecPal Demo",
        apiOrigin: "https://api.secpal.dev",
        rawApiBaseUrl: "https://api.secpal.dev/v1",
        minimumSupportedAppVersion: "1.4.0",
        minimumSupportedAppBuild: 10400,
        androidPush: {
          provider: "fcm",
          metadataRevision: 3,
          publicClientMetadata: {
            apiKey: "public-client-api-key-demo-1234567890",
            projectId: "secpal-demo-push",
            applicationId: "1:1234567890:android:abcdef1234567890",
            senderId: "1234567890",
          },
        },
        features: {
          passwordLoginEnabled: true,
          passkeyLoginEnabled: true,
          managedAndroidEnrollment: false,
        },
      });
    });
    expect(
      await screen.findByRole("heading", { name: /SecPal/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /mail/i })).toBeInTheDocument();
  });

  it("preserves runtime login feature flags immediately after confirming Android runtime discovery", async () => {
    const user = userEvent.setup();
    createAndroidRuntimeBootstrapBridge({ configured: false });
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify(
          createBootstrapResponse({
            features: {
              password_login: false,
              passkey_login: false,
              managed_android_enrollment: false,
              notification_channels: {
                android_fcm: false,
                web_push: false,
              },
            },
            notification_channels: undefined,
          })
        ),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    await renderWithI18n(<App />);

    await user.type(
      await screen.findByLabelText(/instance url/i),
      "https://api.secpal.dev"
    );
    await user.click(screen.getByRole("button", { name: /check instance/i }));
    await screen.findByRole("heading", { name: /secpal demo/i });

    await user.click(
      screen.getByRole("button", { name: /continue to login/i })
    );

    expect(
      await screen.findByText(/signed in to secpal demo/i)
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /log in/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sign in with passkey/i })
    ).not.toBeInTheDocument();
  });

  it("keeps runtime discovery open when the native shell cannot apply the bootstrap", async () => {
    const user = userEvent.setup();
    createAndroidRuntimeBootstrapBridge({
      configured: false,
      setRuntimeBootstrap: null as unknown as ReturnType<typeof vi.fn>,
    });
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(createBootstrapResponse()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await renderWithI18n(<App />);

    await user.type(
      await screen.findByLabelText(/instance url/i),
      "https://api.secpal.dev"
    );
    await user.click(screen.getByRole("button", { name: /check instance/i }));
    await screen.findByRole("heading", { name: /secpal demo/i });

    await user.click(
      screen.getByRole("button", { name: /continue to login/i })
    );

    expect(
      await screen.findByRole("button", { name: /check instance/i })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue to login/i })
    ).toBeEnabled();
    expect(
      screen.getByText(/the selected instance could not be applied/i)
    ).toBeInTheDocument();
  });

  it("shows the configured Android instance summary on the login screen", async () => {
    createAndroidRuntimeBootstrapBridge({ configured: true });
    clearXsrfCookie();

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(/signed in to secpal demo/i)
    ).toBeInTheDocument();
    expect(screen.getByText("https://api.secpal.dev")).toBeInTheDocument();
    expect(document.getElementById("secpal-runtime-switch-instance")).toBe(
      screen.getByRole("button", { name: /switch instance/i })
    );
    expect(
      screen.getByRole("button", { name: /switch instance/i })
    ).toBeEnabled();
    expect(
      screen.queryByRole("heading", { name: /enter your instance url/i })
    ).not.toBeInTheDocument();
  });

  it("preserves runtime login feature flags from the configured Android bootstrap", async () => {
    createAndroidRuntimeBootstrapBridge({
      configured: true,
      getRuntimeBootstrap: vi.fn().mockResolvedValue({
        configured: true,
        bootstrap: {
          instanceDisplayName: "SecPal Demo",
          apiOrigin: "https://api.secpal.dev",
          rawApiBaseUrl: "https://api.secpal.dev/v1",
          minimumSupportedAppVersion: "1.4.0",
          minimumSupportedAppBuild: 10400,
          features: {
            passwordLoginEnabled: false,
            passkeyLoginEnabled: false,
            managedAndroidEnrollment: false,
          },
        },
      }),
    });
    clearXsrfCookie();

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(/signed in to secpal demo/i)
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /log in/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sign in with passkey/i })
    ).not.toBeInTheDocument();
  });

  it("clears configured Android runtime and logged-out local state before returning to discovery", async () => {
    const user = userEvent.setup();
    const bridge = createAndroidRuntimeBootstrapBridge({ configured: true });
    clearXsrfCookie();
    localStorage.setItem("auth_token", "stale-token");
    localStorage.setItem("secpal-notification-preferences", "{}");
    sessionStorage.setItem("tenant:selected", "tenant-1");

    await renderWithI18n(<App />);

    await confirmRuntimeInstanceSwitch(user);

    await waitFor(() => {
      expect(bridge.clearRuntimeBootstrap).toHaveBeenCalled();
    });
    expect(mockAuthStorage.clear).toHaveBeenCalled();
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem("secpal-notification-preferences")).toBeNull();
    expect(sessionStorage.getItem("tenant:selected")).toBeNull();
    expect(
      await screen.findByRole("heading", { name: /enter your instance url/i })
    ).toBeInTheDocument();
    expect(bridge.clearRuntimeBootstrap).toHaveBeenCalledTimes(1);
  });

  it("best-effort revokes the native session before switching Android instances", async () => {
    const user = userEvent.setup();
    const logoutSpy = vi.fn().mockResolvedValue(undefined);
    const bridge = createAndroidRuntimeBootstrapBridge({
      configured: true,
      logout: logoutSpy,
    });
    clearXsrfCookie();

    await renderWithI18n(<App />);

    await confirmRuntimeInstanceSwitch(user);

    await waitFor(() => {
      expect(logoutSpy).toHaveBeenCalledTimes(1);
    });
    expect(bridge.clearRuntimeBootstrap).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole("heading", { name: /enter your instance url/i })
    ).toBeInTheDocument();
  });

  it("clears configured Android runtime and authenticated state before returning to discovery", async () => {
    const user = userEvent.setup();
    const bridge = createAndroidRuntimeBootstrapBridge({ configured: true });
    localStorage.setItem("auth_token", "stale-token");
    sessionStorage.setItem("tenant:selected", "tenant-1");
    await seedPersistedAuthUser({
      id: "42",
      name: "Configured User",
      email: "configured.user@secpal.dev",
      emailVerified: true,
    });
    mockAuthStorage.getUser.mockImplementationOnce(
      () =>
        new Promise(() => undefined) as ReturnType<
          typeof mockAuthStorage.getUser
        >
    );

    await renderWithI18n(<App />);

    await confirmRuntimeInstanceSwitch(user);

    await waitFor(() => {
      expect(bridge.clearRuntimeBootstrap).toHaveBeenCalled();
    });
    expect(mockAuthStorage.clear).toHaveBeenCalled();
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(sessionStorage.getItem("tenant:selected")).toBeNull();
    expect(
      await screen.findByRole("heading", {
        name: /enter your instance url/i,
      })
    ).toBeInTheDocument();
    expect(bridge.clearRuntimeBootstrap).toHaveBeenCalledTimes(1);
  });

  it("clears configured Android runtime even when push cleanup observes a registration conflict", async () => {
    const user = userEvent.setup();
    const bridge = createAndroidRuntimeBootstrapBridge({ configured: true });
    clearXsrfCookie();
    const unsubscribe = vi.fn().mockResolvedValue(false);
    const serviceWorkerDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      "serviceWorker"
    );

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue({
              endpoint: "https://app.secpal.dev/stale-registration",
              unsubscribe,
            }),
          },
        }),
      },
    });

    try {
      await renderWithI18n(<App />);

      await confirmRuntimeInstanceSwitch(user);

      await waitFor(() => {
        expect(bridge.clearRuntimeBootstrap).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(unsubscribe).toHaveBeenCalled();
        expect(mockAuthStorage.clear).toHaveBeenCalled();
      });
      expect(
        await screen.findByRole("heading", {
          name: /enter your instance url/i,
        })
      ).toBeInTheDocument();
      expect(bridge.clearRuntimeBootstrap).toHaveBeenCalledTimes(1);
    } finally {
      if (serviceWorkerDescriptor) {
        Object.defineProperty(
          navigator,
          "serviceWorker",
          serviceWorkerDescriptor
        );
      } else {
        delete (navigator as { serviceWorker?: unknown }).serviceWorker;
      }
    }
  });

  it.each([
    {
      name: "validation errors",
      instanceUrl: "http://api.secpal.dev",
      fetchResponse: null,
      message: /secure https instance url/i,
    },
    {
      name: "bootstrap state-invalid errors",
      instanceUrl: "https://api.secpal.dev",
      fetchResponse: new Response(
        JSON.stringify(
          createBootstrapResponse({
            features: {
              password_login: true,
            },
          })
        ),
        { status: 200 }
      ),
      message: /bootstrap response is incomplete/i,
    },
    {
      name: "bootstrap unavailable errors",
      instanceUrl: "https://api.secpal.dev",
      fetchResponse: new TypeError("Failed to fetch"),
      message: /could not reach that instance/i,
    },
    {
      name: "unsupported-client-version responses",
      instanceUrl: "https://api.secpal.dev",
      fetchResponse: new Response(JSON.stringify(createBootstrapResponse()), {
        status: 426,
      }),
      message: /update the android app/i,
    },
  ])(
    "blocks Android runtime confirmation on $name",
    async ({ instanceUrl, fetchResponse, message }) => {
      const user = userEvent.setup();
      const bridge = createAndroidRuntimeBootstrapBridge({ configured: false });

      if (fetchResponse instanceof Error) {
        fetchSpy.mockRejectedValue(fetchResponse);
      } else if (fetchResponse) {
        fetchSpy.mockResolvedValue(fetchResponse);
      }

      await renderWithI18n(<App />);

      await user.type(
        await screen.findByLabelText(/instance url/i),
        instanceUrl
      );
      await user.click(screen.getByRole("button", { name: /check instance/i }));

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /continue to login/i })
      ).toBeDisabled();
      expect(bridge.setRuntimeBootstrap).not.toHaveBeenCalled();
    }
  );

  it("renders the public source route without requiring authentication", async () => {
    window.history.replaceState({}, "", "/source");
    clearXsrfCookie();

    await renderWithI18n(<App />);

    expect(
      await screen.findByRole("heading", { name: /agpl v3\+/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /agpl source offer for the secpal components made available through this service\./i
      )
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        /the project repositories below remain linked as the preferred form for making modifications/i
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/source code and license/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "https://github.com/SecPal/frontend" })
    ).toHaveAttribute("href", "https://github.com/SecPal/frontend");
    expect(
      screen.getByRole("link", { name: "https://github.com/SecPal/api" })
    ).toHaveAttribute("href", "https://github.com/SecPal/api");
    expect(
      screen.getByRole("link", { name: "https://github.com/SecPal/contracts" })
    ).toHaveAttribute("href", "https://github.com/SecPal/contracts");
    expect(
      screen.queryByRole("link", { name: "https://github.com/SecPal/android" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /read the agpl v3 license/i })
    ).toHaveAttribute("href", "https://www.gnu.org/licenses/agpl-3.0.html");
    expect(
      screen.getByRole("link", { name: /back to login/i })
    ).toHaveAttribute("href", "/login");
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(screen.getByText(/without any warranty/i)).toBeInTheDocument();
  });

  it("renders the source route as an in-app legal page for authenticated users", async () => {
    window.history.replaceState({}, "", "/source");
    await seedPersistedAuthUser({
      id: "42",
      name: "Legal Reader",
      email: "legal.reader@secpal.dev",
      emailVerified: true,
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByRole("heading", { name: /agpl v3\+/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^back$/i })).toHaveAttribute(
      "href",
      "/"
    );
    expect(
      await screen.findByText(
        /the project repositories below remain linked as the preferred form for making modifications/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "https://github.com/SecPal/frontend" })
    ).toHaveAttribute("href", "https://github.com/SecPal/frontend");
    expect(
      screen.getByRole("link", { name: "https://github.com/SecPal/api" })
    ).toHaveAttribute("href", "https://github.com/SecPal/api");
    expect(
      screen.getByRole("link", { name: "https://github.com/SecPal/contracts" })
    ).toHaveAttribute("href", "https://github.com/SecPal/contracts");
    expect(
      screen.queryByRole("link", { name: "https://github.com/SecPal/android" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/project license files/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /secpal\/frontend license/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /secpal\/api license/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /secpal\/contracts license/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /secpal\/android license/i })
    ).not.toBeInTheDocument();
  });

  it("keeps the authenticated home surface on canonical theme tokens", async () => {
    await seedPersistedAuthUser({
      id: "42",
      name: "Home User",
      email: "home.user@secpal.dev",
      emailVerified: true,
    });
    window.history.replaceState({}, "", "/");

    await renderWithI18n(<App />);

    const heading = await screen.findByRole("heading", {
      name: /welcome to secpal/i,
    });
    const copy = screen.getByText(
      (_, element) =>
        element?.tagName === "P" &&
        (element.textContent?.includes("A guard") ?? false)
    );

    expect(heading).toHaveClass("text-foreground");
    expect(copy).toHaveClass("text-muted-foreground");
    expect(heading.className).not.toContain("text-zinc-950");
    expect(copy.className).not.toContain("text-zinc-500");
  });

  it("keeps the authenticated about surface on canonical theme tokens", async () => {
    await seedPersistedAuthUser({
      id: "42",
      name: "About User",
      email: "about.user@secpal.dev",
      emailVerified: true,
    });
    window.history.replaceState({}, "", "/about");

    await renderWithI18n(<App />);

    const heading = await screen.findByRole("heading", {
      name: /about secpal/i,
    });
    const copy = screen.getByText(
      /operations software for german private security services/i
    );

    expect(heading).toHaveClass("text-foreground");
    expect(copy).toHaveClass("text-muted-foreground");
    expect(heading.className).not.toContain("text-zinc-950");
    expect(copy.className).not.toContain("text-zinc-500");
  });

  it("preserves the authenticated return route when opening source from app content", async () => {
    window.history.replaceState(
      { usr: { sourceReturnTo: "/customers/new?draft=1#notes" } },
      "",
      "/source"
    );
    await seedPersistedAuthUser({
      id: "42",
      name: "Legal Reader",
      email: "legal.reader@secpal.dev",
      emailVerified: true,
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByRole("heading", { name: /agpl v3\+/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^back$/i })).toHaveAttribute(
      "href",
      "/customers/new?draft=1#notes"
    );
  });

  it("rehydrates browser-session auth on source when no local snapshot exists", async () => {
    window.history.replaceState({}, "", "/source");
    mockGetCurrentUser.mockResolvedValueOnce({
      id: "42",
      name: "Recovered Source Reader",
      email: "source.reader@secpal.dev",
      emailVerified: true,
      permissions: [],
      roles: [],
      hasOrganizationalScopes: false,
      hasCustomerAccess: false,
      hasSiteAccess: false,
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByRole("heading", { name: /agpl v3\+/i })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole("link", { name: /^back$/i })).toHaveAttribute(
      "href",
      "/"
    );
  });

  it("renders the public source route with a trailing slash", async () => {
    window.history.replaceState({}, "", "/source/");
    clearXsrfCookie();

    await renderWithI18n(<App />);

    expect(
      await screen.findByRole("heading", { name: /agpl v3\+/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/source code and license/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "https://github.com/SecPal/frontend" })
    ).toHaveAttribute("href", "https://github.com/SecPal/frontend");
  });

  it("keeps the update prompt mounted on public login routes", async () => {
    await renderWithI18n(<App />);

    expect(screen.getByTestId("update-prompt")).toBeInTheDocument();
  });

  it.each(["/login/", "/source/", "/onboarding/complete/"])(
    "keeps the update prompt mounted on public trailing-slash route %s",
    async (path) => {
      window.history.replaceState({}, "", path);

      if (path.startsWith("/source")) {
        clearXsrfCookie();
      }

      await renderWithI18n(<App />);

      expect(screen.getByTestId("update-prompt")).toBeInTheDocument();
    }
  );

  it.each([
    {
      path: "/onboarding",
      onboardingWorkflowStatus: "changes_requested" as const,
    },
    {
      path: "/onboarding/submitted",
      onboardingWorkflowStatus: "submitted_for_review" as const,
    },
  ])(
    "keeps the update prompt mounted on authenticated onboarding route $path",
    async ({ path, onboardingWorkflowStatus }) => {
      window.history.replaceState({}, "", path);

      await seedPersistedAuthUser({
        id: 1,
        name: "Pre-Contract User",
        email: "new.hire@secpal.dev",
        emailVerified: true,
        employee: {
          id: "employee-1",
          status: "pre_contract",
          onboarding_workflow: {
            status: onboardingWorkflowStatus,
          },
        },
      });

      await renderWithI18n(<App />);

      await waitForPathname(path);

      await screen.findByRole("button", { name: /sign out/i });
      expect(screen.getByTestId("update-prompt")).toBeInTheDocument();
    }
  );

  it("uses a login-shaped bootstrap placeholder on the login route", async () => {
    mockGetCurrentUser.mockImplementationOnce(
      () =>
        new Promise(() => undefined) as ReturnType<typeof mockGetCurrentUser>
    );

    await renderWithI18n(<App />);

    expect(
      screen.getByRole("status", { name: /loading login/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/welcome to secpal/i, { selector: "h1" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: /loading application/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^english$/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeDisabled();
    expect(screen.getByLabelText(/password/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /^log in$/i })).toBeDisabled();
  });

  it("switches to the interactive login form after a short bootstrap delay", async () => {
    vi.useFakeTimers();
    mockGetCurrentUser.mockImplementationOnce(
      () =>
        new Promise(() => undefined) as ReturnType<typeof mockGetCurrentUser>
    );

    try {
      await renderWithI18n(<App />);

      expect(screen.getByLabelText(/email/i)).toBeDisabled();

      await act(async () => {
        vi.advanceTimersByTime(1_000);
        await Promise.resolve();
      });

      expect(screen.getByLabelText(/email/i)).toBeEnabled();
      expect(screen.getByLabelText(/password/i)).toBeEnabled();
      expect(screen.getByRole("button", { name: /^log in$/i })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the vault unlock action disabled while unlock is still pending", async () => {
    vi.useFakeTimers();
    await seedPersistedAuthUser({
      id: 1,
      name: "Locked User",
      email: "locked@secpal.dev",
      emailVerified: true,
    });
    authStorage.lockVault?.();
    mockAuthStorage.unlockVault.mockImplementationOnce(
      () => new Promise(() => undefined)
    );

    try {
      await renderWithI18n(<App />);

      const unlockButton = screen.getByRole("button", { name: /^unlock$/i });

      await act(async () => {
        unlockButton.click();
        await Promise.resolve();
      });

      expect(mockAuthStorage.unlockVault).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: /unlocking/i })).toBeDisabled();

      await act(async () => {
        vi.advanceTimersByTime(1_000);
        await Promise.resolve();
      });

      expect(
        screen.getByRole("heading", {
          name: /unlock your secure offline data/i,
        })
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /unlocking/i })).toBeDisabled();
      expect(mockAuthStorage.unlockVault).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders the vault lock state on protected routes before loading the app shell", async () => {
    await seedPersistedAuthUser({
      id: 1,
      name: "Locked User",
      email: "locked@secpal.dev",
      emailVerified: true,
    });
    authStorage.lockVault?.();
    window.history.replaceState({}, "", "/customers");
    mockLoadAuthenticatedAppModule.mockRejectedValueOnce(
      createRecoverableLazyModuleError(
        "The protected app shell is temporarily unavailable on this device.",
        new TypeError("Failed to fetch dynamically imported module")
      )
    );

    await renderWithI18n(<App />);

    expect(
      screen.getByRole("heading", {
        name: /unlock your secure offline data/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/we couldn't restore your secure session/i)
    ).not.toBeInTheDocument();
    expect(mockLoadAuthenticatedAppModule).not.toHaveBeenCalled();
  });

  it("renders login form", async () => {
    await renderWithI18n(<App />);
    expect(
      screen.queryByText(/Your digital guard companion/i)
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("renders language switcher on login page", async () => {
    await renderWithI18n(<App />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("redirects authenticated users away from the login route", async () => {
    await seedPersistedAuthUser({
      id: 1,
      name: "Active User",
      email: "guard@secpal.dev",
      emailVerified: true,
      employee: {
        id: "employee-1",
        status: "active",
      },
    });

    await renderWithI18n(<App />);

    await waitFor(
      () => {
        expect(window.location.pathname).toBe("/");
      },
      { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
    );

    expect(
      await screen.findByRole(
        "heading",
        { name: /welcome to secpal/i },
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /log in/i })
    ).not.toBeInTheDocument();
  });

  it("shows recovery UI when the protected app shell chunk cannot be loaded and recovers on retry", async () => {
    await seedPersistedAuthUser({
      id: 1,
      name: "Active User",
      email: "guard@secpal.dev",
      emailVerified: true,
    });
    mockLoadAuthenticatedAppModule.mockRejectedValueOnce(
      createRecoverableLazyModuleError(
        "The protected app shell is temporarily unavailable on this device.",
        new TypeError("Failed to fetch dynamically imported module")
      )
    );

    await renderWithI18n(<App />);

    expect(
      await screen.findByRole("heading", {
        name: /still loading your secure session/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByTestId("update-prompt")).toBeInTheDocument();

    mockLoadAuthenticatedAppModule.mockImplementationOnce(
      () => import("./AuthenticatedApp")
    );

    await act(async () => {
      screen.getByRole("button", { name: /retry/i }).click();
      await Promise.resolve();
    });

    expect(
      await screen.findByRole(
        "heading",
        { name: /welcome to secpal/i },
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
  });

  it("redirects browser-session users away from the login route even without a local auth snapshot", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: "1",
      name: "Recovered Session User",
      email: "recovered-session@secpal.dev",
      emailVerified: true,
      roles: [],
      permissions: [],
      hasOrganizationalScopes: false,
      hasCustomerAccess: false,
      hasSiteAccess: false,
    });

    await renderWithI18n(<App />);

    await waitFor(
      () => {
        expect(window.location.pathname).toBe("/");
      },
      { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
    );

    expect(
      await screen.findByRole(
        "heading",
        { name: /welcome to secpal/i },
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /log in/i })
    ).not.toBeInTheDocument();
  });

  it("keeps protected deep links while browser-session bootstrap is still pending", async () => {
    window.history.replaceState({}, "", "/customers/123/edit");
    mockGetCurrentUser.mockImplementationOnce(
      () =>
        new Promise(() => undefined) as ReturnType<typeof mockGetCurrentUser>
    );

    await renderWithI18n(<App />);

    expect(
      screen.getByRole("status", { name: /loading page/i })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/customers/123/edit");
  });

  it("does not probe /v1/me on the public login route when no csrf cookie or redirect hint exists", async () => {
    clearXsrfCookie();

    await renderWithI18n(<App />);

    await waitFor(
      () => {
        expect(screen.getByLabelText(/email/i)).toBeEnabled();
      },
      { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
    );

    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(mockFetchCsrfToken).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/login");
  });

  it("restores a valid browser session on a protected route even when no local auth snapshot is available", async () => {
    window.history.replaceState({}, "", "/");

    mockGetCurrentUser.mockResolvedValueOnce({
      id: "1",
      name: "Recovered Session User",
      email: "recovered-session@secpal.dev",
      emailVerified: true,
      roles: [],
      permissions: [],
      hasOrganizationalScopes: false,
      hasCustomerAccess: false,
      hasSiteAccess: false,
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByRole(
        "heading",
        { name: /welcome to secpal/i },
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("keeps protected routes on a neutral loader while browser-session recovery is pending", async () => {
    window.history.replaceState({}, "", "/");

    mockGetCurrentUser.mockImplementationOnce(
      () =>
        new Promise(() => undefined) as ReturnType<typeof mockGetCurrentUser>
    );

    await renderWithI18n(<App />);

    expect(window.location.pathname).toBe("/");

    expect(
      screen.getByRole("status", { name: /loading page/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("update-prompt")).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: /loading login/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it("redirects protected routes to login when no local auth snapshot or readable csrf cookie exists", async () => {
    window.history.replaceState({}, "", "/");
    clearXsrfCookie();
    mockGetCurrentUser.mockRejectedValueOnce(
      new AuthApiError(
        "Current user fetch failed: Failed to fetch",
        undefined,
        undefined,
        "NETWORK_ERROR"
      )
    );

    await renderWithI18n(<App />);

    await waitForPathname("/login");

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("redirects protected routes to login when bootstrap without a local auth snapshot or readable csrf cookie times out", async () => {
    window.history.replaceState({}, "", "/");
    clearXsrfCookie();
    vi.useFakeTimers();
    const lateUser = {
      id: "1",
      name: "Late Bootstrap User",
      email: "late-bootstrap@secpal.dev",
      emailVerified: true,
      roles: [],
      permissions: [],
      hasOrganizationalScopes: false,
      hasCustomerAccess: false,
      hasSiteAccess: false,
    };
    let resolveCurrentUser: ((value: typeof lateUser) => void) | undefined;
    mockGetCurrentUser.mockImplementationOnce(
      () =>
        new Promise<typeof lateUser>((resolve) => {
          resolveCurrentUser = resolve;
        }) as ReturnType<typeof mockGetCurrentUser>
    );

    try {
      await renderWithI18n(<App />);

      await act(async () => {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await Promise.resolve();
        }
      });

      expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(ROUTE_NAVIGATION_TIMEOUT_MS);
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await Promise.resolve();
        }
      });

      expect(window.location.pathname).toBe("/login");
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
      expect(mockAuthStorage.setUser).not.toHaveBeenCalled();

      await act(async () => {
        resolveCurrentUser?.(lateUser);
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await Promise.resolve();
        }
      });

      expect(window.location.pathname).toBe("/login");
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(mockAuthStorage.setUser).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows bootstrap recovery in place after protected-route session restore fails and allows retry", async () => {
    const recoveredUser = {
      id: "1",
      name: "Recovered Session User",
      email: "recovered-session@secpal.dev",
      emailVerified: true,
      roles: [],
      permissions: [],
      hasOrganizationalScopes: false,
      hasCustomerAccess: false,
      hasSiteAccess: false,
    };

    window.history.replaceState({}, "", "/");
    mockGetCurrentUser
      .mockRejectedValueOnce(
        new AuthApiError(
          "Current user fetch failed: expected application/json response from API",
          undefined,
          404
        )
      )
      .mockResolvedValueOnce(recoveredUser);

    await renderWithI18n(<App />);

    expect(window.location.pathname).toBe("/");

    expect(
      await screen.findByRole("heading", {
        name: /still loading your secure session/i,
      })
    ).toBeInTheDocument();

    await act(async () => {
      screen.getByRole("button", { name: /retry/i }).click();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockGetCurrentUser).toHaveBeenCalledTimes(2);
    });

    await waitFor(
      () => {
        expect(window.location.pathname).toBe("/");
      },
      { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
    );

    expect(
      await screen.findByRole(
        "heading",
        { name: /welcome to secpal/i },
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
  });

  it("keeps protected deep links during bootstrap recovery and retry", async () => {
    window.history.replaceState({}, "", "/customers/new");
    mockGetCurrentUser.mockRejectedValue(
      new AuthApiError(
        "Current user fetch failed: Network down",
        undefined,
        undefined,
        "NETWORK_ERROR"
      )
    );

    await renderWithI18n(<App />);

    expect(
      await screen.findByRole("heading", {
        name: /still loading your secure session/i,
      })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/customers/new");

    await act(async () => {
      mockGetCurrentUser.mockResolvedValueOnce({
        id: "1",
        name: "Recovered Session User",
        email: "recovered-session@secpal.dev",
        emailVerified: true,
        permissions: ["customers.read"],
        roles: [],
        hasOrganizationalScopes: false,
        hasCustomerAccess: false,
        hasSiteAccess: false,
      });
      screen.getByRole("button", { name: /retry/i }).click();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockGetCurrentUser).toHaveBeenCalledTimes(3);
    });

    expect(
      await screen.findByText(
        /Access Denied/i,
        {},
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/customers/new");
  });

  it("keeps stale protected-route bootstrap recovery on the protected route instead of redirecting", async () => {
    window.history.replaceState({}, "", "/");
    mockAuthStorage.hasStoredUser
      .mockImplementationOnce(() => true)
      .mockImplementationOnce(() => true)
      .mockImplementationOnce(() => true);
    mockAuthStorage.getUser.mockResolvedValueOnce(null);
    mockGetCurrentUser.mockRejectedValueOnce(
      new AuthApiError(
        "Current user fetch failed: expected application/json response from API",
        undefined,
        404
      )
    );

    await renderWithI18n(<App />);

    expect(window.location.pathname).toBe("/");

    expect(
      await screen.findByRole("heading", {
        name: /still loading your secure session/i,
      })
    ).toBeInTheDocument();
  });

  it("shows not found for activity-logs when the user cannot discover that feature", async () => {
    window.history.replaceState({}, "", "/activity-logs");

    await seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      permissions: [],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(
        /Page Not Found/i,
        {},
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
  });

  it("shows not found for the legacy organizational-units route when the user lacks organizational access", async () => {
    window.history.replaceState({}, "", "/organizational-units");

    await seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      hasOrganizationalScopes: false,
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(
        /Page Not Found/i,
        {},
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
  });

  it("shows the organization route when the user has organizational scopes", async () => {
    window.history.replaceState({}, "", "/organization");

    await seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      hasOrganizationalScopes: true,
      roles: [],
      permissions: [],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByRole(
        "heading",
        { name: /Organization Structure/i },
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Page Not Found/i)).not.toBeInTheDocument();
  });

  it("shows not found for customer routes when the user cannot discover that feature", async () => {
    window.history.replaceState({}, "", "/customers");

    await seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      permissions: [],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(
        /Page Not Found/i,
        {},
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
  });

  it("shows not found for site routes when the user cannot discover that feature", async () => {
    window.history.replaceState({}, "", "/sites");

    await seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      permissions: [],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(
        /Page Not Found/i,
        {},
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
  });

  it("shows not found for customer-scoped site routes when the user cannot discover that feature", async () => {
    window.history.replaceState({}, "", "/sites/customer/123");

    await seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      permissions: [],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(
        /Page Not Found/i,
        {},
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
  });

  it("shows access denied for known customer action routes when the user lacks create permission", async () => {
    window.history.replaceState({}, "", "/customers/new");

    await seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      permissions: ["customers.read"],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(
        /Access Denied/i,
        {},
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/customers/new");
  });

  it("shows access denied for known customer edit routes when the user lacks update permission", async () => {
    window.history.replaceState({}, "", "/customers/123/edit");

    await seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      permissions: ["customers.read"],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(
        /Access Denied/i,
        {},
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/customers/123/edit");
  });

  it("shows access denied for known site action routes when the user lacks create permission", async () => {
    window.history.replaceState({}, "", "/sites/new");

    await seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      permissions: ["sites.read"],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(
        /Access Denied/i,
        {},
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/sites/new");
  });

  it("shows access denied for known site edit routes when the user lacks update permission", async () => {
    window.history.replaceState({}, "", "/sites/123/edit");

    await seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      permissions: ["sites.read"],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(
        /Access Denied/i,
        {},
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/sites/123/edit");
  });

  it("shows access denied for known employee action routes when the user lacks create permission", async () => {
    window.history.replaceState({}, "", "/employees/create");

    await seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      hasOrganizationalScopes: true,
      permissions: ["employees.read"],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(
        /Access Denied/i,
        {},
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/employees/create");
  });

  it("shows access denied for known employee edit routes when the user lacks update permission", async () => {
    window.history.replaceState({}, "", "/employees/123/edit");

    await seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      hasOrganizationalScopes: true,
      permissions: ["employees.read"],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(
        /Access Denied/i,
        {},
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/employees/123/edit");
  });

  it("renders employee contacts edit route for users with employee update permission", async () => {
    window.history.replaceState({}, "", "/employees/123/edit/contacts");

    await seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      hasOrganizationalScopes: true,
      permissions: ["employees.read", "employees.update"],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByRole(
        "button",
        { name: /back to employee/i },
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/employees/123/edit/contacts");
  });

  it("redirects the legacy organizational-units route to the canonical organization route for authorized users", async () => {
    window.history.replaceState({}, "", "/organizational-units");

    await seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      hasOrganizationalScopes: true,
      permissions: [],
    });

    await renderWithI18n(<App />);

    await waitForPathname("/organization");

    expect(screen.queryByText(/Page Not Found/i)).not.toBeInTheDocument();
  });

  it("redirects pre-contract authenticated users from the app home route to onboarding and shows a clear notice", async () => {
    window.history.replaceState({}, "", "/");

    await seedPersistedAuthUser({
      id: 1,
      name: "Pre-Contract User",
      email: "new.hire@secpal.dev",
      emailVerified: true,
      employee: {
        id: "employee-1",
        status: "pre_contract",
        onboarding_workflow: {
          status: "account_initialized",
        },
      },
    });

    await renderWithI18n(<App />);

    await waitForPathname("/onboarding");
    expect(
      await screen.findByText(
        /your onboarding is not complete yet\. please complete onboarding/i
      )
    ).toBeInTheDocument();
  });

  it.each([
    "/",
    "/profile",
    "/settings",
    "/customers",
    "/sites",
    "/employees",
    "/organization",
    "/activity-logs",
    "/android-provisioning",
  ])(
    "redirects unverified pre-contract users from %s to onboarding before email verification",
    async (path) => {
      window.history.replaceState({}, "", path);

      await seedPersistedAuthUser({
        id: 1,
        name: "Pre-Contract User",
        email: "new.hire@secpal.dev",
        emailVerified: false,
        hasCustomerAccess: true,
        hasOrganizationalScopes: true,
        hasSiteAccess: true,
        permissions: [
          "customers.view",
          "sites.view",
          "employees.view",
          "activity_logs.view",
          "android_provisioning.view",
        ],
        employee: {
          id: "employee-1",
          status: "pre_contract",
          onboarding_workflow: {
            status: "account_initialized",
          },
        },
      });

      await renderWithI18n(<App />);

      await waitFor(
        () => {
          expect(window.location.pathname).toBe("/onboarding");
        },
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      );
    }
  );

  it("preserves the original deep link when snapshot revalidation clears a stale pre-contract redirect", async () => {
    window.history.replaceState({}, "", "/settings");

    await seedPersistedAuthUser({
      id: 1,
      name: "Stale Snapshot User",
      email: "stale.snapshot@secpal.dev",
      emailVerified: false,
      employee: {
        id: "employee-1",
        status: "pre_contract",
        onboarding_workflow: {
          status: "account_initialized",
        },
      },
    });

    mockGetCurrentUser.mockResolvedValue(
      sanitizePersistedAuthUser({
        id: 1,
        name: "Active User",
        email: "guard@secpal.dev",
        emailVerified: true,
        employee: {
          id: "employee-2",
          status: "active",
          onboarding_workflow: {
            status: "active",
          },
        },
      })
    );

    await renderWithI18n(<App />);

    await waitFor(
      () => {
        expect(window.location.pathname).toBe("/settings");
      },
      { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
    );

    expect(
      await screen.findByRole("heading", {
        name: /settings/i,
      })
    ).toBeInTheDocument();
  });

  it("renders onboarding-only routes without the normal application navigation for pre-contract users", async () => {
    window.history.replaceState({}, "", "/onboarding");

    await seedPersistedAuthUser({
      id: 1,
      name: "Pre-Contract User",
      email: "new.hire@secpal.dev",
      emailVerified: true,
      employee: {
        id: "employee-1",
        status: "pre_contract",
        onboarding_workflow: {
          status: "changes_requested",
        },
      },
    });

    await renderWithI18n(<App />);

    await waitForPathname("/onboarding");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /sign out/i })
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("link", { name: /home/i })
    ).not.toBeInTheDocument();
  });

  it("redirects active authenticated users away from onboarding-only routes", async () => {
    window.history.replaceState({}, "", "/onboarding");

    await seedPersistedAuthUser({
      id: 1,
      name: "Active User",
      email: "guard@secpal.dev",
      emailVerified: true,
      employee: {
        id: "employee-2",
        status: "active",
        onboarding_workflow: {
          status: "active",
        },
      },
    });

    await renderWithI18n(<App />);

    await waitFor(
      () => {
        expect(window.location.pathname).toBe("/");
      },
      { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
    );

    expect(
      await screen.findByRole(
        "heading",
        { name: /welcome to secpal/i },
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
  });

  it("redirects native-bridge users to login after a direct bridge logout", async () => {
    window.history.replaceState({}, "", "/");

    const persistedUser = await seedPersistedAuthUser({
      id: 1,
      name: "Native User",
      email: "native@secpal.dev",
      emailVerified: true,
      employee: {
        id: "employee-3",
        status: "active",
      },
    });

    (
      globalThis as {
        SecPalNativeAuthBridge?: {
          login(credentials: {
            email: string;
            password: string;
          }): Promise<unknown>;
          logout(): Promise<void>;
          getCurrentUser(): Promise<unknown>;
        };
      }
    ).SecPalNativeAuthBridge = {
      login: vi.fn(),
      logout: vi.fn(),
      getCurrentUser: vi.fn().mockResolvedValue(persistedUser),
    };

    await renderWithI18n(<App />);

    expect(
      await screen.findByRole(
        "heading",
        { name: /welcome to secpal/i },
        { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
      )
    ).toBeInTheDocument();

    await act(async () => {
      await (
        globalThis as {
          SecPalNativeAuthBridge?: {
            logout(): Promise<void>;
          };
        }
      ).SecPalNativeAuthBridge?.logout();
      await Promise.resolve();
      await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    });

    await waitFor(
      () => {
        expect(window.location.pathname).toBe("/login");
      },
      { timeout: ROUTE_NAVIGATION_TIMEOUT_MS }
    );

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("redirects unauthenticated users from the protected onboarding route to login", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    window.history.replaceState({}, "", "/onboarding");

    await renderWithI18n(<App />);

    await waitForPathname("/login");

    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    });

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(consoleWarn).not.toHaveBeenCalledWith(
      "Failed to clear offline vault tables on logout:",
      expect.anything()
    );
    expect(consoleWarn).not.toHaveBeenCalledWith(
      "Failed to reset analytics state during logout:",
      expect.anything()
    );
  });
});
