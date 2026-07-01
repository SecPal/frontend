// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

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

export type ShortcutItem = {
  name: string;
  url: string;
  icon: LucideIcon;
  isActive?: boolean;
};

export function NavProjects({ shortcuts }: { shortcuts: ShortcutItem[] }) {
  if (shortcuts.length === 0) {
    return null;
  }

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>
        <Trans>Quick access</Trans>
      </SidebarGroupLabel>
      <SidebarMenu>
        {shortcuts.map((shortcut) => (
          <SidebarMenuItem key={shortcut.name}>
            <SidebarMenuButton asChild isActive={shortcut.isActive}>
              <PrefetchLink to={shortcut.url}>
                <shortcut.icon />
                <span>{shortcut.name}</span>
              </PrefetchLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
