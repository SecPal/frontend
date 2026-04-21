// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import lighthouseDesktopConfig from "lighthouse/core/config/lr-desktop-config.js";
import type { Config } from "lighthouse";

export const LIGHTHOUSE_ONLY_CATEGORIES = [
  "performance",
  "accessibility",
  "best-practices",
] as const;

export const LIGHTHOUSE_SKIP_AUDITS = [
  ...(lighthouseDesktopConfig.settings?.skipAudits ?? []),
  "is-on-https",
  "redirects-http",
  "uses-http2",
];

export const LIGHTHOUSE_AUDIT_CONFIG: Config = {
  ...lighthouseDesktopConfig,
  settings: {
    ...lighthouseDesktopConfig.settings,
    onlyCategories: [...LIGHTHOUSE_ONLY_CATEGORIES],
    skipAudits: [...new Set(LIGHTHOUSE_SKIP_AUDITS)],
    throttling: {
      ...lighthouseDesktopConfig.settings?.throttling,
      cpuSlowdownMultiplier: 1,
    },
  },
};
