// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function renderInteractiveDropdown(children: React.ReactNode) {
  return render(
    <MemoryRouter>
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>{children}</DropdownMenuContent>
      </DropdownMenu>
    </MemoryRouter>
  );
}

describe("DropdownMenuItem", () => {
  it("blurs the trigger after pointer selection without changing keyboard focus behavior", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    renderInteractiveDropdown(
      <DropdownMenuItem onClick={onClick}>Lock app</DropdownMenuItem>
    );

    const trigger = screen.getByRole("button", { name: "Open" });
    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: "Lock app" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(document.activeElement).not.toBe(trigger);
    });
  });

  it("returns focus to the trigger after keyboard selection", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    renderInteractiveDropdown(
      <DropdownMenuItem onClick={onClick}>Lock app</DropdownMenuItem>
    );

    const trigger = screen.getByRole("button", { name: "Open" });
    trigger.focus();
    await user.keyboard("{Enter}{ArrowDown}{Enter}");

    expect(onClick).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it("blurs the trigger after pointer dismissal outside the menu", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Lock app</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </MemoryRouter>
    );

    const trigger = screen.getByRole("button", { name: "Open" });
    await user.click(trigger);
    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);
    fireEvent.click(document.body);

    await waitFor(() => {
      expect(document.activeElement).not.toBe(trigger);
    });
  });

  it("keeps focus on the next control when a pointer close targets another button", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Lock app</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button type="button">Next action</button>
      </MemoryRouter>
    );

    const trigger = screen.getByRole("button", { name: "Open" });
    const nextButton = screen.getByRole("button", { name: "Next action" });

    await user.click(trigger);
    fireEvent.pointerDown(nextButton);
    nextButton.focus();
    fireEvent.mouseDown(nextButton);
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(document.activeElement).toBe(nextButton);
    });
  });

  it("renders dropdown content without the legacy border frame", () => {
    renderOpenDropdown(<DropdownMenuItem>Settings</DropdownMenuItem>);

    const content = screen
      .getByRole("menuitem", { name: "Settings" })
      .closest('[data-slot="dropdown-menu-content"]');

    expect(content).not.toBeNull();
    expect(content!.className).not.toContain(" border ");
    expect(content!.className).not.toContain("border bg-popover");
  });

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

  it("keeps destructive items on the canonical shadcn descendant svg selector", () => {
    renderOpenDropdown(
      <DropdownMenuItem variant="destructive">Delete unit</DropdownMenuItem>
    );

    const menuItem = screen.getByRole("menuitem", { name: "Delete unit" });

    expect(menuItem).toHaveClass(
      "data-[variant=destructive]:text-destructive",
      "data-[variant=destructive]:[&_svg]:text-destructive"
    );
    expect(menuItem.className).not.toContain("*:[svg]:text-destructive!");
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
