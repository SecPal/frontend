// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownMenu,
} from "@/ui";

function renderOpenDropdown(children: React.ReactNode) {
  return render(
    <MemoryRouter>
      <Dropdown open>
        <DropdownButton>Open</DropdownButton>
        <DropdownMenu>{children}</DropdownMenu>
      </Dropdown>
    </MemoryRouter>
  );
}

describe("DropdownItem", () => {
  it("renders link items with a full-width hit target", () => {
    renderOpenDropdown(<DropdownItem href="/settings">Settings</DropdownItem>);

    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveClass(
      "w-full"
    );
  });

  it("renders button items with a full-width hit target and click handler", () => {
    const onClick = vi.fn();

    renderOpenDropdown(<DropdownItem onClick={onClick}>Lock app</DropdownItem>);

    const menuItem = screen.getByRole("menuitem", { name: "Lock app" });

    expect(menuItem).toHaveClass("w-full");
    fireEvent.click(menuItem);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
