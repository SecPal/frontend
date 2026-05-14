// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchAddressLocalitySuggestions,
  fetchAddressStreetSuggestions,
} from "./addressApi";

const mockFetch = vi.fn();

describe("addressApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
    expect(result).toEqual([
      {
        name: "Grabstraße",
        postal_code: "13156",
        locality: "Berlin",
      },
    ]);
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
    expect(result).toEqual([{ postal_code: "10115", locality: "Berlin" }]);
  });
});
