// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ComponentProps, ReactNode } from "react";
import { describe, beforeEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { MemoryRouter } from "react-router-dom";
import { messages as deMessages } from "@/locales/de/messages.mjs";
import { messages as enMessages } from "@/locales/en/messages.mjs";
import { NavUser } from "./nav-user";
import { DropdownMenu } from "@/ui/dropdown-menu";
import { useSidebar } from "@/ui/sidebar";

let lastDropdownMenuModal: ComponentProps<typeof DropdownMenu>["modal"];

vi.mock("@/ui/dropdown-menu", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ui/dropdown-menu")>();

  return {
    ...actual,
    DropdownMenu: (props: ComponentProps<typeof actual.DropdownMenu>) => {
      lastDropdownMenuModal = props.modal;
      return <actual.DropdownMenu {...props} />;
    },
  };
});

vi.mock("@/ui/sidebar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ui/sidebar")>();

  return {
    ...actual,
    SidebarMenu: ({ children }: { children: ReactNode }) => <ul>{children}</ul>,
    SidebarMenuButton: ({ children, ...props }: ComponentProps<"button">) => (
      <button {...props}>{children}</button>
    ),
    SidebarMenuItem: ({ children }: { children: ReactNode }) => (
      <li>{children}</li>
    ),
    useSidebar: vi.fn(),
  };
});

function renderNavUser({
  onLock,
  onLogout = () => {},
}: {
  onLock?: () => void;
  onLogout?: () => void;
} = {}) {
  return render(
    <MemoryRouter>
      <I18nProvider i18n={i18n}>
        <NavUser
          user={{ name: "Max Mustermann", email: "max@example.com" }}
          onLock={onLock}
          onLogout={onLogout}
        />
      </I18nProvider>
    </MemoryRouter>
  );
}

describe("NavUser", () => {
  const setOpenMobile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    lastDropdownMenuModal = undefined;
    i18n.load("en", enMessages);
    i18n.load("de", deMessages);
    vi.mocked(useSidebar).mockReturnValue({
      isMobile: false,
      open: true,
      openMobile: false,
      setOpen: vi.fn(),
      setOpenMobile,
      state: "expanded",
      toggleSidebar: vi.fn(),
    });
  });

  it("localizes the user menu trigger label", () => {
    i18n.activate("de");

    renderNavUser();

    expect(
      screen.getByRole("button", { name: "Benutzermenü" })
    ).toBeInTheDocument();
  });

  it("keeps the user menu dropdown at its natural content width", async () => {
    const user = userEvent.setup();

    renderNavUser();

    await user.click(screen.getByRole("button", { name: /user menu/i }));

    const dropdown = screen
      .getByRole("menuitem", { name: /my profile/i })
      .closest('[data-slot="dropdown-menu-content"]');

    expect(dropdown).not.toBeNull();
    expect(dropdown).toHaveClass("w-fit", "min-w-fit");
    expect(dropdown!.className).not.toContain(
      "w-(--radix-dropdown-menu-trigger-width)"
    );
    expect(dropdown!.className).not.toContain("min-w-56");
  });

  it("disables dropdown modality inside the mobile sidebar", () => {
    vi.mocked(useSidebar).mockReturnValue({
      isMobile: true,
      open: true,
      openMobile: true,
      setOpen: vi.fn(),
      setOpenMobile,
      state: "expanded",
      toggleSidebar: vi.fn(),
    });

    renderNavUser();

    expect(lastDropdownMenuModal).toBe(false);
  });

  it("closes the mobile sidebar before navigating from the user menu", async () => {
    const user = userEvent.setup();
    vi.mocked(useSidebar).mockReturnValue({
      isMobile: true,
      open: true,
      openMobile: true,
      setOpen: vi.fn(),
      setOpenMobile,
      state: "expanded",
      toggleSidebar: vi.fn(),
    });

    renderNavUser();

    await user.click(screen.getByRole("button", { name: /user menu/i }));
    await user.click(
      await screen.findByRole("menuitem", { name: /settings/i })
    );

    expect(setOpenMobile).toHaveBeenCalledWith(false);
  });

  it("closes the mobile sidebar before locking the app", async () => {
    const user = userEvent.setup();
    const onLock = vi.fn();
    vi.mocked(useSidebar).mockReturnValue({
      isMobile: true,
      open: true,
      openMobile: true,
      setOpen: vi.fn(),
      setOpenMobile,
      state: "expanded",
      toggleSidebar: vi.fn(),
    });

    renderNavUser({ onLock });

    await user.click(screen.getByRole("button", { name: /user menu/i }));
    await user.click(
      await screen.findByRole("menuitem", { name: /lock app/i })
    );

    const closeSidebarCallOrder = setOpenMobile.mock.invocationCallOrder[0];
    const lockAppCallOrder = onLock.mock.invocationCallOrder[0];

    expect(setOpenMobile).toHaveBeenCalledWith(false);
    expect(closeSidebarCallOrder).toBeDefined();
    expect(lockAppCallOrder).toBeDefined();
    expect(closeSidebarCallOrder!).toBeLessThan(lockAppCallOrder!);
  });

  it("closes the mobile sidebar before signing out", async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();
    vi.mocked(useSidebar).mockReturnValue({
      isMobile: true,
      open: true,
      openMobile: true,
      setOpen: vi.fn(),
      setOpenMobile,
      state: "expanded",
      toggleSidebar: vi.fn(),
    });

    renderNavUser({ onLogout });

    await user.click(screen.getByRole("button", { name: /user menu/i }));
    await user.click(
      await screen.findByRole("menuitem", { name: /sign out/i })
    );

    const closeSidebarCallOrder = setOpenMobile.mock.invocationCallOrder[0];
    const logoutCallOrder = onLogout.mock.invocationCallOrder[0];

    expect(setOpenMobile).toHaveBeenCalledWith(false);
    expect(closeSidebarCallOrder).toBeDefined();
    expect(logoutCallOrder).toBeDefined();
    expect(closeSidebarCallOrder!).toBeLessThan(logoutCallOrder!);
  });
});
