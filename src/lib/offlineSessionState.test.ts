// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OFFLINE_SESSION_CACHE_NAME,
  OFFLINE_SESSION_STATE_PATH,
  readOfflineSessionState,
  writeOfflineSessionState,
} from "./offlineSessionState";

describe("offlineSessionState", () => {
  describe("when Cache API is unavailable", () => {
    // jsdom does not expose `caches` by default; these tests verify the
    // graceful-degradation paths that skip all cache I/O.

    it("readOfflineSessionState resolves to null", async () => {
      const result = await readOfflineSessionState();
      expect(result).toBeNull();
    });

    it("writeOfflineSessionState resolves without error", async () => {
      await expect(writeOfflineSessionState(true)).resolves.toBeUndefined();
    });
  });

  describe("when Cache API is available", () => {
    const mockDelete = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
    const mockPut = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const mockMatch = vi.fn<() => Promise<Response | undefined>>();
    const mockCache = { match: mockMatch, put: mockPut, delete: mockDelete };
    const mockOpen = vi
      .fn<() => Promise<typeof mockCache>>()
      .mockResolvedValue(mockCache);

    beforeEach(() => {
      vi.stubGlobal("caches", { open: mockOpen });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    describe("readOfflineSessionState", () => {
      it("opens the correct cache name", async () => {
        mockMatch.mockResolvedValue(undefined);
        await readOfflineSessionState();
        expect(mockOpen).toHaveBeenCalledWith(OFFLINE_SESSION_CACHE_NAME);
      });

      it("returns null when no cached entry exists", async () => {
        mockMatch.mockResolvedValue(undefined);
        const result = await readOfflineSessionState();
        expect(result).toBeNull();
      });

      it("returns the parsed session state on a cache hit", async () => {
        const state = { isAuthenticated: true };
        mockMatch.mockResolvedValue(new Response(JSON.stringify(state)));

        const result = await readOfflineSessionState();

        expect(result).toEqual(state);
      });

      it("deletes the corrupt entry and returns null when JSON is invalid", async () => {
        mockMatch.mockResolvedValue(new Response("not-valid-json{"));

        const result = await readOfflineSessionState();

        expect(result).toBeNull();
        expect(mockDelete).toHaveBeenCalledWith(
          expect.stringContaining(OFFLINE_SESSION_STATE_PATH)
        );
      });

      it("deletes the entry and returns null when JSON shape is invalid", async () => {
        // Valid JSON but wrong types — e.g. isAuthenticated is a string
        mockMatch.mockResolvedValue(
          new Response(JSON.stringify({ isAuthenticated: "yes", updatedAt: 0 }))
        );

        const result = await readOfflineSessionState();

        expect(result).toBeNull();
        expect(mockDelete).toHaveBeenCalledWith(
          expect.stringContaining(OFFLINE_SESSION_STATE_PATH)
        );
      });
    });

    describe("writeOfflineSessionState", () => {
      it("opens the correct cache and calls put", async () => {
        await writeOfflineSessionState(false);

        expect(mockOpen).toHaveBeenCalledWith(OFFLINE_SESSION_CACHE_NAME);
        expect(mockPut).toHaveBeenCalledOnce();
      });

      it("writes the correct URL and authenticated=false payload", async () => {
        await writeOfflineSessionState(false);

        const [urlArg, responseArg] = mockPut.mock.calls[0] as unknown as [
          string,
          Response,
        ];
        expect(urlArg).toContain(OFFLINE_SESSION_STATE_PATH);

        const written = (await responseArg.json()) as {
          isAuthenticated: boolean;
        };
        expect(written).toEqual({ isAuthenticated: false });
      });

      it("writes authenticated=true when the user is logged in", async () => {
        await writeOfflineSessionState(true);

        const [, responseArg] = mockPut.mock.calls[0] as unknown as [
          string,
          Response,
        ];
        const written = (await responseArg.json()) as {
          isAuthenticated: boolean;
        };
        expect(written.isAuthenticated).toBe(true);
      });

      it("response has no-store cache-control header", async () => {
        await writeOfflineSessionState(true);

        const [, responseArg] = mockPut.mock.calls[0] as unknown as [
          string,
          Response,
        ];
        expect(responseArg.headers.get("cache-control")).toBe("no-store");
      });
    });
  });
});
