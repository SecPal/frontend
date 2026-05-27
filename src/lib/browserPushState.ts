// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

const BROWSER_PUSH_INSTALLATION_ID_STORAGE_KEY =
  "secpal-browser-push-installation-id";

let volatileInstallationId: string | null = null;

function createInstallationId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `browser-push-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function parseBrowserIdentity(userAgent: string): {
  browserName: string;
  browserVersion: string | null;
} {
  const candidates: Array<{
    browserName: string;
    pattern: RegExp;
  }> = [
    { browserName: "Edge", pattern: /Edg\/([\d.]+)/ },
    { browserName: "Chrome", pattern: /Chrome\/([\d.]+)/ },
    { browserName: "Firefox", pattern: /Firefox\/([\d.]+)/ },
    { browserName: "Safari", pattern: /Version\/([\d.]+).*Safari/ },
  ];

  for (const candidate of candidates) {
    const match = userAgent.match(candidate.pattern);

    if (match) {
      return {
        browserName: candidate.browserName,
        browserVersion: match[1] ?? null,
      };
    }
  }

  return {
    browserName: "Browser",
    browserVersion: null,
  };
}

export function peekBrowserPushInstallationId(): string | null {
  if (typeof localStorage === "undefined") {
    return volatileInstallationId;
  }

  try {
    const storedValue = localStorage.getItem(
      BROWSER_PUSH_INSTALLATION_ID_STORAGE_KEY
    );

    return storedValue && storedValue.trim().length > 0
      ? storedValue
      : volatileInstallationId;
  } catch {
    return volatileInstallationId;
  }
}

export function getOrCreateBrowserPushInstallationId(): string {
  const existingInstallationId = peekBrowserPushInstallationId();

  if (existingInstallationId) {
    return existingInstallationId;
  }

  const createdInstallationId = createInstallationId();

  if (typeof localStorage === "undefined") {
    volatileInstallationId = createdInstallationId;
    return createdInstallationId;
  }

  try {
    localStorage.setItem(
      BROWSER_PUSH_INSTALLATION_ID_STORAGE_KEY,
      createdInstallationId
    );
  } catch {
    volatileInstallationId = createdInstallationId;
  }

  return createdInstallationId;
}

export function clearBrowserPushInstallationId(): void {
  volatileInstallationId = null;

  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(BROWSER_PUSH_INSTALLATION_ID_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures and rely on the in-memory fallback.
  }
}

export function getBrowserPushClientMetadata(
  userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent
): {
  browserName: string;
  browserVersion: string | null;
  installationName: string;
} {
  const { browserName, browserVersion } = parseBrowserIdentity(userAgent);

  return {
    browserName,
    browserVersion,
    installationName: `${browserName} browser notifications`.slice(0, 120),
  };
}

export function getServiceWorkerScopePath(
  scope: string | undefined
): string | null {
  if (!scope) {
    return null;
  }

  try {
    return new URL(scope).pathname || "/";
  } catch {
    return scope;
  }
}
