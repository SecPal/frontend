// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useIsMobile } from "./use-mobile";

function Probe() {
  const isMobile = useIsMobile();

  return <output>{isMobile ? "mobile" : "desktop"}</output>;
}

describe("useIsMobile", () => {
  it("uses a rem-based media query that matches Tailwind's md breakpoint", () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener,
      removeEventListener,
    });

    vi.stubGlobal("matchMedia", matchMedia);

    render(<Probe />);

    expect(matchMedia).toHaveBeenCalledWith("(max-width: 47.999rem)");
    expect(screen.getByText("mobile")).toBeInTheDocument();
    expect(addEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function)
    );
  });
});
