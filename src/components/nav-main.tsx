// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/react/macro";
import { type LucideIcon } from "lucide-react";
import { PrefetchLink } from "@/components/PrefetchLink";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/ui/sidebar";

export type NavMainItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  isActive?: boolean;
};

export function NavMain({ items }: { items: NavMainItem[] }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        <Trans>Navigation</Trans>
      </SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              asChild
              isActive={item.isActive}
              tooltip={item.title}
              aria-current={item.isActive ? "page" : undefined}
            >
              <PrefetchLink to={item.url}>
                <item.icon />
                <span>{item.title}</span>
              </PrefetchLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
