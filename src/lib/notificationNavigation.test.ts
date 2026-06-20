// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it, vi } from "vitest";
import {
  createNotificationData,
  focusOrNavigateClient,
  getNotificationNavigationTarget,
  type NotificationWindowClient,
} from "./notificationNavigation";

function createClient(
  url: string,
  overrides: Partial<NotificationWindowClient> = {}
): NotificationWindowClient {
  const client: NotificationWindowClient = {
    url,
    focus: vi.fn(async () => {
      return client;
    }),
    navigate: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
  return client;
}

describe("notificationNavigation", () => {
  describe("createNotificationData", () => {
    it("keeps payload.url authoritative over payload.data.url", () => {
      expect(
        createNotificationData({
          url: "/alerts/42",
          data: { url: "/wrong", source: "push" },
        })
      ).toEqual({
        url: "/alerts/42",
        source: "push",
      });
    });

    it("falls back to / when payload.url is missing or empty", () => {
      expect(createNotificationData({ data: { foo: "bar" } })).toEqual({
        foo: "bar",
        url: "/",
      });
      expect(createNotificationData({ url: "", data: { foo: "bar" } })).toEqual(
        {
          foo: "bar",
          url: "/",
        }
      );
    });
  });

  describe("getNotificationNavigationTarget", () => {
    it("returns / for missing or invalid notification data", () => {
      expect(getNotificationNavigationTarget(undefined)).toBe("/");
      expect(getNotificationNavigationTarget(null)).toBe("/");
      expect(getNotificationNavigationTarget({ url: 123 })).toBe("/");
    });

    it("returns the url when notification data contains a non-empty string", () => {
      expect(
        getNotificationNavigationTarget({ url: "/sites/123?tab=alerts#latest" })
      ).toBe("/sites/123?tab=alerts#latest");
    });
  });

  describe("focusOrNavigateClient", () => {
    it("focuses and navigates an existing client when pathnames match, ignoring query and hash differences", async () => {
      const differentPath = createClient("https://app.secpal.dev/sites/456");
      const samePath = createClient(
        "https://app.secpal.dev/sites/123?tab=overview",
        {
          navigate: vi.fn(),
        }
      );
      vi.mocked(samePath.navigate).mockResolvedValue(samePath);

      const result = await focusOrNavigateClient(
        [differentPath, samePath],
        new URL("https://app.secpal.dev/sites/123?tab=alerts#latest")
      );

      expect(result).toBe(samePath);
      expect(vi.mocked(differentPath.focus)).not.toHaveBeenCalled();
      expect(vi.mocked(samePath.focus)).toHaveBeenCalledOnce();
      expect(vi.mocked(samePath.navigate)).toHaveBeenCalledWith(
        "https://app.secpal.dev/sites/123?tab=alerts#latest"
      );
    });

    it("tries the next pathname-matching client when the first one cannot navigate", async () => {
      const failingPathMatch = createClient(
        "https://app.secpal.dev/sites/123?tab=overview",
        {
          navigate: vi.fn().mockResolvedValue(null),
        }
      );
      const succeedingPathMatch = createClient(
        "https://app.secpal.dev/sites/123?tab=summary",
        {
          navigate: vi.fn(),
        }
      );
      vi.mocked(succeedingPathMatch.navigate).mockResolvedValue(
        succeedingPathMatch
      );

      const result = await focusOrNavigateClient(
        [failingPathMatch, succeedingPathMatch],
        new URL("https://app.secpal.dev/sites/123?tab=alerts#latest")
      );

      expect(vi.mocked(failingPathMatch.focus)).toHaveBeenCalledOnce();
      expect(vi.mocked(failingPathMatch.navigate)).toHaveBeenCalledWith(
        "https://app.secpal.dev/sites/123?tab=alerts#latest"
      );
      expect(vi.mocked(succeedingPathMatch.focus)).toHaveBeenCalledOnce();
      expect(vi.mocked(succeedingPathMatch.navigate)).toHaveBeenCalledWith(
        "https://app.secpal.dev/sites/123?tab=alerts#latest"
      );
      expect(result).toBe(succeedingPathMatch);
    });

    it("navigates the first client and focuses the returned client when no pathname match exists", async () => {
      const navigatedClient = createClient("https://app.secpal.dev/alerts");
      const firstClient = createClient("https://app.secpal.dev/", {
        navigate: vi.fn().mockResolvedValue(navigatedClient),
      });

      const result = await focusOrNavigateClient(
        [firstClient],
        new URL("https://app.secpal.dev/alerts")
      );

      expect(vi.mocked(firstClient.navigate)).toHaveBeenCalledWith(
        "https://app.secpal.dev/alerts"
      );
      expect(vi.mocked(navigatedClient.focus)).toHaveBeenCalledOnce();
      expect(result).toBe(navigatedClient);
    });

    it("falls back to another existing client when pathname matches keep failing", async () => {
      const failingPathMatch = createClient(
        "https://app.secpal.dev/sites/123?tab=overview",
        {
          navigate: vi.fn().mockResolvedValue(null),
        }
      );
      const navigatedFallbackClient = createClient(
        "https://app.secpal.dev/alerts"
      );
      const fallbackClient = createClient("https://app.secpal.dev/", {
        navigate: vi.fn().mockResolvedValue(navigatedFallbackClient),
      });

      const result = await focusOrNavigateClient(
        [failingPathMatch, fallbackClient],
        new URL("https://app.secpal.dev/sites/123?tab=alerts#latest")
      );

      expect(vi.mocked(failingPathMatch.focus)).toHaveBeenCalledOnce();
      expect(vi.mocked(fallbackClient.navigate)).toHaveBeenCalledWith(
        "https://app.secpal.dev/sites/123?tab=alerts#latest"
      );
      expect(vi.mocked(navigatedFallbackClient.focus)).toHaveBeenCalledOnce();
      expect(result).toBe(navigatedFallbackClient);
    });

    it("returns null when the client list is empty", async () => {
      await expect(
        focusOrNavigateClient([], new URL("https://app.secpal.dev/alerts"))
      ).resolves.toBeNull();
    });

    it("returns null when navigate returns null or throws", async () => {
      const samePathNullClient = createClient(
        "https://app.secpal.dev/alerts?tab=overview"
      );
      const nullClient = createClient("https://app.secpal.dev/", {
        navigate: vi.fn().mockResolvedValue(null),
      });
      const throwingClient = createClient("https://app.secpal.dev/", {
        navigate: vi.fn().mockRejectedValue(new Error("navigation failed")),
      });

      await expect(
        focusOrNavigateClient(
          [samePathNullClient],
          new URL("https://app.secpal.dev/alerts?tab=latest")
        )
      ).resolves.toBeNull();
      await expect(
        focusOrNavigateClient([nullClient], new URL("https://app.secpal.dev/alerts"))
      ).resolves.toBeNull();
      await expect(
        focusOrNavigateClient(
          [throwingClient],
          new URL("https://app.secpal.dev/alerts")
        )
      ).resolves.toBeNull();
    });
  });
});
