// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ProfilePage } from "./ProfilePage";
import { AuthContext, type AuthContextType } from "../../contexts/auth-context";

// Helper to render with all required providers
const renderWithProviders = (
  component: React.ReactNode,
  authValue?: Partial<AuthContextType>
) => {
  const defaultAuthValue: AuthContextType = {
    user: {
      id: 1,
      name: "John Doe",
      email: "john.doe@example.com",
      roles: ["user"],
      permissions: ["secrets.read"],
    },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn().mockReturnValue(false),
    hasPermission: vi.fn().mockReturnValue(false),
    hasOrganizationalAccess: vi.fn().mockReturnValue(false),
    ...authValue,
  };

  return render(
    <AuthContext.Provider value={defaultAuthValue}>
      <I18nProvider i18n={i18n}>
        <MemoryRouter>{component}</MemoryRouter>
      </I18nProvider>
    </AuthContext.Provider>
  );
};

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup i18n with English locale
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders the profile page with heading", () => {
    renderWithProviders(<ProfilePage />);

    expect(
      screen.getByRole("heading", { name: /my profile/i })
    ).toBeInTheDocument();
  });

  it("displays the user name", () => {
    renderWithProviders(<ProfilePage />);

    // Name appears twice: in avatar section and description list
    const nameElements = screen.getAllByText("John Doe");
    expect(nameElements.length).toBeGreaterThanOrEqual(1);
  });

  it("displays the user email", () => {
    renderWithProviders(<ProfilePage />);

    // Email appears twice: in avatar section and description list
    const emailElements = screen.getAllByText("john.doe@example.com");
    expect(emailElements.length).toBeGreaterThanOrEqual(1);
  });

  it("displays name label", () => {
    renderWithProviders(<ProfilePage />);

    expect(screen.getByText(/name/i)).toBeInTheDocument();
  });

  it("displays email label", () => {
    renderWithProviders(<ProfilePage />);

    expect(screen.getByText(/email/i)).toBeInTheDocument();
  });

  it("has proper heading hierarchy", () => {
    renderWithProviders(<ProfilePage />);

    const mainHeading = screen.getByRole("heading", { name: /my profile/i });
    expect(mainHeading.tagName).toBe("H1");
  });

  it("displays user initials in avatar", () => {
    renderWithProviders(<ProfilePage />);

    // Avatar should show initials "JD" for John Doe
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("handles user with single name", () => {
    renderWithProviders(<ProfilePage />, {
      user: {
        id: 2,
        name: "Alice",
        email: "alice@example.com",
      },
    });

    // Name appears multiple times in UI
    const nameElements = screen.getAllByText("Alice");
    expect(nameElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("A")).toBeInTheDocument(); // Single initial
  });

  it("handles missing user gracefully", () => {
    renderWithProviders(<ProfilePage />, {
      user: null,
      isAuthenticated: false,
    });

    // Should still render without crashing
    expect(
      screen.getByRole("heading", { name: /my profile/i })
    ).toBeInTheDocument();
  });
});
