// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useNavigate, useLocation } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { useAuth } from "../hooks/useAuth";
import { logout as apiLogout } from "../services/authApi";
import { getInitials } from "../lib/stringUtils";
import { Avatar } from "./avatar";
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from "./dropdown";
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from "./navbar";
import {
  Sidebar,
  SidebarBody,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from "./sidebar";
import { StackedLayout } from "./stacked-layout";

function HomeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function KeyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M8 7a5 5 0 1 1 3.61 4.804l-1.903 1.903A1 1 0 0 1 9 14H8v1a1 1 0 0 1-1 1H6v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 .293-.707L8.196 8.39A5.002 5.002 0 0 1 8 7Zm5-3a.75.75 0 0 0 0 1.5A1.5 1.5 0 0 1 14.5 7 .75.75 0 0 0 16 7a3 3 0 0 0-3-3Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CogIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ArrowRightStartOnRectangleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z"
        clipRule="evenodd"
      />
      <path
        fillRule="evenodd"
        d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-.943a.75.75 0 1 0-1.004-1.114l-2.5 2.25a.75.75 0 0 0 0 1.114l2.5 2.25a.75.75 0 1 0 1.004-1.114l-1.048-.943h9.546A.75.75 0 0 0 19 10Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function UserCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-5.5-2.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM10 12a5.99 5.99 0 0 0-4.793 2.39A6.483 6.483 0 0 0 10 16.5a6.483 6.483 0 0 0 4.793-2.11A5.99 5.99 0 0 0 10 12Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ShieldCheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M9.661 2.237a.531.531 0 0 1 .678 0 11.947 11.947 0 0 0 7.078 2.749.5.5 0 0 1 .479.425c.069.52.104 1.05.104 1.59 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 0 1-.332 0C5.26 16.564 2 12.163 2 7c0-.538.035-1.069.104-1.589a.5.5 0 0 1 .48-.425 11.947 11.947 0 0 0 7.077-2.75Zm4.196 5.954a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function UserGroupIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.49 15.326a.78.78 0 0 1-.358-.442 3 3 0 0 1 4.308-3.516 6.484 6.484 0 0 0-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 0 1-2.07-.655ZM16.44 15.98a4.97 4.97 0 0 0 2.07-.654.78.78 0 0 0 .357-.442 3 3 0 0 0-4.308-3.517 6.484 6.484 0 0 1 1.907 3.96 2.32 2.32 0 0 1-.026.654ZM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5.304 16.19a.844.844 0 0 1-.277-.71 5 5 0 0 1 9.947 0 .843.843 0 0 1-.277.71A6.975 6.975 0 0 1 10 18a6.974 6.974 0 0 1-4.696-1.81Z" />
    </svg>
  );
}

function BuildingOfficeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path
        fillRule="evenodd"
        d="M4 16.5v-13h-.25a.75.75 0 0 1 0-1.5h12.5a.75.75 0 0 1 0 1.5H16v13h.25a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1 0-1.5H4Zm3-11a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1Zm.5 3.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1Zm-.5 4.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1Zm4.5-8.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1Zm-.5 4.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1Zm.5 3.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function UsersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" fill="currentColor" {...props}>
      <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
    </svg>
  );
}

/**
 * Shared user menu items for both navbar and sidebar dropdowns.
 * Extracted to maintain DRY principles and ensure consistency.
 */
function UserMenuItems({ onLogout }: { onLogout: () => void }) {
  return (
    <>
      <DropdownItem href="/profile">
        <UserCircleIcon />
        <DropdownLabel>
          <Trans>My profile</Trans>
        </DropdownLabel>
      </DropdownItem>
      <DropdownItem href="/settings">
        <CogIcon />
        <DropdownLabel>
          <Trans>Settings</Trans>
        </DropdownLabel>
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem onClick={onLogout}>
        <ArrowRightStartOnRectangleIcon />
        <DropdownLabel>
          <Trans>Sign out</Trans>
        </DropdownLabel>
      </DropdownItem>
    </>
  );
}

export function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, hasOrganizationalAccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if user has access to organizational features
  const hasOrgAccess = hasOrganizationalAccess();

  const handleLogout = async () => {
    // Clear local state FIRST to prevent race conditions
    logout();

    try {
      await apiLogout();
    } catch (error) {
      console.error("Logout API call failed:", error);
    } finally {
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
              <ShieldCheckIcon />
            </NavbarItem>
            <NavbarItem
              href="/"
              current={isCurrentPath("/") && location.pathname === "/"}
            >
              <Trans>Home</Trans>
            </NavbarItem>
            <NavbarItem href="/secrets" current={isCurrentPath("/secrets")}>
              <Trans>Secrets</Trans>
            </NavbarItem>
            {hasOrgAccess && (
              <NavbarItem
                href="/organization"
                current={isCurrentPath("/organization")}
              >
                <Trans>Organization</Trans>
              </NavbarItem>
            )}
            {hasOrgAccess && (
              <NavbarItem
                href="/customers"
                current={isCurrentPath("/customers")}
              >
                <Trans>Customers</Trans>
              </NavbarItem>
            )}
            {hasOrgAccess && (
              <NavbarItem
                href="/guard-books"
                current={isCurrentPath("/guard-books")}
              >
                <Trans>Guard Books</Trans>
              </NavbarItem>
            )}
            {hasOrgAccess && (
              <NavbarItem
                href="/employees"
                current={isCurrentPath("/employees")}
              >
                <Trans>Employees</Trans>
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
                <UserMenuItems onLogout={handleLogout} />
              </DropdownMenu>
            </Dropdown>
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <SidebarItem href="/">
              <ShieldCheckIcon />
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
                <HomeIcon />
                <SidebarLabel>
                  <Trans>Home</Trans>
                </SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/secrets" current={isCurrentPath("/secrets")}>
                <KeyIcon />
                <SidebarLabel>
                  <Trans>Secrets</Trans>
                </SidebarLabel>
              </SidebarItem>
              {hasOrgAccess && (
                <SidebarItem
                  href="/organization"
                  current={isCurrentPath("/organization")}
                >
                  <BuildingOfficeIcon />
                  <SidebarLabel>
                    <Trans>Organization</Trans>
                  </SidebarLabel>
                </SidebarItem>
              )}
              {hasOrgAccess && (
                <SidebarItem
                  href="/customers"
                  current={isCurrentPath("/customers")}
                >
                  <UsersIcon />
                  <SidebarLabel>
                    <Trans>Customers</Trans>
                  </SidebarLabel>
                </SidebarItem>
              )}
              {hasOrgAccess && (
                <SidebarItem
                  href="/employees"
                  current={isCurrentPath("/employees")}
                >
                  <UserGroupIcon />
                  <SidebarLabel>
                    <Trans>Employees</Trans>
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
                <CogIcon />
                <SidebarLabel>
                  <Trans>Settings</Trans>
                </SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarBody>
        </Sidebar>
      }
    >
      {children}
    </StackedLayout>
  );
}
