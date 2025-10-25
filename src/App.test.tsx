// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders welcome message", () => {
    render(<App />);
    expect(screen.getByText(/SecPal Frontend/i)).toBeInTheDocument();
  });

  it("renders main content", () => {
    render(<App />);
    expect(
      screen.getByText(/Welcome to SecPal - Your secure platform/i)
    ).toBeInTheDocument();
  });
});
