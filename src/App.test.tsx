// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import App from "./App";

const { mockGetCurrentUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
}));

vi.mock("./services/authApi", async () => {
  const actual = await vi.importActual("./services/authApi");
  return {
    ...actual,
    getCurrentUser: mockGetCurrentUser,
  };
});

// Helper to render with I18n and wait for async updates
async function renderWithI18n(component: React.ReactElement) {
  const result = render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
  // Wait for any async state updates to settle
  await waitFor(() => {});
  return result;
}

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, "", "/login");
    i18n.load("en", {});
    i18n.activate("en");
    mockGetCurrentUser.mockImplementation(async () => {
      const storedUser = localStorage.getItem("auth_user");

      return storedUser
        ? (JSON.parse(storedUser) as {
            id: number;
            name: string;
            email: string;
            roles?: string[];
            permissions?: string[];
            hasOrganizationalScopes?: boolean;
          })
        : {
            id: 1,
            name: "Fallback User",
            email: "fallback@secpal.dev",
          };
    });
  });

  it("renders login page when not authenticated", async () => {
    await renderWithI18n(<App />);
    expect(
      screen.getByRole("heading", { name: /SecPal/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Log in/i })
    ).toBeInTheDocument();
  });

  it("renders login form", async () => {
    await renderWithI18n(<App />);
    expect(
      screen.queryByText(/Your digital guard companion/i)
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("renders language switcher on login page", async () => {
    await renderWithI18n(<App />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("protects activity-logs route with permission check", async () => {
    window.history.replaceState({}, "", "/activity-logs");

    // Set authenticated user without activity_log.read permission
    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: 1,
        name: "User",
        email: "user@secpal.dev",
        permissions: [],
      })
    );

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(/Access Denied/i, {}, { timeout: 20000 })
    ).toBeInTheDocument();
  });

  it("shows access denied for the legacy organizational-units app route when the user lacks organizational access", async () => {
    window.history.replaceState({}, "", "/organizational-units");

    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: 1,
        name: "User",
        email: "user@secpal.dev",
        hasOrganizationalScopes: false,
      })
    );

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(/Access Denied/i, {}, { timeout: 20000 })
    ).toBeInTheDocument();
  });

  it("shows access denied for organization routes when the user only has scopes but no elevated feature capability", async () => {
    window.history.replaceState({}, "", "/organization");

    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: 1,
        name: "User",
        email: "user@secpal.dev",
        hasOrganizationalScopes: true,
        roles: [],
        permissions: [],
      })
    );

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(/Access Denied/i, {}, { timeout: 20000 })
    ).toBeInTheDocument();
  });

  it("shows a not found state for authenticated users on unknown app routes", async () => {
    window.history.replaceState({}, "", "/dashboard");

    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: 1,
        name: "User",
        email: "user@secpal.dev",
      })
    );

    await renderWithI18n(<App />);

    expect(
      await screen.findByText(/Page Not Found/i, {}, { timeout: 20000 })
    ).toBeInTheDocument();

    expect(window.location.pathname).toBe("/dashboard");
  });
});
