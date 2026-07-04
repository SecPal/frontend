// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useState, type MouseEvent } from "react";
import { CircleUserRound, LockKeyhole, LogOut, Settings } from "lucide-react";
import { flushSync } from "react-dom";
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
  const { isMobile, setOpenMobile } = useSidebar();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPortalContainer, setMenuPortalContainer] =
    useState<HTMLDivElement | null>(null);
  const initials = user.name.trim() ? getInitials(user.name) : "U";

  function closeMobileNavigationOverlays() {
    flushSync(() => {
      setIsMenuOpen(false);

      if (isMobile) {
        setOpenMobile(false);
      }
    });
  }

  function handleMenuLinkClick(event: MouseEvent<HTMLAnchorElement>) {
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

    closeMobileNavigationOverlays();
  }

  function handleMenuAction(action?: () => void) {
    closeMobileNavigationOverlays();
    action?.();
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div ref={setMenuPortalContainer}>
          <DropdownMenu
            modal={!isMobile}
            open={isMenuOpen}
            onOpenChange={setIsMenuOpen}
          >
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                aria-label={t`User menu`}
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
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-fit min-w-56 max-w-[min(20rem,var(--radix-dropdown-menu-content-available-width))] rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
              portalContainer={isMobile ? menuPortalContainer : undefined}
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
                  <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <PrefetchLink to="/profile" onClick={handleMenuLinkClick}>
                    <CircleUserRound />
                    <Trans>My profile</Trans>
                  </PrefetchLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <PrefetchLink to="/settings" onClick={handleMenuLinkClick}>
                    <Settings />
                    <Trans>Settings</Trans>
                  </PrefetchLink>
                </DropdownMenuItem>
                {onLock ? (
                  <DropdownMenuItem onClick={() => handleMenuAction(onLock)}>
                    <LockKeyhole />
                    <Trans>Lock app</Trans>
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleMenuAction(onLogout)}>
                <LogOut />
                <Trans>Sign out</Trans>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
