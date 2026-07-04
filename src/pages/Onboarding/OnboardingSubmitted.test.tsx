// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { messages as enMessages } from "../../locales/en/messages.mjs";
import { OnboardingSubmitted } from "./OnboardingSubmitted";

describe("OnboardingSubmitted", () => {
  it("keeps the submitted summary on canonical theme tokens", () => {
    i18n.load("en", enMessages);
    i18n.activate("en");

    render(
      <I18nProvider i18n={i18n}>
        <OnboardingSubmitted />
      </I18nProvider>
    );

    const heading = screen.getByRole("heading", { name: /you're all set/i });
    const copy = screen.getByText(
      /thank you for submitting your onboarding information/i
    );

    expect(heading).toHaveClass("text-foreground");
    expect(copy.parentElement).toHaveClass("text-muted-foreground");
  });
});
