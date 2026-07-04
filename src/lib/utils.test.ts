// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it } from "vitest";
import { cn as authCn, cn as onboardingCn } from "@/ui";
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

  describe("onboarding cn — tailwind-merge deduplication (regression for clsx-only upgrade)", () => {
    it("keeps last background color when two bg- utilities conflict", () => {
      // Previously (clsx-only) both classes were preserved; now twMerge deduplicates.
      expect(onboardingCn("bg-white", "bg-zinc-50")).toBe("bg-zinc-50");
    });

    it("keeps last text color when two text- utilities conflict", () => {
      expect(onboardingCn("text-zinc-950", "text-zinc-50")).toBe(
        "text-zinc-50"
      );
    });

    it("keeps last border color when two border- utilities conflict", () => {
      expect(onboardingCn("border-zinc-200", "border-zinc-800")).toBe(
        "border-zinc-800"
      );
    });

    it("preserves non-conflicting utilities from both arguments", () => {
      expect(onboardingCn("rounded-md p-4", "text-sm")).toBe(
        "rounded-md p-4 text-sm"
      );
    });

    it("deduplicates padding axis conflicts (px overrides individual p-)", () => {
      expect(onboardingCn("p-4", "px-6")).toBe("p-4 px-6");
    });

    it("handles dark-mode variants independently of base utilities", () => {
      // dark: variants are independent; both base and dark should survive when not conflicting
      expect(
        onboardingCn("border-zinc-200 dark:border-zinc-800", "border-zinc-300")
      ).toBe("dark:border-zinc-800 border-zinc-300");
    });

    it("resolves focus-ring offset color conflicts used in onboarding controls", () => {
      expect(
        onboardingCn(
          "focus-visible:ring-offset-2",
          "dark:focus-visible:ring-offset-zinc-950"
        )
      ).toBe(
        "focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
      );
    });
  });
});
