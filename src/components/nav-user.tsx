// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/react/macro";
import {
  CircleUserRound,
  LockKeyhole,
  LogOut,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { PrefetchLink } from "@/components/PrefetchLink";
import { getInitials } from "@/lib/stringUtils";
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar";
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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/ui/sidebar";

type SidebarUser = {
  name: string;
  email: string;
  avatar?: string;
};

export function NavUser({
  user,
  onLock,
  onLogout,
}: {
  user: SidebarUser;
  onLock?: () => void;
  onLogout: () => void;
}) {
  const { isMobile } = useSidebar();
  const initials = user.name.trim() ? getInitials(user.name) : "U";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              aria-label="User menu"
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                {user.avatar ? (
                  <AvatarImage src={user.avatar} alt={user.name} />
                ) : null}
                <AvatarFallback className="rounded-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {user.avatar ? (
                    <AvatarImage src={user.avatar} alt={user.name} />
                  ) : null}
                  <AvatarFallback className="rounded-lg">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <PrefetchLink to="/profile">
                  <CircleUserRound />
                  <Trans>My profile</Trans>
                </PrefetchLink>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <PrefetchLink to="/settings">
                  <Settings />
                  <Trans>Settings</Trans>
                </PrefetchLink>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <PrefetchLink to="/source">
                  <ShieldCheck />
                  <Trans>Source Code</Trans>
                </PrefetchLink>
              </DropdownMenuItem>
              {onLock ? (
                <DropdownMenuItem onClick={onLock}>
                  <LockKeyhole />
                  <Trans>Lock app</Trans>
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout}>
              <LogOut />
              <Trans>Sign out</Trans>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
