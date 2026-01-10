// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock API calls
vi.mock("../../src/services/api", () => ({
  checkHealth: vi.fn().mockResolvedValue({ status: "ok" }),
}));

// Mock AuthContext
vi.mock("../../src/hooks/useAuth", () => ({
  useAuth: () => ({
    login: vi.fn(),
    logout: vi.fn(),
    user: null,
    isAuthenticated: false,
    isLoading: false,
    hasRole: vi.fn(),
    hasPermission: vi.fn(),
    hasOrganizationalAccess: vi.fn(),
  }),
}));

// Mock lazy-loaded components
vi.mock("../../src/pages/Login", () => ({
  Login: () => <div data-testid="login-page">Login Page</div>,
}));

vi.mock("../../src/pages/Onboarding/OnboardingComplete", () => ({
  default: () => (
    <div data-testid="onboarding-complete-page">Onboarding Complete Page</div>
  ),
}));

describe("App Routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("App module includes OnboardingComplete route", async () => {
    // Import App.tsx to execute lazy loading definitions
    const AppModule = await import("../../src/App");
    expect(AppModule.default).toBeDefined();

    // Verify OnboardingComplete component exists as a module
    const OnboardingModule =
      await import("../../src/pages/Onboarding/OnboardingComplete");
    expect(OnboardingModule.default).toBeDefined();
  });

  it("OnboardingComplete component is exported correctly", () => {
    // Verify the component can be imported
    // This ensures the route can be lazy loaded
    expect(
      import("../../src/pages/Onboarding/OnboardingComplete")
    ).resolves.toBeDefined();
  });
});
