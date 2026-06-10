// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { OnboardingSubmitted } from "../../../../src/pages/Onboarding/OnboardingSubmitted";

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nProvider>
  );
}

describe("OnboardingSubmitted", () => {
  it("renders the submitted confirmation heading", () => {
    renderWithProviders(<OnboardingSubmitted />);
    expect(
      screen.getByRole("heading", { name: /you're all set/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /you're all set/i })
    ).toBeInTheDocument();
  });

  it("renders the HR review pending message", () => {
    renderWithProviders(<OnboardingSubmitted />);
    expect(
      screen.getByText(/our hr team will review your details/i)
    ).toBeInTheDocument();
  });

  it("renders the no-action-required message", () => {
    renderWithProviders(<OnboardingSubmitted />);
    expect(
      screen.getByText(/you do not need to take further action right now/i)
    ).toBeInTheDocument();
  });

  it("renders the notification message", () => {
    renderWithProviders(<OnboardingSubmitted />);
    expect(
      screen.getByText(
        /you will be notified when your submission has been reviewed/i
      )
    ).toBeInTheDocument();
  });
});
