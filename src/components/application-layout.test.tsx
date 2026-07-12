// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
} from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ApplicationLayout } from "./application-layout";
import { APP_SHELL_MAX_WIDTH_CLASS } from "./app-shell-width";
import { AuthProvider } from "../contexts/AuthContext";
import * as authApi from "../services/authApi";
import { sanitizePersistedAuthUser } from "../services/authState";
import { authStorage } from "../services/storage";
import { clearSensitiveClientState } from "../lib/clientStateCleanup";
import { db } from "../lib/db";
import {
  AUTH_VAULT_STORAGE_KEY,
  clearOfflineVaultSession,
} from "../lib/offlineVault";
import { messages as deMessages } from "../locales/de/messages.mjs";

type AuthenticatedUser = Awaited<ReturnType<typeof authApi.getCurrentUser>>;
const mockClearSensitiveClientState = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
);
const mockClearBrowserPushClientState = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
);
const appSurfaceMock = vi.hoisted(() => ({
  isAndroidSurface: true,
}));

vi.mock("../services/authApi");
vi.mock("../platform/appSurface", () => ({
  get isAndroidSurface() {
    return appSurfaceMock.isAndroidSurface;
  },
}));
vi.mock("@/components/UpdatePrompt", () => ({
  UpdatePrompt: () => <div data-testid="layout-update-prompt" />,
}));
vi.mock("../lib/clientStateCleanup", () => ({
  clearSensitiveClientState: mockClearSensitiveClientState,
  clearDestructiveSensitiveClientState: mockClearSensitiveClientState,
  clearBrowserPushClientState: mockClearBrowserPushClientState,
}));
vi.mock("../lib/analytics", () => ({
  analytics: {
    resetForLogout: vi.fn().mockResolvedValue(undefined),
    resumeAuthenticatedSession: vi.fn(),
  },
}));

const QUERY_TIMEOUT = 15000;
const migratedShellFiles = [
  "src/components/application-layout.tsx",
  "src/components/mobile-sidebar-dialog.tsx",
  "src/components/stacked-layout.tsx",
  "src/components/sidebar-layout.tsx",
  "src/ui/dropdown-menu.tsx",
  "src/ui/sheet.tsx",
  "src/ui/sidebar.tsx",
  "src/components/LanguageSwitcher.tsx",
  "src/components/Footer.tsx",
] as const;

const forbiddenHeadlessPackagePattern = new RegExp(
  ["@headlessui", "react"].join("\\/")
);
const forbiddenHeroiconsPackagePattern = new RegExp(
  ["@heroicons", "react"].join("\\/")
);
const forbiddenTailwindPlusLicenseMarkerPattern = new RegExp(
  ["LicenseRef", "TailwindPlus"].join("-")
);
const SIDEBAR_STATE_COOKIE_NAME = "sidebar_state";

function setCsrfTokenCookie(value: string): void {
  document.cookie = `XSRF-TOKEN=;expires=${new Date(0).toUTCString()};path=/`;
  document.cookie = `XSRF-TOKEN=${encodeURIComponent(value)};path=/`;
}

function clearSidebarStateCookie(): void {
  document.cookie = `${SIDEBAR_STATE_COOKIE_NAME}=;expires=${new Date(0).toUTCString()};path=/`;
}

function setSidebarStateCookie(value: boolean): void {
  clearSidebarStateCookie();
  document.cookie = `${SIDEBAR_STATE_COOKIE_NAME}=${value};path=/`;
}

function getStoredAuthState(): string | null {
  return localStorage.getItem(AUTH_VAULT_STORAGE_KEY);
}

// Mock ResizeObserver for Radix menu components.
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

function PathnameProbe() {
  const location = useLocation();

  return <output data-testid="pathname">{location.pathname}</output>;
}

async function seedAuthenticatedUser(user: Record<string, unknown>) {
  const persistedUser = sanitizePersistedAuthUser({
    emailVerified: true,
    ...user,
  });

  if (!persistedUser) {
    throw new Error("Failed to seed authenticated user for test");
  }

  const authenticatedUser: AuthenticatedUser = {
    ...persistedUser,
    roles: Array.isArray(user.roles) ? (user.roles as string[]) : [],
    permissions: Array.isArray(user.permissions)
      ? (user.permissions as string[])
      : [],
    hasOrganizationalScopes:
      typeof user.hasOrganizationalScopes === "boolean"
        ? user.hasOrganizationalScopes
        : false,
    hasCustomerAccess:
      typeof user.hasCustomerAccess === "boolean"
        ? user.hasCustomerAccess
        : false,
    hasSiteAccess:
      typeof user.hasSiteAccess === "boolean" ? user.hasSiteAccess : false,
    emailVerified: persistedUser.emailVerified ?? false,
  };

  vi.mocked(authApi.getCurrentUser).mockResolvedValue(authenticatedUser);
  await authStorage.setUser(persistedUser);
}

async function openUserMenu() {
  const mobileNavigationDialog = screen.queryByRole("dialog", {
    name: /navigation/i,
  });
  const lookup = mobileNavigationDialog
    ? within(mobileNavigationDialog)
    : screen;
  const userMenuButton = lookup.getByRole("button", {
    name: /user menu/i,
  });
  const user = userEvent.setup();

  await user.click(userMenuButton);
  await screen.findByRole("menuitem", { name: /my profile/i });

  return userMenuButton;
}

describe("ApplicationLayout", () => {
  const SLOW_TEST_TIMEOUT = 20000;
  const authenticatedUser = {
    id: 1,
    name: "John Doe",
    email: "john@secpal.dev",
    emailVerified: true,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    appSurfaceMock.isAndroidSurface = true;
    await Promise.all([
      db.analytics.clear(),
      db.organizationalUnitCache.clear(),
      db.vaultProfile.clear(),
      db.vaultAnalytics.clear(),
      db.vaultOrganizationalUnitCache.clear(),
    ]);
    localStorage.clear();
    clearOfflineVaultSession();
    setCsrfTokenCookie("test-csrf-token");
    clearSidebarStateCookie();
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1440,
    });
    i18n.load("en", {});
    i18n.activate("en");

    await seedAuthenticatedUser(authenticatedUser);
  });

  afterEach(() => {
    clearSidebarStateCookie();
    clearOfflineVaultSession();
  });

  describe("rendering", () => {
    it("renders the desktop sidebar with icon collapse and direct navigation links", async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      const desktopSidebar = document.querySelector(
        '[data-slot="sidebar"][data-side="left"]'
      );

      expect(desktopSidebar).toHaveAttribute("data-state", "expanded");
      expect(desktopSidebar).toHaveAttribute("data-collapsible", "");
      expect(
        document.querySelector('[data-slot="sidebar-inner"]')?.tagName
      ).toBe("NAV");
      expect(
        document.querySelector('[data-slot="sidebar-rail"]')
      ).toBeInTheDocument();
      expect(
        document.querySelector('[data-slot="sidebar-menu-button"][href="/"]')
      ).toBeInTheDocument();

      const sidebarTrigger = document.querySelector(
        '[data-slot="sidebar-trigger"]'
      );

      expect(sidebarTrigger).toBeInTheDocument();
      if (!(sidebarTrigger instanceof HTMLButtonElement)) {
        throw new Error("Expected the shared sidebar trigger button to render");
      }

      await user.click(sidebarTrigger);

      expect(desktopSidebar).toHaveAttribute("data-state", "collapsed");
      expect(desktopSidebar).toHaveAttribute("data-collapsible", "icon");
    });

    it("restores the desktop sidebar state from the persisted cookie", () => {
      setSidebarStateCookie(false);

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      const desktopSidebar = document.querySelector(
        '[data-slot="sidebar"][data-side="left"]'
      );

      expect(desktopSidebar).toHaveAttribute("data-state", "collapsed");
      expect(desktopSidebar).toHaveAttribute("data-collapsible", "icon");
    });

    it("renders the sidebar branding and header shell", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.getAllByText("SecPal").length).toBeGreaterThan(0);
      expect(
        screen.getByRole("img", {
          name: "SecPal",
        })
      ).toBeInTheDocument();
      expect(document.querySelector(".bg-sidebar-primary")).toBeNull();
      const brandTrigger = screen.getAllByText("SecPal")[0]?.closest("button");
      expect(brandTrigger).not.toBeNull();
      expect(brandTrigger?.className).toContain("hover:!bg-transparent");
      expect(brandTrigger?.className).toContain(
        "data-[state=open]:!bg-transparent"
      );
      expect(
        document.querySelector('[data-slot="breadcrumb"]')
      ).toBeInTheDocument();
    });

    it("renders the update prompt inside the authenticated shell inset", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      const inset = document.querySelector('[data-slot="sidebar-inset"]');
      const updatePrompt = screen.getByTestId("layout-update-prompt");

      expect(inset).toContainElement(updatePrompt);
      expect(inset?.firstElementChild).toBe(updatePrompt);
    });

    it("does not render the extra shell divider lines from the previous layout", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      const header = document.querySelector("header");
      const verticalSeparator = document.querySelector(
        '[data-slot="separator"][data-orientation="vertical"]'
      );
      const sidebarContainer = document.querySelector(
        '[data-slot="sidebar-container"]'
      );

      expect(header?.className).not.toContain("border-b");
      expect(verticalSeparator).toBeNull();
      expect(sidebarContainer?.className).not.toContain("border-r");
      expect(sidebarContainer?.className).not.toContain("border-l");
      expect(header).toHaveClass("pt-[var(--app-safe-area-inset-top)]");
      expect(header).toHaveClass(
        "min-h-[calc(4rem+var(--app-safe-area-inset-top))]"
      );
      expect(header).toHaveClass(
        "group-has-data-[collapsible=icon]/sidebar-wrapper:min-h-[calc(3rem+var(--app-safe-area-inset-top))]"
      );
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

    it("applies the global light and dark layout classes", () => {
      const { container } = renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      const shell = container.querySelector('[data-slot="sidebar-wrapper"]');
      const main = screen.getByRole("main");

      expect(shell).not.toBeNull();
      if (!shell) {
        throw new Error("Expected sidebar wrapper shell to exist");
      }

      expect(shell).toHaveClass("min-h-[var(--app-shell-min-height)]");
      expect(shell).toHaveClass("has-data-[variant=inset]:bg-sidebar");
      expect(shell.className).not.toContain("dark:bg-zinc-900");
      expect(shell.className).not.toContain("dark:lg:bg-zinc-950");
      expect(main).toHaveClass("bg-background");
      expect(main.className).not.toContain("dark:bg-zinc-900");
    });

    it("renders the sidebar menu slots without grouped collapsible sections", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      const sidebarMenus = document.querySelectorAll(
        '[data-slot="sidebar-menu"]'
      );
      expect(sidebarMenus.length).toBeGreaterThan(0);
      expect(screen.getByText("Navigation")).toBeInTheDocument();
      expect(screen.queryByText("Operations")).not.toBeInTheDocument();
      expect(screen.queryByText("Administration")).not.toBeInTheDocument();
      expect(
        document.querySelector('[data-slot="sidebar-rail"]')
      ).toBeInTheDocument();
    });

    it("does not render settings as a direct sidebar navigation item", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>,
        { route: "/settings" }
      );

      const settingsSidebarLink = document.querySelector(
        '[data-slot="sidebar-menu-button"][href="/settings"]'
      );
      expect(settingsSidebarLink).toBeNull();
    });

    it("renders navigation links", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(
        document.querySelector('[data-slot="sidebar-menu-button"][href="/"]')
      ).toBeInTheDocument();
    });

    it("renders a collapsible legal section with source code above the user menu", async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(
        screen.queryByRole("link", { name: /agpl v3\+/i })
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /legal/i }));

      expect(
        screen.queryByRole("link", { name: /agpl v3\+/i })
      ).not.toBeInTheDocument();
      expect(
        await screen.findByRole("link", { name: /source code/i })
      ).toHaveAttribute("href", "/source");

      const legalTrigger = screen.getByRole("button", { name: /legal/i });
      const userMenuButton = screen.getByRole("button", { name: /user menu/i });
      expect(legalTrigger.compareDocumentPosition(userMenuButton)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    });

    it("renders user information in the sidebar footer avatar", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      const userMenuButton = screen.getByRole("button", { name: /user menu/i });
      expect(userMenuButton).toBeInTheDocument();
      const avatar = userMenuButton.querySelector('[data-slot="avatar"]');
      expect(avatar).toHaveClass("rounded-lg");
      expect(avatar?.className).not.toContain("bg-zinc-900");
    });

    it("opens and closes the mobile sidebar with Radix dialog semantics", async () => {
      const user = userEvent.setup();
      const originalInnerWidth = window.innerWidth;

      try {
        Object.defineProperty(window, "innerWidth", {
          configurable: true,
          value: 480,
        });

        renderWithProviders(
          <ApplicationLayout>
            <div>Content</div>
          </ApplicationLayout>
        );

        const sidebarTrigger = await screen.findByRole("button", {
          name: /toggle sidebar/i,
        });

        expect(sidebarTrigger).toHaveClass("size-11");
        expect(sidebarTrigger).toHaveClass("md:size-7");

        await user.click(sidebarTrigger);

        const dialog = await screen.findByRole("dialog", {
          name: /navigation/i,
        });
        const mobileSidebar = document.querySelector(
          '[data-slot="sidebar"][data-mobile="true"]'
        );
        expect(dialog).toBeInTheDocument();
        expect(
          document.querySelector('[data-slot="sheet-overlay"]')
        ).toBeInTheDocument();
        expect(mobileSidebar).toBeInTheDocument();
        expect(mobileSidebar).toHaveClass("border-r-0");
        expect(mobileSidebar).toHaveClass(
          "pt-[var(--app-safe-area-inset-top)]"
        );
        expect(
          mobileSidebar?.querySelector('[data-slot="sidebar-footer"]')
        ).toHaveClass(
          "pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]"
        );
        expect(mobileSidebar?.className).not.toContain("[&>button]:hidden");
        const mobileSidebarRail = mobileSidebar?.querySelector(
          '[data-slot="sidebar-rail"]'
        );
        expect(mobileSidebarRail).toBeInTheDocument();
        expect(mobileSidebarRail).toHaveClass("hidden");
        expect(mobileSidebarRail).toHaveClass("md:flex");
        expect(mobileSidebarRail?.className).not.toContain("sm:flex");

        await user.click(screen.getByRole("button", { name: /close/i }));

        await waitFor(() => {
          expect(
            screen.queryByRole("dialog", { name: /navigation/i })
          ).not.toBeInTheDocument();
        });
      } finally {
        Object.defineProperty(window, "innerWidth", {
          configurable: true,
          value: originalInnerWidth,
        });
      }
    });

    it("localizes the mobile sidebar dialog name in German", async () => {
      const user = userEvent.setup();
      const originalInnerWidth = window.innerWidth;

      try {
        Object.defineProperty(window, "innerWidth", {
          configurable: true,
          value: 480,
        });

        act(() => {
          i18n.load("de", deMessages);
          i18n.activate("de");
        });

        renderWithProviders(
          <ApplicationLayout>
            <div>Content</div>
          </ApplicationLayout>
        );

        const sidebarTrigger = document.querySelector(
          '[data-slot="sidebar-trigger"]'
        );

        if (!(sidebarTrigger instanceof HTMLButtonElement)) {
          throw new Error(
            "Expected the shared sidebar trigger button to render"
          );
        }

        await user.click(sidebarTrigger);

        expect(
          await screen.findByRole("dialog", { name: "Navigationsmenü" })
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: "Navigation schließen" })
        ).toBeInTheDocument();
      } finally {
        Object.defineProperty(window, "innerWidth", {
          configurable: true,
          value: originalInnerWidth,
        });
        act(() => {
          i18n.activate("en");
        });
      }
    });

    it("closes the mobile sidebar after primary navigation", async () => {
      const user = userEvent.setup();
      const originalInnerWidth = window.innerWidth;

      try {
        Object.defineProperty(window, "innerWidth", {
          configurable: true,
          value: 480,
        });

        await seedAuthenticatedUser({
          ...authenticatedUser,
          hasCustomerAccess: true,
        });

        renderWithProviders(
          <ApplicationLayout>
            <PathnameProbe />
          </ApplicationLayout>,
          { route: "/" }
        );

        await user.click(
          await screen.findByRole("button", { name: /toggle sidebar/i })
        );

        await screen.findByRole("dialog", {
          name: /navigation/i,
        });

        const customersLink = screen.getByRole("link", { name: /customers/i });
        expect(customersLink).toHaveClass("min-h-11");

        await user.click(customersLink);

        await waitFor(() => {
          expect(screen.getByTestId("pathname")).toHaveTextContent(
            "/customers"
          );
          expect(
            screen.queryByRole("dialog", { name: /navigation/i })
          ).not.toBeInTheDocument();
        });
      } finally {
        Object.defineProperty(window, "innerWidth", {
          configurable: true,
          value: originalInnerWidth,
        });
      }
    });

    it("opens the mobile user dropdown from the sidebar footer", async () => {
      const user = userEvent.setup();
      const originalInnerWidth = window.innerWidth;

      try {
        Object.defineProperty(window, "innerWidth", {
          configurable: true,
          value: 480,
        });

        renderWithProviders(
          <ApplicationLayout>
            <div>Content</div>
          </ApplicationLayout>
        );

        await user.click(
          await screen.findByRole("button", { name: /toggle sidebar/i })
        );

        const navigationDialog = await screen.findByRole("dialog", {
          name: /navigation/i,
        });
        const userMenuButton = within(navigationDialog).getByRole("button", {
          name: /user menu/i,
        });

        await user.click(userMenuButton);

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
      } finally {
        Object.defineProperty(window, "innerWidth", {
          configurable: true,
          value: originalInnerWidth,
        });
      }
    });

    it("renders user initials in avatar", async () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      // Avatar in navbar (stacked layout has avatar only in navbar)
      const avatars = await screen.findAllByText("JD");
      expect(avatars.length).toBeGreaterThanOrEqual(1);
    });

    it("uses the shared wide shell container for desktop content", () => {
      const { container } = renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      const contentContainer = container.querySelector(
        '[data-slot="sidebar-inset"] .grow > div'
      );

      expect(contentContainer).toHaveClass(
        ...APP_SHELL_MAX_WIDTH_CLASS.split(" ")
      );
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

      const homeLink = document.querySelector(
        '[data-slot="sidebar-menu-button"][href="/"]'
      );
      expect(homeLink).toHaveAttribute("data-active", "true");
    });

    it("shows the current standalone page in the breadcrumb", () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>,
        { route: "/about" }
      );

      expect(screen.getByRole("link", { current: "page" })).toHaveTextContent(
        "About"
      );
    });

    it("recomputes breadcrumb labels when the locale changes without navigation", async () => {
      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>,
        { route: "/settings" }
      );

      expect(screen.getByRole("link", { current: "page" })).toHaveTextContent(
        "Settings"
      );

      act(() => {
        i18n.load("de", deMessages);
        i18n.activate("de");
      });

      await waitFor(() => {
        expect(screen.getByRole("link", { current: "page" })).toHaveTextContent(
          "Einstellungen"
        );
      });
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
          document.querySelector('[data-slot="dropdown-menu-content"]')
        ).toBeInTheDocument();
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
      "shows a lock action in the navbar dropdown without calling the logout API",
      async () => {
        renderWithProviders(
          <ApplicationLayout>
            <div>Content</div>
          </ApplicationLayout>
        );

        await openUserMenu();

        const lockItem = await screen.findByRole(
          "menuitem",
          { name: /lock app/i },
          { timeout: QUERY_TIMEOUT }
        );

        fireEvent.click(lockItem);

        expect(authApi.logout).not.toHaveBeenCalled();
        expect(getStoredAuthState()).not.toBeNull();
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
      expect(getStoredAuthState()).toBeNull();
      await waitFor(() => {
        expect(clearSensitiveClientState).toHaveBeenCalledTimes(1);
      });
    });

    it("does not clear local state before API call completes, then clears it in finally (ordering guarantee)", async () => {
      let wasLocalStorageClearedBeforeApiCall = false;

      const mockLogout = vi.mocked(authApi.logout);
      mockLogout.mockImplementation(async () => {
        wasLocalStorageClearedBeforeApiCall = getStoredAuthState() === null;
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
      expect(getStoredAuthState()).toBeNull();

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
        await act(async () => {
          fireEvent.click(signOutButton);
          await Promise.resolve();
        });

        expect(mockLogout).toHaveBeenCalledTimes(1);
        expect(getStoredAuthState()).not.toBeNull();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(7999);
        });
        expect(getStoredAuthState()).not.toBeNull();

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
        expect(getStoredAuthState()).toBeNull();
        vi.useRealTimers();
        await waitFor(() => {
          expect(clearSensitiveClientState).toHaveBeenCalledTimes(1);
        });
      } finally {
        vi.useRealTimers();
        consoleSpy.mockRestore();
      }
    });
  });

  describe("getInitials helper", () => {
    it("generates correct initials for two-word name", async () => {
      await seedAuthenticatedUser({
        id: 1,
        name: "Jane Smith",
        email: "jane@secpal.dev",
      });

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      // Avatar in navbar (stacked layout has avatar only in navbar)
      const avatars = await screen.findAllByText("JS");
      expect(avatars.length).toBeGreaterThanOrEqual(1);
    });

    it("generates correct initials for single-word name", async () => {
      await seedAuthenticatedUser({
        id: 1,
        name: "Operations",
        email: "operations@secpal.dev",
      });

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      // Avatar in navbar (stacked layout has avatar only in navbar)
      const avatars = await screen.findAllByText("O");
      expect(avatars.length).toBeGreaterThanOrEqual(1);
    });

    it("generates correct initials for three-word name (max 2)", async () => {
      await seedAuthenticatedUser({
        id: 1,
        name: "John Paul Smith",
        email: "john@secpal.dev",
      });

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      // Avatar in navbar (stacked layout has avatar only in navbar)
      const avatars = await screen.findAllByText("JP");
      expect(avatars.length).toBeGreaterThanOrEqual(1);
    });

    it("shows fallback U when user name is missing", async () => {
      await seedAuthenticatedUser({
        id: 1,
        name: "   ",
        email: "user@secpal.dev",
      });

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
    it("hides Organization link when user has no organizational scopes", async () => {
      await seedAuthenticatedUser({
        id: 1,
        name: "John Doe",
        email: "john@secpal.dev",
        hasOrganizationalScopes: false,
      });

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.queryByText("Organization")).not.toBeInTheDocument();
    });

    it("hides Customers link when user has no organizational scopes", async () => {
      await seedAuthenticatedUser({
        id: 1,
        name: "John Doe",
        email: "john@secpal.dev",
        hasOrganizationalScopes: false,
      });

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.queryByText("Customers")).not.toBeInTheDocument();
    });

    it("keeps management links hidden for scope-only users", async () => {
      await seedAuthenticatedUser({
        id: 1,
        name: "John Doe",
        email: "john@secpal.dev",
        hasOrganizationalScopes: true,
        roles: [],
        permissions: [],
      });

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.queryByText("Organization")).not.toBeInTheDocument();
      expect(screen.queryByText("Customers")).not.toBeInTheDocument();
      expect(screen.queryByText("Employees")).not.toBeInTheDocument();
    });

    it("shows management links from explicit permissions and org scopes", async () => {
      await seedAuthenticatedUser({
        id: 1,
        name: "John Doe",
        email: "john@secpal.dev",
        hasOrganizationalScopes: true,
        roles: [],
        permissions: ["customers.read", "employees.read"],
      });

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(await screen.findByText("Organization")).toBeInTheDocument();
      expect(await screen.findByText("Customers")).toBeInTheDocument();
      expect(await screen.findByText("Employees")).toBeInTheDocument();
    });

    it("shows Customers for users with explicit customer permissions", async () => {
      await seedAuthenticatedUser({
        id: 1,
        name: "John Doe",
        email: "john@secpal.dev",
        hasOrganizationalScopes: false,
        roles: [],
        permissions: ["customers.read"],
      });

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(
        await screen.findByRole("link", { name: /customers/i })
      ).toBeInTheDocument();
      expect(screen.queryByText("Organization")).not.toBeInTheDocument();
      expect(screen.queryByText("Employees")).not.toBeInTheDocument();
    });

    it("shows Customers for users with backend scoped-access flags", async () => {
      await seedAuthenticatedUser({
        id: 1,
        name: "John Doe",
        email: "john@secpal.dev",
        hasOrganizationalScopes: false,
        hasCustomerAccess: true,
        roles: [],
        permissions: [],
      });

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(
        await screen.findByRole("link", { name: /customers/i })
      ).toBeInTheDocument();
      expect(screen.queryByText("Organization")).not.toBeInTheDocument();
      expect(screen.queryByText("Employees")).not.toBeInTheDocument();
    });

    it("always shows Home", async () => {
      await seedAuthenticatedUser({
        id: 1,
        name: "John Doe",
        email: "john@secpal.dev",
        hasOrganizationalScopes: false,
      });

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.getAllByText("Home").length).toBeGreaterThan(0);
    });

    it("treats undefined hasOrganizationalScopes as false", async () => {
      await seedAuthenticatedUser({
        id: 1,
        name: "John Doe",
        email: "john@secpal.dev",
      });

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
    it("renders the migrated footer surface", () => {
      const { container } = renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      const footer = container.querySelector('[data-slot="app-footer"]');
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveClass(
        "pb-[var(--app-footer-padding-bottom)]",
        "bg-background",
        "text-muted-foreground",
        "text-xs"
      );
      expect(footer?.className).not.toContain("bg-white");
      expect(footer?.className).not.toContain("dark:bg-zinc-900");
      expect(footer).toHaveTextContent(
        "Powered by SecPal – A guard's best friend"
      );
      expect(footer).not.toHaveTextContent("AGPL v3+");
      expect(footer).not.toHaveTextContent("Source Code");
      expect(footer?.firstElementChild).toHaveClass(
        ...APP_SHELL_MAX_WIDTH_CLASS.split(" ")
      );
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
      ).toHaveClass("text-xs");
    });
  });

  describe("Activity Logs Navigation", () => {
    it("shows Activity Logs menu item when user has permission", async () => {
      await seedAuthenticatedUser({
        id: 1,
        name: "Operations User",
        email: "operations@secpal.dev",
        permissions: ["activity_log.read"],
      });

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(await screen.findByText("Activity Logs")).toBeInTheDocument();
    });

    it("hides Activity Logs menu item when user lacks permission", async () => {
      await seedAuthenticatedUser({
        id: 1,
        name: "Regular User",
        email: "user@secpal.dev",
        permissions: [],
      });

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.queryByText("Activity Logs")).not.toBeInTheDocument();
    });

    it("highlights Activity Logs when on that page", async () => {
      await seedAuthenticatedUser({
        id: 1,
        name: "Operations User",
        email: "operations@secpal.dev",
        permissions: ["activity_log.read"],
      });

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>,
        { route: "/activity-logs" }
      );

      await waitFor(() => {
        const activityLogsLink = document.querySelector(
          '[data-slot="sidebar-menu-button"][href="/activity-logs"]'
        );
        expect(activityLogsLink).toHaveAttribute("data-active", "true");
      });
    });

    it("links to /activity-logs route", async () => {
      await seedAuthenticatedUser({
        id: 1,
        name: "Operations User",
        email: "operations@secpal.dev",
        permissions: ["activity_log.read"],
      });

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      const activityLogsLink = await screen.findByRole("link", {
        name: /activity logs/i,
      });
      expect(activityLogsLink).toHaveAttribute("href", "/activity-logs");
    });
  });

  describe("Android Provisioning Navigation", () => {
    afterEach(() => {
      act(() => {
        i18n.activate("en");
      });
    });

    it("renders the localized German label instead of the raw Lingui message id", async () => {
      act(() => {
        i18n.load("de", deMessages);
        i18n.activate("de");
      });

      await seedAuthenticatedUser({
        id: 1,
        name: "Operations User",
        email: "operations@secpal.dev",
        hasOrganizationalScopes: true,
        roles: [],
        permissions: ["android_enrollment.read"],
      });

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      await waitFor(() => {
        expect(screen.getAllByText("Android-Provisionierung").length).toBe(1);
      });
      expect(screen.queryByText("62KQbc")).not.toBeInTheDocument();
    });

    it("renders localized sidebar section labels and quick actions in German", async () => {
      act(() => {
        i18n.load("de", deMessages);
        i18n.activate("de");
      });

      await seedAuthenticatedUser({
        id: 1,
        name: "Operations User",
        email: "operations@secpal.dev",
        hasOrganizationalScopes: true,
        roles: [],
        permissions: ["customers.read", "android_enrollment.read"],
      });

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.getByText("Navigation")).toBeInTheDocument();
      expect(screen.getByText("Arbeitsbereich")).toBeInTheDocument();
      expect(screen.queryByText("Einstellungen")).not.toBeInTheDocument();
    });

    it("updates the active workspace subtitle when the locale changes after render", async () => {
      await seedAuthenticatedUser({
        id: 1,
        name: "Operations User",
        email: "operations@secpal.dev",
        hasOrganizationalScopes: true,
        roles: [],
        permissions: ["customers.read"],
      });

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(screen.getByText("Workspace")).toBeInTheDocument();

      act(() => {
        i18n.load("de", deMessages);
        i18n.activate("de");
      });

      await waitFor(() => {
        expect(screen.getByText("Arbeitsbereich")).toBeInTheDocument();
      });
    });

    it("hides the Android provisioning navigation entry without read access", async () => {
      await seedAuthenticatedUser({
        id: 1,
        name: "Operations User",
        email: "operations@secpal.dev",
        hasOrganizationalScopes: true,
        roles: [],
        permissions: ["activity_log.read"],
      });

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(
        screen.queryByRole("link", { name: "Android Provisioning" })
      ).not.toBeInTheDocument();
    });

    it("hides the Android provisioning navigation entry outside Android surfaces", async () => {
      appSurfaceMock.isAndroidSurface = false;

      await seedAuthenticatedUser({
        id: 1,
        name: "Operations User",
        email: "operations@secpal.dev",
        hasOrganizationalScopes: true,
        roles: [],
        permissions: ["android_enrollment.read"],
      });

      renderWithProviders(
        <ApplicationLayout>
          <div>Content</div>
        </ApplicationLayout>
      );

      expect(
        screen.queryByRole("link", { name: "Android Provisioning" })
      ).not.toBeInTheDocument();
    });
  });

  describe("migration boundary", () => {
    it("removes the legacy app shell implementation from the active UI surface", () => {
      expect(existsSync(join(process.cwd(), "src/ui/appShell.tsx"))).toBe(
        false
      );
    });

    it("keeps the migrated shell free of Headless, Heroicons and inline UI icon sources", () => {
      const forbiddenPatterns = [
        forbiddenHeadlessPackagePattern,
        forbiddenHeroiconsPackagePattern,
        forbiddenTailwindPlusLicenseMarkerPattern,
        /function \w+Icon\(/,
        /<svg\s+data-slot="icon"/,
      ];

      const violations = migratedShellFiles.flatMap((relativePath) => {
        const source = readFileSync(join(process.cwd(), relativePath), "utf8");
        return forbiddenPatterns
          .filter((pattern) => pattern.test(source))
          .map((pattern) => `${relativePath}: ${pattern}`);
      });

      expect(violations).toEqual([]);
    });
  });
});
