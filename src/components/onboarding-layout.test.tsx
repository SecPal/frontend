// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { messages as deMessages } from "../locales/de/messages.mjs";
import { messages as enMessages } from "../locales/en/messages.mjs";
import { OnboardingLayout, LOGOUT_TIMEOUT_MS } from "./onboarding-layout";
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
    supportsPasskeyLogin: vi.fn().mockReturnValue(false),
    loginWithPasskey: vi.fn(),
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
    i18n.load("en", enMessages);
    i18n.load("de", deMessages);
    i18n.activate("en");

    vi.mocked(authHook.useAuth).mockReturnValue(authContext);
    mockTransport();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders children and a dedicated sign-out action", () => {
    renderLayout();

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByText("Onboarding Wizard Content")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign out/i })
    ).toBeInTheDocument();
  });

  it("keeps the onboarding shell on canonical theme tokens", () => {
    const { container } = renderLayout();

    const shell = container.querySelector("main");
    const header = container.querySelector("header");

    expect(shell).toHaveClass("bg-background");
    expect(shell).toHaveClass("text-foreground");
    expect(header).toHaveClass("border-border");

    expect(shell?.className).not.toContain("bg-white");
    expect(shell?.className).not.toContain("lg:bg-zinc-50");
    expect(header?.className).not.toContain("border-zinc-200");
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

  it("still calls logout and navigates to login when transport logout fails", async () => {
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
      expect(logout).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });

    consoleError.mockRestore();
  });

  it("does not show a retry error when transport logout fails", async () => {
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
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });

    consoleError.mockRestore();
  });

  it("does not show a localized retry error in German", async () => {
    const user = userEvent.setup();
    const transportLogout = vi
      .fn()
      .mockRejectedValue(new Error("Network down"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await act(async () => {
      i18n.activate("de");
    });
    mockTransport(transportLogout);

    renderLayout();

    await user.click(screen.getByRole("button", { name: /abmelden/i }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });

    consoleError.mockRestore();
    await act(async () => {
      i18n.activate("en");
    });
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

  it("awaits logout completion before navigating even when transport logout rejects", async () => {
    const user = userEvent.setup();

    let resolveLogout!: () => void;
    const logoutSettled = new Promise<void>((resolve) => {
      resolveLogout = resolve;
    });
    const logout = vi.fn().mockReturnValue(logoutSettled);
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
      expect(logout).toHaveBeenCalledTimes(1);
    });

    expect(mockNavigate).not.toHaveBeenCalled();

    await act(async () => {
      resolveLogout();
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });

    consoleError.mockRestore();
  });

  it("navigates to login when local logout cleanup fails", async () => {
    const user = userEvent.setup();
    const cleanupError = new Error("Storage unavailable");
    const logout = vi.fn().mockRejectedValue(cleanupError);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    vi.mocked(authHook.useAuth).mockReturnValue({
      ...authContext,
      logout,
    });

    renderLayout();

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith(
        "Local logout cleanup failed:",
        cleanupError
      );
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });

    consoleError.mockRestore();
  });

  it("completes client-side logout when the logout API hangs past the timeout", async () => {
    vi.useFakeTimers();

    const logout = vi.fn();
    const transportLogout = vi.fn(() => new Promise<void>(() => {}));

    vi.mocked(authHook.useAuth).mockReturnValue({
      ...authContext,
      logout,
    });

    mockTransport(transportLogout);

    renderLayout();

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    expect(transportLogout).toHaveBeenCalledTimes(1);
    expect(logout).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOGOUT_TIMEOUT_MS);
    });

    expect(logout).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});
