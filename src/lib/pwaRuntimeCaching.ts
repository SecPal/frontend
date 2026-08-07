// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import type { VitePWAOptions } from "vite-plugin-pwa";

type WorkboxRuntimeCachingRule = NonNullable<
  VitePWAOptions["workbox"]["runtimeCaching"]
>[number];

export type PwaRuntimeCachingRule = Omit<
  WorkboxRuntimeCachingRule,
  "urlPattern"
> & {
  urlPattern: RegExp;
};

export function buildPwaRuntimeCaching(): PwaRuntimeCachingRule[] {
  return [
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)(?:\?.*)?$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "images",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern:
        /^(?!.*\/runtime-config\.js(?:\?.*)?$).*\.(?:js|css)(?:\?.*)?$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 365 * 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /\.(?:woff|woff2|ttf|otf|eot)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "fonts",
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 365 * 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts-cache",
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 365 * 24 * 60 * 60,
        },
      },
    },
  ];
}
