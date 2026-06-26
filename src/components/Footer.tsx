// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/react/macro";
import { LegalFooterLinks } from "./LegalFooterLinks";

export function Footer() {
  return (
    <footer
      data-slot="app-footer"
      className="bg-white pt-4 pb-[var(--app-footer-padding-bottom)] text-[11px] dark:bg-zinc-900"
    >
      <div className="mx-auto max-w-6xl px-6 text-center">
        <div className="mb-2">
          <a
            href="https://secpal.app"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
          >
            <Trans>Powered by SecPal – A guard's best friend</Trans>
          </a>
        </div>
        <LegalFooterLinks className="flex items-center justify-center gap-3 text-zinc-500 dark:text-zinc-400" />
      </div>
    </footer>
  );
}
