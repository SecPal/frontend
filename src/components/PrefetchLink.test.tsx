// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PrefetchLink } from "./PrefetchLink";

const { mockPrefetchPath, mockPrefetchPathModuleOnly } = vi.hoisted(() => ({
  mockPrefetchPath: vi.fn(),
  mockPrefetchPathModuleOnly: vi.fn(),
}));

vi.mock("../hooks/usePrefetch", () => ({
  usePrefetch: () => ({
    prefetchPath: mockPrefetchPath,
    prefetchPathModuleOnly: mockPrefetchPathModuleOnly,
  }),
}));

describe("PrefetchLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefetches internal app routes on link intent", () => {
    render(
      <MemoryRouter>
        <PrefetchLink to="/customers/customer-123">View customer</PrefetchLink>
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: /view customer/i });

    fireEvent.mouseEnter(link);
    fireEvent.focus(link);

    expect(mockPrefetchPath).toHaveBeenCalledWith("/customers/customer-123");
    expect(mockPrefetchPath).toHaveBeenCalledTimes(2);
  });

  it("prefetches only the route module (no API) on touch to avoid spurious requests during scroll", () => {
    render(
      <MemoryRouter>
        <PrefetchLink to="/customers/customer-123">View customer</PrefetchLink>
      </MemoryRouter>
    );

    const link = screen.getByRole("link", { name: /view customer/i });

    fireEvent.touchStart(link);

    expect(mockPrefetchPathModuleOnly).toHaveBeenCalledWith(
      "/customers/customer-123"
    );
    expect(mockPrefetchPath).not.toHaveBeenCalled();
  });

  it("ignores non-route links", () => {
    render(
      <MemoryRouter>
        <PrefetchLink to="mailto:guard@secpal.dev">Email</PrefetchLink>
      </MemoryRouter>
    );

    fireEvent.mouseEnter(screen.getByRole("link", { name: /email/i }));

    expect(mockPrefetchPath).not.toHaveBeenCalled();
  });
});
