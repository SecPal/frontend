// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchAddressLocalitySuggestions,
  fetchAddressStreetSuggestions,
} from "./addressApi";

import { apiConfig } from "../config";

const mockFetch = vi.fn();

describe("addressApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["streets", fetchAddressStreetSuggestions],
    ["localities", fetchAddressLocalitySuggestions],
  ] as const)(
    "preserves available empty results and attribution metadata for %s",
    async (endpoint, fetchSuggestions) => {
      const payload = {
        data: [],
        meta: {
          source: "OpenPLZ API Data",
          license: "ODbL-1.0",
          attribution: "OpenPotato; © OpenStreetMap contributors",
          imported_at: "2026-10-18T00:00:00Z",
          version_hash: "a".repeat(64),
        },
      };
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(payload)));
      expect(await fetchSuggestions({})).toEqual(payload);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = new URL(
        mockFetch.mock.calls[0]![0],
        "https://app.secpal.dev"
      );
      const apiOrigin = new URL(
        apiConfig.baseUrl || "/",
        "https://app.secpal.dev"
      ).origin;
      expect(url.origin).toBe(apiOrigin);
      expect(url.pathname).toBe(`/v1/addresses/de/${endpoint}`);
    }
  );

  it("fetches street suggestions with the expected query parameters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          {
            name: "Grabstraße",
            postal_code: "13156",
            locality: "Berlin",
          },
        ],
      }),
    } as Response);

    const result = await fetchAddressStreetSuggestions({
      name: "Gr",
      postalCode: "13156",
      locality: "Berlin",
      limit: 5,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/v1/addresses/de/streets?name=Gr&postal_code=13156&locality=Berlin&limit=5"
      ),
      expect.objectContaining({
        credentials: "include",
        method: "GET",
      })
    );
    expect(result.data).toEqual([
      {
        name: "Grabstraße",
        postal_code: "13156",
        locality: "Berlin",
      },
    ]);
  });

  it("throws ApiError with the server message when street fetch fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: async () => ({ message: "OpenPLZ API unavailable" }),
    } as unknown as Response);

    await expect(
      fetchAddressStreetSuggestions({ name: "Test" })
    ).rejects.toMatchObject({
      message: "OpenPLZ API unavailable",
      status: 503,
    });
  });

  it("throws ApiError with statusText when street fetch fails and json parsing fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    } as unknown as Response);

    await expect(
      fetchAddressStreetSuggestions({ name: "Test" })
    ).rejects.toMatchObject({ message: "Bad Gateway", status: 502 });
  });

  it("throws ApiError with the server message when locality fetch fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ message: "Locality not found" }),
    } as unknown as Response);

    await expect(
      fetchAddressLocalitySuggestions({ postalCode: "99999" })
    ).rejects.toMatchObject({ message: "Locality not found", status: 404 });
  });

  it("throws ApiError with statusText when locality fetch fails and json parsing fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    } as unknown as Response);

    await expect(
      fetchAddressLocalitySuggestions({ locality: "Berlin" })
    ).rejects.toMatchObject({ message: "Internal Server Error", status: 500 });
  });

  it("fetches locality suggestions with the expected query parameters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ postal_code: "10115", locality: "Berlin" }],
      }),
    } as Response);

    const result = await fetchAddressLocalitySuggestions({
      postalCode: "101",
      locality: "Ber",
      limit: 6,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/v1/addresses/de/localities?postal_code=101&locality=Ber&limit=6"
      ),
      expect.objectContaining({
        credentials: "include",
        method: "GET",
      })
    );
    expect(result.data).toEqual([{ postal_code: "10115", locality: "Berlin" }]);
  });
});
