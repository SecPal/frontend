// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

const { capturedLinkProps } = vi.hoisted(() => ({
  capturedLinkProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom"
    );
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
  it("SidebarMenuButton composes with Link via `asChild` without leaking `href`", async () => {
    const { Link } = await import("react-router-dom");
    const { SidebarProvider, SidebarMenuButton } = await import("@/ui");

    render(
      <SidebarProvider>
        <SidebarMenuButton asChild>
          <Link to="/customers">Customers</Link>
        </SidebarMenuButton>
      </SidebarProvider>
    );

    const capture = findCapture("/customers");
    expect(capture).not.toHaveProperty("href");
  });

  it("SidebarMenuSubButton composes with Link via `asChild` without leaking `href`", async () => {
    const { Link } = await import("react-router-dom");
    const { SidebarMenuSubButton } = await import("@/ui");

    render(
      <SidebarMenuSubButton asChild>
        <Link to="/profile">Profile</Link>
      </SidebarMenuSubButton>
    );

    const capture = findCapture("/profile");
    expect(capture).not.toHaveProperty("href");
  });

  it("DropdownMenuItem composes with Link via `asChild` without leaking `href`", async () => {
    const { Link } = await import("react-router-dom");
    const { DropdownMenuItem } = await import("@/ui");

    render(
      <DropdownMenuPrimitive.Root open>
        <DropdownMenuPrimitive.Trigger>Open</DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content>
            <DropdownMenuItem asChild>
              <Link to="/settings">Settings</Link>
            </DropdownMenuItem>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    );

    const capture = findCapture("/settings");
    expect(capture).not.toHaveProperty("href");
  });
});
