// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Application Configuration
 *
 * This file contains configuration that can be overridden per deployment.
 * For customer-specific deployments, copy this file and adjust the values.
 */

/**
 * API Configuration
 */
import { parsePreviewHostname } from "./previewHostname";

export class ApiBaseUrlConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiBaseUrlConfigurationError";
  }
}

const LIVE_APP_HOSTNAME = "app.secpal.dev";
const LIVE_API_ORIGIN = "https://api.secpal.dev";

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isLoopbackApiHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname)
  );
}

function isPreviewHostname(hostname: string): boolean {
  return parsePreviewHostname(hostname) !== null;
}

function normalizeConfiguredApiBaseUrl(value: string): string {
  return stripTrailingSlashes(value.trim());
}

function getRuntimeHostname(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.location.hostname || null;
}

/**
 * Polyscope preview apps are served at `{workspace}.preview.secpal.dev` with a
 * sibling API host `api-{workspace}.preview.secpal.dev`. CI or mis-built bundles
 * sometimes bake in `http://localhost:4173` as `VITE_API_URL`; in the browser we
 * must still talk to the workspace API, not the developer machine.
 */
function getCanonicalPreviewApiOrigin(
  runtimeHostname: string | null
): string | null {
  const previewHostname = parsePreviewHostname(runtimeHostname);

  if (
    !previewHostname ||
    (previewHostname.repo !== null && previewHostname.repo !== "frontend")
  ) {
    return null;
  }

  return `https://api-${previewHostname.workspace}.preview.secpal.dev`;
}

/**
 * Returns true only when the configured API base should be replaced by the
 * workspace-sibling preview API: empty, relative, loopback, or pointing at the
 * SPA preview host itself. Explicitly configured hosts for a different workspace
 * or a production API are preserved as-is.
 */
function shouldReplaceConfiguredApiBaseWithPreviewWorkspaceOrigin(
  normalizedConfiguredBaseUrl: string,
  runtimeHostname: string | null
): boolean {
  const runtimePreviewHostname = parsePreviewHostname(runtimeHostname);

  if (
    !runtimePreviewHostname ||
    (runtimePreviewHostname.repo !== null &&
      runtimePreviewHostname.repo !== "frontend")
  ) {
    return false;
  }

  if (!normalizedConfiguredBaseUrl) {
    return true;
  }

  if (!isAbsoluteHttpUrl(normalizedConfiguredBaseUrl)) {
    return true;
  }

  let configuredHostname: string;
  try {
    configuredHostname = new URL(normalizedConfiguredBaseUrl).hostname;
  } catch {
    return true;
  }

  if (isLoopbackApiHost(configuredHostname)) {
    return true;
  }

  const configuredPreviewHostname = parsePreviewHostname(configuredHostname);

  return Boolean(
    configuredPreviewHostname?.workspace === runtimePreviewHostname.workspace &&
    (configuredPreviewHostname.repo === null ||
      configuredPreviewHostname.repo === "frontend")
  );
}

function shouldUseCanonicalLiveApiOrigin(
  runtimeHostname: string | null,
  normalizedConfiguredBaseUrl: string
): boolean {
  if (runtimeHostname !== LIVE_APP_HOSTNAME) {
    return false;
  }

  if (!normalizedConfiguredBaseUrl) {
    return true;
  }

  if (!isAbsoluteHttpUrl(normalizedConfiguredBaseUrl)) {
    return true;
  }

  const normalizedOrigin = new URL(normalizedConfiguredBaseUrl).origin;
  const normalizedHostname = new URL(normalizedOrigin).hostname;

  return (
    normalizedHostname === LIVE_APP_HOSTNAME ||
    isLoopbackApiHost(normalizedHostname)
  );
}

export function resolveApiBaseUrl(options?: {
  configuredBaseUrl?: string;
  mode?: string;
  runtimeHostname?: string | null;
}): string {
  const configuredBaseUrl =
    options?.configuredBaseUrl ?? import.meta.env.VITE_API_URL ?? "";
  const mode = options?.mode ?? import.meta.env.MODE;
  const runtimeHostname = options?.runtimeHostname ?? getRuntimeHostname();
  const normalizedConfiguredBaseUrl =
    normalizeConfiguredApiBaseUrl(configuredBaseUrl);

  if (
    mode === "production" &&
    runtimeHostname &&
    isLoopbackApiHost(runtimeHostname) &&
    isAbsoluteHttpUrl(normalizedConfiguredBaseUrl) &&
    isPreviewHostname(new URL(normalizedConfiguredBaseUrl).hostname)
  ) {
    return "";
  }

  if (
    shouldUseCanonicalLiveApiOrigin(
      runtimeHostname,
      normalizedConfiguredBaseUrl
    )
  ) {
    return LIVE_API_ORIGIN;
  }

  const canonicalPreviewApiOrigin =
    getCanonicalPreviewApiOrigin(runtimeHostname);

  if (
    canonicalPreviewApiOrigin &&
    shouldReplaceConfiguredApiBaseWithPreviewWorkspaceOrigin(
      normalizedConfiguredBaseUrl,
      runtimeHostname
    )
  ) {
    return canonicalPreviewApiOrigin;
  }

  if (!normalizedConfiguredBaseUrl) {
    if (mode === "production") {
      throw new ApiBaseUrlConfigurationError(
        "VITE_API_URL must be set to an absolute https:// or http:// API origin in production. Relative or missing API base URLs are unsafe because they can route /v1/* and /sanctum/* back to the SPA host."
      );
    }

    return "";
  }

  if (mode !== "production") {
    return normalizedConfiguredBaseUrl;
  }

  if (!isAbsoluteHttpUrl(normalizedConfiguredBaseUrl)) {
    throw new ApiBaseUrlConfigurationError(
      "VITE_API_URL must be an absolute https:// or http:// API origin in production. Relative API base URLs are unsafe because they can route /v1/* and /sanctum/* back to the SPA host."
    );
  }

  const normalizedOrigin = new URL(normalizedConfiguredBaseUrl).origin;
  const normalizedUrl = new URL(normalizedOrigin);

  if (isLoopbackApiHost(normalizedUrl.hostname)) {
    throw new ApiBaseUrlConfigurationError(
      "VITE_API_URL must not point to a loopback or local preview origin in production. Use the deployed API origin instead of localhost/127.0.0.1/::1."
    );
  }

  return normalizedOrigin;
}

export const apiConfig = {
  /**
   * Base URL for API requests (without /api prefix - backend routes are at /v1/*)
   * Can be overridden via VITE_API_URL environment variable.
   * Production builds require an absolute API base URL; missing or relative
   * values fail fast so `/v1/*` and `/sanctum/*` never fall back to the SPA
   * origin by accident.
   *
   * Examples:
   * - Development with DDEV: (empty string, Vite proxy handles routing)
   * - Development without proxy: http://localhost:8000
   * - Demo/Testing: https://api.secpal.dev
   * - Production: deployment-specific absolute API origin provided during deployment
   * - Customer On-Premise: customer-specific absolute API origin provided during deployment
   * - Polyscope preview: `{workspace}.preview.secpal.dev` resolves to
   *   `https://api-{workspace}.preview.secpal.dev` when the bundle’s base URL is
   *   empty, relative, loopback, or the SPA host (so leaked CI `localhost:4173`
   *   never overrides the workspace API).
   *
   * Note: The backend uses apiPrefix: '' in Laravel's bootstrap/app.php,
   * so routes are accessible at /v1/* NOT /api/v1/*
   *
   * Local Development:
   * When VITE_API_URL is not set, we use empty string for same-origin requests.
   * Vite's proxy (see vite.config.ts) forwards /v1/* and /sanctum/* to DDEV.
   */
  get baseUrl(): string {
    return resolveApiBaseUrl();
  },

  /**
   * API timeout in milliseconds
   */
  timeout: 10000,

  /**
   * Retry configuration for failed requests
   */
  retry: {
    maxAttempts: 5,
    backoffMultiplier: 2, // 1s, 2s, 4s, 8s, 16s
    maxRetentionTimeMinutes: 60 * 24, // 24 hours
  },
};

/**
 * Application Configuration
 */
export const appConfig = {
  /**
   * Application name
   */
  name: "SecPal",

  /**
   * Default locale
   */
  defaultLocale: "en",

  /**
   * Available locales
   */
  availableLocales: ["en", "de"],
};

/**
 * Get API base URL
 * Convenience function for accessing the configured API base URL
 */
export function getApiBaseUrl(): string {
  return apiConfig.baseUrl;
}

export function buildApiUrl(
  path: string,
  options?: {
    configuredBaseUrl?: string;
    mode?: string;
    runtimeHostname?: string | null;
  }
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = resolveApiBaseUrl(options);

  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}
