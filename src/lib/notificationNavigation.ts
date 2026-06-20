// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

export interface NotificationPayloadData {
  url?: string;
  data?: Record<string, unknown>;
}

export interface NotificationWindowClient {
  url: string;
  focus(): Promise<NotificationWindowClient>;
  navigate(url: string): Promise<NotificationWindowClient | null>;
}

function normalizeNotificationUrl(url: unknown): string {
  return typeof url === "string" && url.length > 0 ? url : "/";
}

export function createNotificationData(
  payload: NotificationPayloadData
): Record<string, unknown> {
  return {
    ...payload.data,
    url: normalizeNotificationUrl(payload.url),
  };
}

export function getNotificationNavigationTarget(
  notificationData: unknown
): string {
  if (typeof notificationData !== "object" || notificationData === null) {
    return "/";
  }

  return normalizeNotificationUrl(
    (notificationData as Record<string, unknown>).url
  );
}

export async function focusOrNavigateClient(
  windowClients: readonly NotificationWindowClient[],
  targetUrl: URL
): Promise<NotificationWindowClient | null> {
  const targetHref = targetUrl.toString();

  for (const client of windowClients) {
    if (new URL(client.url).pathname === targetUrl.pathname) {
      try {
        const focused = await client.focus();
        await focused.navigate(targetHref);
        return focused;
      } catch {
        return null;
      }
    }
  }

  const firstClient = windowClients[0];

  if (!firstClient) {
    return null;
  }

  try {
    const navigatedClient = await firstClient.navigate(targetHref);

    if (!navigatedClient) {
      return null;
    }

    return navigatedClient.focus();
  } catch {
    return null;
  }
}
