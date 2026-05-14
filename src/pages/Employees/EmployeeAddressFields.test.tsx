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
});
