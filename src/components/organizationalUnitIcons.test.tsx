// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import {
  OrganizationalUnitRootIcon,
  OrganizationalUnitTypeIcon,
} from "./organizationalUnitIcons";

describe("organizationalUnitIcons", () => {
  it("keeps unit type icons on canonical foreground or muted tokens", () => {
    const { container, rerender } = render(
      <OrganizationalUnitTypeIcon type="company" />
    );
    const firstIcon = container.querySelector('[data-slot="icon"]');

    expect(firstIcon).toHaveClass("text-foreground");
    expect(firstIcon?.className).not.toContain("text-blue-500");

    rerender(<OrganizationalUnitTypeIcon type="branch" />);
    const secondIcon = container.querySelector('[data-slot="icon"]');
    expect(secondIcon).toHaveClass("text-muted-foreground");
    expect(secondIcon?.className).not.toContain("text-purple-500");
  });

  it("keeps the root icon on canonical muted tokens", () => {
    const { container } = render(<OrganizationalUnitRootIcon />);
    const icon = container.querySelector('[data-slot="icon"]');

    expect(icon).toHaveClass("text-muted-foreground");
    expect(icon?.className).not.toContain("text-gray-400");
  });
});
