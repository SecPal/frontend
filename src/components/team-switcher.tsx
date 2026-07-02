// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import * as React from "react";
import { t } from "@lingui/core/macro";
import { ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/ui/sidebar";

type WorkspaceLogoProps = {
  className?: string;
  size?: "16" | "32" | "48" | "64";
};

type Workspace = {
  name: string;
  logo: React.ComponentType<WorkspaceLogoProps>;
  plan: string;
};

export function TeamSwitcher({ workspaces }: { workspaces: Workspace[] }) {
  const { isMobile } = useSidebar();
  const [activeWorkspaceName, setActiveWorkspaceName] = React.useState(
    workspaces[0]?.name ?? null
  );
  const activeWorkspace =
    workspaces.find((workspace) => workspace.name === activeWorkspaceName) ??
    workspaces[0] ??
    null;

  if (!activeWorkspace) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu modal={!isMobile}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="hover:!bg-transparent hover:!text-inherit data-[state=open]:!bg-transparent data-[state=open]:!text-inherit active:!bg-transparent active:!text-inherit"
            >
              <div className="flex aspect-square size-8 items-center justify-center">
                <activeWorkspace.logo size="32" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {activeWorkspace.name}
                </span>
                <span className="truncate text-xs">{activeWorkspace.plan}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t`Workspace`}
            </DropdownMenuLabel>
            {workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.name}
                onClick={() => setActiveWorkspaceName(workspace.name)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <workspace.logo size="16" className="shrink-0" />
                </div>
                {workspace.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
