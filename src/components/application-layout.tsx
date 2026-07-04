// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { Suspense, useCallback, useEffect, useMemo } from "react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CircleUserRound,
  Home,
  MapPinned,
  Settings,
  Smartphone,
  SquareChartGantt,
  Building2,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/ui/breadcrumb";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/ui/sidebar";
import { useAuth } from "../hooks/useAuth";
import { usePrefetch } from "../hooks/usePrefetch";
import { useUserCapabilities } from "../hooks/useUserCapabilities";
import { getAuthTransport } from "../services/authTransport";
import { Footer } from "./Footer";
import { PrefetchLink } from "./PrefetchLink";
import { RouteContentFallback } from "./RouteContentFallback";
import { APP_SHELL_MAX_WIDTH_CLASS } from "./app-shell-width";

const LOGOUT_TIMEOUT_MS = 8000;

async function logoutWithTimeout(logoutRequest: Promise<void>): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      logoutRequest,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(`Logout request timed out after ${LOGOUT_TIMEOUT_MS}ms.`)
          );
        }, LOGOUT_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

export function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const { lock, user, logout } = useAuth();
  const { i18n } = useLingui();
  const activeLocale = i18n.locale;
  const capabilities = useUserCapabilities();
  const { prefetchPathsOnIdle } = usePrefetch();
  const authTransport = useMemo(() => getAuthTransport(), []);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const primaryDestinations = ["/profile", "/settings"];

    if (capabilities.organization) {
      primaryDestinations.push("/organization");
    }
    if (capabilities.customers) {
      primaryDestinations.push("/customers");
    }
    if (capabilities.sites) {
      primaryDestinations.push("/sites");
    }
    if (capabilities.employees) {
      primaryDestinations.push("/employees");
    }
    if (capabilities.activityLogs) {
      primaryDestinations.push("/activity-logs");
    }
    if (capabilities.androidProvisioning) {
      primaryDestinations.push("/android-provisioning");
    }

    prefetchPathsOnIdle(primaryDestinations);
  }, [
    capabilities.activityLogs,
    capabilities.androidProvisioning,
    capabilities.customers,
    capabilities.employees,
    capabilities.organization,
    capabilities.sites,
    prefetchPathsOnIdle,
  ]);

  const handleLogout = async () => {
    try {
      await logoutWithTimeout(authTransport.logout());
    } catch (error) {
      console.error("Logout API call failed:", error);
    } finally {
      try {
        await Promise.resolve(logout());
      } catch (error) {
        console.error("Local logout cleanup failed:", error);
      }
      navigate("/login");
    }
  };

  const isCurrentPath = useCallback(
    (path: string) => {
      if (path === "/") {
        return location.pathname === "/";
      }

      return location.pathname.startsWith(path);
    },
    [location.pathname]
  );

  const isDefined = <T,>(value: T | null): value is T => value !== null;

  const navMain = useMemo(() => {
    void activeLocale;

    return [
      {
        title: t`Home`,
        url: "/",
        icon: Home,
        isActive: location.pathname === "/",
      },
      capabilities.customers
        ? {
            title: t`Customers`,
            url: "/customers",
            icon: Users,
            isActive: isCurrentPath("/customers"),
          }
        : null,
      capabilities.sites
        ? {
            title: t`Sites`,
            url: "/sites",
            icon: MapPinned,
            isActive: isCurrentPath("/sites"),
          }
        : null,
      capabilities.employees
        ? {
            title: t`Employees`,
            url: "/employees",
            icon: UserRound,
            isActive: isCurrentPath("/employees"),
          }
        : null,
      capabilities.organization
        ? {
            title: t`Organization`,
            url: "/organization",
            icon: Building2,
            isActive: isCurrentPath("/organization"),
          }
        : null,
      capabilities.activityLogs
        ? {
            title: t`Activity Logs`,
            url: "/activity-logs",
            icon: SquareChartGantt,
            isActive: isCurrentPath("/activity-logs"),
          }
        : null,
      capabilities.androidProvisioning
        ? {
            title: t`Android Provisioning`,
            url: "/android-provisioning",
            icon: Smartphone,
            isActive: isCurrentPath("/android-provisioning"),
          }
        : null,
    ].filter(isDefined);
  }, [
    activeLocale,
    capabilities.activityLogs,
    capabilities.androidProvisioning,
    capabilities.customers,
    capabilities.employees,
    capabilities.organization,
    capabilities.sites,
    isCurrentPath,
    location.pathname,
  ]);

  const shortcuts = useMemo(() => {
    void activeLocale;

    return [
      {
        name: t`My profile`,
        url: "/profile",
        icon: CircleUserRound,
        isActive: isCurrentPath("/profile"),
      },
      {
        name: t`Settings`,
        url: "/settings",
        icon: Settings,
        isActive: isCurrentPath("/settings"),
      },
      {
        name: t`Source Code`,
        url: "/source",
        icon: ShieldCheck,
        isActive: isCurrentPath("/source"),
      },
    ];
  }, [activeLocale, isCurrentPath]);

  const currentPageLabel = useMemo(() => {
    void activeLocale;

    const page = navMain.find((item) => item.isActive);
    if (page) {
      return page.title;
    }

    const shortcut = shortcuts.find((item) => item.isActive);
    if (shortcut) {
      return shortcut.name;
    }

    if (location.pathname === "/about") {
      return t`About`;
    }

    return t`Home`;
  }, [activeLocale, location.pathname, navMain, shortcuts]);

  return (
    <SidebarProvider
      className="min-h-[var(--app-shell-min-height)]"
      style={
        {
          "--sidebar-width": "18rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        navMain={navMain}
        user={{
          name: user?.name ?? "User",
          email: user?.email ?? "user@secpal.dev",
        }}
        onLock={lock}
        onLogout={handleLogout}
      />
      <SidebarInset>
        <UpdatePrompt />
        <header className="flex min-h-[calc(4rem+var(--app-safe-area-inset-top))] shrink-0 items-center gap-2 pt-[var(--app-safe-area-inset-top)] transition-[width,min-height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:min-h-[calc(3rem+var(--app-safe-area-inset-top))]">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink asChild>
                    <PrefetchLink to="/">
                      <Trans>SecPal</Trans>
                    </PrefetchLink>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{currentPageLabel}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="bg-background flex flex-1 flex-col">
          <div className="grow p-6 lg:p-10">
            <div className={APP_SHELL_MAX_WIDTH_CLASS}>
              <Suspense fallback={<RouteContentFallback />}>
                {children}
              </Suspense>
            </div>
          </div>
          <Footer />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
