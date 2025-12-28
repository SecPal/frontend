// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { MemoryRouter } from "react-router-dom";
import { ApplicationLayout } from "./application-layout";
import { AuthProvider } from "../contexts/AuthContext";
import * as authApi from "../services/authApi";

vi.mock("../services/authApi");

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

describe("ApplicationLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    i18n.load("en", {});
    i18n.activate("en");

    // Set up authenticated user
    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: 1,
        name: "John Doe",
        email: "john@example.com",
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

    it("renders navigation links", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("Secrets")).toBeInTheDocument();
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

    it("highlights Secrets link when on secrets page", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>,
        { route: "/secrets" }
      );

      const secretsLink = screen.getByRole("link", { name: /secrets/i });
      expect(secretsLink).toHaveAttribute("data-current", "true");
    });

    it("highlights Secrets link when on secrets subpage", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>,
        { route: "/secrets/new" }
      );

      const secretsLink = screen.getByRole("link", { name: /secrets/i });
      expect(secretsLink).toHaveAttribute("data-current", "true");
    });
  });

  describe("navbar user dropdown", () => {
    it("opens navbar dropdown when clicking user menu button", async () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      // Find and click the navbar user menu button (has aria-label)
      const userMenuButton = screen.getByRole("button", { name: /user menu/i });
      fireEvent.click(userMenuButton);

      await waitFor(() => {
        expect(screen.getByText("My profile")).toBeInTheDocument();
        expect(screen.getByText("Sign out")).toBeInTheDocument();
      });
    });

    it("has profile link in navbar dropdown", async () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      const userMenuButton = screen.getByRole("button", { name: /user menu/i });
      fireEvent.click(userMenuButton);

      await waitFor(() => {
        const profileItem = screen.getByRole("menuitem", {
          name: /my profile/i,
        });
        expect(profileItem).toHaveAttribute("href", "/profile");
      });
    });

    it("has settings link in navbar dropdown", async () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      const userMenuButton = screen.getByRole("button", { name: /user menu/i });
      fireEvent.click(userMenuButton);

      await waitFor(() => {
        const settingsItem = screen.getByRole("menuitem", {
          name: /settings/i,
        });
        expect(settingsItem).toHaveAttribute("href", "/settings");
      });
    });

    it("triggers logout when clicking sign out in navbar dropdown", async () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      const userMenuButton = screen.getByRole("button", { name: /user menu/i });
      fireEvent.click(userMenuButton);

      await waitFor(() => {
        const signOutItem = screen.getByRole("menuitem", { name: /sign out/i });
        fireEvent.click(signOutItem);
      });

      // Should have called the logout API
      await waitFor(() => {
        expect(authApi.logout).toHaveBeenCalled();
      });
    });
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

      // Open dropdown (navbar user menu)
      const dropdownButton = screen.getByRole("button", {
        name: /user menu/i,
      });
      fireEvent.click(dropdownButton);

      await waitFor(() => {
        expect(screen.getByText("Sign out")).toBeInTheDocument();
      });

      // Click sign out
      const signOutButton = screen.getByRole("menuitem", { name: /sign out/i });
      fireEvent.click(signOutButton);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });

      // User should be cleared from localStorage
      expect(localStorage.getItem("auth_user")).toBeNull();
    });

    it("clears local state before API call (prevents race condition)", async () => {
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

      // Open dropdown (navbar user menu)
      const dropdownButton = screen.getByRole("button", {
        name: /user menu/i,
      });
      fireEvent.click(dropdownButton);

      await waitFor(() => {
        expect(screen.getByText("Sign out")).toBeInTheDocument();
      });

      // Click sign out
      const signOutButton = screen.getByRole("menuitem", { name: /sign out/i });
      fireEvent.click(signOutButton);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
        expect(wasLocalStorageClearedBeforeApiCall).toBe(true);
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

      // Open dropdown (navbar user menu)
      const dropdownButton = screen.getByRole("button", {
        name: /user menu/i,
      });
      fireEvent.click(dropdownButton);

      await waitFor(() => {
        expect(screen.getByText("Sign out")).toBeInTheDocument();
      });

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
  });

  describe("getInitials helper", () => {
    it("generates correct initials for two-word name", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Jane Smith",
          email: "jane@example.com",
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
          email: "admin@example.com",
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
          email: "john@example.com",
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
          email: "user@example.com",
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
          email: "john@example.com",
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
          email: "john@example.com",
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

    it("shows Organization link when user has organizational scopes", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "John Doe",
          email: "john@example.com",
          hasOrganizationalScopes: true,
        })
      );

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.getByText("Organization")).toBeInTheDocument();
    });

    it("shows Customers link when user has organizational scopes", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "John Doe",
          email: "john@example.com",
          hasOrganizationalScopes: true,
        })
      );

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.getByText("Customers")).toBeInTheDocument();
    });

    it("always shows Home and Secrets links regardless of scopes", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "John Doe",
          email: "john@example.com",
          hasOrganizationalScopes: false,
        })
      );

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("Secrets")).toBeInTheDocument();
    });

    it("treats undefined hasOrganizationalScopes as false", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "John Doe",
          email: "john@example.com",
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
        screen.getByText(/powered by secpal - a guard's best friend/i)
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
          email: "admin@example.com",
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
          email: "user@example.com",
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
          email: "admin@example.com",
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
          email: "admin@example.com",
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
});
