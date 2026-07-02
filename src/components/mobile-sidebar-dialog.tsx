// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { t } from "@lingui/core/macro";
import { X } from "lucide-react";
import type React from "react";
import { Button } from "@/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/ui/sheet";
import { cn } from "@/lib/utils";

export function MobileSidebarDialog({
  open,
  close,
  children,
}: React.PropsWithChildren<{ open: boolean; close: () => void }>) {
  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          close();
        }
      }}
    >
      <SheetContent
        side="left"
        overlayClassName="lg:hidden"
        className={cn(
          "w-full max-w-80 border-r-0 bg-transparent p-2 pt-[calc(0.5rem+var(--app-safe-area-inset-top))] shadow-none lg:hidden",
          "focus:outline-none [&>button]:hidden"
        )}
      >
        <SheetTitle className="sr-only">
          {t({
            id: "layout.mobileNavigation.title",
            message: "Navigation",
          })}
        </SheetTitle>
        <SheetDescription className="sr-only">
          {t({
            id: "layout.mobileNavigation.description",
            message: "Main application navigation",
          })}
        </SheetDescription>
        <div className="bg-background ring-border/50 flex h-full flex-col rounded-md shadow-lg ring-1">
          <div className="-mb-3 px-4 pt-3">
            <SheetClose asChild>
              <Button
                type="button"
                variant="ghost"
                className="size-11 p-2"
                aria-label={t({
                  id: "layout.mobileNavigation.close",
                  message: "Close navigation",
                })}
              >
                <X data-slot="icon" aria-hidden="true" />
              </Button>
            </SheetClose>
          </div>
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
