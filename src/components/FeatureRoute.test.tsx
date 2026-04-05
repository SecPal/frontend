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
  const capabilities: UserCapabilities = {
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
        confirmOnboarding: true,
        terminate: true,
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");
    vi.mocked(authHook.useAuth).mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      bootstrapRecoveryReason: null,
      user: {
        id: "1",
        name: "User",
        email: "user@secpal.dev",
        emailVerified: false,
      },
      login: vi.fn(),
      logout: vi.fn(),
      retryBootstrap: vi.fn(),
      hasRole: vi.fn(),
      hasPermission: vi.fn(),
      hasOrganizationalAccess: vi.fn(),
    });
    vi.mocked(capabilitiesHook.useUserCapabilities).mockReturnValue(
      capabilities
    );
  });

  it("shows the email verification gate before rendering the feature", () => {
    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/customers"]}>
          <Routes>
            <Route
              path="/customers"
              element={
                <FeatureRoute feature="customers">
                  <div>Customers Content</div>
                </FeatureRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(
      screen.getByRole("heading", { name: /verify your email address/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("Customers Content")).not.toBeInTheDocument();
  });
});
