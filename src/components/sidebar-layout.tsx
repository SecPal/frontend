// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { t } from "@lingui/core/macro";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { NavbarItem } from "./navbar";
import { SidebarCloseProvider } from "./sidebar";
import { Footer } from "./Footer";

function MobileSidebar({
  open,
  close,
  children,
}: React.PropsWithChildren<{ open: boolean; close: () => void }>) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          close();
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="app-mobile-sidebar-overlay"
          className="fixed inset-0 z-40 bg-zinc-950/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 dark:bg-zinc-950/70 lg:hidden"
        />
        <DialogPrimitive.Content
          data-slot="app-mobile-sidebar-content"
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-full max-w-80 p-2 lg:hidden",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:animate-in data-[state=open]:slide-in-from-left",
            "focus:outline-none"
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            {t({
              id: "layout.mobileNavigation.title",
              message: "Navigation",
            })}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {t({
              id: "layout.mobileNavigation.description",
              message: "Main application navigation",
            })}
          </DialogPrimitive.Description>
          <div className="flex h-full flex-col rounded-md bg-white shadow-lg ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
            <div className="-mb-3 px-4 pt-3">
              <DialogPrimitive.Close asChild>
                <NavbarItem
                  aria-label={t({
                    id: "layout.mobileNavigation.close",
                    message: "Close navigation",
                  })}
                >
                  <X data-slot="icon" aria-hidden="true" />
                </NavbarItem>
              </DialogPrimitive.Close>
            </div>
            <SidebarCloseProvider close={close}>
              {children}
            </SidebarCloseProvider>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

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
    <div
      data-slot="app-sidebar-layout"
      className="relative isolate flex min-h-dvh w-full bg-white max-lg:flex-col lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950"
    >
      <div className="fixed inset-y-0 left-0 w-64 max-lg:hidden">{sidebar}</div>

      <MobileSidebar open={showSidebar} close={() => setShowSidebar(false)}>
        {sidebar}
      </MobileSidebar>

      <header className="flex items-center px-4 lg:hidden">
        <div className="py-2.5">
          <NavbarItem
            onClick={() => setShowSidebar(true)}
            aria-label="Open navigation"
          >
            <Menu data-slot="icon" aria-hidden="true" />
          </NavbarItem>
        </div>
        <div className="min-w-0 flex-1">{navbar}</div>
      </header>

      <main className="flex flex-1 flex-col lg:min-w-0 lg:pl-64">
        <div className="flex flex-1 flex-col bg-white dark:bg-zinc-900">
          <div className="grow p-6 lg:p-10">
            <div className="mx-auto max-w-6xl">{children}</div>
          </div>

          <div className="flex-1" />

          <Footer />
        </div>
      </main>
    </div>
  );
}
