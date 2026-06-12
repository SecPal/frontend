// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeAll, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Combobox, ComboboxOption } from "./combobox";

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("Combobox", () => {
  it("clears the filter text when the popover closes without a selection", async () => {
    const user = userEvent.setup();

    render(
      <>
        <Combobox
          aria-label="Favorite option"
          options={["Alpha", "Beta", "Gamma"]}
          displayValue={(value) => value ?? undefined}
          value="Alpha"
        >
          {(option) => (
            <ComboboxOption key={option} value={option}>
              {option}
            </ComboboxOption>
          )}
        </Combobox>
        <button type="button">Outside</button>
      </>
    );

    const input = screen.getByRole("textbox", { name: "Favorite option" });
    expect(input).toHaveValue("Alpha");

    await user.click(input);
    fireEvent.change(input, { target: { value: "Be" } });

    await waitFor(() => {
      expect(input).toHaveValue("Be");
    });
    expect(screen.getByRole("option", { name: "Beta" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Alpha" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Outside" }));

    await waitFor(() => {
      expect(input).toHaveValue("Alpha");
    });

    await user.click(input);

    await waitFor(() => {
      expect(input).toHaveValue("");
    });

    expect(screen.getByRole("option", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Beta" })).toBeInTheDocument();
  });
});
