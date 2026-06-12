// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { lazy } from "react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import { ApplicationLayout } from "./components/application-layout";
import { AuthProvider } from "./contexts/AuthContext";
import { messages as enMessages } from "./locales/en/messages.mjs";
import { sanitizePersistedAuthUser } from "./services/authState";
import { authStorage } from "./services/storage";

const { mockGetCurrentUser, mockFetchCsrfToken, profileGate } = vi.hoisted(
  () => {
    let resolveProfileModule: () => void = () => {};
    let profileModulePromise = Promise.resolve();

    return {
      mockGetCurrentUser: vi.fn(),
      mockFetchCsrfToken: vi.fn(),
      profileGate: {
        reset() {
          profileModulePromise = new Promise<void>((resolve) => {
            resolveProfileModule = resolve;
          });
        },
        resolve() {
          resolveProfileModule();
        },
        get promise() {
          return profileModulePromise;
        },
      },
    };
  }
);

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

const LazyProfileRoute = lazy(async () => {
  await profileGate.promise;

  return {
    default: function MockProfilePage() {
      return <h1>Profile loaded</h1>;
    },
  };
});

function AuthenticatedRouteTransitionHarness() {
  return (
    <MemoryRouter initialEntries={["/"]}>
      <I18nProvider i18n={i18n}>
        <AuthProvider>
          <Routes>
            <Route
              path="/"
              element={
                <ApplicationLayout>
                  <h1>Home route</h1>
                  <Link to="/profile">Profile route</Link>
                </ApplicationLayout>
              }
            />
            <Route
              path="/profile"
              element={
                <ApplicationLayout>
                  <LazyProfileRoute />
                </ApplicationLayout>
              }
            />
          </Routes>
        </AuthProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

vi.spyOn(globalThis, "fetch").mockRejectedValue(
  new TypeError("fetch is not available in app-shell-loading.test.tsx")
);

function setXsrfCookie(token = "test-xsrf-token"): void {
  document.cookie = `XSRF-TOKEN=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
}

async function seedPersistedAuthUser() {
  const persistedUser = sanitizePersistedAuthUser({
    id: 1,
    name: "Shell User",
    email: "shell@secpal.dev",
    emailVerified: true,
    roles: [],
    permissions: [],
    hasOrganizationalScopes: false,
    hasCustomerAccess: false,
    hasSiteAccess: false,
  });

  if (!persistedUser) {
    throw new Error("Failed to seed persisted auth user for shell test");
  }

  setXsrfCookie();
  await authStorage.setUser(persistedUser);

  return persistedUser;
}

async function renderWithI18n() {
  let result!: ReturnType<typeof render>;

  await act(async () => {
    result = render(
      <I18nProvider i18n={i18n}>
        <App />
      </I18nProvider>
    );
    await Promise.resolve();
  });

  return result;
}

describe("authenticated app shell loading behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, "", "/");
    i18n.load("en", enMessages);
    i18n.activate("en");
    mockFetchCsrfToken.mockResolvedValue(undefined);
    profileGate.reset();
  });

  it("keeps the authenticated shell visible during startup revalidation", async () => {
    await seedPersistedAuthUser();
    mockGetCurrentUser.mockImplementation(() => new Promise(() => {}));

    await renderWithI18n();

    expect(
      await screen.findByRole("button", { name: /user menu/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText("Home").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("status", { name: /loading page/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("keeps the shell mounted while navigating to an authenticated lazy route", async () => {
    const persistedUser = await seedPersistedAuthUser();
    mockGetCurrentUser.mockResolvedValue(persistedUser);

    render(<AuthenticatedRouteTransitionHarness />);

    expect(
      await screen.findByRole("heading", { name: /home route/i })
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: /profile route/i }));

    expect(
      await screen.findByRole("button", { name: /user menu/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText("Home").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("status", { name: /loading application/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();

    const contentFallback = screen.queryByRole("status", {
      name: /loading page/i,
    });
    const previousContent = screen.queryByRole("heading", {
      name: /home route/i,
    });
    expect(contentFallback ?? previousContent).not.toBeNull();

    await act(async () => {
      profileGate.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /profile loaded/i })
      ).toBeInTheDocument();
    });
  });
});
