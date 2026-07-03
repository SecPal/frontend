// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import { loadSourceOffer } from "./sourceOffer";

describe("loadSourceOffer", () => {
  it("prefers same-origin immutable source references when the deployment publishes them", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
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
      );
    });

    const result = await loadSourceOffer(fetchMock);

    expect(fetchMock).toHaveBeenCalledWith("/source-offer.json", {
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
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          version: 1,
          repositories: {
            frontend: {
              sourceUrl:
                " https://github.com/SecPal/frontend/releases/download/frontend-2026-06-26/source.tar.gz ",
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
      );
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

  it("keeps optional repositories separate when the deployment omits their immutable source URL", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
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
      );
    });

    const result = await loadSourceOffer(fetchMock);

    expect(result.mode).toBe("deployment");
    expect(result.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "android",
          sourceUrl: null,
          repositoryUrl: "https://github.com/SecPal/android",
        }),
      ])
    );
  });

  it("falls back to the project repositories when the deployment metadata is unavailable", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response("not found", { status: 404 });
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
        expect.objectContaining({
          id: "android",
          sourceUrl: "https://github.com/SecPal/android",
        }),
      ])
    );
  });
});
