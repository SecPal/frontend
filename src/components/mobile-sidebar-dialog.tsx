// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { t } from "@lingui/core/macro";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type React from "react";
import { NavbarItem, SidebarCloseProvider } from "@/ui";
import { cn } from "@/lib/utils";

export function MobileSidebarDialog({
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
            "fixed inset-y-0 left-0 z-50 w-full max-w-80 p-2 pt-[calc(0.5rem+var(--app-safe-area-inset-top))] lg:hidden",
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
            <SidebarCloseProvider close={close}>{children}</SidebarCloseProvider>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
