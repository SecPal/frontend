// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { Menu } from "lucide-react";
import React, { useState } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/ui/sidebar";
import { Footer } from "./Footer";
import { MobileSidebarDialog } from "./mobile-sidebar-dialog";
import { APP_SHELL_MAX_WIDTH_CLASS } from "./app-shell-width";

export function StackedLayout({
  navbar,
  sidebar,
  children,
}: React.PropsWithChildren<{
  navbar: React.ReactNode;
  sidebar: React.ReactNode;
}>) {
  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <SidebarProvider
      open={showSidebar}
      onOpenChange={setShowSidebar}
      data-layout="stacked"
      className="bg-background relative isolate flex min-h-[var(--app-shell-min-height)] w-full flex-col"
    >
      <MobileSidebarDialog
        open={showSidebar}
        close={() => setShowSidebar(false)}
      >
        {sidebar}
      </MobileSidebarDialog>

      <header className="flex items-center px-4 pt-[var(--app-safe-area-inset-top)]">
        <div className="py-2.5 lg:hidden">
          <SidebarTrigger
            onClick={() => setShowSidebar(true)}
            aria-label="Open navigation"
          >
            <Menu data-slot="icon" aria-hidden="true" />
          </SidebarTrigger>
        </div>
        <div className="min-w-0 flex-1">{navbar}</div>
      </header>

      <SidebarInset className="flex flex-1 flex-col">
        <div className="bg-background flex flex-1 flex-col">
          <div className="grow p-6 lg:p-10">
            <div className={APP_SHELL_MAX_WIDTH_CLASS}>{children}</div>
          </div>

          <div className="flex-1" />

          <Footer />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
