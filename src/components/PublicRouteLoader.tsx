// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";

export function PublicRouteLoader() {
  const { i18n } = useLingui();

  return (
    <div
      className="flex min-h-dvh items-center justify-center bg-white dark:bg-zinc-950"
      role="status"
      aria-live="polite"
      aria-label={i18n._(msg`Loading page`)}
    >
      <div
        aria-hidden="true"
        className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-950 dark:border-zinc-700 dark:border-t-zinc-50"
      />
    </div>
  );
}
