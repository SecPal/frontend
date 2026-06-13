// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor as waitForTestingLibrary,
} from "@testing-library/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ProtectedRoute } from "./ProtectedRoute";
import {
  AuthProvider,
  BOOTSTRAP_REVALIDATION_TIMEOUT_MS,
} from "../contexts/AuthContext";
import { AuthApiError } from "../services/authApi";
import { sanitizePersistedAuthUser } from "../services/authState";
import { authStorage } from "../services/storage";
import { db } from "../lib/db";
import { clearOfflineVaultSession } from "../lib/offlineVault";
import { useAuth } from "../hooks/useAuth";

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

const TestComponent = () => <div>Protected Content</div>;
const LockingTestComponent = () => {
  const auth = useAuth();

  return (
    <div>
      <button onClick={() => auth.lock?.()} type="button">
        Lock vault now
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
    clearOfflineVaultSession();
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

  it("renders revalidatingFallback during snapshot revalidation when a verified user is persisted", async () => {
    mockGetCurrentUser.mockReturnValueOnce(new Promise(() => undefined));

    await persistAuthUser({
      id: 1,
      name: "Test",
      email: "test@secpal.dev",
      emailVerified: true,
    });

    render(
      <BrowserRouter>
        <I18nProvider i18n={i18n}>
          <AuthProvider>
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
          </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Revalidating fallback")).toBeInTheDocument();
    });
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("still gates the email verification screen during revalidation when the persisted snapshot is unverified", async () => {
    mockGetCurrentUser.mockReturnValueOnce(new Promise(() => undefined));

    await persistAuthUser(unverifiedUser);

    render(
      <BrowserRouter>
        <I18nProvider i18n={i18n}>
          <AuthProvider>
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
          </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    );

    expect(
      await screen.findByRole(
        "heading",
        { name: /verify your email address/i },
        { timeout: AUTH_ROUTE_TIMEOUT_MS }
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("Revalidating fallback")).not.toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
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
        screen.getByRole("status", { name: /loading application/i })
      ).toBeInTheDocument();
    });

    it("loading state has aria-live=polite", () => {
      mockGetCurrentUser.mockReturnValueOnce(new Promise(() => undefined));
      renderProtectedRoute();

      expect(
        screen.getByRole("status", { name: /loading application/i })
      ).toHaveAttribute("aria-live", "polite");
    });

    it("loading state has a stable accessible name", () => {
      mockGetCurrentUser.mockReturnValueOnce(new Promise(() => undefined));
      renderProtectedRoute();

      expect(
        screen.getByRole("status", { name: /loading application/i })
      ).toHaveAccessibleName("Loading application");
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
