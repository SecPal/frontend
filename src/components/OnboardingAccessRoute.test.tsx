// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { AppAccessRoute, OnboardingOnlyRoute } from "./OnboardingAccessRoute";
import type { User } from "../contexts/auth-context";
import * as authHook from "../hooks/useAuth";

vi.mock("../hooks/useAuth");
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");

  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div>Redirected to {to}</div>,
  };
});

const authContext = {
  isAuthenticated: true,
  isLoading: false,
  bootstrapRecoveryReason: null,
  login: vi.fn(),
  logout: vi.fn(),
  retryBootstrap: vi.fn(),
  hasRole: vi.fn(),
  hasPermission: vi.fn(),
  hasOrganizationalAccess: vi.fn(),
};

function buildUser(status: "pre_contract" | "active"): User {
  const isPreContract = status === "pre_contract";
  const email = isPreContract ? "new.hire@secpal.dev" : "guard@secpal.dev";

  return {
    id: "1",
    name: isPreContract ? "Pre-Contract User" : "Active User",
    email,
    emailVerified: true,
    employee: {
      id: isPreContract ? "employee-1" : "employee-2",
      employee_number: isPreContract ? "EMP-001" : "EMP-002",
      first_name: isPreContract ? "New" : "Active",
      last_name: isPreContract ? "Hire" : "User",
      full_name: isPreContract ? "New Hire" : "Active User",
      email,
      date_of_birth: null,
      contract_start_date: null,
      status,
      contract_type: "full_time",
      organizational_unit: null,
      management_level: 0,
      created_at: "2026-04-06T00:00:00Z",
      updated_at: "2026-04-06T00:00:00Z",
      onboarding_workflow: {
        status: isPreContract ? "account_initialized" : "active",
      },
    },
  };
}

function mockAuthenticatedUser(status: "pre_contract" | "active") {
  vi.mocked(authHook.useAuth).mockReturnValue({
    ...authContext,
    user: buildUser(status),
  });
}

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
    mockAuthenticatedUser("pre_contract");

    renderWithProviders(
      <AppAccessRoute>
        <div>Protected App Content</div>
      </AppAccessRoute>
    );

    expect(screen.getByText("Redirected to /onboarding")).toBeInTheDocument();
    expect(screen.queryByText("Protected App Content")).not.toBeInTheDocument();
  });

  it("renders normal app content for non pre-contract users", () => {
    mockAuthenticatedUser("active");

    renderWithProviders(
      <AppAccessRoute>
        <div>Protected App Content</div>
      </AppAccessRoute>
    );

    expect(screen.getByText("Protected App Content")).toBeInTheDocument();
  });

  it("renders onboarding content for pre-contract users", () => {
    mockAuthenticatedUser("pre_contract");

    renderWithProviders(
      <OnboardingOnlyRoute>
        <div>Onboarding Content</div>
      </OnboardingOnlyRoute>
    );

    expect(screen.getByText("Onboarding Content")).toBeInTheDocument();
  });

  it("redirects non pre-contract users away from onboarding-only routes", () => {
    mockAuthenticatedUser("active");

    renderWithProviders(
      <OnboardingOnlyRoute>
        <div>Onboarding Content</div>
      </OnboardingOnlyRoute>
    );

    expect(screen.getByText("Redirected to /")).toBeInTheDocument();
    expect(screen.queryByText("Onboarding Content")).not.toBeInTheDocument();
  });

  it("allows access to app routes when employee status is unknown (offline/stale user)", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      ...authContext,
      user: {
        id: "1",
        name: "User",
        email: "user@secpal.dev",
        emailVerified: true,
      },
    });

    renderWithProviders(
      <AppAccessRoute>
        <div>Protected App Content</div>
      </AppAccessRoute>
    );

    // AppAccessRoute does not fail-closed for unknown employee status: the
    // persisted auth user omits employee data after bootstrap. Access is
    // permitted until bootstrap revalidation can confirm pre-contract status.
    // A follow-up issue tracks persisting employee lifecycle state to close
    // this narrow offline window (see #743).
    expect(screen.getByText("Protected App Content")).toBeInTheDocument();
  });

  it("allows access to onboarding routes when employee status is unknown (offline/stale user)", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      ...authContext,
      user: {
        id: "1",
        name: "User",
        email: "user@secpal.dev",
        emailVerified: true,
      },
    });

    renderWithProviders(
      <OnboardingOnlyRoute>
        <div>Onboarding Content</div>
      </OnboardingOnlyRoute>
    );

    expect(screen.getByText("Onboarding Content")).toBeInTheDocument();
  });
});
