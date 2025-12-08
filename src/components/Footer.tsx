// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-FileCopyrightText: Tailwind Labs Inc.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/macro";
import { ScaleIcon, CodeBracketIcon } from "@heroicons/react/24/outline";
import { Text, Strong } from "./text";
import { Link } from "./link";

export function Footer() {
  return (
    <footer className="py-4">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <Text className="mb-2 text-xs">
          <Strong>
            <Trans>Powered by SecPal - a guard's best friend</Trans>
          </Strong>
        </Text>
        <div className="flex items-center justify-center gap-3 text-xs">
          <Link
            href="https://www.gnu.org/licenses/agpl-3.0.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
          >
            <ScaleIcon className="h-4 w-4" aria-hidden="true" />
            <Trans>AGPL v3+</Trans>
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600" aria-hidden="true">
            |
          </span>
          <Link
            href="https://github.com/SecPal"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
          >
            <CodeBracketIcon className="h-4 w-4" aria-hidden="true" />
            <Trans>Source Code</Trans>
          </Link>
        </div>
      </div>
    </footer>
  );
}
