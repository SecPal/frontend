// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

const PUBLIC_LOGGED_OUT_PATHS = new Set(["/login", "/onboarding/complete"]);

export interface RedirectableWindowClient {
  url: string;
  navigate(url: string): Promise<WindowClient | null>;
}

export interface ProtectedClientRedirectSummary {
  redirected: number;
  skipped: number;
  failed: number;
}

export function shouldRedirectLoggedOutNavigation(
  pathname: string,
  isAuthenticated: boolean | null
): boolean {
  if (isAuthenticated !== false) {
    return false;
  }

  const normalizedPathname =
    pathname !== "/" && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  return !PUBLIC_LOGGED_OUT_PATHS.has(normalizedPathname);
}

function redactClientUrlForLog(clientUrl: string): string {
  try {
    const { origin, pathname } = new URL(clientUrl);
    return `${origin}${pathname}`;
  } catch {
    return "[invalid-client-url]";
  }
}

export async function redirectProtectedWindowClientsToLogin(
  windowClients: readonly RedirectableWindowClient[],
  origin: string,
  logger: Pick<Console, "error" | "warn"> = console
): Promise<ProtectedClientRedirectSummary> {
  const loginUrl = new URL("/login", origin).toString();

  const results = await Promise.all(
    windowClients.map(async (client) => {
      try {
        const pathname = new URL(client.url).pathname;

        if (!shouldRedirectLoggedOutNavigation(pathname, false)) {
          return "skipped" as const;
        }

        await client.navigate(loginUrl);
        return "redirected" as const;
      } catch (error) {
        logger.error("[SW] Failed to redirect protected client to login:", {
          clientUrl: redactClientUrlForLog(client.url),
          error,
        });
        return "failed" as const;
      }
    })
  );

  const summary = results.reduce<ProtectedClientRedirectSummary>(
    (accumulator, result) => {
      accumulator[result] += 1;
      return accumulator;
    },
    { redirected: 0, skipped: 0, failed: 0 }
  );

  if (summary.failed > 0) {
    logger.warn(
      "[SW] Completed protected-client login redirects with failures:",
      summary
    );
  }

  return summary;
}
