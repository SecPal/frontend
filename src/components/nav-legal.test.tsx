// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { messages as enMessages } from "@/locales/en/messages.mjs";
import { NavLegal } from "./nav-legal";
import { useSidebar } from "@/ui/sidebar";

vi.mock("@/ui/sidebar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ui/sidebar")>();

  return {
    ...actual,
    SidebarGroup: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    SidebarGroupLabel: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    SidebarMenu: ({ children }: { children: ReactNode }) => <ul>{children}</ul>,
    SidebarMenuButton: ({
      children,
      asChild,
      ...props
    }: {
      children: ReactNode;
      asChild?: boolean;
    } & Record<string, unknown>) =>
      asChild ? <>{children}</> : <button {...props}>{children}</button>,
    SidebarMenuItem: ({ children }: { children: ReactNode }) => (
      <li>{children}</li>
    ),
    SidebarMenuSub: ({ children }: { children: ReactNode }) => (
      <ul>{children}</ul>
    ),
    SidebarMenuSubButton: ({
      children,
      asChild,
      ...props
    }: {
      children: ReactNode;
      asChild?: boolean;
    } & Record<string, unknown>) =>
      asChild ? <>{children}</> : <a {...props}>{children}</a>,
    SidebarMenuSubItem: ({ children }: { children: ReactNode }) => (
      <li>{children}</li>
    ),
    useSidebar: vi.fn(),
  };
});

function LocationStateProbe() {
  const location = useLocation();

  return (
    <output data-testid="location-state">
      {JSON.stringify(location.state ?? null)}
    </output>
  );
}

describe("NavLegal", () => {
  const setOpenMobile = vi.fn();
  const setOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", enMessages);
    i18n.activate("en");
    vi.mocked(useSidebar).mockReturnValue({
      isMobile: false,
      open: true,
      openMobile: false,
      setOpen,
      setOpenMobile,
      state: "expanded",
      toggleSidebar: vi.fn(),
    });
  });

  it("renders legal-page placeholders above the open-source links", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <I18nProvider i18n={i18n}>
          <NavLegal />
        </I18nProvider>
      </MemoryRouter>
    );

    expect(
      screen.queryByRole("link", { name: /agpl v3\+/i })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /legal/i }));

    expect(await screen.findByText(/legal pages/i)).toBeInTheDocument();
    expect(screen.getByText(/imprint/i)).toBeInTheDocument();
    expect(screen.getByText(/privacy/i)).toBeInTheDocument();
    expect(screen.getByText(/open source/i)).toBeInTheDocument();

    const licenseLink = await screen.findByRole("link", { name: /agpl v3\+/i });
    expect(licenseLink).toHaveAttribute(
      "href",
      "https://www.gnu.org/licenses/agpl-3.0.html"
    );
    expect(licenseLink).toHaveAttribute("target", "_blank");
    expect(licenseLink).toHaveAttribute("rel", "noopener noreferrer");

    const sourceCodeLink = screen.getByRole("link", { name: /source code/i });
    expect(sourceCodeLink).toHaveAttribute("href", "/source");
  });

  it("preserves the current route when navigating to source code", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/customers/new?draft=1#notes"]}>
        <I18nProvider i18n={i18n}>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  <NavLegal />
                  <LocationStateProbe />
                </>
              }
            />
            <Route path="/source" element={<LocationStateProbe />} />
          </Routes>
        </I18nProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /legal/i }));
    await user.click(await screen.findByRole("link", { name: /source code/i }));

    expect(screen.getByTestId("location-state")).toHaveTextContent(
      JSON.stringify({ sourceReturnTo: "/customers/new?draft=1#notes" })
    );
  });

  it("closes the mobile sidebar after legal navigation", async () => {
    const user = userEvent.setup();
    vi.mocked(useSidebar).mockReturnValue({
      isMobile: true,
      open: true,
      openMobile: true,
      setOpen,
      setOpenMobile,
      state: "expanded",
      toggleSidebar: vi.fn(),
    });

    render(
      <MemoryRouter>
        <I18nProvider i18n={i18n}>
          <NavLegal />
        </I18nProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /legal/i }));
    await user.click(await screen.findByRole("link", { name: /source code/i }));

    expect(setOpenMobile).toHaveBeenCalledWith(false);
  });

  it("shows the legal links in a separate dropdown when the desktop sidebar is collapsed", async () => {
    const user = userEvent.setup();

    vi.mocked(useSidebar).mockReturnValue({
      isMobile: false,
      open: false,
      openMobile: false,
      setOpen,
      setOpenMobile,
      state: "collapsed",
      toggleSidebar: vi.fn(),
    });

    render(
      <MemoryRouter>
        <I18nProvider i18n={i18n}>
          <NavLegal />
        </I18nProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /legal/i }));

    expect(setOpen).not.toHaveBeenCalled();
    expect(await screen.findByText(/legal pages/i)).toBeInTheDocument();
    expect(screen.getByText(/open source/i)).toBeInTheDocument();
  });

  it("keeps the source code link available in the collapsed desktop dropdown on source routes", async () => {
    const user = userEvent.setup();

    vi.mocked(useSidebar).mockReturnValue({
      isMobile: false,
      open: false,
      openMobile: false,
      setOpen,
      setOpenMobile,
      state: "collapsed",
      toggleSidebar: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/source"]}>
        <I18nProvider i18n={i18n}>
          <NavLegal />
        </I18nProvider>
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: /legal/i }));

    expect(setOpen).not.toHaveBeenCalled();
    expect(await screen.findByText(/legal pages/i)).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /source code/i })
    ).toHaveAttribute("href", "/source");
  });

  it("blurs the collapsed legal trigger after pointer dismissal outside the dropdown", async () => {
    const user = userEvent.setup();

    vi.mocked(useSidebar).mockReturnValue({
      isMobile: false,
      open: false,
      openMobile: false,
      setOpen,
      setOpenMobile,
      state: "collapsed",
      toggleSidebar: vi.fn(),
    });

    render(
      <MemoryRouter>
        <I18nProvider i18n={i18n}>
          <NavLegal />
        </I18nProvider>
      </MemoryRouter>
    );

    const trigger = screen.getByRole("button", { name: /legal/i });

    await user.click(trigger);
    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);
    fireEvent.click(document.body);

    await waitFor(() => {
      expect(document.activeElement).not.toBe(trigger);
    });
  });
});
