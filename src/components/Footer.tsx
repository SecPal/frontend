// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/react/macro";
import { Code2, Scale } from "lucide-react";

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
        <div className="flex items-center justify-center gap-3">
          <a
            href="https://www.gnu.org/licenses/agpl-3.0.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
          >
            <Scale className="h-4 w-4" aria-hidden="true" />
            <Trans>AGPL v3+</Trans>
          </a>
          <span className="text-zinc-300 dark:text-zinc-600" aria-hidden="true">
            |
          </span>
          <a
            href="https://github.com/SecPal"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
          >
            <Code2 className="h-4 w-4" aria-hidden="true" />
            <Trans>Source Code</Trans>
          </a>
        </div>
      </div>
    </footer>
  );
}
