// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { loadSourceOffer } from "./sourceOffer";

describe("loadSourceOffer", () => {
  function createResponseRouter(responses: Record<string, Response>) {
    return vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      const response = responses[url];

      if (!response) {
        throw new Error(`unexpected fetch for ${url}`);
      }

      return response;
    });
  }

  it("prefers same-origin immutable source references when the deployment publishes them", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
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
      "/v1/release": new Response(
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

    const result = await loadSourceOffer(fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/source-offer.json", {
      cache: "no-store",
      credentials: "omit",
      headers: {
        accept: "application/json",
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/v1/release", {
      cache: "no-store",
      credentials: "omit",
      headers: {
        accept: "application/json",
      },
    });
    expect(result.mode).toBe("deployment");
    expect(result.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "frontend",
          sourceUrl:
            "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
        }),
        expect.objectContaining({
          id: "api",
          sourceUrl:
            "https://github.com/SecPal/api/releases/download/api-2026-06-26/source.tar.gz",
        }),
        expect.objectContaining({
          id: "contracts",
          sourceUrl:
            "https://github.com/SecPal/contracts/releases/download/contracts-2026-06-26/source.tar.gz",
        }),
      ])
    );
  });

  it("trims manifest source URLs before returning them", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
        JSON.stringify({
          version: 1,
          repositories: {
            frontend: {
              sourceUrl:
                " https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz ",
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
      "/v1/release": new Response(
        JSON.stringify({
          data: {
            version: "api-2026-06-26",
            source_url:
              " https://github.com/SecPal/api/releases/download/api-2026-06-26/source.tar.gz ",
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

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("deployment");
    expect(result.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "frontend",
          sourceUrl:
            "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
        }),
      ])
    );
  });

  it("uses the live API release metadata when the deployment manifest is otherwise valid", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
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
      "/v1/release": new Response(
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

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("deployment");
    expect(result.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "api",
          sourceUrl:
            "https://github.com/SecPal/api/releases/download/api-2026-07-03/source.tar.gz",
        }),
      ])
    );
  });

  it("omits optional repositories when the deployment does not publish them", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
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
      "/v1/release": new Response(
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

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("deployment");
    expect(
      result.repositories.some((repository) => repository.id === "android")
    ).toBe(false);
  });

  it("falls back to the project repositories when the deployment metadata is unavailable", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response("not found", { status: 404 }),
      "/v1/release": new Response("not found", { status: 404 }),
    });

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("fallback");
    expect(result.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "frontend",
          sourceUrl: "https://github.com/SecPal/frontend",
        }),
        expect.objectContaining({
          id: "api",
          sourceUrl: "https://github.com/SecPal/api",
        }),
        expect.objectContaining({
          id: "contracts",
          sourceUrl: "https://github.com/SecPal/contracts",
        }),
      ])
    );
    expect(
      result.repositories.some((repository) => repository.id === "android")
    ).toBe(false);
  });

  it("keeps the API source link immutable when the frontend manifest is unavailable", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response("not found", { status: 404 }),
      "/v1/release": new Response(
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

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("deployment");
    expect(result.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "frontend",
          sourceUrl: null,
        }),
        expect.objectContaining({
          id: "api",
          sourceUrl:
            "https://github.com/SecPal/api/releases/download/api-2026-07-03/source.tar.gz",
        }),
        expect.objectContaining({
          id: "contracts",
          sourceUrl: null,
        }),
      ])
    );
  });

  it("falls back when a manifest is missing required deployment repositories", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
        JSON.stringify({
          version: 1,
          repositories: {
            frontend: {
              sourceUrl:
                "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
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
      "/v1/release": new Response(
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

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("deployment");
    expect(result.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "frontend",
          sourceUrl: null,
        }),
        expect.objectContaining({
          id: "api",
          sourceUrl:
            "https://github.com/SecPal/api/releases/download/api-2026-06-26/source.tar.gz",
        }),
        expect.objectContaining({
          id: "contracts",
          sourceUrl: null,
        }),
      ])
    );
  });

  it("falls back when the manifest version is unsupported", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
        JSON.stringify({
          version: 2,
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
      "/v1/release": new Response(
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

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("deployment");
  });

  it("falls back when a manifest repository uses a non-HTTPS source URL", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
        JSON.stringify({
          version: 1,
          repositories: {
            frontend: {
              sourceUrl: "javascript:alert('nope')",
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
      "/v1/release": new Response(
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

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("deployment");
    expect(result.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "frontend",
          sourceUrl: null,
        }),
        expect.objectContaining({
          id: "api",
          sourceUrl:
            "https://github.com/SecPal/api/releases/download/api-2026-06-26/source.tar.gz",
        }),
      ])
    );
  });

  it("falls back when the manifest response body is not valid JSON", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response("{", {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      }),
      "/v1/release": new Response(
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

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("deployment");
  });

  it("rejects manifest repositories with non-string source URLs", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
        JSON.stringify({
          version: 1,
          repositories: {
            frontend: {
              sourceUrl: [
                "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
              ],
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
      "/v1/release": new Response("not found", { status: 404 }),
    });

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("fallback");
  });

  it("rejects manifest repositories that point to mutable public repository roots", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
        JSON.stringify({
          version: 1,
          repositories: {
            frontend: {
              sourceUrl: "https://github.com/SecPal/frontend/",
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
      "/v1/release": new Response("not found", { status: 404 }),
    });

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("fallback");
  });

  it("rejects manifest repositories that point to mutable public repository roots with query or fragment variants", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
        JSON.stringify({
          version: 1,
          repositories: {
            frontend: {
              sourceUrl:
                "https://github.com/SecPal/frontend?tab=readme-ov-file#top",
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
      "/v1/release": new Response("not found", { status: 404 }),
    });

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("fallback");
  });

  it("rejects manifest repositories that point to mutable public repository roots with case variants", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
        JSON.stringify({
          version: 1,
          repositories: {
            frontend: {
              sourceUrl: "https://github.com/secpal/frontend",
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
      "/v1/release": new Response("not found", { status: 404 }),
    });

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("fallback");
  });

  it("rejects manifest repositories that point to Git clone repository roots", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
        JSON.stringify({
          version: 1,
          repositories: {
            frontend: {
              sourceUrl: "https://github.com/SecPal/frontend.git",
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
      "/v1/release": new Response("not found", { status: 404 }),
    });

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("fallback");
  });

  it("rejects manifest repositories that point to Git clone repository roots with a trailing slash", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
        JSON.stringify({
          version: 1,
          repositories: {
            frontend: {
              sourceUrl: "https://github.com/SecPal/frontend.git/",
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
      "/v1/release": new Response("not found", { status: 404 }),
    });

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("fallback");
  });

  it("rejects manifest repositories that point to mutable GitHub branch archives", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
        JSON.stringify({
          version: 1,
          repositories: {
            frontend: {
              sourceUrl:
                "https://github.com/SecPal/frontend/archive/refs/heads/main.tar.gz",
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
      "/v1/release": new Response("not found", { status: 404 }),
    });

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("fallback");
  });

  it("falls back only the API repository when the live release response is invalid", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
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
      "/v1/release": new Response(
        JSON.stringify({
          data: {
            version: " ",
            source_url: "javascript:alert(1)",
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

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("deployment");
    expect(result.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "frontend",
          sourceUrl:
            "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
        }),
        expect.objectContaining({
          id: "api",
          sourceUrl: null,
        }),
        expect.objectContaining({
          id: "contracts",
          sourceUrl:
            "https://github.com/SecPal/contracts/releases/download/contracts-2026-06-26/source.tar.gz",
        }),
      ])
    );
  });

  it("rejects API release metadata that points to the mutable public repository root", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
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
      "/v1/release": new Response(
        JSON.stringify({
          data: {
            version: "api-2026-06-26",
            source_url: "https://github.com/SecPal/api/?tab=readme-ov-file",
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

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("deployment");
    expect(result.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "frontend",
          sourceUrl:
            "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
        }),
        expect.objectContaining({
          id: "api",
          sourceUrl: null,
        }),
        expect.objectContaining({
          id: "contracts",
          sourceUrl:
            "https://github.com/SecPal/contracts/releases/download/contracts-2026-06-26/source.tar.gz",
        }),
      ])
    );
  });

  it("rejects API release metadata that points to the mutable public repository root with a case variant", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
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
      "/v1/release": new Response(
        JSON.stringify({
          data: {
            version: "api-2026-06-26",
            source_url: "https://github.com/secpal/api",
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

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("deployment");
    expect(result.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "api",
          sourceUrl: null,
        }),
      ])
    );
  });

  it("rejects API release metadata that points to a Git clone repository root", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
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
      "/v1/release": new Response(
        JSON.stringify({
          data: {
            version: "api-2026-06-26",
            source_url: "https://github.com/SecPal/api.git",
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

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("deployment");
    expect(result.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "api",
          sourceUrl: null,
        }),
      ])
    );
  });

  it("rejects API release metadata that points to a Git clone repository root with a trailing slash", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
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
      "/v1/release": new Response(
        JSON.stringify({
          data: {
            version: "api-2026-06-26",
            source_url: "https://github.com/SecPal/api.git/",
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

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("deployment");
    expect(result.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "api",
          sourceUrl: null,
        }),
      ])
    );
  });

  it("rejects API release metadata that points to mutable GitHub branch archives", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
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
      "/v1/release": new Response(
        JSON.stringify({
          data: {
            version: "api-2026-06-26",
            source_url:
              "https://github.com/SecPal/api/archive/refs/heads/main.tar.gz",
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

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("deployment");
    expect(result.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "api",
          sourceUrl: null,
        }),
      ])
    );
  });

  it("rejects API release metadata with a non-string source URL", async () => {
    const fetchMock = createResponseRouter({
      "/source-offer.json": new Response(
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
      "/v1/release": new Response(
        JSON.stringify({
          data: {
            version: "api-2026-06-26",
            source_url: [
              "https://github.com/SecPal/api/releases/download/api-2026-06-26/source.tar.gz",
            ],
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

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("deployment");
    expect(result.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "frontend",
          sourceUrl:
            "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
        }),
        expect.objectContaining({
          id: "api",
          sourceUrl: null,
        }),
      ])
    );
  });

  it("keeps manifest source links when the live release fetch throws", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
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
        throw new TypeError("Failed to fetch");
      }

      throw new Error(`unexpected fetch for ${url}`);
    });

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("deployment");
    expect(result.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "frontend",
          sourceUrl:
            "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
        }),
        expect.objectContaining({
          id: "api",
          sourceUrl: null,
        }),
        expect.objectContaining({
          id: "contracts",
          sourceUrl:
            "https://github.com/SecPal/contracts/releases/download/contracts-2026-06-26/source.tar.gz",
        }),
      ])
    );
  });

  it("publishes manifest source links before the API release fetch settles", async () => {
    let resolveApiFetch: ((value: Response) => void) | undefined;
    const onPartialLoad = vi.fn();

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
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
        return new Promise<Response>((resolve) => {
          resolveApiFetch = resolve;
        });
      }

      throw new Error(`unexpected fetch for ${url}`);
    });

    const resultPromise = loadSourceOffer(fetchMock, onPartialLoad);

    await vi.waitFor(() => {
      expect(onPartialLoad).toHaveBeenCalledWith({
        mode: "deployment",
        repositories: [
          {
            id: "frontend",
            name: "SecPal/frontend",
            repositoryUrl: "https://github.com/SecPal/frontend",
            sourceUrl:
              "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
          },
          {
            id: "api",
            name: "SecPal/api",
            repositoryUrl: "https://github.com/SecPal/api",
            sourceUrl: null,
          },
          {
            id: "contracts",
            name: "SecPal/contracts",
            repositoryUrl: "https://github.com/SecPal/contracts",
            sourceUrl:
              "https://github.com/SecPal/contracts/releases/download/contracts-2026-06-26/source.tar.gz",
          },
        ],
      });
    });

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

    const result = await resultPromise;

    expect(result.mode).toBe("deployment");
    expect(result.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "api",
          sourceUrl:
            "https://github.com/SecPal/api/releases/download/api-2026-07-03/source.tar.gz",
        }),
      ])
    );
  });

  it("publishes the API release source link before the manifest fetch settles", async () => {
    let resolveManifestFetch: ((value: Response) => void) | undefined;
    const onPartialLoad = vi.fn();

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url === "/source-offer.json") {
        return new Promise<Response>((resolve) => {
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
    });

    const resultPromise = loadSourceOffer(fetchMock, onPartialLoad);

    await vi.waitFor(() => {
      expect(onPartialLoad).toHaveBeenCalledWith({
        mode: "deployment",
        repositories: [
          {
            id: "frontend",
            name: "SecPal/frontend",
            repositoryUrl: "https://github.com/SecPal/frontend",
            sourceUrl: null,
          },
          {
            id: "api",
            name: "SecPal/api",
            repositoryUrl: "https://github.com/SecPal/api",
            sourceUrl:
              "https://github.com/SecPal/api/releases/download/api-2026-07-03/source.tar.gz",
          },
          {
            id: "contracts",
            name: "SecPal/contracts",
            repositoryUrl: "https://github.com/SecPal/contracts",
            sourceUrl: null,
          },
        ],
      });
    });

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

    const result = await resultPromise;

    expect(result.mode).toBe("deployment");
    expect(result.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "frontend",
          sourceUrl:
            "https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz",
        }),
        expect.objectContaining({
          id: "api",
          sourceUrl:
            "https://github.com/SecPal/api/releases/download/api-2026-07-03/source.tar.gz",
        }),
      ])
    );
  });
});
