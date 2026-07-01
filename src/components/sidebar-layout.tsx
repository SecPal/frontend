// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { Menu } from "lucide-react";
import React, { useState } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/ui/sidebar";
import { Footer } from "./Footer";
import { MobileSidebarDialog } from "./mobile-sidebar-dialog";

export function SidebarLayout({
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
      data-layout="sidebar"
      className="bg-background relative isolate flex min-h-[var(--app-shell-min-height)] w-full max-lg:flex-col"
    >
      <div className="fixed inset-y-0 left-0 w-64 max-lg:hidden">{sidebar}</div>

      <MobileSidebarDialog
        open={showSidebar}
        close={() => setShowSidebar(false)}
      >
        {sidebar}
      </MobileSidebarDialog>

      <header className="flex items-center px-4 pt-[var(--app-safe-area-inset-top)] lg:hidden">
        <div className="py-2.5">
          <SidebarTrigger
            onClick={() => setShowSidebar(true)}
            aria-label="Open navigation"
          >
            <Menu data-slot="icon" aria-hidden="true" />
          </SidebarTrigger>
        </div>
        <div className="min-w-0 flex-1">{navbar}</div>
      </header>

      <SidebarInset className="flex flex-1 flex-col lg:min-w-0 lg:pl-64">
        <div className="bg-background flex flex-1 flex-col">
          <div className="grow p-6 lg:p-10">
            <div className="mx-auto max-w-6xl">{children}</div>
          </div>

          <div className="flex-1" />

          <Footer />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
