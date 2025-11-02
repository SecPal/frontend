// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders home page", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /SecPal/i })).toBeInTheDocument();
  });

  it("renders main content", () => {
    render(<App />);
    expect(
      screen.getByText(/SecPal - a guard's best friend/i)
    ).toBeInTheDocument();
  });

  it("renders about link", () => {
    render(<App />);
    expect(screen.getByText(/About/i)).toBeInTheDocument();
  });
});
