// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { messages as enMessages } from "../../locales/en/messages.mjs";
import { OnboardingComplete } from "./OnboardingComplete";

const { mockLogin, onboardingApiMocks } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  onboardingApiMocks: {
    completeOnboarding: vi.fn(),
    validateOnboardingToken: vi.fn(),
  },
}));

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

vi.mock("../../services/onboardingApi", () => onboardingApiMocks);

describe("OnboardingComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", enMessages);
    i18n.activate("en");
    onboardingApiMocks.validateOnboardingToken.mockResolvedValue({
      data: { valid: true },
    });
  });

  it("keeps the completion card mounted while validating the onboarding link", () => {
    onboardingApiMocks.validateOnboardingToken.mockImplementation(
      () => new Promise(() => undefined)
    );

    render(
      <MemoryRouter
        initialEntries={["/?token=test-token&email=new.guard%40example.com"]}
      >
        <I18nProvider i18n={i18n}>
          <Routes>
            <Route path="/" element={<OnboardingComplete />} />
          </Routes>
        </I18nProvider>
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: /secpal/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /validating onboarding link/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/validating your link\.\.\./i)
    ).not.toBeInTheDocument();
  });

  it("fails closed when onboarding completion omits email_verified", async () => {
    onboardingApiMocks.completeOnboarding.mockResolvedValue({
      data: {
        user: {
          id: 1,
          email: "new.guard@example.com",
          name: "New Guard",
        },
        employee: {
          status: "pre_contract",
        },
      },
    });

    render(
      <MemoryRouter
        initialEntries={["/?token=test-token&email=new.guard%40example.com"]}
      >
        <I18nProvider i18n={i18n}>
          <Routes>
            <Route path="/" element={<OnboardingComplete />} />
          </Routes>
        </I18nProvider>
      </MemoryRouter>
    );

    await screen.findByRole("button", { name: /complete account setup/i });

    fireEvent.change(screen.getByLabelText(/first names \(all\)/i), {
      target: { value: "New" },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Guard" },
    });
    fireEvent.change(screen.getByLabelText(/date of birth/i), {
      target: { value: "1990-01-01" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "Password123!" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "Password123!" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /complete account setup/i })
    );

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        id: "1",
        email: "new.guard@example.com",
        name: "New Guard",
        emailVerified: false,
        employeeStatus: "pre_contract",
      });
    });
  });

  it("keeps welcome, invalid-link, and rate-limit states on canonical theme tokens", async () => {
    const { unmount } = render(
      <MemoryRouter
        initialEntries={["/?token=test-token&email=new.guard%40example.com"]}
      >
        <I18nProvider i18n={i18n}>
          <Routes>
            <Route path="/" element={<OnboardingComplete />} />
          </Routes>
        </I18nProvider>
      </MemoryRouter>
    );

    const heading = await screen.findByRole("heading", {
      name: /welcome to secpal/i,
    });
    const copy = screen.getByText(
      /complete your account setup to get started/i
    );
    expect(heading).toHaveClass("text-foreground");
    expect(copy).toHaveClass("text-muted-foreground");

    unmount();
    onboardingApiMocks.validateOnboardingToken.mockResolvedValueOnce({
      data: { valid: false, message: "Link expired." },
    });

    const invalidView = render(
      <MemoryRouter
        initialEntries={["/?token=bad-token&email=bad%40example.com"]}
      >
        <I18nProvider i18n={i18n}>
          <Routes>
            <Route path="/" element={<OnboardingComplete />} />
          </Routes>
        </I18nProvider>
      </MemoryRouter>
    );

    const invalid = await screen.findByText(
      "Invalid onboarding link. Please check your email and try again."
    );
    expect(invalid.closest('[data-slot="alert"]')).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );

    invalidView.unmount();
    onboardingApiMocks.validateOnboardingToken.mockRejectedValueOnce({
      response: {
        status: 429,
        data: {},
        retryAfterSeconds: 120,
      },
    });

    render(
      <MemoryRouter
        initialEntries={["/?token=slow-token&email=slow%40example.com"]}
      >
        <I18nProvider i18n={i18n}>
          <Routes>
            <Route path="/" element={<OnboardingComplete />} />
          </Routes>
        </I18nProvider>
      </MemoryRouter>
    );

    const rateLimitTitle = await screen.findByText(/too many attempts/i);
    const rateLimitMessage = screen.getByText(
      /too many onboarding attempts\. please try again later\./i
    );
    expect(rateLimitTitle).toHaveClass("text-foreground");
    expect(rateLimitMessage).toHaveClass("text-foreground");
    expect(rateLimitTitle.className).not.toContain("text-amber-700");
    expect(rateLimitMessage.className).not.toContain("text-amber-700");
  });
});
