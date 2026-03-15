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
            email: "fallback@example.com",
          };
    });
  });

  it("renders login page when not authenticated", async () => {
    await renderWithI18n(<App />);
    expect(
      screen.getByRole("heading", { name: /SecPal/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Login/i)).toBeInTheDocument();
  });

  it("renders login form", async () => {
    await renderWithI18n(<App />);
    expect(
      screen.getByText(/Your digital guard companion/i)
    ).toBeInTheDocument();
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
        email: "user@example.com",
        permissions: [],
      })
    );

    // This test verifies that the route structure includes PermissionRoute
    // Actual redirect behavior is tested in PermissionRoute.test.tsx
    await renderWithI18n(<App />);

    expect(
      await screen.findByRole(
        "heading",
        { name: /Welcome to SecPal/i },
        { timeout: 20000 }
      )
    ).toBeInTheDocument();
  });

  it("does not expose secrets navigation for authenticated users", async () => {
    window.history.replaceState({}, "", "/");

    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: 1,
        name: "User",
        email: "user@example.com",
        permissions: [],
      })
    );

    await renderWithI18n(<App />);

    expect(
      await screen.findByRole("heading", { name: /Welcome to SecPal/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("Secrets")).not.toBeInTheDocument();
    expect(screen.queryByText("View Secrets")).not.toBeInTheDocument();
  });
});
