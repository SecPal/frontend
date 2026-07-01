// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { SourcePage } from "./SourcePage";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
    isLoading: false,
  })),
}));

function renderWithProviders() {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>
        <SourcePage />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("SourcePage", () => {
  it("keeps the source page on canonical theme tokens", () => {
    const { container } = renderWithProviders();

    const main = container.querySelector("main");
    const banner = container.querySelector("main > div > div");
    const cards = container.querySelectorAll('[data-slot="card"]');
    const repoArticle = screen.getByText("SecPal/frontend").closest("article");
    const repoLink = screen.getByRole("link", {
      name: "https://github.com/SecPal/frontend",
    });
    const issueLink = screen.getByRole("link", {
      name: /secpal\/frontend issues/i,
    });

    expect(main).toHaveClass("bg-background", "text-foreground");
    expect(banner).toHaveClass("border-border");
    expect(cards[0]).toHaveClass("border-border", "bg-card");
    expect(repoArticle).toHaveClass("border-border", "bg-muted");
    expect(repoLink).toHaveClass(
      "text-primary",
      "decoration-border",
      "hover:text-primary/80"
    );
    expect(issueLink).toHaveClass(
      "border-border",
      "text-foreground",
      "hover:bg-muted"
    );

    expect(main?.className).not.toContain("bg-zinc-50");
    expect(main?.className).not.toContain("text-zinc-950");
    expect(banner?.className).not.toContain("border-zinc-200");
    expect(cards[0]?.className).not.toContain("border-zinc-200");
    expect(cards[0]?.className).not.toContain("dark:bg-zinc-900");
    expect(repoArticle?.className).not.toContain("bg-zinc-50");
    expect(repoLink?.className).not.toContain("text-zinc-950");
    expect(issueLink?.className).not.toContain("border-zinc-200");
  });
});
