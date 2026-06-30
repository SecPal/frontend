// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * App-shell wrappers (`NavbarItem`, `SidebarMenuButton`, `DropdownMenuItem`) translate a
 * custom `href` prop into router navigation by
 * passing `to` to `react-router-dom`'s `<Link>`. Their wrapper API must not
 * also forward `href` as a separate prop into the underlying router `<Link>`:
 * the custom `href` is the wrapper-level API, not a prop the router consumes.
 *
 * react-router-dom v7's `Link` already overrides any spread `href` with its
 * own `useHref(to)`-derived value before rendering the `<a>`, so the leak is
 * silent at runtime today, but it couples the wrapper API to undocumented
 * router prop ordering and makes future router upgrades fragile.
 *
 * These tests assert that the wrapper destructures `href` out of its rest
 * props before spreading the rest onto `<Link>`.
 */

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

describe("App-shell router-link wrappers do not leak `href` into Link", () => {
  it("NavbarItem passes `to` and not `href` to react-router-dom Link", async () => {
    const { NavbarItem } = await import("@/ui");

    render(<NavbarItem href="/profile">Profile</NavbarItem>);

    const capture = findCapture("/profile");
    expect(capture).not.toHaveProperty("href");
  });

  it("SidebarMenuButton passes `to` and not `href` to react-router-dom Link", async () => {
    const { SidebarMenuButton } = await import("@/ui");

    render(<SidebarMenuButton href="/customers">Customers</SidebarMenuButton>);

    const capture = findCapture("/customers");
    expect(capture).not.toHaveProperty("href");
  });

  it("DropdownMenuItem passes `to` and not `href` to react-router-dom Link", async () => {
    const { DropdownMenuItem } = await import("@/ui");

    render(
      <DropdownMenuPrimitive.Root open>
        <DropdownMenuPrimitive.Trigger>Open</DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content>
            <DropdownMenuItem href="/settings">Settings</DropdownMenuItem>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    );

    const capture = findCapture("/settings");
    expect(capture).not.toHaveProperty("href");
  });
});
