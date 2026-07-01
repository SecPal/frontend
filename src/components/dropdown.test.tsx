// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PrefetchLink } from "@/components/PrefetchLink";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/ui";

function renderOpenDropdown(children: React.ReactNode) {
  return render(
    <MemoryRouter>
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>{children}</DropdownMenuContent>
      </DropdownMenu>
    </MemoryRouter>
  );
}

describe("DropdownMenuItem", () => {
  it("supports `asChild` link composition", () => {
    renderOpenDropdown(
      <DropdownMenuItem asChild>
        <PrefetchLink to="/settings">Settings</PrefetchLink>
      </DropdownMenuItem>
    );

    const menuItem = screen.getByRole("menuitem", { name: "Settings" });
    expect(menuItem).toHaveAttribute("href", "/settings");
    expect(menuItem).toHaveAttribute("data-slot", "dropdown-menu-item");
  });

  it("renders button items with click handler support", () => {
    const onClick = vi.fn();

    renderOpenDropdown(
      <DropdownMenuItem onClick={onClick}>Lock app</DropdownMenuItem>
    );

    const menuItem = screen.getByRole("menuitem", { name: "Lock app" });

    expect(menuItem).toHaveAttribute("data-slot", "dropdown-menu-item");
    fireEvent.click(menuItem);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders item labels as inline content instead of nested menu section labels", () => {
    renderOpenDropdown(
      <DropdownMenuItem asChild>
        <PrefetchLink to="/settings">
          <DropdownMenuLabel>Settings</DropdownMenuLabel>
        </PrefetchLink>
      </DropdownMenuItem>
    );

    const label = screen.getByText("Settings");

    expect(label.tagName).toBe("DIV");
    expect(label).toHaveAttribute("data-slot", "dropdown-menu-label");
  });
});
