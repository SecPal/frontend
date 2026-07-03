// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { t } from "@lingui/core/macro";
import { NavMain, type NavMainItem } from "@/components/nav-main";
import { NavLegal } from "@/components/nav-legal";
import { NavUser } from "@/components/nav-user";
import { TeamSwitcher } from "@/components/team-switcher";
import { Logo } from "@/components/Logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/ui/sidebar";

type SidebarUser = {
  name: string;
  email: string;
  avatar?: string;
};

export function AppSidebar({
  navMain,
  user,
  onLock,
  onLogout,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  navMain: NavMainItem[];
  user: SidebarUser;
  onLock?: () => void;
  onLogout: () => void;
}) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher
          workspaces={[
            {
              name: "SecPal",
              logo: Logo,
              plan: t`Workspace`,
            },
          ]}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavLegal />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} onLock={onLock} onLogout={onLogout} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
