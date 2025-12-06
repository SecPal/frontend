// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Spinner, SpinnerContainer } from "./spinner";

describe("Spinner", () => {
  it("renders with default medium size", () => {
    const { container } = render(<Spinner />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass("h-8", "w-8", "border-2");
  });

  it("renders with small size", () => {
    const { container } = render(<Spinner size="sm" />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toHaveClass("h-4", "w-4", "border-2");
  });

  it("renders with large size", () => {
    const { container } = render(<Spinner size="lg" />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toHaveClass("h-12", "w-12", "border-b-2");
  });

  it("has proper accessibility attributes", () => {
    render(<Spinner />);
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("accepts custom className", () => {
    const { container } = render(<Spinner className="custom-class" />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toHaveClass("custom-class");
  });
});

describe("SpinnerContainer", () => {
  it("renders centered spinner by default", () => {
    const { container } = render(<SpinnerContainer />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
    expect(container.firstChild).toHaveClass(
      "flex",
      "items-center",
      "justify-center"
    );
  });

  it("renders custom children", () => {
    render(
      <SpinnerContainer>
        <div data-testid="custom-content">Custom content</div>
      </SpinnerContainer>
    );
    expect(screen.getByTestId("custom-content")).toBeInTheDocument();
  });

  it("accepts custom className", () => {
    const { container } = render(<SpinnerContainer className="custom-class" />);
    expect(container.firstChild).toHaveClass("custom-class");
  });
});
