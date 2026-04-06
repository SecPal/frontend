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
const authContext = {
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
};

vi.mock("../hooks/useAuth");
vi.mock("../services/authTransport");
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function mockTransport(logout = vi.fn().mockResolvedValue(undefined)) {
  vi.mocked(authTransport.getAuthTransport).mockReturnValue({
    kind: "browser-session",
    login: vi.fn(),
    logout,
    logoutAll: vi.fn(),
    getCurrentUser: vi.fn(),
    isNetworkAvailable: vi.fn(),
  });

  return logout;
}

function renderLayout() {
  return renderWithProviders(
    <OnboardingLayout>
      <div>Onboarding Wizard Content</div>
    </OnboardingLayout>
  );
}

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

    vi.mocked(authHook.useAuth).mockReturnValue(authContext);
    mockTransport();
  });

  it("renders children and a dedicated sign-out action", () => {
    renderLayout();

    expect(screen.getByText("Onboarding Wizard Content")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign out/i })
    ).toBeInTheDocument();
  });

  it("logs out and navigates to login when sign out succeeds", async () => {
    const user = userEvent.setup();
    const logout = vi.fn();

    vi.mocked(authHook.useAuth).mockReturnValue({
      ...authContext,
      logout,
    });

    const transportLogout = mockTransport();

    renderLayout();

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
      expect(transportLogout).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });
  });

  it("does not call logout or navigate when transport logout fails", async () => {
    const user = userEvent.setup();
    const logout = vi.fn();
    const transportLogout = vi
      .fn()
      .mockRejectedValue(new Error("Network down"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    vi.mocked(authHook.useAuth).mockReturnValue({
      ...authContext,
      logout,
    });

    mockTransport(transportLogout);

    renderLayout();

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => {
      expect(transportLogout).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith(
        "Logout API call failed:",
        expect.any(Error)
      );
      // auth state must be preserved so the user can retry
      expect(logout).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    consoleError.mockRestore();
  });

  it("shows an error message when transport logout fails", async () => {
    const user = userEvent.setup();
    const transportLogout = vi
      .fn()
      .mockRejectedValue(new Error("Network down"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mockTransport(transportLogout);

    renderLayout();

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/we could not complete the sign out request/i)
      ).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });

  it("does not call logout before the API attempt", async () => {
    const user = userEvent.setup();
    const logout = vi.fn();
    const transportLogout = vi.fn().mockResolvedValue(undefined);

    vi.mocked(authHook.useAuth).mockReturnValue({
      ...authContext,
      logout,
    });

    mockTransport(transportLogout);

    renderLayout();

    // logout() must NOT be called before the button is clicked
    expect(logout).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => {
      // logout() is called exactly once after the successful API call
      expect(logout).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });
  });
});
