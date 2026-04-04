// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { FeatureRoute } from "./FeatureRoute";
import * as authHook from "../hooks/useAuth";
import * as capabilitiesHook from "../hooks/useUserCapabilities";
import type { UserCapabilities } from "../lib/capabilities";

vi.mock("../hooks/useAuth");
vi.mock("../hooks/useUserCapabilities");

describe("FeatureRoute", () => {
  const baseCapabilities: UserCapabilities = {
    home: true,
    profile: true,
    settings: true,
    organization: true,
    customers: true,
    sites: true,
    employees: true,
    activityLogs: true,
    actions: {
      customers: { create: true, update: true, delete: true },
      sites: { create: true, update: true, delete: true },
      employees: {
        create: true,
        update: true,
        delete: true,
        activate: true,
        terminate: true,
      },
    },
  };

  function mockAuth(
    overrides: Partial<ReturnType<typeof authHook.useAuth>> = {}
  ) {
    vi.mocked(authHook.useAuth).mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
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
      hasRole: vi.fn(),
      hasPermission: vi.fn(),
      hasOrganizationalAccess: vi.fn(),
      ...overrides,
    });
  }

  function mockCapabilities(overrides: Partial<UserCapabilities> = {}) {
    vi.mocked(capabilitiesHook.useUserCapabilities).mockReturnValue({
      ...baseCapabilities,
      ...overrides,
      actions: {
        ...baseCapabilities.actions,
        ...overrides.actions,
      },
    });
  }

  function renderFeatureRoute(element?: React.ReactNode) {
    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/customers"]}>
          <Routes>
            <Route
              path="/customers"
              element={
                <FeatureRoute
                  feature="customers"
                  fallbackPath="/fallback"
                  missingFeatureElement={<div>Missing Feature</div>}
                  deniedActionElement={<div>Action Denied</div>}
                  requiredAction={(capabilities) =>
                    capabilities.actions.customers.create
                  }
                >
                  <div>Customers Content</div>
                </FeatureRoute>
              }
            />
            <Route path="/fallback" element={<div>Fallback Page</div>} />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    if (element) {
      expect(screen.getByText(element as string)).toBeInTheDocument();
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders the dedicated email verification gate before feature checks", () => {
    mockAuth({
      user: {
        id: "1",
        name: "User",
        email: "user@secpal.dev",
        emailVerified: false,
      },
    });
    mockCapabilities();

    renderFeatureRoute();

    expect(
      screen.getByRole("heading", { name: /verify your email address/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("Customers Content")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated users to login", () => {
    mockAuth({ isAuthenticated: false, user: null });
    mockCapabilities();

    renderFeatureRoute();

    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("redirects to the fallback path when the feature is unavailable", () => {
    mockAuth();
    mockCapabilities({ customers: false });

    renderFeatureRoute();

    expect(screen.getByText("Fallback Page")).toBeInTheDocument();
  });

  it("renders the denied action element when the action capability is missing", () => {
    mockAuth();
    mockCapabilities({
      actions: {
        ...baseCapabilities.actions,
        customers: { create: false, update: true, delete: true },
      },
    });

    renderFeatureRoute();

    expect(screen.getByText("Action Denied")).toBeInTheDocument();
  });

  it("renders children when the feature and action are allowed", () => {
    mockAuth();
    mockCapabilities();

    renderFeatureRoute();

    expect(screen.getByText("Customers Content")).toBeInTheDocument();
  });
});
