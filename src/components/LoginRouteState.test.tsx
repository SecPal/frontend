// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { MemoryRouter } from "react-router-dom";
import {
  LoginRouteLoadingState,
  LoginRouteVaultLockedState,
} from "./LoginRouteState";

function renderWithI18n(ui: React.ReactElement) {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nProvider>
  );
}

describe("LoginRouteState", () => {
  it("keeps the route-loading skeleton and footer on canonical theme tokens", () => {
    const { container } = renderWithI18n(<LoginRouteLoadingState />);

    const skeletonShell = container.querySelector('[aria-hidden="true"]');
    const skeletonBars = skeletonShell?.querySelectorAll("span");
    const footer = container.querySelector("footer div");
    const footerBrand = screen.getByText(/powered by secpal/i);

    expect(skeletonShell).toHaveClass("border-input", "bg-muted");
    expect(skeletonBars?.[0]).toHaveClass("bg-border");
    expect(skeletonBars?.[1]).toHaveClass("bg-border");
    expect(footer).toHaveClass("text-muted-foreground");
    expect(footerBrand).toHaveClass("text-foreground");

    expect(skeletonShell?.className).not.toContain("border-zinc-300");
    expect(skeletonShell?.className).not.toContain("bg-zinc-100");
    expect(skeletonBars?.[0]?.className).not.toContain("bg-zinc-200");
    expect(footer?.className).not.toContain("text-zinc-500");
    expect(footerBrand.className).not.toContain("text-zinc-700");
  });

  it("keeps the vault-locked explanation and error states on canonical tokens", async () => {
    const unlock = vi.fn().mockResolvedValue(false);

    const { container } = renderWithI18n(
      <LoginRouteVaultLockedState
        onUnlock={unlock}
        onSignInAgain={() => undefined}
      />
    );

    expect(
      screen.getByText(/secpal locked the local encrypted vault/i)
    ).toHaveClass("text-muted-foreground");

    screen.getByRole("button", { name: /unlock/i }).click();

    const error = await screen.findByRole("status");
    expect(error).toHaveAttribute("data-slot", "alert");
    expect(error).toHaveClass("border-destructive/30", "bg-destructive/10");
    expect(error).toHaveClass("text-foreground");

    const footer = container.querySelector("main");
    expect(footer).toHaveClass("bg-background", "text-foreground");
  });
});
