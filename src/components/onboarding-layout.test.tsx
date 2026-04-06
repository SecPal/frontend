// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { OnboardingLayout } from "./onboarding-layout";
import * as authHook from "../hooks/useAuth";
import * as authTransport from "../services/authTransport";

const mockNavigate = vi.fn();

vi.mock("../hooks/useAuth");
vi.mock("../services/authTransport");
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderWithProviders(component: React.ReactNode) {
  return render(
    <MemoryRouter>
      <I18nProvider i18n={i18n}>{component}</I18nProvider>
    </MemoryRouter>
  );
}

describe("OnboardingLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");

    vi.mocked(authHook.useAuth).mockReturnValue({
      user: null,
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

    vi.mocked(authTransport.getAuthTransport).mockReturnValue({
      kind: "browser-session",
      login: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
      logoutAll: vi.fn(),
      getCurrentUser: vi.fn(),
      isNetworkAvailable: vi.fn(),
    });
  });

  it("renders children and a dedicated sign-out action", () => {
    renderWithProviders(
      <OnboardingLayout>
        <div>Onboarding Wizard Content</div>
      </OnboardingLayout>
    );

    expect(screen.getByText("Onboarding Wizard Content")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign out/i })
    ).toBeInTheDocument();
  });

  it("logs out and navigates to login when sign out succeeds", async () => {
    const user = userEvent.setup();
    const logout = vi.fn();
    const transportLogout = vi.fn().mockResolvedValue(undefined);

    vi.mocked(authHook.useAuth).mockReturnValue({
      user: null,
      isAuthenticated: true,
      isLoading: false,
      bootstrapRecoveryReason: null,
      login: vi.fn(),
      logout,
      retryBootstrap: vi.fn(),
      hasRole: vi.fn(),
      hasPermission: vi.fn(),
      hasOrganizationalAccess: vi.fn(),
    });

    vi.mocked(authTransport.getAuthTransport).mockReturnValue({
      kind: "browser-session",
      login: vi.fn(),
      logout: transportLogout,
      logoutAll: vi.fn(),
      getCurrentUser: vi.fn(),
      isNetworkAvailable: vi.fn(),
    });

    renderWithProviders(
      <OnboardingLayout>
        <div>Onboarding Wizard Content</div>
      </OnboardingLayout>
    );

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
      expect(transportLogout).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("still navigates to login when transport logout fails", async () => {
    const user = userEvent.setup();
    const logout = vi.fn();
    const transportLogout = vi.fn().mockRejectedValue(new Error("Network down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.mocked(authHook.useAuth).mockReturnValue({
      user: null,
      isAuthenticated: true,
      isLoading: false,
      bootstrapRecoveryReason: null,
      login: vi.fn(),
      logout,
      retryBootstrap: vi.fn(),
      hasRole: vi.fn(),
      hasPermission: vi.fn(),
      hasOrganizationalAccess: vi.fn(),
    });

    vi.mocked(authTransport.getAuthTransport).mockReturnValue({
      kind: "browser-session",
      login: vi.fn(),
      logout: transportLogout,
      logoutAll: vi.fn(),
      getCurrentUser: vi.fn(),
      isNetworkAvailable: vi.fn(),
    });

    renderWithProviders(
      <OnboardingLayout>
        <div>Onboarding Wizard Content</div>
      </OnboardingLayout>
    );

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
      expect(transportLogout).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith(
        "Logout API call failed:",
        expect.any(Error)
      );
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });

    consoleError.mockRestore();
  });
});
