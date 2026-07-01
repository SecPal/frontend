// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { MemoryRouter } from "react-router-dom";
import {
  RouteAccessDeniedState,
  RouteBootstrapRecoveryState,
  RouteEmailVerificationState,
  RouteNotFoundState,
  RouteVaultLockedState,
} from "./RouteGuardState";

const mockSendVerificationNotification = vi.fn();

vi.mock("../services/authAccountApi", () => ({
  sendVerificationNotification: mockSendVerificationNotification,
}));

function renderWithProviders(component: React.ReactElement) {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>{component}</MemoryRouter>
    </I18nProvider>
  );
}

describe("RouteGuardState theme tokens", () => {
  beforeEach(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("keeps the bootstrap recovery surface on canonical theme tokens", () => {
    renderWithProviders(
      <RouteBootstrapRecoveryState
        onRetry={vi.fn()}
        onSignInAgain={vi.fn()}
        reason="timeout"
      />
    );

    const copy = screen.getByText(
      /could not confirm your session quickly enough/i
    );

    expect(copy).toHaveClass("text-muted-foreground");
    expect(copy.className).not.toContain("text-zinc-500");
  });

  it("keeps the vault-locked state on canonical theme tokens", async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn().mockResolvedValue(false);

    renderWithProviders(
      <RouteVaultLockedState onUnlock={onUnlock} onSignInAgain={vi.fn()} />
    );

    expect(
      screen.getByText(/locked the local encrypted vault on this device/i)
    ).toHaveClass("text-muted-foreground");

    await user.click(screen.getByRole("button", { name: /^unlock$/i }));

    const error = await screen.findByText(
      /could not unlock the encrypted offline data/i
    );
    expect(error).toHaveClass("text-destructive");
    expect(error.className).not.toContain("text-red-600");
  });

  it("keeps the email verification state on canonical theme tokens", async () => {
    renderWithProviders(
      <RouteEmailVerificationState
        email="user@secpal.dev"
        onRetry={vi.fn()}
        onSignInAgain={vi.fn()}
      />
    );

    const copy = screen.getByText(
      /this account cannot access the protected app until the email address is verified/i
    );

    expect(copy).toHaveClass("text-muted-foreground");
    expect(copy.className).not.toContain("text-zinc-500");
  });

  it("renders email verification success feedback through canonical alert tokens", async () => {
    const user = userEvent.setup();
    mockSendVerificationNotification.mockResolvedValueOnce({
      message: "Verification email sent.",
    });

    renderWithProviders(
      <RouteEmailVerificationState
        email="user@secpal.dev"
        onRetry={vi.fn()}
        onSignInAgain={vi.fn()}
      />
    );

    await user.click(
      screen.getByRole("button", { name: /send verification email/i })
    );

    const success = await screen.findByText(/verification email sent\./i);
    expect(success.closest('[data-slot="alert"]')).toHaveClass(
      "border-emerald-500/30",
      "bg-emerald-500/10"
    );
    expect(success).toHaveClass("text-foreground");
    expect(success.className).not.toContain("text-emerald-700");
  });

  it("keeps access denied and not found states on canonical theme tokens", () => {
    const { rerender } = renderWithProviders(<RouteAccessDeniedState />);

    const denied = screen.getByText(
      /do not have permission to access this feature/i
    );
    expect(denied).toHaveClass("text-muted-foreground");
    expect(denied.className).not.toContain("text-zinc-500");

    rerender(
      <I18nProvider i18n={i18n}>
        <MemoryRouter>
          <RouteNotFoundState />
        </MemoryRouter>
      </I18nProvider>
    );

    const notFound = screen.getByText(
      /does not exist or is no longer available/i
    );
    expect(notFound).toHaveClass("text-muted-foreground");
    expect(notFound.className).not.toContain("text-zinc-500");
  });
});
