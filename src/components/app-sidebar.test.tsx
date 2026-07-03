// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppSidebar } from "./app-sidebar";

vi.mock("@/components/nav-main", () => ({
  NavMain: () => <div data-testid="nav-main">Main navigation</div>,
}));

vi.mock("@/components/nav-legal", () => ({
  NavLegal: () => <div data-testid="nav-legal">Legal navigation</div>,
}));

vi.mock("@/components/nav-user", () => ({
  NavUser: () => <div data-testid="nav-user">User navigation</div>,
}));

vi.mock("@/components/team-switcher", () => ({
  TeamSwitcher: () => <div data-testid="team-switcher">Workspace switcher</div>,
}));

vi.mock("@/components/Logo", () => ({
  Logo: () => <div data-testid="logo">Logo</div>,
}));

vi.mock("@/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: ReactNode }) => (
    <aside data-testid="sidebar">{children}</aside>
  ),
  SidebarHeader: ({ children }: { children: ReactNode }) => (
    <div data-slot="sidebar-header">{children}</div>
  ),
  SidebarContent: ({ children }: { children: ReactNode }) => (
    <div data-slot="sidebar-content">{children}</div>
  ),
  SidebarFooter: ({ children }: { children: ReactNode }) => (
    <div data-slot="sidebar-footer">{children}</div>
  ),
  SidebarRail: () => <div data-testid="sidebar-rail" />,
}));

describe("AppSidebar", () => {
  it("keeps legal navigation inside the scrollable sidebar content and leaves the footer for the user menu", () => {
    render(
      <AppSidebar
        navMain={[]}
        user={{ name: "Max Mustermann", email: "max@example.com" }}
        onLogout={() => undefined}
      />
    );

    const sidebarContent = screen
      .getByTestId("nav-main")
      .closest('[data-slot="sidebar-content"]');
    const sidebarFooter = screen
      .getByTestId("nav-user")
      .closest('[data-slot="sidebar-footer"]');

    expect(sidebarContent).not.toBeNull();
    expect(sidebarFooter).not.toBeNull();
    expect(
      within(sidebarContent as HTMLElement).getByTestId("nav-legal")
    ).toBeInTheDocument();
    expect(
      within(sidebarFooter as HTMLElement).queryByTestId("nav-legal")
    ).not.toBeInTheDocument();
    expect(
      within(sidebarFooter as HTMLElement).getByTestId("nav-user")
    ).toBeInTheDocument();
  });
});
