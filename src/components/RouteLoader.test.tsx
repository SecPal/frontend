// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouteLoader } from "./RouteLoader";

describe("RouteLoader", () => {
  it("renders loading spinner", () => {
    render(<RouteLoader />);

    // Check for the spinner container
    const spinnerContainer = screen.getByRole("status");
    expect(spinnerContainer).toBeInTheDocument();
  });

  it("has correct accessibility attributes", () => {
    render(<RouteLoader />);

    const statusElement = screen.getByRole("status");
    expect(statusElement).toHaveAttribute("aria-live", "polite");
  });

  it("includes screen reader text", () => {
    render(<RouteLoader />);

    // Check for sr-only text
    const srText = screen.getByText("Loading...");
    expect(srText).toBeInTheDocument();
    expect(srText).toHaveClass("sr-only");
  });

  it("renders with correct styling classes", () => {
    const { container } = render(<RouteLoader />);

    // Check container has flexbox centering
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass(
      "flex",
      "items-center",
      "justify-center",
      "min-h-screen"
    );
  });

  it("renders spinner with animation", () => {
    const { container } = render(<RouteLoader />);

    // Find the spinner div
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass(
      "rounded-full",
      "h-12",
      "w-12",
      "border-b-2",
      "border-blue-600"
    );
  });
});
