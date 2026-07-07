// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { OrganizationalRoute } from "./OrganizationalRoute";
import * as authHook from "../hooks/useAuth";

vi.mock("../hooks/useAuth");

describe("OrganizationalRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders revalidatingFallback during snapshot revalidation for a verified persisted user", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      hasPermission: vi.fn(),
      isLoading: true,
      isAuthenticated: true,
      bootstrapRecoveryReason: null,
      user: {
        id: "1",
        name: "User",
        email: "user@secpal.dev",
        emailVerified: true,
      },
      login: vi.fn(),
      logout: vi.fn(),
      retryBootstrap: vi.fn(),
      hasOrganizationalAccess: vi.fn(() => true),
    });

    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/organization"]}>
          <Routes>
            <Route
              path="/organization"
              element={
                <OrganizationalRoute
                  revalidatingFallback={<div>Revalidating fallback</div>}
                >
                  <div>Organization Content</div>
                </OrganizationalRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(screen.getByText("Revalidating fallback")).toBeInTheDocument();
    expect(screen.queryByText("Organization Content")).not.toBeInTheDocument();
  });

  it("still runs the email verification gate during revalidation for an unverified persisted user", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      hasPermission: vi.fn(),
      isLoading: true,
      isAuthenticated: true,
      bootstrapRecoveryReason: null,
      user: {
        id: "1",
        name: "User",
        email: "user@secpal.dev",
        emailVerified: false,
      },
      login: vi.fn(),
      logout: vi.fn(),
      retryBootstrap: vi.fn(),
      hasOrganizationalAccess: vi.fn(() => true),
    });

    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/organization"]}>
          <Routes>
            <Route
              path="/organization"
              element={
                <OrganizationalRoute
                  revalidatingFallback={<div>Revalidating fallback</div>}
                >
                  <div>Organization Content</div>
                </OrganizationalRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(
      screen.getByRole("heading", { name: /verify your email address/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("Revalidating fallback")).not.toBeInTheDocument();
    expect(screen.queryByText("Organization Content")).not.toBeInTheDocument();
  });

  it("derives the privacy shield from isPrivacyShielded when sensitiveUiState is omitted", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      hasPermission: vi.fn(),
      isLoading: false,
      isAuthenticated: true,
      isPrivacyShielded: true,
      bootstrapRecoveryReason: null,
      user: {
        id: "1",
        name: "User",
        email: "user@secpal.dev",
        emailVerified: true,
      },
      login: vi.fn(),
      logout: vi.fn(),
      retryBootstrap: vi.fn(),
      hidePrivacyShield: vi.fn(),
      hasOrganizationalAccess: vi.fn(() => true),
    });

    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/organization"]}>
          <Routes>
            <Route
              path="/organization"
              element={
                <OrganizationalRoute>
                  <div>Organization Content</div>
                </OrganizationalRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(
      screen.getByRole("heading", { name: /privacy shield/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Organization Content")).toBeInTheDocument();
  });

  it("renders children when the user has organizational access", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      hasPermission: vi.fn(),
      isLoading: false,
      isAuthenticated: true,
      bootstrapRecoveryReason: null,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      retryBootstrap: vi.fn(),
      hasOrganizationalAccess: vi.fn(() => true),
    });

    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/organization"]}>
          <Routes>
            <Route
              path="/organization"
              element={
                <OrganizationalRoute>
                  <div>Organization Content</div>
                </OrganizationalRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(screen.getByText("Organization Content")).toBeInTheDocument();
  });

  it("shows access denied when the user lacks organizational access", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      hasPermission: vi.fn(),
      isLoading: false,
      isAuthenticated: true,
      bootstrapRecoveryReason: null,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      retryBootstrap: vi.fn(),
      hasOrganizationalAccess: vi.fn(() => false),
    });

    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/organization"]}>
          <Routes>
            <Route
              path="/organization"
              element={
                <OrganizationalRoute>
                  <div>Organization Content</div>
                </OrganizationalRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(screen.getByText("Access Denied")).toBeInTheDocument();
    expect(
      screen.getByText(/You do not have permission to access this feature/i)
    ).toBeInTheDocument();
    expect(screen.queryByText("Organization Content")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated users to login", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      hasPermission: vi.fn(),
      isLoading: false,
      isAuthenticated: false,
      bootstrapRecoveryReason: null,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      retryBootstrap: vi.fn(),
      hasOrganizationalAccess: vi.fn(() => false),
    });

    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/organization"]}>
          <Routes>
            <Route
              path="/organization"
              element={
                <OrganizationalRoute>
                  <div>Organization Content</div>
                </OrganizationalRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("uses the shared bootstrap loading state until any session snapshot exists", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      hasPermission: vi.fn(),
      isLoading: true,
      isAuthenticated: false,
      bootstrapRecoveryReason: null,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      retryBootstrap: vi.fn(),
      hasOrganizationalAccess: vi.fn(() => false),
    });

    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/organization"]}>
          <Routes>
            <Route
              path="/organization"
              element={
                <OrganizationalRoute>
                  <div>Organization Content</div>
                </OrganizationalRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(
      screen.getByRole("status", { name: /loading application/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("Organization Content")).not.toBeInTheDocument();
  });

  it("keeps organizational content visible while a user snapshot is revalidated", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      hasPermission: vi.fn(),
      isLoading: true,
      isAuthenticated: true,
      bootstrapRecoveryReason: null,
      user: {
        id: "1",
        name: "User",
        email: "user@secpal.dev",
        emailVerified: true,
      },
      login: vi.fn(),
      logout: vi.fn(),
      retryBootstrap: vi.fn(),
      hasOrganizationalAccess: vi.fn(() => true),
    });

    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/organization"]}>
          <Routes>
            <Route
              path="/organization"
              element={
                <OrganizationalRoute>
                  <div>Organization Content</div>
                </OrganizationalRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(screen.getByText("Organization Content")).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: /loading application/i })
    ).not.toBeInTheDocument();
  });

  it("shows the email verification gate before organizational access checks", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      hasPermission: vi.fn(),
      isLoading: false,
      isAuthenticated: true,
      bootstrapRecoveryReason: null,
      user: {
        id: "1",
        name: "User",
        email: "user@secpal.dev",
        emailVerified: false,
      },
      login: vi.fn(),
      logout: vi.fn(),
      retryBootstrap: vi.fn(),
      hasOrganizationalAccess: vi.fn(() => true),
    });

    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/organization"]}>
          <Routes>
            <Route
              path="/organization"
              element={
                <OrganizationalRoute>
                  <div>Organization Content</div>
                </OrganizationalRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(
      screen.getByRole("heading", { name: /verify your email address/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("Organization Content")).not.toBeInTheDocument();
    expect(screen.queryByText("Access Denied")).not.toBeInTheDocument();
  });

  it("shows the locked vault state before redirecting unauthenticated users", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      hasPermission: vi.fn(),
      isLoading: false,
      isAuthenticated: false,
      isVaultLocked: true,
      bootstrapRecoveryReason: null,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      lock: vi.fn(),
      unlock: vi.fn(async () => true),
      retryBootstrap: vi.fn(),
      hasOrganizationalAccess: vi.fn(() => false),
    });

    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/organization"]}>
          <Routes>
            <Route
              path="/organization"
              element={
                <OrganizationalRoute>
                  <div>Organization Content</div>
                </OrganizationalRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(
      screen.getByRole("heading", { name: /unlock your secure offline data/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("Organization Content")).not.toBeInTheDocument();
  });
});
