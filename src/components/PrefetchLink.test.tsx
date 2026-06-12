// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PrefetchLink } from "./PrefetchLink";

const { mockPrefetchPath } = vi.hoisted(() => ({
  mockPrefetchPath: vi.fn(),
}));

vi.mock("../hooks/usePrefetch", () => ({
  usePrefetch: () => ({
    prefetchPath: mockPrefetchPath,
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
