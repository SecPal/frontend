// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("source offer metadata unavailable in SourcePage.test.tsx")
    );
  });

  it("keeps the source page on canonical theme tokens", async () => {
    const { container } = renderWithProviders();
    const repoLink = await screen.findByRole("link", {
      name: "https://github.com/SecPal/frontend",
    });

    const main = container.querySelector("main");
    const banner = container.querySelector("main > div > div");
    const cards = container.querySelectorAll('[data-slot="card"]');
    const repoArticle = screen.getByText("SecPal/frontend").closest("article");
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

  it("renders deployment-specific immutable source references when the manifest is published", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          version: 1,
          repositories: {
            frontend: {
              sourceUrl:
                "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
            },
            api: {
              sourceUrl:
                "https://github.com/SecPal/api/releases/download/api-2026-06-26/source.tar.gz",
            },
            contracts: {
              sourceUrl:
                "https://github.com/SecPal/contracts/releases/download/contracts-2026-06-26/source.tar.gz",
            },
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      )
    );

    renderWithProviders();

    expect(
      await screen.findByText(
        /immutable corresponding source published for this deployment/i
      )
    ).toBeInTheDocument();

    const frontendArticle = screen
      .getByText("SecPal/frontend")
      .closest("article");
    expect(frontendArticle).not.toBeNull();

    const frontendLinks = within(frontendArticle as HTMLElement).getAllByRole(
      "link"
    );
    expect(frontendLinks[0]).toHaveAttribute(
      "href",
      "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz"
    );
    expect(frontendLinks[1]).toHaveAttribute(
      "href",
      "https://github.com/SecPal/frontend"
    );
  });

  it("does not present optional repositories as deployment-published source when the manifest omits them", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          version: 1,
          repositories: {
            frontend: {
              sourceUrl:
                "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
            },
            api: {
              sourceUrl:
                "https://github.com/SecPal/api/releases/download/api-2026-06-26/source.tar.gz",
            },
            contracts: {
              sourceUrl:
                "https://github.com/SecPal/contracts/releases/download/contracts-2026-06-26/source.tar.gz",
            },
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      )
    );

    renderWithProviders();

    const androidArticle = await screen.findByText("SecPal/android");
    const androidLinks = within(androidArticle.closest("article") as HTMLElement)
      .getAllByRole("link");

    expect(androidLinks).toHaveLength(1);
    expect(androidLinks[0]).toHaveAttribute(
      "href",
      "https://github.com/SecPal/android"
    );
    expect(androidLinks[0]).toHaveTextContent(/open public repository/i);
    expect(
      screen.queryByRole("link", {
        name: "https://github.com/SecPal/android",
      })
    ).not.toBeInTheDocument();
  });

  it("shows fallback source links while the manifest request is pending", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;

    vi.mocked(globalThis.fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    renderWithProviders();

    expect(
      screen.queryByText(
        /the project repositories below remain linked as the preferred form for making modifications/i
      )
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "https://github.com/SecPal/frontend",
      })
    ).toHaveAttribute("href", "https://github.com/SecPal/frontend");

    resolveFetch?.(
      new Response(
        JSON.stringify({
          version: 1,
          repositories: {
            frontend: {
              sourceUrl:
                "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
            },
            api: {
              sourceUrl:
                "https://github.com/SecPal/api/releases/download/api-2026-06-26/source.tar.gz",
            },
            contracts: {
              sourceUrl:
                "https://github.com/SecPal/contracts/releases/download/contracts-2026-06-26/source.tar.gz",
            },
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      )
    );

    expect(
      await screen.findByText(
        /immutable corresponding source published for this deployment/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
      })
    ).toHaveAttribute(
      "href",
      "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz"
    );
  });

  it("falls back to project repositories when deployment metadata is unavailable", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByText(
          /the project repositories below remain linked as the preferred form for making modifications/i
        )
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("link", {
        name: "https://github.com/SecPal/frontend",
      })
    ).toHaveAttribute("href", "https://github.com/SecPal/frontend");
  });
});
