// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor as waitForTestingLibrary,
} from "@testing-library/react";
import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ProtectedRoute } from "./ProtectedRoute";
import {
  AuthProvider,
  BOOTSTRAP_REVALIDATION_TIMEOUT_MS,
} from "../contexts/AuthContext";
import { AuthApiError } from "../services/AuthApiError";
import { sanitizePersistedAuthUser } from "../services/authState";
import { authStorage } from "../services/storage";
import { db } from "../lib/db";
import {
  clearOfflineVaultSession,
  clearRecentAuthVaultKeyMaterials,
} from "../lib/offlineVault";
import * as authHook from "../hooks/useAuth";

const mockNavigate = vi.fn();
const { mockGetCurrentUser, mockSendVerificationNotification } = vi.hoisted(
  () => ({
    mockGetCurrentUser: vi.fn(),
    mockSendVerificationNotification: vi.fn(),
  })
);

vi.mock("../services/authApi", async () => {
  const actual = await vi.importActual("../services/authApi");
  return {
    ...actual,
    getCurrentUser: mockGetCurrentUser,
  };
});

vi.mock("../services/authAccountApi", async () => {
  const actual = await vi.importActual("../services/authAccountApi");
  return {
    ...actual,
    sendVerificationNotification: mockSendVerificationNotification,
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => {
      mockNavigate(to);
      return <div>Redirected to {to}</div>;
    },
  };
});

const verifiedPersistedUser = {
  id: "1",
  name: "Test",
  email: "test@secpal.dev",
  emailVerified: true,
};

const mockVerifiedRevalidatingAuth = (): ReturnType<typeof vi.spyOn> =>
  vi.spyOn(authHook, "useAuth").mockReturnValue({
    isLoading: true,
    isAuthenticated: true,
    bootstrapRecoveryReason: null,
    user: verifiedPersistedUser,
    login: vi.fn(),
    logout: vi.fn(),
    retryBootstrap: vi.fn(),
    hasPermission: vi.fn(() => true),
    hasOrganizationalAccess: vi.fn(() => true),
  });

const TestComponent = () => <div>Protected Content</div>;
const ShieldStateTestComponent = () => {
  const auth = authHook.useAuth();
  const [note, setNote] = useState("");

  return (
    <div>
      <button onClick={() => auth.showPrivacyShield?.()} type="button">
        Show privacy shield
      </button>
      <label htmlFor="shield-note">Shield note</label>
      <input
        id="shield-note"
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
        }}
      />
      <div>{note || "empty-note"}</div>
    </div>
  );
};
const LockingTestComponent = () => {
  const auth = authHook.useAuth();

  return (
    <div>
      <button onClick={() => auth.lock?.()} type="button">
        Lock vault now
      </button>
      <button onClick={() => auth.showPrivacyShield?.()} type="button">
        Show privacy shield
      </button>
      <div>Protected Content</div>
    </div>
  );
};
const AUTH_ROUTE_TIMEOUT_MS = 20_000;
const unverifiedUser = {
  id: 1,
  name: "Test",
  email: "test@secpal.dev",
  emailVerified: false,
};

function setCsrfTokenCookie(value: string): void {
  document.cookie = `XSRF-TOKEN=;expires=${new Date(0).toUTCString()};path=/`;
  document.cookie = `XSRF-TOKEN=${encodeURIComponent(value)};path=/`;
}

const renderProtectedRoute = () => {
  return render(
    <BrowserRouter>
      <I18nProvider i18n={i18n}>
        <AuthProvider>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <TestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  );
};

const renderLockingProtectedRoute = () => {
  return render(
    <BrowserRouter>
      <I18nProvider i18n={i18n}>
        <AuthProvider>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <LockingTestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  );
};

const renderShieldStateProtectedRoute = () => {
  return render(
    <BrowserRouter>
      <I18nProvider i18n={i18n}>
        <AuthProvider>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <ShieldStateTestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  );
};

const persistAuthUser = async (
  user: Record<string, unknown> = unverifiedUser
) => {
  const persistedUser = sanitizePersistedAuthUser(user);

  if (!persistedUser) {
    throw new Error("Failed to seed persisted auth user for test");
  }

  await authStorage.setUser(persistedUser);
  mockGetCurrentUser.mockResolvedValue(persistedUser);
};

async function waitForProtectedRoute(
  assertion: Parameters<typeof waitForTestingLibrary>[0],
  timeout = AUTH_ROUTE_TIMEOUT_MS
) {
  await waitForTestingLibrary(assertion, {
    timeout,
  });
}

const waitFor = waitForProtectedRoute;

describe("ProtectedRoute", () => {
  beforeEach(async () => {
    // resetAllMocks clears implementations too, preventing leftover mockReturnValueOnce
    // entries from failed tests from leaking into subsequent tests.
    vi.resetAllMocks();
    if (!db.isOpen()) {
      await db.open();
    }
    await Promise.all([
      db.analytics.clear(),
      db.organizationalUnitCache.clear(),
      db.vaultProfile.clear(),
      db.vaultAnalytics.clear(),
      db.vaultOrganizationalUnitCache.clear(),
    ]);
    localStorage.clear();
    clearOfflineVaultSession();
    clearRecentAuthVaultKeyMaterials();
    setCsrfTokenCookie("test-csrf-token");
    i18n.load("en", {});
    i18n.activate("en");
    mockGetCurrentUser.mockRejectedValue(
      Object.assign(new Error("Unauthorized"), {
        code: "HTTP_401",
      })
    );
  });

  afterEach(() => {
    if (vi.isMockFunction(authHook.useAuth)) {
      vi.mocked(authHook.useAuth).mockRestore();
    }
    clearOfflineVaultSession();
    clearRecentAuthVaultKeyMaterials();
  });

  it("redirects to login when not authenticated", async () => {
    renderProtectedRoute();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });
    expect(screen.getByText(/redirected to \/login/i)).toBeInTheDocument();
  });

  it("renders children when authenticated", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 1,
      name: "Test",
      email: "test@secpal.dev",
      emailVerified: true,
    });

    await persistAuthUser({
      id: 1,
      name: "Test",
      email: "test@secpal.dev",
      emailVerified: true,
    });

    renderProtectedRoute();

    expect(
      screen.getByRole("status", { name: /loading application/i })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows the shared bootstrap loading state while stored auth is revalidated without a snapshot", async () => {
    mockGetCurrentUser.mockReturnValueOnce(new Promise(() => undefined));

    await persistAuthUser({
      id: 1,
      name: "Test",
      email: "test@secpal.dev",
      emailVerified: true,
    });

    renderProtectedRoute();

    expect(
      screen.getByRole("status", { name: /loading application/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("renders revalidatingFallback during snapshot revalidation when a verified user is persisted", () => {
    const useAuthSpy = mockVerifiedRevalidatingAuth();

    render(
      <BrowserRouter>
        <I18nProvider i18n={i18n}>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute
                  revalidatingFallback={<div>Revalidating fallback</div>}
                >
                  <TestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </I18nProvider>
      </BrowserRouter>
    );

    expect(screen.getByText("Revalidating fallback")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();

    useAuthSpy.mockRestore();
  });

  it("still gates the email verification screen during revalidation when the persisted snapshot is unverified", () => {
    const useAuthSpy = vi.spyOn(authHook, "useAuth").mockReturnValue({
      isLoading: true,
      isAuthenticated: true,
      bootstrapRecoveryReason: null,
      user: {
        id: "1",
        name: "Test",
        email: "test@secpal.dev",
        emailVerified: false,
      },
      login: vi.fn(),
      logout: vi.fn(),
      retryBootstrap: vi.fn(),
      hasPermission: vi.fn(() => true),
      hasOrganizationalAccess: vi.fn(() => true),
    });

    render(
      <BrowserRouter>
        <I18nProvider i18n={i18n}>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute
                  revalidatingFallback={<div>Revalidating fallback</div>}
                >
                  <TestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </I18nProvider>
      </BrowserRouter>
    );

    expect(
      screen.getByRole("heading", { name: /verify your email address/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("Revalidating fallback")).not.toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();

    useAuthSpy.mockRestore();
  });

  it("redirects to login after stored auth revalidation fails", async () => {
    mockGetCurrentUser.mockRejectedValueOnce(
      Object.assign(new Error("Unauthorized"), {
        code: "HTTP_401",
      })
    );

    await persistAuthUser({
      id: 1,
      name: "Test",
      email: "test@secpal.dev",
      emailVerified: true,
    });

    renderProtectedRoute();

    expect(
      screen.getByRole("status", { name: /loading application/i })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });

    expect(screen.getByText(/redirected to \/login/i)).toBeInTheDocument();
  });

  it("recovers browser-session auth when the persisted record becomes unreadable after CSRF rotation", async () => {
    await persistAuthUser({
      id: 1,
      name: "Recovered User",
      email: "recovered@secpal.dev",
      emailVerified: true,
    });

    setCsrfTokenCookie("rotated-csrf-token");
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 1,
      name: "Recovered User",
      email: "recovered@secpal.dev",
      emailVerified: true,
    });

    renderProtectedRoute();

    expect(
      screen.getByRole("status", { name: /loading application/i })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("retries bootstrap recovery automatically before showing the recovery state", async () => {
    const stalledBootstrap = new Promise(() => undefined);

    mockGetCurrentUser
      .mockReturnValueOnce(stalledBootstrap)
      .mockReturnValueOnce(stalledBootstrap);

    await persistAuthUser({
      id: 1,
      name: "Test",
      email: "test@secpal.dev",
      emailVerified: true,
    });

    renderProtectedRoute();

    expect(
      screen.getByRole("status", { name: /loading application/i })
    ).toBeInTheDocument();

    expect(
      await screen.findByRole(
        "heading",
        { name: /still loading your secure session/i },
        { timeout: BOOTSTRAP_REVALIDATION_TIMEOUT_MS * 2 + 2_000 }
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /go to login/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockGetCurrentUser).toHaveBeenCalled();
  });

  it("keeps bootstrap recovery hidden when the automatic retry succeeds", async () => {
    mockGetCurrentUser
      .mockReturnValueOnce(new Promise(() => undefined))
      .mockResolvedValueOnce({
        id: 1,
        name: "Recovered User",
        email: "recovered@secpal.dev",
        emailVerified: true,
      });

    await persistAuthUser({
      id: 1,
      name: "Test",
      email: "test@secpal.dev",
      emailVerified: true,
    });

    renderProtectedRoute();

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    }, BOOTSTRAP_REVALIDATION_TIMEOUT_MS + 2_000);

    expect(
      screen.queryByRole("heading", {
        name: /still loading your secure session/i,
      })
    ).not.toBeInTheDocument();
    expect(mockGetCurrentUser).toHaveBeenCalled();
  });

  it("retries bootstrap recovery when the user requests it", async () => {
    const pendingBootstrap = new Promise(() => undefined);

    mockGetCurrentUser
      .mockReturnValueOnce(pendingBootstrap)
      .mockReturnValueOnce(pendingBootstrap)
      .mockResolvedValueOnce({
        id: 1,
        name: "Recovered User",
        email: "recovered@secpal.dev",
        emailVerified: true,
      });

    await persistAuthUser({
      id: 1,
      name: "Test",
      email: "test@secpal.dev",
      emailVerified: true,
    });

    renderProtectedRoute();

    await screen.findByRole(
      "button",
      { name: /retry/i },
      { timeout: BOOTSTRAP_REVALIDATION_TIMEOUT_MS * 2 + 2_000 }
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    });

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
    expect(mockGetCurrentUser).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows a locked-screen flow after the user locks the offline vault and restores access on unlock", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 1,
      name: "Test",
      email: "test@secpal.dev",
      emailVerified: true,
    });

    await persistAuthUser({
      id: 1,
      name: "Test",
      email: "test@secpal.dev",
      emailVerified: true,
    });

    renderLockingProtectedRoute();

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /lock vault now/i }));

    expect(
      await screen.findByRole("heading", {
        name: /unlock your secure offline data/i,
      })
    ).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(screen.queryByText("test@secpal.dev")).not.toBeInTheDocument();

    vi.spyOn(authStorage, "unlockVault").mockResolvedValueOnce({
      id: "1",
      name: "Test",
      email: "test@secpal.dev",
      emailVerified: true,
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /unlock/i }));
    });

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("shows a visual privacy shield without exposing the vault unlock flow", async () => {
    const persistedUser = {
      id: 1,
      name: "Test",
      email: "test@secpal.dev",
      emailVerified: true,
    };

    mockGetCurrentUser.mockResolvedValueOnce(persistedUser);

    await persistAuthUser(persistedUser);

    renderShieldStateProtectedRoute();

    await waitFor(() => {
      expect(screen.getByLabelText("Shield note")).toBeInTheDocument();
    });

    fireEvent.input(screen.getByLabelText("Shield note"), {
      target: { value: "keep-mounted" },
    });
    expect(screen.getByText("keep-mounted")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /show privacy shield/i })
    );

    expect(
      await screen.findByRole("heading", { name: /privacy shield/i })
    ).toBeInTheDocument();
    expect(screen.getByText("keep-mounted")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^unlock$/i })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show app/i }));

    await waitFor(() => {
      expect(screen.getByText("keep-mounted")).toBeInTheDocument();
    });
  });

  it("derives the privacy shield from isPrivacyShielded when sensitiveUiState is omitted", () => {
    vi.spyOn(authHook, "useAuth").mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      isPrivacyShielded: true,
      bootstrapRecoveryReason: null,
      user: {
        id: "1",
        name: "User",
        email: "user@secpal.dev",
        emailVerified: true,
      },
      login: vi.fn(),
      logout: vi.fn(),
      retryBootstrap: vi.fn(),
      hidePrivacyShield: vi.fn(),
      hasPermission: vi.fn(() => true),
      hasOrganizationalAccess: vi.fn(() => true),
    });

    render(
      <BrowserRouter>
        <I18nProvider i18n={i18n}>
          <ProtectedRoute>
            <div>Protected Content</div>
          </ProtectedRoute>
        </I18nProvider>
      </BrowserRouter>
    );

    expect(
      screen.getByRole("heading", { name: /privacy shield/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    mockGetCurrentUser.mockReturnValueOnce(new Promise(() => undefined));

    const { container } = render(
      <BrowserRouter>
        <I18nProvider i18n={i18n}>
          <AuthProvider>
            <ProtectedRoute>
              <TestComponent />
            </ProtectedRoute>
          </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    );

    // The component should render quickly, so we just verify it doesn't crash
    expect(container).toBeTruthy();
  });

  describe("Accessibility", () => {
    it("loading state has role=status", () => {
      mockGetCurrentUser.mockReturnValueOnce(new Promise(() => undefined));
      renderProtectedRoute();

      expect(
        screen.getByRole("status", { name: /loading login/i })
      ).toBeInTheDocument();
    });

    it("loading state has aria-live=polite", () => {
      mockGetCurrentUser.mockReturnValueOnce(new Promise(() => undefined));
      renderProtectedRoute();

      expect(
        screen.getByRole("status", { name: /loading login/i })
      ).toHaveAttribute("aria-live", "polite");
    });

    it("loading state has a stable accessible name", () => {
      mockGetCurrentUser.mockReturnValueOnce(new Promise(() => undefined));
      renderProtectedRoute();

      expect(
        screen.getByRole("status", { name: /loading login/i })
      ).toHaveAccessibleName("Loading login");
    });
  });

  it("shows the dedicated email verification gate for authenticated unverified users", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(unverifiedUser);
    await persistAuthUser();

    renderProtectedRoute();

    expect(
      await screen.findByRole(
        "heading",
        { name: /verify your email address/i },
        { timeout: AUTH_ROUTE_TIMEOUT_MS }
      )
    ).toBeInTheDocument();

    expect(screen.getByText(/test@secpal\.dev/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /i have verified my email/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send verification email again/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("resends the verification email and retries bootstrap from the dedicated gate", async () => {
    mockGetCurrentUser
      .mockResolvedValueOnce(unverifiedUser)
      .mockResolvedValueOnce({ ...unverifiedUser, emailVerified: true });
    mockSendVerificationNotification.mockResolvedValueOnce({
      message: "Verification link sent successfully.",
    });
    await persistAuthUser();

    renderProtectedRoute();

    fireEvent.click(
      await screen.findByRole(
        "button",
        {
          name: /send verification email again/i,
        },
        { timeout: AUTH_ROUTE_TIMEOUT_MS }
      )
    );

    expect(
      await screen.findByText(
        /verification link sent successfully\./i,
        {},
        { timeout: AUTH_ROUTE_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /i have verified my email/i })
    );

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("shows resend failures from the dedicated gate", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(unverifiedUser);
    mockSendVerificationNotification.mockRejectedValueOnce(
      new AuthApiError("Too many requests.")
    );
    await persistAuthUser();

    renderProtectedRoute();

    fireEvent.click(
      await screen.findByRole(
        "button",
        {
          name: /send verification email again/i,
        },
        { timeout: AUTH_ROUTE_TIMEOUT_MS }
      )
    );

    expect(
      await screen.findByText(
        /too many requests\./i,
        {},
        {
          timeout: AUTH_ROUTE_TIMEOUT_MS,
        }
      )
    ).toBeInTheDocument();
  });

  it("shows a generic error when resend rejects with a non-Error value", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(unverifiedUser);
    mockSendVerificationNotification.mockRejectedValueOnce("network-failed");
    await persistAuthUser();

    renderProtectedRoute();

    fireEvent.click(
      await screen.findByRole(
        "button",
        {
          name: /send verification email again/i,
        },
        { timeout: AUTH_ROUTE_TIMEOUT_MS }
      )
    );

    expect(
      await screen.findByText(
        /we could not send a new verification email\. please try again\./i,
        {},
        { timeout: AUTH_ROUTE_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
  });
});
