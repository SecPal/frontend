// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/react/macro";
import { Code2, FileText, Scale, Shield } from "lucide-react";
import { useLocation } from "react-router-dom";
import { PrefetchLink } from "@/components/PrefetchLink";
import { Button } from "@/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

export function LoginLegalMenu() {
  const location = useLocation();
  const sourceReturnTo = `${location.pathname}${location.search}${location.hash}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-auto justify-start gap-2 px-3 text-base font-normal whitespace-nowrap md:text-sm"
        >
          <Scale
            className="h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Trans>Legal</Trans>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-fit min-w-fit">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <Trans>Legal pages</Trans>
          </DropdownMenuLabel>
          <DropdownMenuItem disabled>
            <FileText />
            <Trans>Imprint</Trans>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Shield />
            <Trans>Privacy</Trans>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <Trans>Open Source</Trans>
          </DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <a
              href="https://www.gnu.org/licenses/agpl-3.0.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Scale />
              <Trans>AGPL v3+</Trans>
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <PrefetchLink to="/source" state={{ sourceReturnTo }}>
              <Code2 />
              <Trans>Source Code</Trans>
            </PrefetchLink>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LoginTopControls({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="absolute top-[calc(1rem+var(--app-safe-area-inset-top))] inset-x-4 flex items-start justify-between gap-2 sm:top-[calc(1.5rem+var(--app-safe-area-inset-top))] sm:inset-x-6">
      {children}
    </div>
  );
}

export function LoginTopControlsSkeleton() {
  return (
    <LoginTopControls>
      <div
        aria-hidden="true"
        className="border-input bg-muted flex h-10 min-w-[8rem] items-center gap-2 rounded-md border px-3"
      >
        <span className="bg-border h-3 flex-1 rounded-full" />
        <span className="bg-border h-3 w-3 rounded-full" />
      </div>
      <div
        aria-hidden="true"
        className="border-input bg-muted flex h-10 min-w-[7rem] items-center gap-2 rounded-md border px-3"
      >
        <span className="bg-border h-3 flex-1 rounded-full" />
        <span className="bg-border h-3 w-3 rounded-full" />
      </div>
    </LoginTopControls>
  );
}
