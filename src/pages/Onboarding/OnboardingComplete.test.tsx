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
});
