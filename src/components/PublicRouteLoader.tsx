// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

export function PublicRouteLoader() {
  const { i18n } = useLingui();

  return (
    <div
      className="flex min-h-[var(--app-shell-min-height)] items-center justify-center bg-background"
      role="status"
      aria-live="polite"
      aria-label={i18n._(msg`Loading page`)}
    >
      <div
        aria-hidden="true"
        className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-foreground"
      />
    </div>
  );
}
