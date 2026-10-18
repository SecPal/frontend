// SPDX-FileCopyrightText: 2026 SecPal Contributors
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
import { MemoryRouter, useLocation } from "react-router";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { messages as deMessages } from "../locales/de/messages.mjs";
import { messages as enMessages } from "../locales/en/messages.mjs";
import { OnboardingLayout, LOGOUT_TIMEOUT_MS } from "./onboarding-layout";
import * as authHook from "../hooks/useAuth";
import * as authTransport from "../services/authTransport";
import { useServiceWorkerUpdate } from "../hooks/useServiceWorkerUpdate";

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
vi.mock("../hooks/useServiceWorkerUpdate", () => ({
  useServiceWorkerUpdate: vi.fn(() => ({
    needRefresh: false,
    offlineReady: false,
    updateServiceWorker: vi.fn(),
  })),
}));
vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");

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

function renderWithProviders(
  component: React.ReactNode,
  initialEntries = ["/"]
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <I18nProvider i18n={i18n}>{component}</I18nProvider>
    </MemoryRouter>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <output>{JSON.stringify(location)}</output>;
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

  it("keeps the rounded update banner centered below the onboarding header", () => {
    vi.mocked(useServiceWorkerUpdate).mockReturnValueOnce({
      needRefresh: true,
      offlineReady: false,
      updateServiceWorker: vi.fn(),
    });

    renderLayout();

    const banner = screen.getByRole("status");
    expect(banner).toHaveClass("rounded-md", "mx-auto", "max-w-4xl");
    expect(screen.getByRole("banner").compareDocumentPosition(banner)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(
      screen.getByRole("button", { name: /update application now/i })
    ).toBeInTheDocument();
  });

  it.each(["en", "de"])(
    "renders the SecPal footer below onboarding content in %s",
    (locale) => {
      i18n.activate(locale);
      renderLayout();

      const link = screen.getByRole("link", {
        name: "Powered by SecPal – A guard's best friend",
      });

      expect(link).toHaveAttribute("href", "https://secpal.app");
      expect(link.closest("footer")).toBeInTheDocument();
      expect(
        screen
          .getByText("Onboarding Wizard Content")
          .compareDocumentPosition(link)
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
  );

  it.each([
    {
      locale: "en",
      legal: "Legal",
      imprint: "Imprint",
      privacy: "Privacy",
      source: "Source Code",
    },
    {
      locale: "de",
      legal: "Rechtliches",
      imprint: "Impressum",
      privacy: "Datenschutz",
      source: "Quellcode",
    },
  ])(
    "provides the legal menu in $locale",
    async ({ locale, legal, imprint, privacy, source }) => {
      i18n.activate(locale);
      const user = userEvent.setup();
      renderLayout();

      await user.click(screen.getByRole("button", { name: legal }));

      expect(
        await screen.findByRole("menuitem", { name: imprint })
      ).toHaveAttribute("data-disabled", "");
      expect(screen.getByRole("menuitem", { name: privacy })).toHaveAttribute(
        "data-disabled",
        ""
      );
      expect(screen.getByRole("menuitem", { name: source })).toHaveAttribute(
        "href",
        "/source"
      );
    }
  );

  it("preserves the onboarding return address when opening source code", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <OnboardingLayout>
          <div>Onboarding Wizard Content</div>
        </OnboardingLayout>
        <LocationProbe />
      </>,
      ["/onboarding?step=address#current"]
    );

    await user.click(screen.getByRole("button", { name: "Legal" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Source Code" })
    );

    expect(
      JSON.parse(screen.getByRole("status").textContent ?? "{}")
    ).toMatchObject({
      pathname: "/source",
      state: { sourceReturnTo: "/onboarding?step=address#current" },
    });
  });

  it.each([false, true])(
    "aligns the onboarding header with source-page controls (wide: %s)",
    (wide) => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn(() => ({
          matches: wide,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }))
      );

      try {
        const { container } = renderLayout();
        const header = container.querySelector(
          '[data-slot="public-page-header"]'
        );
        const controls = container.querySelector(
          '[data-slot="public-page-header-controls"]'
        );

        expect(header).toHaveClass(
          "grid",
          "min-[86rem]:grid-cols-[minmax(0,1fr)_minmax(0,64rem)_minmax(0,1fr)]"
        );
        expect(header?.parentElement).toHaveClass(
          "pt-[calc(1.5rem+var(--app-safe-area-inset-top))]"
        );
        expect(
          Array.from(controls?.querySelectorAll("button") ?? []).map((button) =>
            button.textContent?.trim()
          )
        ).toEqual(
          wide
            ? ["Legal", "Sign out", "English"]
            : ["Legal", "English", "Sign out"]
        );
        expect(
          screen.getAllByRole("button", { name: "Sign out" })
        ).toHaveLength(1);
      } finally {
        vi.unstubAllGlobals();
      }
    }
  );

  it("updates header order on resize and removes its media-query listener", () => {
    const mediaQuery = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => mediaQuery)
    );

    try {
      const { container, unmount } = renderLayout();
      const onChange = mediaQuery.addEventListener.mock.calls[0]?.[1] as (
        event: MediaQueryListEvent
      ) => void;
      expect(onChange).toBeTypeOf("function");

      act(() => onChange({ matches: true } as MediaQueryListEvent));

      const controls = container.querySelector(
        '[data-slot="public-page-header-controls"]'
      );
      expect(
        Array.from(controls?.querySelectorAll("button") ?? []).map((button) =>
          button.textContent?.trim()
        )
      ).toEqual(["Legal", "Sign out", "English"]);
      unmount();
      expect(mediaQuery.removeEventListener).toHaveBeenCalledWith(
        "change",
        onChange
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("switches the onboarding controls to German", async () => {
    const previousPreference = localStorage.getItem("secpal-locale");
    const previousLanguage = document.documentElement.lang;
    const user = userEvent.setup();
    renderLayout();

    try {
      await user.click(
        screen.getByRole("combobox", { name: "Select language" })
      );
      await user.click(await screen.findByRole("option", { name: "Deutsch" }));

      expect(
        await screen.findByRole("button", { name: "Rechtliches" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Abmelden" })
      ).toBeInTheDocument();
      expect(localStorage.getItem("secpal-locale")).toBe("de");
    } finally {
      if (previousPreference === null) {
        localStorage.removeItem("secpal-locale");
      } else {
        localStorage.setItem("secpal-locale", previousPreference);
      }
      document.documentElement.lang = previousLanguage;
    }
  });

  it("keeps the onboarding shell on canonical theme tokens", () => {
    const { container } = renderLayout();

    const shell = container.querySelector("main");
    const header = container.querySelector("header");

    expect(shell).toHaveClass("bg-background");
    expect(shell).toHaveClass("text-foreground");

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
