// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { act } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { EmployeeAddressFields } from "./EmployeeAddressFields";
import { ApiError } from "../../services/ApiError";

vi.mock("../../services/addressApi", () => ({
  fetchAddressStreetSuggestions: vi.fn(),
  fetchAddressLocalitySuggestions: vi.fn(),
}));

import {
  fetchAddressLocalitySuggestions,
  fetchAddressStreetSuggestions,
} from "../../services/addressApi";

describe("EmployeeAddressFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fills postal code and city from a selected street suggestion", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([
      {
        name: "Grabstraße",
        postal_code: "13156",
        locality: "Berlin",
      },
    ]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "Gr",
            houseNumber: "",
            postalCode: "",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    fireEvent.focus(screen.getByLabelText(/street/i));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(fetchAddressStreetSuggestions).toHaveBeenCalledWith({
      name: "Gr",
      postalCode: undefined,
      locality: undefined,
      limit: 8,
    });
    expect(
      screen.getByRole("option", { name: /grabstraße/i })
    ).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("option", { name: /grabstraße/i }));

    expect(onChange).toHaveBeenCalledWith("street", "Grabstraße");
    expect(onChange).toHaveBeenCalledWith("postalCode", "13156");
    expect(onChange).toHaveBeenCalledWith("city", "Berlin");
  });

  it("fills city from a selected postal code suggestion", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([
      {
        postal_code: "10115",
        locality: "Berlin",
      },
    ]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "",
            houseNumber: "",
            postalCode: "101",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    fireEvent.focus(screen.getByLabelText(/postal code/i));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(fetchAddressLocalitySuggestions).toHaveBeenCalledWith({
      postalCode: "101",
      locality: undefined,
      limit: 8,
    });
    expect(screen.getByRole("option", { name: /10115/i })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("option", { name: /10115/i }));

    expect(onChange).toHaveBeenCalledWith("postalCode", "10115");
    expect(onChange).toHaveBeenCalledWith("city", "Berlin");
  });

  it("selects a street suggestion with ArrowDown and Enter", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([
      {
        name: "Grabstraße",
        postal_code: "13156",
        locality: "Berlin",
      },
    ]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "Gr",
            houseNumber: "",
            postalCode: "",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    const streetInput = screen.getByLabelText(/street/i);
    fireEvent.focus(streetInput);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    fireEvent.keyDown(streetInput, { key: "ArrowDown" });
    fireEvent.keyDown(streetInput, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("street", "Grabstraße");
    expect(onChange).toHaveBeenCalledWith("postalCode", "13156");
    expect(onChange).toHaveBeenCalledWith("city", "Berlin");
  });

  it("keeps locality suggestions visible after switching focus from postal code to city with TAB", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([
      { postal_code: "42103", locality: "Wuppertal" },
    ]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "",
            houseNumber: "",
            postalCode: "42",
            city: "Wu",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    const postalInput = screen.getByLabelText(/postal code/i);
    const cityInput = screen.getByLabelText(/^city$/i);

    fireEvent.focus(postalInput);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.getByRole("option", { name: /42103/i })).toBeInTheDocument();

    fireEvent.blur(postalInput);
    fireEvent.focus(cityInput);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(cityInput).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("option", { name: /wuppertal/i })
    ).toBeInTheDocument();
  });

  it("shows a visible API error for street autocomplete failures", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockRejectedValue(
      new ApiError("Address reference data is not available yet.", 503)
    );
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "Gr",
            houseNumber: "",
            postalCode: "",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    fireEvent.focus(screen.getByLabelText(/street/i));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(
      screen.getByText("Address reference data is not available yet. (503)")
    ).toBeInTheDocument();
  });

  it("shows a visible empty-state message when no street suggestions are found", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "Xy",
            houseNumber: "",
            postalCode: "",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    fireEvent.focus(screen.getByLabelText(/street/i));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(
      screen.getByText("No address suggestions found.")
    ).toBeInTheDocument();
  });

  it("fills city and postal code from a city suggestion selection", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([
      { postal_code: "50667", locality: "Köln" },
    ]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "",
            houseNumber: "",
            postalCode: "",
            city: "Kö",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    fireEvent.focus(screen.getByLabelText(/^city$/i));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.getByRole("option", { name: /köln/i })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("option", { name: /köln/i }));

    expect(onChange).toHaveBeenCalledWith("city", "Köln");
    expect(onChange).toHaveBeenCalledWith("postalCode", "50667");
  });

  it("selects a locality suggestion with ArrowDown and Enter on city input", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([
      { postal_code: "50667", locality: "Köln" },
    ]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "",
            houseNumber: "",
            postalCode: "",
            city: "Kö",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    const cityInput = screen.getByLabelText(/^city$/i);
    fireEvent.focus(cityInput);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    fireEvent.keyDown(cityInput, { key: "ArrowDown" });
    fireEvent.keyDown(cityInput, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("city", "Köln");
    expect(onChange).toHaveBeenCalledWith("postalCode", "50667");
  });

  it("selects locality suggestion with Tab when highlighted", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([
      { postal_code: "50667", locality: "Köln" },
    ]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "",
            houseNumber: "",
            postalCode: "",
            city: "Kö",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    const cityInput = screen.getByLabelText(/^city$/i);
    fireEvent.focus(cityInput);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    fireEvent.keyDown(cityInput, { key: "ArrowDown" });
    fireEvent.keyDown(cityInput, { key: "Tab" });

    expect(onChange).toHaveBeenCalledWith("city", "Köln");
  });

  it("dismisses street suggestions with Escape and closes the popup", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([
      { name: "Grabstraße", postal_code: "13156", locality: "Berlin" },
    ]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "Gr",
            houseNumber: "",
            postalCode: "",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    const streetInput = screen.getByLabelText(/street/i);
    fireEvent.focus(streetInput);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(streetInput).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(streetInput, { key: "Escape" });

    expect(streetInput).toHaveAttribute("aria-expanded", "false");
  });

  it("dismisses locality suggestions with Escape", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([
      { postal_code: "10115", locality: "Berlin" },
    ]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "",
            houseNumber: "",
            postalCode: "101",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    const postalInput = screen.getByLabelText(/postal code/i);
    fireEvent.focus(postalInput);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(postalInput).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(postalInput, { key: "Escape" });

    expect(postalInput).toHaveAttribute("aria-expanded", "false");
  });

  it("navigates street suggestions with ArrowUp", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([
      { name: "Astraße", postal_code: "10001", locality: "Berlin" },
      { name: "Bstraße", postal_code: "10002", locality: "Berlin" },
    ]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "st",
            houseNumber: "",
            postalCode: "",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    const streetInput = screen.getByLabelText(/street/i);
    fireEvent.focus(streetInput);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    fireEvent.keyDown(streetInput, { key: "ArrowDown" });
    fireEvent.keyDown(streetInput, { key: "ArrowDown" });
    fireEvent.keyDown(streetInput, { key: "ArrowUp" });
    fireEvent.keyDown(streetInput, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("street", "Astraße");
  });

  it("selects street suggestion with Tab when highlighted", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([
      { name: "Grabstraße", postal_code: "13156", locality: "Berlin" },
    ]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "Gr",
            houseNumber: "",
            postalCode: "",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    const streetInput = screen.getByLabelText(/street/i);
    fireEvent.focus(streetInput);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    fireEvent.keyDown(streetInput, { key: "ArrowDown" });
    fireEvent.keyDown(streetInput, { key: "Tab" });

    expect(onChange).toHaveBeenCalledWith("street", "Grabstraße");
  });

  it("shows a loading indicator while fetching street suggestions", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockReturnValue(
      new Promise(() => {})
    );
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "La",
            houseNumber: "",
            postalCode: "",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    fireEvent.focus(screen.getByLabelText(/street/i));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows a loading indicator while fetching locality suggestions", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([]);
    vi.mocked(fetchAddressLocalitySuggestions).mockReturnValue(
      new Promise(() => {})
    );

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "",
            houseNumber: "",
            postalCode: "10",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    fireEvent.focus(screen.getByLabelText(/postal code/i));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows a visible API error for locality autocomplete failures", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([]);
    vi.mocked(fetchAddressLocalitySuggestions).mockRejectedValue(
      new ApiError("Locality lookup unavailable.", 503)
    );

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "",
            houseNumber: "",
            postalCode: "10",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    fireEvent.focus(screen.getByLabelText(/postal code/i));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(
      screen.getByText("Locality lookup unavailable. (503)")
    ).toBeInTheDocument();
  });

  it("shows no suggestions and skips API call when country is not DE", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "Ru",
            houseNumber: "",
            postalCode: "",
            city: "",
            supplement: "",
            country: "FR",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    fireEvent.focus(screen.getByLabelText(/street/i));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(fetchAddressStreetSuggestions).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not fetch street suggestions before the field is focused", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([
      { name: "Grabstraße", postal_code: "13156", locality: "Berlin" },
    ]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "Gr",
            houseNumber: "",
            postalCode: "",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(fetchAddressStreetSuggestions).not.toHaveBeenCalled();
  });

  it("renders all fields as disabled in readOnly mode", () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "Hauptstraße",
            houseNumber: "1",
            postalCode: "10115",
            city: "Berlin",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
          readOnly
        />
      </I18nProvider>
    );

    expect(screen.getByLabelText(/street/i)).toBeDisabled();
    expect(screen.getByLabelText(/postal code/i)).toBeDisabled();
    expect(screen.getByLabelText(/^city$/i)).toBeDisabled();
    expect(screen.getByLabelText(/house number/i)).toBeDisabled();
    expect(screen.getByLabelText(/supplement/i)).toBeDisabled();
  });

  it("shows no suggestions and empty state after clearing street below 2 chars", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([
      { name: "Grabstraße", postal_code: "13156", locality: "Berlin" },
    ]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    const { rerender } = render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "Gr",
            houseNumber: "",
            postalCode: "",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    fireEvent.focus(screen.getByLabelText(/street/i));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(
      screen.getByRole("option", { name: /grabstraße/i })
    ).toBeInTheDocument();

    rerender(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "G",
            houseNumber: "",
            postalCode: "",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("triggers onChange when typing in house number and supplement fields", () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "",
            houseNumber: "",
            postalCode: "",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByLabelText(/house number/i), {
      target: { value: "4b" },
    });
    expect(onChange).toHaveBeenCalledWith("houseNumber", "4b");

    fireEvent.change(screen.getByLabelText(/supplement/i), {
      target: { value: "EG" },
    });
    expect(onChange).toHaveBeenCalledWith("supplement", "EG");
  });

  it("auto-applies a postal code suggestion when typing the exact code", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([
      { postal_code: "50667", locality: "Köln" },
    ]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "",
            houseNumber: "",
            postalCode: "506",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    const postalInput = screen.getByLabelText(/postal code/i);
    fireEvent.focus(postalInput);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.getByRole("option", { name: /50667/i })).toBeInTheDocument();

    fireEvent.change(postalInput, { target: { value: "50667" } });

    expect(onChange).toHaveBeenCalledWith("postalCode", "50667");
    expect(onChange).toHaveBeenCalledWith("city", "Köln");
  });

  it("auto-applies a city suggestion when typing the exact city name", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([
      { postal_code: "50667", locality: "Köln" },
    ]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "",
            houseNumber: "",
            postalCode: "",
            city: "Kö",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    const cityInput = screen.getByLabelText(/^city$/i);
    fireEvent.focus(cityInput);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.getByRole("option", { name: /köln/i })).toBeInTheDocument();

    fireEvent.change(cityInput, { target: { value: "Köln" } });

    expect(onChange).toHaveBeenCalledWith("city", "Köln");
    expect(onChange).toHaveBeenCalledWith("postalCode", "50667");
  });

  it("auto-applies a street suggestion when typing the exact street name", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([
      { name: "Grabstraße", postal_code: "13156", locality: "Berlin" },
    ]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "Gr",
            houseNumber: "",
            postalCode: "",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    const streetInput = screen.getByLabelText(/street/i);
    fireEvent.focus(streetInput);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    fireEvent.change(streetInput, { target: { value: "Grabstraße" } });

    expect(onChange).toHaveBeenCalledWith("street", "Grabstraße");
    expect(onChange).toHaveBeenCalledWith("postalCode", "13156");
    expect(onChange).toHaveBeenCalledWith("city", "Berlin");
  });

  it("hides suggestions when blurring to an external element", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([
      { name: "Grabstraße", postal_code: "13156", locality: "Berlin" },
    ]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "Gr",
            houseNumber: "",
            postalCode: "",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    const streetInput = screen.getByLabelText(/street/i);
    fireEvent.focus(streetInput);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(streetInput).toHaveAttribute("aria-expanded", "true");

    fireEvent.blur(streetInput);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(streetInput).toHaveAttribute("aria-expanded", "false");
  });

  it("shows no suggestions for non-2-character country code (selectedCountryOption null)", () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "",
            houseNumber: "",
            postalCode: "",
            city: "",
            supplement: "",
            country: "DEU",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    expect(screen.getByLabelText(/street/i)).toBeInTheDocument();
  });

  it("enters Enter without highlight on street does nothing to onChange", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([
      { name: "Grabstraße", postal_code: "13156", locality: "Berlin" },
    ]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "Gr",
            houseNumber: "",
            postalCode: "",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    const streetInput = screen.getByLabelText(/street/i);
    fireEvent.focus(streetInput);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    fireEvent.keyDown(streetInput, { key: "Enter" });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("handles generic Error in autocomplete error message", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockRejectedValue(
      new Error("Network error")
    );
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "Ha",
            houseNumber: "",
            postalCode: "",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    fireEvent.focus(screen.getByLabelText(/street/i));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  it("triggers onChange with empty string when country combobox is cleared", () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "",
            houseNumber: "",
            postalCode: "",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    expect(
      screen.getByRole("combobox", { name: /country/i })
    ).toBeInTheDocument();
  });

  it("calls onChange with the selected country code when a country is picked", async () => {
    vi.useRealTimers();
    const user = (await import("@testing-library/user-event")).default.setup();
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "",
            houseNumber: "",
            postalCode: "",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    await user.click(screen.getByRole("combobox", { name: /country/i }));
    await user.type(screen.getByRole("searchbox"), "FR");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("country", "FR");
  });

  it("shows empty state for no locality suggestions found", async () => {
    const onChange = vi.fn();
    vi.mocked(fetchAddressStreetSuggestions).mockResolvedValue([]);
    vi.mocked(fetchAddressLocalitySuggestions).mockResolvedValue([]);

    render(
      <I18nProvider i18n={i18n}>
        <EmployeeAddressFields
          draft={{
            street: "",
            houseNumber: "",
            postalCode: "99999",
            city: "",
            supplement: "",
            country: "DE",
          }}
          onChange={onChange}
        />
      </I18nProvider>
    );

    fireEvent.focus(screen.getByLabelText(/postal code/i));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(
      screen.getByText("No address suggestions found.")
    ).toBeInTheDocument();
  });
});
