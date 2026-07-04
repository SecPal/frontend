// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { DropdownMenu } from "@/ui/dropdown-menu";
import { TeamSwitcher } from "./team-switcher";
import { useSidebar } from "@/ui/sidebar";

let lastDropdownMenuModal: ComponentProps<typeof DropdownMenu>["modal"];

vi.mock("@/ui/dropdown-menu", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ui/dropdown-menu")>();

  return {
    ...actual,
    DropdownMenu: (props: ComponentProps<typeof actual.DropdownMenu>) => {
      lastDropdownMenuModal = props.modal;
      return <actual.DropdownMenu {...props} />;
    },
  };
});

vi.mock("@/ui/sidebar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ui/sidebar")>();

  return {
    ...actual,
    SidebarMenu: ({ children }: { children: ReactNode }) => <ul>{children}</ul>,
    SidebarMenuButton: ({ children, ...props }: ComponentProps<"button">) => (
      <button {...props}>{children}</button>
    ),
    SidebarMenuItem: ({ children }: { children: ReactNode }) => (
      <li>{children}</li>
    ),
    useSidebar: vi.fn(),
  };
});

const WorkspaceLogo = () => <svg aria-hidden="true" />;

describe("TeamSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastDropdownMenuModal = undefined;
    vi.mocked(useSidebar).mockReturnValue({
      isMobile: false,
      open: true,
      openMobile: false,
      setOpen: vi.fn(),
      setOpenMobile: vi.fn(),
      state: "expanded",
      toggleSidebar: vi.fn(),
    });
  });

  it("disables dropdown modality inside the mobile sidebar", () => {
    vi.mocked(useSidebar).mockReturnValue({
      isMobile: true,
      open: true,
      openMobile: true,
      setOpen: vi.fn(),
      setOpenMobile: vi.fn(),
      state: "expanded",
      toggleSidebar: vi.fn(),
    });

    render(
      <TeamSwitcher
        workspaces={[
          {
            name: "SecPal",
            logo: WorkspaceLogo,
            plan: "Workspace",
          },
        ]}
      />
    );

    expect(lastDropdownMenuModal).toBe(false);
  });
});
