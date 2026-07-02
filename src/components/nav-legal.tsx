// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, type MouseEvent } from "react";
import { useLocation } from "react-router-dom";
import { ChevronRight, Code2, FileText, Scale, Shield } from "lucide-react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { PrefetchLink } from "@/components/PrefetchLink";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import {
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/ui/collapsible";

export function NavLegal() {
  const location = useLocation();
  const { isMobile, setOpenMobile, state } = useSidebar();
  const sourceReturnTo = `${location.pathname}${location.search}${location.hash}`;
  const isSourceRoute = location.pathname.startsWith("/source");
  const [isLegalOpen, setIsLegalOpen] = useState(isSourceRoute);
  const effectiveIsLegalOpen = isLegalOpen || isSourceRoute;
  const isDesktopCollapsed = !isMobile && state === "collapsed";

  function handleItemClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      !isMobile ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    setOpenMobile(false);
  }

  if (isDesktopCollapsed) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu modal>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton tooltip={t`Legal`}>
                <Scale />
                <span>
                  <Trans>Legal</Trans>
                </span>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-fit min-w-fit rounded-lg"
              side="right"
              align="end"
              sideOffset={4}
            >
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
                    onClick={handleItemClick}
                  >
                    <Scale />
                    <span>
                      <Trans>AGPL v3+</Trans>
                    </span>
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <PrefetchLink
                    to="/source"
                    state={{ sourceReturnTo }}
                    onClick={handleItemClick}
                  >
                    <Code2 />
                    <span>
                      <Trans>Source Code</Trans>
                    </span>
                  </PrefetchLink>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <Collapsible
        asChild
        open={effectiveIsLegalOpen}
        onOpenChange={setIsLegalOpen}
        className="group/collapsible"
      >
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={t`Legal`}>
              <Scale />
              <span>
                <Trans>Legal</Trans>
              </span>
              <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              <SidebarMenuSubItem>
                <SidebarGroupLabel asChild>
                  <span>
                    <Trans>Legal pages</Trans>
                  </span>
                </SidebarGroupLabel>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild className="pointer-events-none">
                  <span aria-disabled="true">
                    <FileText />
                    <span>
                      <Trans>Imprint</Trans>
                    </span>
                  </span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild className="pointer-events-none">
                  <span aria-disabled="true">
                    <Shield />
                    <span>
                      <Trans>Privacy</Trans>
                    </span>
                  </span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem className="mt-1 border-t border-sidebar-border pt-2">
                <SidebarGroupLabel asChild>
                  <span>
                    <Trans>Open Source</Trans>
                  </span>
                </SidebarGroupLabel>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild>
                  <a
                    href="https://www.gnu.org/licenses/agpl-3.0.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleItemClick}
                  >
                    <Scale />
                    <span>
                      <Trans>AGPL v3+</Trans>
                    </span>
                  </a>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild isActive={isSourceRoute}>
                  <PrefetchLink
                    to="/source"
                    state={{ sourceReturnTo }}
                    onClick={handleItemClick}
                  >
                    <Code2 />
                    <span>
                      <Trans>Source Code</Trans>
                    </span>
                  </PrefetchLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    </SidebarMenu>
  );
}
