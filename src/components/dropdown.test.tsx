// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  it("renders link items with a full-width hit target", () => {
    renderOpenDropdown(
      <DropdownMenuItem href="/settings">Settings</DropdownMenuItem>
    );

    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveClass(
      "w-full"
    );
  });

  it("renders button items with a full-width hit target and click handler", () => {
    const onClick = vi.fn();

    renderOpenDropdown(
      <DropdownMenuItem onClick={onClick}>Lock app</DropdownMenuItem>
    );

    const menuItem = screen.getByRole("menuitem", { name: "Lock app" });

    expect(menuItem).toHaveClass("w-full");
    fireEvent.click(menuItem);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
