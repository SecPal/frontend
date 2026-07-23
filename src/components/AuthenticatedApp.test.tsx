// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { MemoryRouter } from "react-router-dom";
import AuthenticatedApp from "../AuthenticatedApp";

const appSurfaceMock = vi.hoisted(() => ({
  isAndroidSurface: false,
}));

vi.mock("./UpdatePrompt", () => ({
  UpdatePrompt: () => <div data-testid="route-update-prompt" />,
}));

vi.mock("./application-layout", () => ({
  ApplicationLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="application-layout">{children}</div>
  ),
}));

vi.mock("./FeatureRoute", () => ({
  FeatureRoute: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("./OnboardingAccessRoute", () => ({
  AppAccessRoute: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  OnboardingOnlyRoute: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("./ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("./RouteContentFallback", () => ({
  RouteContentFallback: () => <div role="status" aria-label="Loading page" />,
}));

vi.mock("./RouteGuardState", () => ({
  RouteNotFoundState: () => <div>Not found</div>,
}));

vi.mock("./RouteLoader", () => ({
  RouteLoader: () => <div role="status" aria-label="Loading application" />,
}));

vi.mock("./onboarding-layout", () => ({
  OnboardingLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="onboarding-layout">{children}</div>
  ),
}));

vi.mock("../hooks/useNotifications", () => ({
  useNotifications: () => undefined,
}));

vi.mock("../platform/appSurface", () => ({
  get isAndroidSurface() {
    return appSurfaceMock.isAndroidSurface;
  },
}));

vi.mock("./OfflineIndicator", () => ({
  OfflineIndicator: () => null,
}));

vi.mock("../routeModules", () => {
  const resolvedModule = { default: () => <div>Resolved route</div> };
  const androidProvisioningModule = {
    default: () => <div>Android provisioning route</div>,
  };
  const never = new Promise<typeof resolvedModule>(() => undefined);

  return {
    routeModuleLoaders: {
      settings: () => never,
      profile: () => Promise.resolve(resolvedModule),
      employeeList: () => Promise.resolve(resolvedModule),
      employeeDetail: () => Promise.resolve(resolvedModule),
      employeeCreate: () => Promise.resolve(resolvedModule),
      employeeEdit: () => Promise.resolve(resolvedModule),
      employeeContactsEdit: () => Promise.resolve(resolvedModule),
      onboardingWizard: () => Promise.resolve(resolvedModule),
      onboardingComplete: () => Promise.resolve(resolvedModule),
      onboardingSubmitted: () => Promise.resolve(resolvedModule),
      organization: () => Promise.resolve(resolvedModule),
      customers: () => Promise.resolve(resolvedModule),
      customerCreate: () => Promise.resolve(resolvedModule),
      customerDetail: () => Promise.resolve(resolvedModule),
      customerEdit: () => Promise.resolve(resolvedModule),
      sites: () => Promise.resolve(resolvedModule),
      siteCreate: () => Promise.resolve(resolvedModule),
      siteDetail: () => Promise.resolve(resolvedModule),
      siteEdit: () => Promise.resolve(resolvedModule),
      activityLogs: () => Promise.resolve(resolvedModule),
      androidProvisioning: () => Promise.resolve(androidProvisioningModule),
    },
  };
});

describe("AuthenticatedApp", () => {
  beforeEach(() => {
    appSurfaceMock.isAndroidSurface = false;
  });

  it("keeps the update prompt mounted while an authenticated route module is still loading", async () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <I18nProvider i18n={i18n}>
          <Suspense fallback={null}>
            <AuthenticatedApp />
          </Suspense>
        </I18nProvider>
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("status", { name: /loading application/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("route-update-prompt")).toBeInTheDocument();
  });

  it("does not expose the removed Android provisioning route", async () => {
    appSurfaceMock.isAndroidSurface = true;

    render(
      <MemoryRouter initialEntries={["/android-provisioning"]}>
        <I18nProvider i18n={i18n}>
          <Suspense fallback={null}>
            <AuthenticatedApp />
          </Suspense>
        </I18nProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText("Not found")).toBeInTheDocument();
    expect(
      screen.queryByText("Android provisioning route")
    ).not.toBeInTheDocument();
  });
});
