// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePointerAwareCloseAutoFocus } from "./overlayFocus";

function OverlayFocusHarness({
  triggerProps,
}: {
  triggerProps?: React.ComponentProps<"button"> & {
    "data-slot"?: string;
  };
} = {}) {
  const { blurActiveElementAfterPointerClose, markPointerInteraction } =
    usePointerAwareCloseAutoFocus();

  return (
    <div>
      <button data-slot="dropdown-menu-trigger" type="button" {...triggerProps}>
        Trigger
      </button>
      <button type="button">Next action</button>
      <button
        type="button"
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={() => {
          markPointerInteraction();
          blurActiveElementAfterPointerClose();
        }}
      >
        Close
      </button>
    </div>
  );
}

describe("usePointerAwareCloseAutoFocus", () => {
  it("does not blur the next focused control after a pointer close", async () => {
    render(<OverlayFocusHarness />);

    const trigger = screen.getByRole("button", { name: "Trigger" });
    const nextButton = screen.getByRole("button", { name: "Next action" });
    const closeButton = screen.getByRole("button", { name: "Close" });

    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(closeButton);
    nextButton.focus();
    await Promise.resolve();

    expect(document.activeElement).toBe(nextButton);
  });

  it("blurs overlay triggers after pointer close when focus stays on the trigger", async () => {
    render(<OverlayFocusHarness />);

    const trigger = screen.getByRole("button", { name: "Trigger" });
    const closeButton = screen.getByRole("button", { name: "Close" });

    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(closeButton);
    trigger.focus();
    await Promise.resolve();

    expect(document.activeElement).not.toBe(trigger);
  });

  it("blurs asChild dropdown triggers after pointer close when focus stays on the trigger", async () => {
    render(
      <OverlayFocusHarness
        triggerProps={{
          "aria-expanded": "false",
          "aria-haspopup": "menu",
          "data-slot": "button",
        }}
      />
    );

    const trigger = screen.getByRole("button", { name: "Trigger" });
    const closeButton = screen.getByRole("button", { name: "Close" });

    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(closeButton);
    trigger.focus();
    await Promise.resolve();

    expect(document.activeElement).not.toBe(trigger);
  });
});
