// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { useCallback } from "react";
import { apiConfig } from "../config";
import { routeModuleLoaders, type RouteModuleKey } from "../routeModules";

export interface RoutePrefetchPlan {
  routeModules: RouteModuleKey[];
  apiPaths: string[];
}

interface PrefetchRouteOptions {
  includeApi?: boolean;
}

type LowPriorityRequestInit = RequestInit & { priority?: "low" };

const completedPrefetches = new Set<string>();
const pendingPrefetches = new Map<string, Promise<void>>();
// Cross-session isolation: `resetPrefetchCache` bumps this counter so callbacks
// from prefetches that were in flight before the reset cannot leak keys back
// into `completedPrefetches` after a logout/login boundary.
let prefetchEpoch = 0;

function pathFromUrlLike(value: string): string | null {
  if (!value.startsWith("/")) {
    return null;
  }

  try {
    const url = new URL(value, window.location.origin);
    return `${url.pathname}${url.search}`;
  } catch {
    return value;
  }
}

function encodePathSegment(value: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(value));
  } catch {
    return encodeURIComponent(value);
  }
}

function listApiPath(resource: string, params: Record<string, string>): string {
  const searchParams = new URLSearchParams(params);

  return `/v1/${resource}?${searchParams.toString()}`;
}

function routePlan(
  routeModules: RouteModuleKey[],
  apiPaths: string[] = []
): RoutePrefetchPlan {
  return { routeModules, apiPaths };
}

export function getRoutePrefetchPlan(
  destination: string
): RoutePrefetchPlan | null {
  const path = pathFromUrlLike(destination);

  if (!path) {
    return null;
  }

  const pathname = path.split("?")[0] ?? "";

  switch (pathname) {
    case "/profile":
      return routePlan(["profile"]);
    case "/settings":
      return routePlan(["settings"]);
    case "/organization":
      return routePlan(
        ["organization"],
        [listApiPath("organizational-units", { per_page: "100" })]
      );
    case "/customers":
      return routePlan(
        ["customers"],
        [listApiPath("customers", { page: "1", per_page: "15" })]
      );
    case "/customers/new":
      return routePlan(["customerCreate"]);
    case "/sites":
      return routePlan(
        ["sites"],
        [listApiPath("sites", { page: "1", per_page: "15" })]
      );
    case "/sites/new":
      return routePlan(["siteCreate"], ["/v1/lookups/legal-entities"]);
    case "/employees":
      return routePlan(
        ["employeeList"],
        [
          listApiPath("employees", { page: "1", per_page: "15" }),
          "/v1/lookups/legal-entities",
        ]
      );
    case "/employees/create":
      return routePlan(["employeeCreate"], ["/v1/lookups/legal-entities"]);
    case "/activity-logs":
      return routePlan(
        ["activityLogs"],
        [
          listApiPath("activity-logs", {
            page: "1",
            per_page: "50",
            include_verification: "1",
          }),
          "/v1/organizational-units",
        ]
      );
    default:
      break;
  }

  const customerMatch = pathname.match(/^\/customers\/([^/]+)$/);
  if (customerMatch) {
    const id = encodePathSegment(customerMatch[1] ?? "");
    return routePlan(["customerDetail"], [`/v1/customers/${id}`]);
  }

  const customerEditMatch = pathname.match(/^\/customers\/([^/]+)\/edit$/);
  if (customerEditMatch) {
    const id = encodePathSegment(customerEditMatch[1] ?? "");
    return routePlan(["customerEdit"], [`/v1/customers/${id}`]);
  }

  const customerSitesMatch = pathname.match(/^\/sites\/customer\/([^/]+)$/);
  if (customerSitesMatch) {
    return routePlan(
      ["sites"],
      [
        listApiPath("sites", {
          customer_id: encodePathSegment(customerSitesMatch[1] ?? ""),
          page: "1",
          per_page: "15",
        }),
      ]
    );
  }

  const customerSiteCreateMatch = pathname.match(
    /^\/sites\/new\/customer\/([^/]+)$/
  );
  if (customerSiteCreateMatch) {
    const customerId = encodePathSegment(customerSiteCreateMatch[1] ?? "");
    return routePlan(
      ["siteCreate"],
      [`/v1/customers/${customerId}`, "/v1/lookups/legal-entities"]
    );
  }

  const siteMatch = pathname.match(/^\/sites\/([^/]+)$/);
  if (siteMatch) {
    const id = encodePathSegment(siteMatch[1] ?? "");
    return routePlan(
      ["siteDetail"],
      [`/v1/sites/${id}`, "/v1/lookups/legal-entities"]
    );
  }

  const siteEditMatch = pathname.match(/^\/sites\/([^/]+)\/edit$/);
  if (siteEditMatch) {
    const id = encodePathSegment(siteEditMatch[1] ?? "");
    return routePlan(
      ["siteEdit"],
      [`/v1/sites/${id}`, "/v1/lookups/legal-entities"]
    );
  }

  const employeeContactsMatch = pathname.match(
    /^\/employees\/([^/]+)\/edit\/contacts$/
  );
  if (employeeContactsMatch) {
    const id = encodePathSegment(employeeContactsMatch[1] ?? "");
    return routePlan(["employeeContactsEdit"], [`/v1/employees/${id}`]);
  }

  const employeeEditMatch = pathname.match(/^\/employees\/([^/]+)\/edit$/);
  if (employeeEditMatch) {
    const id = encodePathSegment(employeeEditMatch[1] ?? "");
    return routePlan(
      ["employeeEdit"],
      [`/v1/employees/${id}`, "/v1/lookups/legal-entities"]
    );
  }

  const employeeMatch = pathname.match(/^\/employees\/([^/]+)$/);
  if (employeeMatch) {
    const id = encodePathSegment(employeeMatch[1] ?? "");
    return routePlan(
      ["employeeDetail"],
      [`/v1/employees/${id}`, "/v1/lookups/legal-entities"]
    );
  }

  return null;
}

function runPrefetch(
  key: string,
  task: () => Promise<Response | unknown>
): Promise<void> {
  if (completedPrefetches.has(key)) {
    return Promise.resolve();
  }

  const pending = pendingPrefetches.get(key);
  if (pending) {
    return pending;
  }

  const startEpoch = prefetchEpoch;
  const promise = Promise.resolve()
    .then(task)
    .then(
      (result: Response | unknown) => {
        if (result instanceof Response && !result.ok) {
          if (import.meta.env.DEV) {
            console.warn(
              `[Prefetch] Prefetch for ${key} returned HTTP ${result.status}; not caching.`
            );
          }
          return;
        }
        // Drop the result if the cache was reset (e.g. logout) while this
        // prefetch was in flight; otherwise the previous session's warm-up
        // leaks into the next user's dedupe state.
        if (prefetchEpoch !== startEpoch) {
          return;
        }
        completedPrefetches.add(key);
      },
      (error: unknown) => {
        if (import.meta.env.DEV) {
          console.warn(`[Prefetch] Failed to prefetch ${key}:`, error);
        }
      }
    )
    .finally(() => {
      if (prefetchEpoch === startEpoch) {
        pendingPrefetches.delete(key);
      }
    });

  pendingPrefetches.set(key, promise);
  return promise;
}

function prefetchRouteModule(routeModule: RouteModuleKey): Promise<void> {
  return runPrefetch(`route:${routeModule}`, () =>
    routeModuleLoaders[routeModule]()
  );
}

function prefetchApiPath(path: string): Promise<void> {
  const requestInit: LowPriorityRequestInit = {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  };

  if (typeof Request !== "undefined" && "priority" in Request.prototype) {
    requestInit.priority = "low";
  }

  return runPrefetch(`api:${path}`, () =>
    fetch(`${apiConfig.baseUrl}${path}`, requestInit)
  );
}

export async function prefetchRoutePath(
  destination: string,
  options: PrefetchRouteOptions = {}
): Promise<void> {
  const plan = getRoutePrefetchPlan(destination);

  if (!plan) {
    return;
  }

  const apiPaths = options.includeApi === false ? [] : plan.apiPaths;

  await Promise.all([
    ...plan.routeModules.map(prefetchRouteModule),
    ...apiPaths.map(prefetchApiPath),
  ]);
}

export function scheduleRoutePrefetch(
  destination: string,
  options: PrefetchRouteOptions = {}
): void {
  const prefetch = () => {
    void prefetchRoutePath(destination, options);
  };

  if (
    typeof window !== "undefined" &&
    "requestIdleCallback" in window &&
    typeof window.requestIdleCallback === "function"
  ) {
    window.requestIdleCallback(prefetch, { timeout: 2000 });
    return;
  }

  window.setTimeout(prefetch, 100);
}

export function resetPrefetchCache(): void {
  prefetchEpoch += 1;
  completedPrefetches.clear();
  pendingPrefetches.clear();
}

/** @internal Use only in tests. */
export function resetPrefetchCacheForTests(): void {
  resetPrefetchCache();
}

export function usePrefetch() {
  const prefetchPath = useCallback((destination: string) => {
    void prefetchRoutePath(destination);
  }, []);

  const prefetchPathModuleOnly = useCallback((destination: string) => {
    void prefetchRoutePath(destination, { includeApi: false });
  }, []);

  const prefetchPathOnIdle = useCallback((destination: string) => {
    scheduleRoutePrefetch(destination, { includeApi: false });
  }, []);

  const prefetchPathsOnIdle = useCallback((destinations: string[]) => {
    destinations.forEach((destination) => {
      scheduleRoutePrefetch(destination, { includeApi: false });
    });
  }, []);

  return {
    prefetchPath,
    prefetchPathModuleOnly,
    prefetchPathOnIdle,
    prefetchPathsOnIdle,
  };
}
