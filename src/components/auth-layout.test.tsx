// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthLayout } from "./auth-layout";

describe("AuthLayout", () => {
  it("keeps the shared auth shell on canonical theme tokens", () => {
    const { container } = render(
      <AuthLayout>
        <section aria-label="Login card">Content</section>
      </AuthLayout>
    );

    const shell = container.querySelector("main");
    const card = shell?.firstElementChild;

    expect(shell).toHaveClass(
      "bg-background",
      "text-foreground",
      "pt-[calc(1.5rem+var(--app-safe-area-inset-top))]"
    );
    expect(card).toHaveClass(
      "border-border",
      "bg-card",
      "text-card-foreground"
    );
    expect(screen.getByText("Content")).toBeInTheDocument();

    expect(shell?.className).not.toContain("bg-white");
    expect(shell?.className).not.toContain("text-zinc-950");
    expect(card?.className).not.toContain("border-zinc-200");
    expect(card?.className).not.toContain("dark:bg-zinc-900");
  });
});
