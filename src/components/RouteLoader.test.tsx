// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouteLoader } from "./RouteLoader";

describe("RouteLoader", () => {
  it("renders a shell-equivalent loading placeholder", () => {
    render(<RouteLoader />);

    expect(screen.getByRole("img", { name: "SecPal" })).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /loading application/i })
    ).toBeInTheDocument();
  });

  it("has correct accessibility attributes on the content skeleton", () => {
    render(<RouteLoader />);

    const statusElement = screen.getByRole("status", {
      name: /loading application/i,
    });
    expect(statusElement).toHaveAttribute("aria-live", "polite");
    expect(statusElement).toHaveAttribute("aria-busy", "true");
  });

  it("does not render the old raw loading copy", () => {
    render(<RouteLoader />);

    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("renders with shell styling classes", () => {
    const { container } = render(<RouteLoader />);

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass(
      "relative",
      "isolate",
      "flex",
      "min-h-dvh",
      "w-full",
      "flex-col"
    );
  });

  it("renders skeleton placeholders instead of a spinner", () => {
    const { container } = render(<RouteLoader />);

    expect(container.querySelector(".animate-spin")).not.toBeInTheDocument();
    expect(
      container.querySelectorAll('[data-slot="ui-skeleton"]').length
    ).toBeGreaterThan(0);
  });
});
