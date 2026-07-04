// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { Trans } from "@lingui/react/macro";
import { APP_SHELL_MAX_WIDTH_CLASS } from "./app-shell-width";

export function Footer() {
  return (
    <footer
      data-slot="app-footer"
      className="bg-background text-muted-foreground pt-3 pb-[var(--app-footer-padding-bottom)] text-xs"
    >
      <div className={`${APP_SHELL_MAX_WIDTH_CLASS} px-6 text-center`}>
        <a
          href="https://secpal.app"
          target="_blank"
          rel="noopener"
          className="text-foreground hover:text-foreground/80 inline-block text-xs font-semibold"
        >
          <Trans>Powered by SecPal – A guard's best friend</Trans>
        </a>
      </div>
    </footer>
  );
}
