// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __SECPAL_RESOLVED_APP_SURFACE__: import("./platform/appSurfaceContract").AppSurface;

interface ImportMetaEnv {
  readonly VITEST?: boolean;
  readonly VITE_API_URL?: string;
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface SecPalRuntimeConfig {
  readonly apiBaseUrl: string | null;
}

interface Window {
  __SECPAL_RUNTIME_CONFIG__?: Readonly<SecPalRuntimeConfig>;
}
