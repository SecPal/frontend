// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Suspense, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Trans } from "@lingui/react/macro";
import {
  Building2,
  CircleUserRound,
  Home,
  LockKeyhole,
  LogOut,
  Settings,
  ShieldCheck,
  Smartphone,
  UserRoundCheck,
  Users,
} from "lucide-react";
import {
  Avatar,
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  Navbar,
  NavbarItem,
  NavbarSection,
  NavbarSpacer,
  Sidebar,
  SidebarBody,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from "@/ui";
import { useAuth } from "../hooks/useAuth";
import { usePrefetch } from "../hooks/usePrefetch";
import { useUserCapabilities } from "../hooks/useUserCapabilities";
import { getAuthTransport } from "../services/authTransport";
import { getInitials } from "../lib/stringUtils";
import { StackedLayout } from "./stacked-layout";
import { Logo } from "./Logo";
import { RouteContentFallback } from "./RouteContentFallback";

/**
 * Shared user menu items for both navbar and sidebar dropdowns.
 * Extracted to maintain DRY principles and ensure consistency.
 */
function UserMenuItems({
  onLock,
  onLogout,
}: {
  onLock?: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      <DropdownItem href="/profile">
        <CircleUserRound data-slot="icon" aria-hidden="true" />
        <DropdownLabel>
          <Trans>My profile</Trans>
        </DropdownLabel>
      </DropdownItem>
      <DropdownItem href="/settings">
        <Settings data-slot="icon" aria-hidden="true" />
        <DropdownLabel>
          <Trans>Settings</Trans>
        </DropdownLabel>
      </DropdownItem>
      {onLock ? (
        <DropdownItem onClick={onLock}>
          <LockKeyhole data-slot="icon" aria-hidden="true" />
          <DropdownLabel>
            <Trans>Lock app</Trans>
          </DropdownLabel>
        </DropdownItem>
      ) : null}
      <DropdownDivider />
      <DropdownItem onClick={onLogout}>
        <LogOut data-slot="icon" aria-hidden="true" />
        <DropdownLabel>
          <Trans>Sign out</Trans>
        </DropdownLabel>
      </DropdownItem>
    </>
  );
}

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

  const isCurrentPath = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <StackedLayout
      navbar={
        <Navbar>
          <NavbarSection className="max-lg:hidden">
            <NavbarItem href="/">
              <Logo size="32" />
            </NavbarItem>
            <NavbarItem
              href="/"
              current={isCurrentPath("/") && location.pathname === "/"}
            >
              <Trans>Home</Trans>
            </NavbarItem>
            {capabilities.organization && (
              <NavbarItem
                href="/organization"
                current={isCurrentPath("/organization")}
              >
                <Trans>Organization</Trans>
              </NavbarItem>
            )}
            {capabilities.customers && (
              <NavbarItem
                href="/customers"
                current={isCurrentPath("/customers")}
              >
                <Trans>Customers</Trans>
              </NavbarItem>
            )}
            {capabilities.employees && (
              <NavbarItem
                href="/employees"
                current={isCurrentPath("/employees")}
              >
                <Trans>Employees</Trans>
              </NavbarItem>
            )}
            {capabilities.activityLogs && (
              <NavbarItem
                href="/activity-logs"
                current={isCurrentPath("/activity-logs")}
              >
                <Trans>Activity Logs</Trans>
              </NavbarItem>
            )}
            {capabilities.androidProvisioning && (
              <NavbarItem
                href="/android-provisioning"
                current={isCurrentPath("/android-provisioning")}
              >
                <Trans>Android Provisioning</Trans>
              </NavbarItem>
            )}
          </NavbarSection>
          <NavbarSpacer />
          <NavbarSection>
            <Dropdown>
              <DropdownButton as={NavbarItem} aria-label="User menu">
                <Avatar
                  initials={user?.name?.trim() ? getInitials(user.name) : "U"}
                  className="size-8 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                />
              </DropdownButton>
              <DropdownMenu className="min-w-64" anchor="bottom end">
                <UserMenuItems onLock={lock} onLogout={handleLogout} />
              </DropdownMenu>
            </Dropdown>
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <SidebarItem href="/">
              <Logo size="48" />
              <SidebarLabel className="text-lg font-semibold">
                SecPal
              </SidebarLabel>
            </SidebarItem>
          </SidebarHeader>

          <SidebarBody>
            <SidebarSection>
              <SidebarItem
                href="/"
                current={isCurrentPath("/") && location.pathname === "/"}
              >
                <Home data-slot="icon" aria-hidden="true" />
                <SidebarLabel>
                  <Trans>Home</Trans>
                </SidebarLabel>
              </SidebarItem>
              {capabilities.organization && (
                <SidebarItem
                  href="/organization"
                  current={isCurrentPath("/organization")}
                >
                  <Building2 data-slot="icon" aria-hidden="true" />
                  <SidebarLabel>
                    <Trans>Organization</Trans>
                  </SidebarLabel>
                </SidebarItem>
              )}
              {capabilities.customers && (
                <SidebarItem
                  href="/customers"
                  current={isCurrentPath("/customers")}
                >
                  <Users data-slot="icon" aria-hidden="true" />
                  <SidebarLabel>
                    <Trans>Customers</Trans>
                  </SidebarLabel>
                </SidebarItem>
              )}
              {capabilities.employees && (
                <SidebarItem
                  href="/employees"
                  current={isCurrentPath("/employees")}
                >
                  <UserRoundCheck data-slot="icon" aria-hidden="true" />
                  <SidebarLabel>
                    <Trans>Employees</Trans>
                  </SidebarLabel>
                </SidebarItem>
              )}
              {capabilities.activityLogs && (
                <SidebarItem
                  href="/activity-logs"
                  current={isCurrentPath("/activity-logs")}
                >
                  <ShieldCheck data-slot="icon" aria-hidden="true" />
                  <SidebarLabel>
                    <Trans>Activity Logs</Trans>
                  </SidebarLabel>
                </SidebarItem>
              )}
              {capabilities.androidProvisioning && (
                <SidebarItem
                  href="/android-provisioning"
                  current={isCurrentPath("/android-provisioning")}
                >
                  <Smartphone data-slot="icon" aria-hidden="true" />
                  <SidebarLabel>
                    <Trans>Android Provisioning</Trans>
                  </SidebarLabel>
                </SidebarItem>
              )}
            </SidebarSection>

            <SidebarSpacer />

            <SidebarSection>
              <SidebarItem
                href="/settings"
                current={isCurrentPath("/settings")}
              >
                <Settings data-slot="icon" aria-hidden="true" />
                <SidebarLabel>
                  <Trans>Settings</Trans>
                </SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarBody>
        </Sidebar>
      }
    >
      <Suspense fallback={<RouteContentFallback />}>{children}</Suspense>
    </StackedLayout>
  );
}
