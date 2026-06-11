// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { cn as authCn } from "@/pages/Auth/ui";
import { cn as onboardingCn } from "@/pages/Onboarding/ui";
import { cn } from "./utils";

describe("shadcn utility helpers", () => {
  it("merges conditional class values and resolves Tailwind conflicts", () => {
    expect(
      cn(
        "rounded-sm px-2 py-1 text-sm text-zinc-500",
        { hidden: false },
        ["px-4", { "text-blue-600": true, "text-red-600": false }],
        "rounded-md py-3"
      )
    ).toBe("text-sm px-4 text-blue-600 rounded-md py-3");
  });

  it("is shared by the auth and onboarding shadcn UI barrels", () => {
    expect(authCn).toBe(cn);
    expect(onboardingCn).toBe(cn);
    expect(authCn("border border-red-500", "border-blue-500")).toBe(
      "border border-blue-500"
    );
    expect(onboardingCn("bg-white dark:bg-zinc-950", "bg-zinc-50")).toBe(
      "dark:bg-zinc-950 bg-zinc-50"
    );
  });
});
