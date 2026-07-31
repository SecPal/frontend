// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { useState, type MouseEvent } from "react";
import { useLocation } from "react-router";
import { ChevronRight, Code2, FileText, Scale, Shield } from "lucide-react";
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
  SidebarGroup,
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
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu modal>
              <DropdownMenuTrigger render={<SidebarMenuButton />}>
                <Scale />
                <span>
                  <Trans>Legal</Trans>
                </span>
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
                  <DropdownMenuItem
                    render={
                      <PrefetchLink
                        to="/source"
                        state={{ sourceReturnTo }}
                        onClick={handleItemClick}
                      />
                    }
                  >
                    <Code2 />
                    <span>
                      <Trans>Source Code</Trans>
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <SidebarMenu>
        <Collapsible
          render={<SidebarMenuItem />}
          open={effectiveIsLegalOpen}
          onOpenChange={setIsLegalOpen}
          className="group/collapsible"
        >
          <CollapsibleTrigger render={<SidebarMenuButton />}>
            <Scale />
            <span>
              <Trans>Legal</Trans>
            </span>
            <ChevronRight className="ml-auto transition-transform group-data-open/collapsible:rotate-90" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              <SidebarMenuSubItem>
                <SidebarGroupLabel render={<span />}>
                  <Trans>Legal pages</Trans>
                </SidebarGroupLabel>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  render={<span aria-disabled="true" />}
                  className="pointer-events-none"
                >
                  <FileText />
                  <span>
                    <Trans>Imprint</Trans>
                  </span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  render={<span aria-disabled="true" />}
                  className="pointer-events-none"
                >
                  <Shield />
                  <span>
                    <Trans>Privacy</Trans>
                  </span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem className="mt-1 border-t border-sidebar-border pt-2">
                <SidebarGroupLabel render={<span />}>
                  <Trans>Open Source</Trans>
                </SidebarGroupLabel>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  render={
                    <PrefetchLink
                      to="/source"
                      state={{ sourceReturnTo }}
                      onClick={handleItemClick}
                    />
                  }
                  isActive={isSourceRoute}
                >
                  <Code2 />
                  <span>
                    <Trans>Source Code</Trans>
                  </span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </CollapsibleContent>
        </Collapsible>
      </SidebarMenu>
    </SidebarGroup>
  );
}
