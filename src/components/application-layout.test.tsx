// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
} from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { MemoryRouter } from "react-router-dom";
import { ApplicationLayout } from "./application-layout";
import { AuthProvider } from "../contexts/AuthContext";
import * as authApi from "../services/authApi";
import { clearSensitiveClientState } from "../lib/clientStateCleanup";
import { messages as deMessages } from "../locales/de/messages.mjs";

vi.mock("../services/authApi");
vi.mock("../lib/clientStateCleanup", () => ({
  clearSensitiveClientState: vi.fn().mockResolvedValue(undefined),
}));

const QUERY_TIMEOUT = 15000;

// Mock ResizeObserver for HeadlessUI Menu component
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const renderWithProviders = (
  component: React.ReactNode,
  { route = "/" }: { route?: string } = {}
) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <I18nProvider i18n={i18n}>
        <AuthProvider>{component}</AuthProvider>
      </I18nProvider>
    </MemoryRouter>
  );
};

async function openUserMenu() {
  const userMenuButton = screen.getByRole("button", {
    name: /user menu/i,
  });

  fireEvent.click(userMenuButton);

  await waitFor(
    () => {
      expect(userMenuButton).toHaveAttribute("aria-expanded", "true");
    },
    { timeout: QUERY_TIMEOUT }
  );

  return userMenuButton;
}

describe("ApplicationLayout", () => {
  const SLOW_TEST_TIMEOUT = 20000;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    i18n.load("en", {});
    i18n.activate("en");

    vi.mocked(authApi.getCurrentUser).mockImplementation(
      () => new Promise(() => undefined)
    );

    // Set up authenticated user
    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: 1,
        name: "John Doe",
        email: "john@secpal.dev",
      })
    );
  });

  describe("rendering", () => {
    it("renders navigation with Shield icon (branding)", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      // In stacked layout, SecPal branding is represented by Shield icon in navbar
      // The text "SecPal" only appears in mobile sidebar
      expect(screen.getByText("Home")).toBeInTheDocument();
    });

    it("renders children content", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div data-testid="test-content">Test Content</div>
        </ApplicationLayout>
      );

      expect(screen.getByTestId("test-content")).toBeInTheDocument();
      expect(screen.getByText("Test Content")).toBeInTheDocument();
    });

    it("renders the desktop content surface without an inset frame", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      const main = screen.getByRole("main");
      expect(main).not.toHaveClass("pb-2");
      expect(main.className).not.toContain("lg:px-2");

      const contentSurface = main.firstElementChild as HTMLDivElement | null;

      expect(contentSurface).not.toBeNull();
      expect(contentSurface?.className).not.toContain("lg:rounded-lg");
      expect(contentSurface?.className).not.toContain("lg:shadow-xs");
      expect(contentSurface?.className).not.toContain("lg:ring-1");
    });

    it("renders navigation links", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.getByText("Home")).toBeInTheDocument();
    });

    it("renders user information in navbar avatar", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      // In stacked layout, user info is accessible via avatar and dropdown menu
      const userMenuButton = screen.getByRole("button", { name: /user menu/i });
      expect(userMenuButton).toBeInTheDocument();
    });

    it("renders user initials in avatar", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      // Avatar in navbar (stacked layout has avatar only in navbar)
      const avatars = screen.getAllByText("JD");
      expect(avatars.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("navigation highlighting", () => {
    it("highlights Home link when on home page", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>,
        { route: "/" }
      );

      const homeLink = screen.getByRole("link", { name: /home/i });
      expect(homeLink).toHaveAttribute("data-current", "true");
    });
  });

  describe("navbar user dropdown", () => {
    it(
      "opens navbar dropdown when clicking user menu button",
      async () => {
        renderWithProviders(
          <ApplicationLayout>
            <div>Content</div>
          </ApplicationLayout>
        );

        await openUserMenu();

        expect(
          await screen.findByRole(
            "menuitem",
            { name: /my profile/i },
            { timeout: QUERY_TIMEOUT }
          )
        ).toBeInTheDocument();
        expect(
          screen.getByRole("menuitem", { name: /sign out/i })
        ).toBeInTheDocument();
      },
      SLOW_TEST_TIMEOUT
    );

    it(
      "has profile link in navbar dropdown",
      async () => {
        renderWithProviders(
          <ApplicationLayout>
            <div>Content</div>
          </ApplicationLayout>
        );

        await openUserMenu();

        const profileItem = await screen.findByRole(
          "menuitem",
          {
            name: /my profile/i,
          },
          { timeout: QUERY_TIMEOUT }
        );

        expect(profileItem).toHaveAttribute("href", "/profile");
      },
      SLOW_TEST_TIMEOUT
    );

    it(
      "has settings link in navbar dropdown",
      async () => {
        renderWithProviders(
          <ApplicationLayout>
            <div>Content</div>
          </ApplicationLayout>
        );

        await openUserMenu();

        const settingsItem = await screen.findByRole(
          "menuitem",
          {
            name: /settings/i,
          },
          { timeout: QUERY_TIMEOUT }
        );

        expect(settingsItem).toHaveAttribute("href", "/settings");
      },
      SLOW_TEST_TIMEOUT
    );

    it(
      "triggers logout when clicking sign out in navbar dropdown",
      async () => {
        const user = userEvent.setup();

        renderWithProviders(
          <ApplicationLayout>
            <div>Content</div>
          </ApplicationLayout>
        );

        await openUserMenu();

        const signOutItem = await screen.findByRole(
          "menuitem",
          { name: /sign out/i },
          { timeout: QUERY_TIMEOUT }
        );
        await user.click(signOutItem);

        await waitFor(() => {
          expect(authApi.logout).toHaveBeenCalled();
        });
      },
      SLOW_TEST_TIMEOUT
    );
  });

  // Note: Sidebar footer with user info was removed - all user menu functionality is in the navbar.

  describe("logout functionality", () => {
    it("calls logout API and clears auth on sign out click", async () => {
      const mockLogout = vi.mocked(authApi.logout);
      mockLogout.mockResolvedValue(undefined);

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      await openUserMenu();

      // Click sign out
      const signOutButton = screen.getByRole("menuitem", { name: /sign out/i });
      fireEvent.click(signOutButton);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });

      // User should be cleared from localStorage
      expect(localStorage.getItem("auth_user")).toBeNull();
      expect(clearSensitiveClientState).toHaveBeenCalledTimes(1);
    });

    it("does not clear local state before API call completes, then clears it in finally (ordering guarantee)", async () => {
      let wasLocalStorageClearedBeforeApiCall = false;

      const mockLogout = vi.mocked(authApi.logout);
      mockLogout.mockImplementation(async () => {
        wasLocalStorageClearedBeforeApiCall =
          localStorage.getItem("auth_user") === null;
      });

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      await openUserMenu();

      // Click sign out
      const signOutButton = screen.getByRole("menuitem", { name: /sign out/i });
      fireEvent.click(signOutButton);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
        // Local state should NOT be cleared before the API call —
        // logout() now runs in the finally block after authTransport.logout()
        expect(wasLocalStorageClearedBeforeApiCall).toBe(false);
        // Local state IS cleared after the API call settles (finally block ran)
        expect(vi.mocked(clearSensitiveClientState)).toHaveBeenCalledTimes(1);
      });
    });

    it("handles logout API failure gracefully", async () => {
      const mockLogout = vi.mocked(authApi.logout);
      mockLogout.mockRejectedValue(new Error("Network error"));

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      await openUserMenu();

      // Click sign out
      const signOutButton = screen.getByRole("menuitem", { name: /sign out/i });
      fireEvent.click(signOutButton);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
          "Logout API call failed:",
          expect.any(Error)
        );
      });

      // User should still be cleared from localStorage
      expect(localStorage.getItem("auth_user")).toBeNull();

      consoleSpy.mockRestore();
    });

    it("completes client-side logout when the logout API hangs past the timeout", async () => {
      const mockLogout = vi.mocked(authApi.logout);
      mockLogout.mockImplementation(() => new Promise(() => undefined));

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      await openUserMenu();

      const signOutButton = screen.getByRole("menuitem", { name: /sign out/i });

      vi.useFakeTimers();

      try {
        fireEvent.click(signOutButton);

        expect(mockLogout).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem("auth_user")).not.toBeNull();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(7999);
        });
        expect(localStorage.getItem("auth_user")).not.toBeNull();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(1);
        });

        expect(
          consoleSpy.mock.calls.some(
            ([message, error]) =>
              message === "Logout API call failed:" &&
              error instanceof Error &&
              error.message.includes("timed out after 8000ms")
          )
        ).toBe(true);
        expect(localStorage.getItem("auth_user")).toBeNull();
        expect(clearSensitiveClientState).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
        consoleSpy.mockRestore();
      }
    });
  });

  describe("getInitials helper", () => {
    it("generates correct initials for two-word name", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Jane Smith",
          email: "jane@secpal.dev",
        })
      );

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      // Avatar in navbar (stacked layout has avatar only in navbar)
      const avatars = screen.getAllByText("JS");
      expect(avatars.length).toBeGreaterThanOrEqual(1);
    });

    it("generates correct initials for single-word name", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Admin",
          email: "admin@secpal.dev",
        })
      );

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      // Avatar in navbar (stacked layout has avatar only in navbar)
      const avatars = screen.getAllByText("A");
      expect(avatars.length).toBeGreaterThanOrEqual(1);
    });

    it("generates correct initials for three-word name (max 2)", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "John Paul Smith",
          email: "john@secpal.dev",
        })
      );

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      // Avatar in navbar (stacked layout has avatar only in navbar)
      const avatars = screen.getAllByText("JP");
      expect(avatars.length).toBeGreaterThanOrEqual(1);
    });

    it("shows fallback U when user name is missing", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          email: "user@secpal.dev",
        })
      );

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      // Avatar in navbar (stacked layout has avatar only in navbar)
      const avatars = screen.getAllByText("U");
      expect(avatars.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("permission-based navigation", () => {
    it("hides Organization link when user has no organizational scopes", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "John Doe",
          email: "john@secpal.dev",
          hasOrganizationalScopes: false,
        })
      );

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.queryByText("Organization")).not.toBeInTheDocument();
    });

    it("hides Customers link when user has no organizational scopes", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "John Doe",
          email: "john@secpal.dev",
          hasOrganizationalScopes: false,
        })
      );

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.queryByText("Customers")).not.toBeInTheDocument();
    });

    it("keeps management links hidden for scope-only users", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "John Doe",
          email: "john@secpal.dev",
          hasOrganizationalScopes: true,
          roles: [],
          permissions: [],
        })
      );

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.queryByText("Organization")).not.toBeInTheDocument();
      expect(screen.queryByText("Customers")).not.toBeInTheDocument();
      expect(screen.queryByText("Employees")).not.toBeInTheDocument();
    });

    it("shows management links for elevated organization roles", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "John Doe",
          email: "john@secpal.dev",
          hasOrganizationalScopes: true,
          roles: ["Manager"],
          permissions: [],
        })
      );

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.getByText("Organization")).toBeInTheDocument();
      expect(screen.getByText("Customers")).toBeInTheDocument();
      expect(screen.getByText("Employees")).toBeInTheDocument();
    });

    it("shows Customers for users with explicit customer permissions", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "John Doe",
          email: "john@secpal.dev",
          hasOrganizationalScopes: false,
          roles: [],
          permissions: ["customers.read"],
        })
      );

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.getByText("Customers")).toBeInTheDocument();
      expect(screen.queryByText("Organization")).not.toBeInTheDocument();
      expect(screen.queryByText("Employees")).not.toBeInTheDocument();
    });

    it("shows Customers for users with backend scoped-access flags", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "John Doe",
          email: "john@secpal.dev",
          hasOrganizationalScopes: false,
          hasCustomerAccess: true,
          roles: [],
          permissions: [],
        })
      );

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.getByText("Customers")).toBeInTheDocument();
      expect(screen.queryByText("Organization")).not.toBeInTheDocument();
      expect(screen.queryByText("Employees")).not.toBeInTheDocument();
    });

    it("always shows Home", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "John Doe",
          email: "john@secpal.dev",
          hasOrganizationalScopes: false,
        })
      );

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.getByText("Home")).toBeInTheDocument();
    });

    it("treats undefined hasOrganizationalScopes as false", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "John Doe",
          email: "john@secpal.dev",
          // hasOrganizationalScopes not set
        })
      );

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      // Should not show organizational menu items
      expect(screen.queryByText("Organization")).not.toBeInTheDocument();
      expect(screen.queryByText("Customers")).not.toBeInTheDocument();
    });
  });

  describe("footer", () => {
    it("renders license link in main content footer", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      const licenseLink = screen.getByRole("link", { name: /agpl v3\+/i });
      expect(licenseLink).toBeInTheDocument();
      expect(licenseLink).toHaveAttribute(
        "href",
        "https://www.gnu.org/licenses/agpl-3.0.html"
      );
      expect(licenseLink).toHaveAttribute("target", "_blank");
      expect(licenseLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("renders source code link in main content footer", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      const sourceLink = screen.getByRole("link", { name: /source code/i });
      expect(sourceLink).toBeInTheDocument();
      expect(sourceLink).toHaveAttribute("href", "https://github.com/SecPal");
      expect(sourceLink).toHaveAttribute("target", "_blank");
      expect(sourceLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("renders SecPal slogan in footer", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(
        screen.getByRole("link", {
          name: "Powered by SecPal – A guard's best friend",
        })
      ).toBeInTheDocument();
    });
  });

  describe("Activity Logs Navigation", () => {
    it("shows Activity Logs menu item when user has permission", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Admin User",
          email: "admin@secpal.dev",
          permissions: ["activity_log.read"],
        })
      );

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.getByText("Activity Logs")).toBeInTheDocument();
    });

    it("hides Activity Logs menu item when user lacks permission", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Regular User",
          email: "user@secpal.dev",
          permissions: [],
        })
      );

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.queryByText("Activity Logs")).not.toBeInTheDocument();
    });

    it("highlights Activity Logs when on that page", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Admin User",
          email: "admin@secpal.dev",
          permissions: ["activity_log.read"],
        })
      );

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>,
        { route: "/activity-logs" }
      );

      const activityLogsLink = screen.getByText("Activity Logs").closest("a");
      expect(activityLogsLink).toHaveAttribute("href", "/activity-logs");
    });

    it("links to /activity-logs route", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Admin User",
          email: "admin@secpal.dev",
          permissions: ["activity_log.read"],
        })
      );

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      const activityLogsLink = screen.getByText("Activity Logs").closest("a");
      expect(activityLogsLink).toHaveAttribute("href", "/activity-logs");
    });
  });

  describe("Android Provisioning Navigation", () => {
    afterEach(() => {
      act(() => {
        i18n.activate("en");
      });
    });

    it("renders the localized German label instead of the raw Lingui message id", () => {
      act(() => {
        i18n.load("de", deMessages);
        i18n.activate("de");
      });

      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Admin User",
          email: "admin@secpal.dev",
          hasOrganizationalScopes: true,
          roles: ["Manager"],
          permissions: ["android_enrollment.read"],
        })
      );

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.getByText("Android-Provisionierung")).toBeInTheDocument();
      expect(screen.queryByText("62KQbc")).not.toBeInTheDocument();
    });
  });
});
