// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { AppAccessRoute, OnboardingOnlyRoute } from "./OnboardingAccessRoute";
import * as authHook from "../hooks/useAuth";

vi.mock("../hooks/useAuth");
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");

  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div>Redirected to {to}</div>,
  };
});

function renderWithProviders(component: React.ReactNode) {
  return render(
    <MemoryRouter>
      <I18nProvider i18n={i18n}>{component}</I18nProvider>
    </MemoryRouter>
  );
}

describe("OnboardingAccessRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("redirects pre-contract users away from normal app routes", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      user: {
        id: "1",
        name: "Pre-Contract User",
        email: "new.hire@secpal.dev",
        emailVerified: true,
        employee: {
          id: "employee-1",
          employee_number: "EMP-001",
          first_name: "New",
          last_name: "Hire",
          full_name: "New Hire",
          email: "new.hire@secpal.dev",
          date_of_birth: null,
          contract_start_date: null,
          status: "pre_contract",
          contract_type: "full_time",
          organizational_unit: null,
          management_level: 0,
          created_at: "2026-04-06T00:00:00Z",
          updated_at: "2026-04-06T00:00:00Z",
          onboarding_workflow: {
            status: "account_initialized",
          },
        },
      },
      isAuthenticated: true,
      isLoading: false,
      bootstrapRecoveryReason: null,
      login: vi.fn(),
      logout: vi.fn(),
      retryBootstrap: vi.fn(),
      hasRole: vi.fn(),
      hasPermission: vi.fn(),
      hasOrganizationalAccess: vi.fn(),
    });

    renderWithProviders(
      <AppAccessRoute>
        <div>Protected App Content</div>
      </AppAccessRoute>
    );

    expect(screen.getByText("Redirected to /onboarding")).toBeInTheDocument();
    expect(screen.queryByText("Protected App Content")).not.toBeInTheDocument();
  });

  it("renders normal app content for non pre-contract users", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      user: {
        id: "1",
        name: "Active User",
        email: "guard@secpal.dev",
        emailVerified: true,
        employee: {
          id: "employee-2",
          employee_number: "EMP-002",
          first_name: "Active",
          last_name: "User",
          full_name: "Active User",
          email: "guard@secpal.dev",
          date_of_birth: null,
          contract_start_date: null,
          status: "active",
          contract_type: "full_time",
          organizational_unit: null,
          management_level: 0,
          created_at: "2026-04-06T00:00:00Z",
          updated_at: "2026-04-06T00:00:00Z",
          onboarding_workflow: {
            status: "active",
          },
        },
      },
      isAuthenticated: true,
      isLoading: false,
      bootstrapRecoveryReason: null,
      login: vi.fn(),
      logout: vi.fn(),
      retryBootstrap: vi.fn(),
      hasRole: vi.fn(),
      hasPermission: vi.fn(),
      hasOrganizationalAccess: vi.fn(),
    });

    renderWithProviders(
      <AppAccessRoute>
        <div>Protected App Content</div>
      </AppAccessRoute>
    );

    expect(screen.getByText("Protected App Content")).toBeInTheDocument();
  });

  it("renders onboarding content for pre-contract users", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      user: {
        id: "1",
        name: "Pre-Contract User",
        email: "new.hire@secpal.dev",
        emailVerified: true,
        employee: {
          id: "employee-1",
          employee_number: "EMP-001",
          first_name: "New",
          last_name: "Hire",
          full_name: "New Hire",
          email: "new.hire@secpal.dev",
          date_of_birth: null,
          contract_start_date: null,
          status: "pre_contract",
          contract_type: "full_time",
          organizational_unit: null,
          management_level: 0,
          created_at: "2026-04-06T00:00:00Z",
          updated_at: "2026-04-06T00:00:00Z",
          onboarding_workflow: {
            status: "changes_requested",
          },
        },
      },
      isAuthenticated: true,
      isLoading: false,
      bootstrapRecoveryReason: null,
      login: vi.fn(),
      logout: vi.fn(),
      retryBootstrap: vi.fn(),
      hasRole: vi.fn(),
      hasPermission: vi.fn(),
      hasOrganizationalAccess: vi.fn(),
    });

    renderWithProviders(
      <OnboardingOnlyRoute>
        <div>Onboarding Content</div>
      </OnboardingOnlyRoute>
    );

    expect(screen.getByText("Onboarding Content")).toBeInTheDocument();
  });

  it("redirects non pre-contract users away from onboarding-only routes", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      user: {
        id: "1",
        name: "Active User",
        email: "guard@secpal.dev",
        emailVerified: true,
        employee: {
          id: "employee-2",
          employee_number: "EMP-002",
          first_name: "Active",
          last_name: "User",
          full_name: "Active User",
          email: "guard@secpal.dev",
          date_of_birth: null,
          contract_start_date: null,
          status: "active",
          contract_type: "full_time",
          organizational_unit: null,
          management_level: 0,
          created_at: "2026-04-06T00:00:00Z",
          updated_at: "2026-04-06T00:00:00Z",
          onboarding_workflow: {
            status: "active",
          },
        },
      },
      isAuthenticated: true,
      isLoading: false,
      bootstrapRecoveryReason: null,
      login: vi.fn(),
      logout: vi.fn(),
      retryBootstrap: vi.fn(),
      hasRole: vi.fn(),
      hasPermission: vi.fn(),
      hasOrganizationalAccess: vi.fn(),
    });

    renderWithProviders(
      <OnboardingOnlyRoute>
        <div>Onboarding Content</div>
      </OnboardingOnlyRoute>
    );

    expect(screen.getByText("Redirected to /")).toBeInTheDocument();
    expect(screen.queryByText("Onboarding Content")).not.toBeInTheDocument();
  });
});
