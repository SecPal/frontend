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
    expect(result.repositories.some((repository) => repository.id === "android")).toBe(
      false
    );
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
    expect(result.repositories.some((repository) => repository.id === "android")).toBe(
      false
    );
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
});
