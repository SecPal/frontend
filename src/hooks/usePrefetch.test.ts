// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const { mockRouteModuleLoaders } = vi.hoisted(() => {
  const createLoader = () =>
    vi.fn().mockResolvedValue({
      default: () => null,
    });

  return {
    mockRouteModuleLoaders: {
      settings: createLoader(),
      profile: createLoader(),
      employeeList: createLoader(),
      employeeDetail: createLoader(),
      employeeCreate: createLoader(),
      employeeEdit: createLoader(),
      employeeContactsEdit: createLoader(),
      onboardingWizard: createLoader(),
      onboardingComplete: createLoader(),
      onboardingSubmitted: createLoader(),
      organization: createLoader(),
      customers: createLoader(),
      customerCreate: createLoader(),
      customerDetail: createLoader(),
      customerEdit: createLoader(),
      sites: createLoader(),
      siteCreate: createLoader(),
      siteDetail: createLoader(),
      siteEdit: createLoader(),
      activityLogs: createLoader(),
      androidProvisioning: createLoader(),
    },
  };
});

vi.mock("../routeModules", () => ({
  routeModuleLoaders: mockRouteModuleLoaders,
}));

vi.mock("../config", () => ({
  apiConfig: {
    baseUrl: "",
  },
}));

import {
  getRoutePrefetchPlan,
  prefetchRoutePath,
  resetPrefetchCacheForTests,
  usePrefetch,
} from "./usePrefetch";

describe("usePrefetch route strategy", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetPrefetchCacheForTests();
    vi.clearAllMocks();
    mockFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("plans primary list navigation with route chunk and API data prefetches", () => {
    expect(getRoutePrefetchPlan("/customers")).toEqual({
      routeModules: ["customers"],
      apiPaths: ["/v1/customers?page=1&per_page=15"],
    });

    expect(getRoutePrefetchPlan("/employees")).toEqual({
      routeModules: ["employeeList"],
      apiPaths: [
        "/v1/employees?page=1&per_page=15",
        "/v1/organizational-units",
      ],
    });
  });

  it("plans high-frequency detail links with detail chunks and entity data", () => {
    expect(getRoutePrefetchPlan("/customers/customer-123")).toEqual({
      routeModules: ["customerDetail"],
      apiPaths: ["/v1/customers/customer-123"],
    });

    expect(getRoutePrefetchPlan("/sites/site-123/edit")).toEqual({
      routeModules: ["siteEdit"],
      apiPaths: ["/v1/sites/site-123", "/v1/organizational-units?per_page=100"],
    });

    expect(getRoutePrefetchPlan("/employees/employee-123")).toEqual({
      routeModules: ["employeeDetail"],
      apiPaths: ["/v1/employees/employee-123"],
    });
  });

  it("aligns site-create org-units prefetch with the page's listOrganizationalUnits({ per_page: 100 }) call", () => {
    expect(getRoutePrefetchPlan("/sites/new")).toEqual({
      routeModules: ["siteCreate"],
      apiPaths: ["/v1/organizational-units?per_page=100"],
    });

    expect(getRoutePrefetchPlan("/sites/new/customer/customer-123")).toEqual({
      routeModules: ["siteCreate"],
      apiPaths: [
        "/v1/customers/customer-123",
        "/v1/organizational-units?per_page=100",
      ],
    });
  });

  it("prefetches route modules and API data once per resource", async () => {
    await prefetchRoutePath("/customers");
    await prefetchRoutePath("/customers");

    expect(mockRouteModuleLoaders.customers).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/v1/customers?page=1&per_page=15",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      })
    );
  });

  it("does not mark an API path as completed when the response is not ok", async () => {
    mockFetch.mockResolvedValueOnce(new Response("", { status: 500 }));

    await prefetchRoutePath("/customers");
    resetPrefetchCacheForTests();

    await prefetchRoutePath("/customers");

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not repopulate the completed cache from prefetches that were in flight when the cache was reset", async () => {
    let resolveFetch!: (response: Response) => void;
    mockFetch.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );

    const inFlight = prefetchRoutePath("/customers");

    // Let the internal Promise.resolve().then(task) actually invoke fetch so
    // `resolveFetch` is wired before we test the reset race.
    await new Promise((resolve) => setTimeout(resolve, 0));

    resetPrefetchCacheForTests();

    resolveFetch(new Response("{}", { status: 200 }));
    await inFlight;

    // A new prefetch must re-fetch because the prior in-flight result must
    // not survive the cache reset (cross-session isolation after logout).
    await prefetchRoutePath("/customers");

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockRouteModuleLoaders.customers).toHaveBeenCalledTimes(2);
  });

  it("does not trigger session logout on a 401 API prefetch response", async () => {
    mockFetch.mockResolvedValueOnce(new Response("", { status: 401 }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(prefetchRoutePath("/customers")).resolves.toBeUndefined();

    warn.mockRestore();
  });

  it("does not fail navigation when prefetch work rejects", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRouteModuleLoaders.customerDetail.mockRejectedValueOnce(
      new Error("chunk unavailable")
    );
    mockFetch.mockRejectedValueOnce(new Error("network unavailable"));

    await expect(
      prefetchRoutePath("/customers/customer-123")
    ).resolves.toBeUndefined();

    warn.mockRestore();
  });

  it("handles malformed percent-encoded path segments without throwing", async () => {
    await expect(prefetchRoutePath("/customers/100%")).resolves.toBeUndefined();
  });

  it("schedules route chunk warmups on idle through the hook", async () => {
    vi.useFakeTimers();
    const requestIdleCallback = vi.fn(
      (callback: IdleRequestCallback): number => {
        window.setTimeout(() => {
          callback({
            didTimeout: false,
            timeRemaining: () => 50,
          });
        }, 0);

        return 1;
      }
    );
    Object.defineProperty(window, "requestIdleCallback", {
      configurable: true,
      value: requestIdleCallback,
    });
    const { result } = renderHook(() => usePrefetch());

    act(() => {
      result.current.prefetchPathOnIdle("/customers");
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(requestIdleCallback).toHaveBeenCalled();
    expect(mockRouteModuleLoaders.customers).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
