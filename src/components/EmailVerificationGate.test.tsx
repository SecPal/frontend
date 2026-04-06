// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { EmailVerificationGate } from "./EmailVerificationGate";

function renderGate(component: React.ReactNode) {
  return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
}

describe("EmailVerificationGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders children when the user email is verified", () => {
    renderGate(
      <EmailVerificationGate
        user={{
          id: "1",
          name: "User",
          email: "user@secpal.dev",
          emailVerified: true,
        }}
        onRetry={vi.fn()}
        onSignInAgain={vi.fn()}
      >
        <div>Protected Content</div>
      </EmailVerificationGate>
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /verify your email address/i })
    ).not.toBeInTheDocument();
  });

  it("shows the email verification state when the user email is unverified", () => {
    renderGate(
      <EmailVerificationGate
        user={{
          id: "1",
          name: "User",
          email: "user@secpal.dev",
          emailVerified: false,
        }}
        onRetry={vi.fn()}
        onSignInAgain={vi.fn()}
      >
        <div>Protected Content</div>
      </EmailVerificationGate>
    );

    expect(
      screen.getByRole("heading", { name: /verify your email address/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });
});
