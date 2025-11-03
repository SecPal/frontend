// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import App from "./App";

// Helper to render with I18n
function renderWithI18n(component: React.ReactElement) {
  return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
}

describe("App", () => {
  it("renders home page", () => {
    renderWithI18n(<App />);
    expect(
      screen.getByRole("heading", { name: /SecPal/i })
    ).toBeInTheDocument();
  });

  it("renders main content", () => {
    renderWithI18n(<App />);
    expect(
      screen.getByText(/SecPal - a guard's best friend/i)
    ).toBeInTheDocument();
  });

  it("renders about link", () => {
    renderWithI18n(<App />);
    expect(screen.getByText(/About/i)).toBeInTheDocument();
  });
});
