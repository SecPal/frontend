// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import App from "./App";
import {
  sanitizePersistedAuthUser,
  type PersistedAuthUser,
} from "./services/authState";

const { mockGetCurrentUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
}));

vi.mock("./services/authApi", async () => {
  const actual = await vi.importActual("./services/authApi");
  return {
    ...actual,
    getCurrentUser: mockGetCurrentUser,
  };
});

// Block all real network requests: lazy-loaded page components call their
// data APIs on mount, and those pending fetch Promises accumulate in the
// Node.js event loop, stalling the microtask queue and pushing the auth
// bootstrap past BOOTSTRAP_REVALIDATION_TIMEOUT_MS. Failing immediately
// prevents that backlog without affecting the auth behaviour under test.
// Using spyOn (not stubGlobal) so it is not undone by unstubGlobals: true
// between tests.
vi.spyOn(globalThis, "fetch").mockRejectedValue(
  new TypeError("fetch is not available in App.test.tsx")
);

// Helper to render with I18n and wait for async updates
async function renderWithI18n(component: React.ReactElement) {
  const result = render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
  // Wait for any async state updates to settle
  await waitFor(() => {});
  return result;
}

let seededAuthUser: PersistedAuthUser | null = null;

function seedPersistedAuthUser(user: Record<string, unknown>) {
  const persistedUser = sanitizePersistedAuthUser(user);

  if (!persistedUser) {
    throw new Error("Failed to seed persisted auth user for test");
  }

  seededAuthUser = persistedUser;
  localStorage.setItem("auth_user", JSON.stringify(persistedUser));

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

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    seededAuthUser = null;
    window.history.replaceState({}, "", "/login");
    i18n.load("en", {});
    i18n.activate("en");
    mockGetCurrentUser.mockImplementation(async () => {
      if (!seededAuthUser) {
        throw new Error("No mock auth user available for bootstrap");
      }

      return seededAuthUser;
    });
  });

  it("renders login page when not authenticated", async () => {
    await renderWithI18n(<App />);
    expect(
      screen.getByRole("heading", { name: /SecPal/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Log in/i })
    ).toBeInTheDocument();
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

  it("shows not found for activity-logs when the user cannot discover that feature", async () => {
    window.history.replaceState({}, "", "/activity-logs");

    seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      permissions: [],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(/Page Not Found/i, {}, { timeout: 20000 })
    ).toBeInTheDocument();
  });

  it("shows not found for the legacy organizational-units route when the user lacks organizational access", async () => {
    window.history.replaceState({}, "", "/organizational-units");

    seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      hasOrganizationalScopes: false,
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(/Page Not Found/i, {}, { timeout: 20000 })
    ).toBeInTheDocument();
  });

  it("shows not found for organization routes when the user only has scopes but no elevated feature capability", async () => {
    window.history.replaceState({}, "", "/organization");

    seedPersistedAuthUser({
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
      await screen.findByText(/Page Not Found/i, {}, { timeout: 20000 })
    ).toBeInTheDocument();
  });

  it("shows not found for customer routes when the user cannot discover that feature", async () => {
    window.history.replaceState({}, "", "/customers");

    seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      permissions: [],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(/Page Not Found/i, {}, { timeout: 20000 })
    ).toBeInTheDocument();
  });

  it("shows not found for site routes when the user cannot discover that feature", async () => {
    window.history.replaceState({}, "", "/sites");

    seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      permissions: [],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(/Page Not Found/i, {}, { timeout: 20000 })
    ).toBeInTheDocument();
  });

  it("shows not found for customer-scoped site routes when the user cannot discover that feature", async () => {
    window.history.replaceState({}, "", "/sites/customer/123");

    seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      permissions: [],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(/Page Not Found/i, {}, { timeout: 20000 })
    ).toBeInTheDocument();
  });

  it("shows access denied for known customer action routes when the user lacks create permission", async () => {
    window.history.replaceState({}, "", "/customers/new");

    seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      permissions: ["customers.read"],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(/Access Denied/i, {}, { timeout: 20000 })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/customers/new");
  });

  it("shows access denied for known customer edit routes when the user lacks update permission", async () => {
    window.history.replaceState({}, "", "/customers/123/edit");

    seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      permissions: ["customers.read"],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(/Access Denied/i, {}, { timeout: 20000 })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/customers/123/edit");
  });

  it("shows access denied for known site action routes when the user lacks create permission", async () => {
    window.history.replaceState({}, "", "/sites/new");

    seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      permissions: ["sites.read"],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(/Access Denied/i, {}, { timeout: 20000 })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/sites/new");
  });

  it("shows access denied for known site edit routes when the user lacks update permission", async () => {
    window.history.replaceState({}, "", "/sites/123/edit");

    seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      permissions: ["sites.read"],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(/Access Denied/i, {}, { timeout: 20000 })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/sites/123/edit");
  });

  it("shows access denied for known employee action routes when the user lacks create permission", async () => {
    window.history.replaceState({}, "", "/employees/create");

    seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      hasOrganizationalScopes: true,
      permissions: ["employees.read"],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(/Access Denied/i, {}, { timeout: 20000 })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/employees/create");
  });

  it("shows access denied for known employee edit routes when the user lacks update permission", async () => {
    window.history.replaceState({}, "", "/employees/123/edit");

    seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      hasOrganizationalScopes: true,
      permissions: ["employees.read"],
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(/Access Denied/i, {}, { timeout: 20000 })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/employees/123/edit");
  });

  it("redirects the legacy organizational-units route to the canonical organization route for authorized users", async () => {
    window.history.replaceState({}, "", "/organizational-units");

    seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
      hasOrganizationalScopes: true,
      roles: ["Manager"],
      permissions: [],
    });

    await renderWithI18n(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/organization");
    });

    expect(screen.queryByText(/Page Not Found/i)).not.toBeInTheDocument();
  });

  it("shows a not found state for authenticated users on unknown app routes", async () => {
    window.history.replaceState({}, "", "/dashboard");

    seedPersistedAuthUser({
      id: 1,
      name: "User",
      email: "user@secpal.dev",
      emailVerified: true,
    });

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(/Page Not Found/i, {}, { timeout: 20000 })
    ).toBeInTheDocument();

    expect(window.location.pathname).toBe("/dashboard");
  });

  it("redirects pre-contract authenticated users from the app home route to onboarding", async () => {
    window.history.replaceState({}, "", "/");

    seedPersistedAuthUser({
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

    await waitFor(() => {
      expect(window.location.pathname).toBe("/onboarding");
    });
  });

  it("renders onboarding-only routes without the normal application navigation for pre-contract users", async () => {
    window.history.replaceState({}, "", "/onboarding");

    seedPersistedAuthUser({
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

    await waitFor(() => {
      expect(window.location.pathname).toBe("/onboarding");
    });

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

    seedPersistedAuthUser({
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
      { timeout: 20000 }
    );

    expect(
      await screen.findByRole(
        "heading",
        { name: /welcome to secpal/i },
        { timeout: 20000 }
      )
    ).toBeInTheDocument();
  });

  it("redirects unauthenticated users from the protected onboarding route to login", async () => {
    window.history.replaceState({}, "", "/onboarding");

    await renderWithI18n(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/login");
    });

    expect(
      screen.getByRole("heading", { name: /log in/i })
    ).toBeInTheDocument();
  });
});
