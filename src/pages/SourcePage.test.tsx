// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { messages as deMessages } from "@/locales/de/messages.mjs";
import { useAuth } from "@/hooks/useAuth";
import { SourcePage } from "./SourcePage";

const nativeFacadeMock = vi.hoisted(() => ({
  isOssLicensesAvailable: vi.fn(() => false),
  openOssLicenses: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
    isLoading: false,
  })),
}));

vi.mock("@/native", () => ({
  SecPalEnterprise: nativeFacadeMock,
}));

function mockSourceOfferRequests(options?: {
  manifestResponse?: Response;
  releaseResponse?: Response;
}) {
  vi.mocked(globalThis.fetch).mockImplementation(
    async (input: string | URL | Request) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url === "/source-offer.json") {
        return (
          options?.manifestResponse ??
          new Response("not found", {
            status: 404,
          })
        );
      }

      if (url === "/v1/release") {
        return (
          options?.releaseResponse ??
          new Response("not found", {
            status: 404,
          })
        );
      }

      throw new Error(`unexpected fetch for ${url}`);
    }
  );
}

function renderWithProviders(
  initialEntries: Array<string | { pathname: string; state?: unknown }> = ["/"]
) {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={initialEntries}>
        <SourcePage />
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("SourcePage", () => {
  beforeEach(() => {
    nativeFacadeMock.isOssLicensesAvailable.mockReset();
    nativeFacadeMock.isOssLicensesAvailable.mockReturnValue(false);
    nativeFacadeMock.openOssLicenses.mockReset();
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    vi.spyOn(globalThis, "fetch");
    mockSourceOfferRequests();
  });

  it("opens native OSS notices from the source page when the capability is available", async () => {
    const user = userEvent.setup();
    nativeFacadeMock.isOssLicensesAvailable.mockReturnValue(true);
    renderWithProviders();

    await user.click(
      await screen.findByRole("button", { name: /open source licenses/i })
    );

    expect(nativeFacadeMock.openOssLicenses).toHaveBeenCalledOnce();
  });

  it("hides native OSS notices when the capability is unavailable", async () => {
    renderWithProviders();

    await screen.findByRole("heading", { name: /source code and license/i });

    expect(
      screen.queryByRole("button", { name: /open source licenses/i })
    ).not.toBeInTheDocument();
  });

  it("keeps the source page on canonical theme tokens", async () => {
    const { container } = renderWithProviders();
    const repoLink = await screen.findByRole("link", {
      name: "https://github.com/SecPal/frontend",
    });

    const main = container.querySelector("main");
    const banner = container.querySelector(
      "[data-testid='source-page-header']"
    );
    const cards = container.querySelectorAll('[data-slot="card"]');
    const repoArticle = screen.getByText("SecPal/frontend").closest("article");
    const issueLink = screen.getByRole("link", {
      name: /secpal\/frontend issues/i,
    });

    expect(main).toHaveClass("bg-background", "text-foreground");
    expect(banner).not.toHaveClass("border-b", "border-border");
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

  it("shows the shared SecPal footer link on the source page", async () => {
    renderWithProviders();

    expect(
      await screen.findByRole("link", {
        name: "Powered by SecPal – A guard's best friend",
      })
    ).toHaveAttribute("href", "https://secpal.app");
    expect(
      screen.getByRole("link", {
        name: "Powered by SecPal – A guard's best friend",
      })
    ).toHaveAttribute("rel", "noopener");
  });

  it("uses Quellcode consistently in German", async () => {
    const previousLocale = i18n.locale;
    i18n.load("de", deMessages);
    i18n.activate("de");

    try {
      renderWithProviders();

      expect(
        (
          await screen.findAllByRole("heading", {
            name: "Quellcode und Lizenz",
          })
        )[0]
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Quellcodeangebot zur AGPL-Lizenz für die über diesen Dienst bereitgestellten SecPal-Komponenten\./i
        )
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", {
          name: "Repositories des entsprechenden Quellcodes",
        })
      ).toBeInTheDocument();
      expect(screen.queryByText(/Quelltext/i)).not.toBeInTheDocument();
    } finally {
      i18n.activate(previousLocale);
    }
  });

  it("keeps legal and language controls at the page edges", async () => {
    const mediaQueryList = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => mediaQueryList as unknown as MediaQueryList)
    );

    try {
      const { container, unmount } = renderWithProviders();
      const main = container.querySelector("main");
      const header = container.querySelector(
        "[data-testid='source-page-header']"
      );
      const mobileControls = container.querySelector(
        "[data-testid='source-header-controls']"
      );

      expect(main).not.toHaveClass("relative");
      expect(header).not.toHaveClass("border-b", "border-border");
      expect(header).toHaveClass(
        "grid",
        "grid-cols-[minmax(0,1fr)_auto]",
        "min-[86rem]:grid-cols-[minmax(0,1fr)_minmax(0,64rem)_minmax(0,1fr)]"
      );
      expect(screen.getAllByRole("heading", { name: "AGPL v3+" })).toHaveLength(
        1
      );
      expect(
        Array.from(
          (mobileControls as HTMLElement).querySelectorAll("button, a")
        ).map((control) => control.textContent?.trim())
      ).toEqual(["Legal", "English", "Back to login"]);

      unmount();
      mediaQueryList.matches = true;

      const { container: desktopContainer } = renderWithProviders();
      const desktopControls = desktopContainer.querySelector(
        "[data-testid='source-header-controls']"
      );

      expect(screen.getAllByRole("heading", { name: "AGPL v3+" })).toHaveLength(
        1
      );
      expect(
        Array.from(
          (desktopControls as HTMLElement).querySelectorAll("button, a")
        ).map((control) => control.textContent?.trim())
      ).toEqual(["Legal", "Back to login", "English"]);
      expect(
        within(desktopControls as HTMLElement).getByRole("combobox", {
          name: /select language/i,
        })
      ).toBeInTheDocument();
      expect(
        within(desktopControls as HTMLElement).getByRole("link", {
          name: /back to login/i,
        })
      ).toHaveClass("shrink-0", "rounded-xl");
      await screen.findByText(
        /if this deployment does not publish source releases here/i
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("preserves the authenticated return route after selecting source code from its legal menu", async () => {
    const user = userEvent.setup();
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    const { container } = renderWithProviders([
      {
        pathname: "/source",
        state: { sourceReturnTo: "/customers/new?draft=1#notes" },
      },
    ]);

    const mobileControls = container.querySelector(
      "[data-testid='source-header-controls']"
    );
    const backLink = within(mobileControls as HTMLElement).getByRole("link", {
      name: /^back$/i,
    });
    expect(backLink).toHaveAttribute("href", "/customers/new?draft=1#notes");

    await user.click(
      within(mobileControls as HTMLElement).getByRole("button", {
        name: /legal/i,
      })
    );
    await user.click(
      await screen.findByRole("menuitem", { name: /source code/i })
    );

    expect(backLink).toHaveAttribute("href", "/customers/new?draft=1#notes");
  });

  it("describes the additional SecPal attribution terms in legal notices", async () => {
    renderWithProviders();

    const legalNotices = await screen.findByRole("heading", {
      name: "Legal notices",
    });
    const legalCard = legalNotices.closest('[data-slot="card"]');

    expect(legalCard).not.toBeNull();

    const legalContent = within(legalCard as HTMLElement);

    expect(
      legalContent.getByText(
        /agpl-3\.0-or-later with additional secpal attribution terms/i
      )
    ).toBeInTheDocument();
    expect(legalContent.getByText(/powered by secpal/i)).toBeInTheDocument();
    expect(
      legalContent.getByText(
        /the tagline "a guard's best friend" and https:\/\/secpal\.app are preferred, but they are not required license conditions/i
      )
    ).toBeInTheDocument();
  });

  it("renders deployment-specific immutable source references when the manifest is published", async () => {
    mockSourceOfferRequests({
      manifestResponse: new Response(
        JSON.stringify({
          version: 1,
          repositories: {
            frontend: {
              sourceUrl:
                "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
            },
            contracts: {
              sourceUrl:
                "https://github.com/SecPal/contracts/releases/download/contracts-2026-06-26/source.tar.gz",
            },
            android: {
              sourceUrl:
                "https://github.com/SecPal/android/releases/download/android-2026-06-26/source.tar.gz",
            },
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      ),
      releaseResponse: new Response(
        JSON.stringify({
          data: {
            version: "api-2026-06-26",
            source_url:
              "https://github.com/SecPal/api/releases/download/api-2026-06-26/source.tar.gz",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      ),
    });

    renderWithProviders();

    expect(
      await screen.findByText(
        /the source release links shown below point to the immutable corresponding source published for this deployment/i
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
    expect(frontendLinks[1]).toHaveAccessibleName(
      "Open public repository for SecPal/frontend"
    );
  });

  it("wraps long immutable source URLs on narrow layouts", async () => {
    mockSourceOfferRequests({
      manifestResponse: new Response(
        JSON.stringify({
          version: 1,
          repositories: {
            frontend: {
              sourceUrl:
                "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
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
      ),
      releaseResponse: new Response(
        JSON.stringify({
          data: {
            version: "api-2026-06-26",
            source_url:
              "https://github.com/SecPal/api/releases/download/api-2026-06-26/source.tar.gz",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      ),
    });

    renderWithProviders();

    const sourceReleaseLink = await screen.findByRole("link", {
      name: "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
    });
    const sourceReleaseLabel = within(sourceReleaseLink).getByText(
      "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz"
    );

    expect(sourceReleaseLink).toHaveClass("min-w-0", "items-start");
    expect(sourceReleaseLabel).toHaveClass("min-w-0", "break-all");
  });

  it("renders immutable manifest links before the API release fetch settles", async () => {
    let resolveApiFetch: ((value: Response) => void) | undefined;

    vi.mocked(globalThis.fetch).mockImplementation(
      async (input: string | URL | Request) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url === "/source-offer.json") {
          return new Response(
            JSON.stringify({
              version: 1,
              repositories: {
                frontend: {
                  sourceUrl:
                    "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
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
          );
        }

        if (url === "/v1/release") {
          return new Promise((resolve) => {
            resolveApiFetch = resolve;
          });
        }

        throw new Error(`unexpected fetch for ${url}`);
      }
    );

    renderWithProviders();

    expect(
      await screen.findByRole("link", {
        name: "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
      })
    ).toHaveAttribute(
      "href",
      "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz"
    );

    expect(
      screen.queryByRole("link", {
        name: "https://github.com/SecPal/api/releases/download/api-2026-07-03/source.tar.gz",
      })
    ).not.toBeInTheDocument();

    resolveApiFetch?.(
      new Response(
        JSON.stringify({
          data: {
            version: "api-2026-07-03",
            source_url:
              "https://github.com/SecPal/api/releases/download/api-2026-07-03/source.tar.gz",
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
      await screen.findByRole("link", {
        name: "https://github.com/SecPal/api/releases/download/api-2026-07-03/source.tar.gz",
      })
    ).toHaveAttribute(
      "href",
      "https://github.com/SecPal/api/releases/download/api-2026-07-03/source.tar.gz"
    );
  });

  it("renders the API release link before the manifest fetch settles", async () => {
    let resolveManifestFetch: ((value: Response) => void) | undefined;

    vi.mocked(globalThis.fetch).mockImplementation(
      async (input: string | URL | Request) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url === "/source-offer.json") {
          return new Promise((resolve) => {
            resolveManifestFetch = resolve;
          });
        }

        if (url === "/v1/release") {
          return new Response(
            JSON.stringify({
              data: {
                version: "api-2026-07-03",
                source_url:
                  "https://github.com/SecPal/api/releases/download/api-2026-07-03/source.tar.gz",
              },
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            }
          );
        }

        throw new Error(`unexpected fetch for ${url}`);
      }
    );

    renderWithProviders();

    expect(
      await screen.findByRole("link", {
        name: "https://github.com/SecPal/api/releases/download/api-2026-07-03/source.tar.gz",
      })
    ).toHaveAttribute(
      "href",
      "https://github.com/SecPal/api/releases/download/api-2026-07-03/source.tar.gz"
    );

    expect(
      screen.queryByRole("link", {
        name: "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
      })
    ).not.toBeInTheDocument();

    resolveManifestFetch?.(
      new Response(
        JSON.stringify({
          version: 1,
          repositories: {
            frontend: {
              sourceUrl:
                "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
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
      await screen.findByRole("link", {
        name: "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
      })
    ).toHaveAttribute(
      "href",
      "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz"
    );
  });

  it("lists Android first when the deployment publishes an Android release", async () => {
    mockSourceOfferRequests({
      manifestResponse: new Response(
        JSON.stringify({
          version: 1,
          repositories: {
            frontend: {
              sourceUrl:
                "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
            },
            contracts: {
              sourceUrl:
                "https://github.com/SecPal/contracts/releases/download/contracts-2026-06-26/source.tar.gz",
            },
            android: {
              sourceUrl:
                "https://github.com/SecPal/android/releases/download/android-2026-06-26/source.tar.gz",
            },
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      ),
      releaseResponse: new Response(
        JSON.stringify({
          data: {
            version: "api-2026-06-26",
            source_url:
              "https://github.com/SecPal/api/releases/download/api-2026-06-26/source.tar.gz",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      ),
    });

    const { container } = renderWithProviders();

    await screen.findByText(
      /the source release links shown below point to the immutable corresponding source published for this deployment/i
    );

    const repositoryHeadings = Array.from(
      container.querySelectorAll("article h3")
    ).map((heading) => heading.textContent);

    expect(repositoryHeadings[0]).toBe("SecPal/android");
    expect(repositoryHeadings.slice(1)).toEqual([
      "SecPal/frontend",
      "SecPal/api",
      "SecPal/contracts",
    ]);
  });

  it("omits Android sources when the deployment manifest does not publish an Android release", async () => {
    mockSourceOfferRequests({
      manifestResponse: new Response(
        JSON.stringify({
          version: 1,
          repositories: {
            frontend: {
              sourceUrl:
                "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
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
      ),
      releaseResponse: new Response(
        JSON.stringify({
          data: {
            version: "api-2026-06-26",
            source_url:
              "https://github.com/SecPal/api/releases/download/api-2026-06-26/source.tar.gz",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      ),
    });

    renderWithProviders();

    await screen.findByText(
      /the source release links shown below point to the immutable corresponding source published for this deployment/i
    );

    expect(screen.queryByText("SecPal/android")).not.toBeInTheDocument();
  });

  it("shows fallback source links while the manifest request is pending", async () => {
    let resolveManifestFetch: ((value: Response) => void) | undefined;

    vi.mocked(globalThis.fetch).mockImplementation(
      async (input: string | URL | Request) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        if (url === "/source-offer.json") {
          return new Promise((resolve) => {
            resolveManifestFetch = resolve;
          });
        }

        if (url === "/v1/release") {
          return new Response(
            JSON.stringify({
              data: {
                version: "api-2026-06-26",
                source_url:
                  "https://github.com/SecPal/api/releases/download/api-2026-06-26/source.tar.gz",
              },
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            }
          );
        }

        throw new Error(`unexpected fetch for ${url}`);
      }
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
    expect(screen.queryByText("SecPal/android")).not.toBeInTheDocument();

    resolveManifestFetch?.(
      new Response(
        JSON.stringify({
          version: 1,
          repositories: {
            frontend: {
              sourceUrl:
                "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
            },
            contracts: {
              sourceUrl:
                "https://github.com/SecPal/contracts/releases/download/contracts-2026-06-26/source.tar.gz",
            },
            android: {
              sourceUrl:
                "https://github.com/SecPal/android/releases/download/android-2026-06-26/source.tar.gz",
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
        /the source release links shown below point to the immutable corresponding source published for this deployment/i
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
          /if this deployment does not publish source releases here, the project repositories below remain linked as the preferred form for making modifications/i
        )
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("link", {
        name: "https://github.com/SecPal/frontend",
      })
    ).toHaveAttribute("href", "https://github.com/SecPal/frontend");
    expect(screen.queryByText("SecPal/android")).not.toBeInTheDocument();
  });

  it("keeps the API repository immutable when the frontend manifest is unavailable", async () => {
    mockSourceOfferRequests({
      releaseResponse: new Response(
        JSON.stringify({
          data: {
            version: "api-2026-07-03",
            source_url:
              "https://github.com/SecPal/api/releases/download/api-2026-07-03/source.tar.gz",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      ),
    });

    renderWithProviders();

    expect(
      await screen.findByText(
        /published source release links shown below are immutable\. components without a published source release remain linked to their public repositories/i
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "https://github.com/SecPal/api/releases/download/api-2026-07-03/source.tar.gz",
      })
    ).toHaveAttribute(
      "href",
      "https://github.com/SecPal/api/releases/download/api-2026-07-03/source.tar.gz"
    );
  });
});
