// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import App from "./App";

// Helper to render with I18n
function renderWithI18n(component: React.ReactElement) {
  return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
}

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders login page when not authenticated", () => {
    renderWithI18n(<App />);
    expect(
      screen.getByRole("heading", { name: /SecPal/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Sign in to your account/i)).toBeInTheDocument();
  });

  it("renders login form", () => {
    renderWithI18n(<App />);
    expect(
      screen.getByText(/SecPal - a guard's best friend/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });

  it("renders language switcher on login page", () => {
    renderWithI18n(<App />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
