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

async function focusAndNavigateMatchingClient(
  client: NotificationWindowClient,
  targetHref: string
): Promise<NotificationWindowClient | null> {
  try {
    const focusedClient = await client.focus();
    return await focusedClient.navigate(targetHref);
  } catch {
    return null;
  }
}

async function navigateAndFocusClient(
  client: NotificationWindowClient,
  targetHref: string
): Promise<NotificationWindowClient | null> {
  try {
    const navigatedClient = await client.navigate(targetHref);

    if (!navigatedClient) {
      return null;
    }

    return navigatedClient.focus();
  } catch {
    return null;
  }
}

export async function focusOrNavigateClient(
  windowClients: readonly NotificationWindowClient[],
  targetUrl: URL
): Promise<NotificationWindowClient | null> {
  const targetHref = targetUrl.toString();
  const matchingClients = windowClients.filter(
    (client) => new URL(client.url).pathname === targetUrl.pathname
  );
  const attemptedClients = new Set<NotificationWindowClient>();

  for (const client of matchingClients) {
    attemptedClients.add(client);

    const navigatedClient = await focusAndNavigateMatchingClient(
      client,
      targetHref
    );

    if (navigatedClient) {
      return navigatedClient;
    }
  }

  for (const client of windowClients) {
    if (attemptedClients.has(client)) {
      continue;
    }

    const navigatedClient = await navigateAndFocusClient(client, targetHref);

    if (navigatedClient) {
      return navigatedClient;
    }
  }

  return null;
}
