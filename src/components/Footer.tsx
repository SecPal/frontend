// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/react/macro";
import { LegalFooterLinks } from "./LegalFooterLinks";

export function Footer() {
  return (
    <footer
      data-slot="app-footer"
      className="bg-background text-muted-foreground pt-4 pb-[var(--app-footer-padding-bottom)] text-[11px]"
    >
      <div className="mx-auto max-w-6xl px-6 text-center">
        <div className="mb-2">
          <a
            href="https://secpal.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-foreground/80 font-semibold"
          >
            <Trans>Powered by SecPal – A guard's best friend</Trans>
          </a>
        </div>
        <LegalFooterLinks className="text-muted-foreground flex items-center justify-center gap-3" />
      </div>
    </footer>
  );
}
