// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { Menu as DropdownMenuPrimitive } from "@base-ui/react/menu";

const { capturedLinkProps } = vi.hoisted(() => ({
  capturedLinkProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("react-router", async () => {
  const actual =
    await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    Link: ({
      children,
      to,
      ...rest
    }: {
      children?: React.ReactNode;
      to?: unknown;
      [key: string]: unknown;
    }) => {
      capturedLinkProps.push({ to, ...rest });
      return (
        <a
          href={typeof to === "string" ? to : "#"}
          data-testid="captured-link"
          {...rest}
        >
          {children as React.ReactNode}
        </a>
      );
    },
  };
});

beforeEach(() => {
  capturedLinkProps.length = 0;
});

function findCapture(targetTo: string) {
  const matches = capturedLinkProps.filter((props) => props.to === targetTo);
  if (matches.length === 0) {
    throw new Error(
      `No captured Link had to=${targetTo}; captured: ${JSON.stringify(
        capturedLinkProps
      )}`
    );
  }
  return matches[matches.length - 1];
}

describe("shadcn router-link composition keeps Link props clean", () => {
  it("SidebarMenuButton composes with Link via `render` without leaking `href`", async () => {
    const { Link } = await import("react-router");
    const { SidebarProvider, SidebarMenuButton } = await import("@/ui");

    render(
      <SidebarProvider>
        <SidebarMenuButton render={<Link to="/customers" />}>
          Customers
        </SidebarMenuButton>
      </SidebarProvider>
    );

    const capture = findCapture("/customers");
    expect(capture).not.toHaveProperty("href");
  });

  it("SidebarMenuSubButton composes with Link via `render` without leaking `href`", async () => {
    const { Link } = await import("react-router");
    const { SidebarMenuSubButton } = await import("@/ui");

    render(
      <SidebarMenuSubButton render={<Link to="/profile" />}>
        Profile
      </SidebarMenuSubButton>
    );

    const capture = findCapture("/profile");
    expect(capture).not.toHaveProperty("href");
  });

  it("DropdownMenuItem composes with Link via `render` without leaking `href`", async () => {
    const { Link } = await import("react-router");
    const { DropdownMenuItem } = await import("@/ui");

    render(
      <DropdownMenuPrimitive.Root open>
        <DropdownMenuPrimitive.Trigger>Open</DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Positioner>
            <DropdownMenuPrimitive.Popup>
              <DropdownMenuItem render={<Link to="/settings" />}>
                Settings
              </DropdownMenuItem>
            </DropdownMenuPrimitive.Popup>
          </DropdownMenuPrimitive.Positioner>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    );

    const capture = findCapture("/settings");
    expect(capture).not.toHaveProperty("href");
  });
});
