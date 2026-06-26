// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/react/macro";
import { Code2, Scale } from "lucide-react";
import { Link } from "react-router-dom";

interface LegalFooterLinksProps {
  className?: string;
}

export function LegalFooterLinks({ className }: LegalFooterLinksProps) {
  return (
    <div className={className}>
      <a
        href="https://www.gnu.org/licenses/agpl-3.0.html"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 hover:text-zinc-950 dark:hover:text-white"
      >
        <Scale className="h-4 w-4" aria-hidden="true" />
        <Trans>AGPL v3+</Trans>
      </a>
      <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">
        |
      </span>
      <Link
        to="/source"
        className="inline-flex items-center gap-1.5 hover:text-zinc-950 dark:hover:text-white"
      >
        <Code2 className="h-4 w-4" aria-hidden="true" />
        <Trans>Source Code</Trans>
      </Link>
    </div>
  );
}
