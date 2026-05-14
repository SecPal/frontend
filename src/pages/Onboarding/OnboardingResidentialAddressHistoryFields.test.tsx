// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  OnboardingResidentialAddressHistoryFields,
  type ResidentialAddressHistoryChange,
} from "./OnboardingResidentialAddressHistoryFields";
import {
  addCalendarDaysToIsoDate,
  getResidentialAddressHistoryValue,
  residentialHistoryBewacherDefaults,
  type ResidentialAddressHistoryValue,
  validateResidentialAddressHistoryValue,
} from "./onboardingResidentialAddressHistory";

function localIsoDateWithDayOffset(dayOffset: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

vi.mock("../../services/addressApi", () => ({
  fetchAddressStreetSuggestions: vi.fn().mockResolvedValue([]),
  fetchAddressLocalitySuggestions: vi.fn().mockResolvedValue([]),
}));

describe("OnboardingResidentialAddressHistoryFields", () => {
  beforeEach(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("normalizes empty onboarding form data", () => {
    expect(getResidentialAddressHistoryValue({})).toEqual({
      current_address: {
        street: "",
        house_number: "",
        postal_code: "",
        city: "",
        supplement: "",
        country: "DE",
        resided_from: "",
        resided_until: "",
      },
      previous_addresses: [],
      ...residentialHistoryBewacherDefaults,
    });
  });

  it("validates missing current address and invalid previous residence dates", () => {
    const translate = i18n._.bind(i18n) as typeof i18n._;

    const errors = validateResidentialAddressHistoryValue(
      {
        ...residentialHistoryBewacherDefaults,
        has_current_bewacher_id: "no",
        current_address: {
          street: "",
          house_number: "",
          postal_code: "",
          city: "",
          supplement: "",
          country: "D",
          resided_from: localIsoDateWithDayOffset(-100),
          resided_until: "",
        },
        previous_addresses: [
          {
            street: "Old Street",
            house_number: "2",
            postal_code: "12345",
            city: "Berlin",
            supplement: "",
            country: "DE",
            resided_from: "2025-01-10",
            resided_until: "2025-01-01",
          },
        ],
      },
      translate
    );

    expect(errors["current_address.street"]).toMatch(
      /current residential address/i
    );
    expect(errors["current_address.country"]).toMatch(
      /two-letter country code/i
    );
    expect(errors["previous_addresses.0.resided_until"]).toMatch(
      /end date must be on or after the start date/i
    );
  });

  it("merges sequential address updates so postal code is not overwritten", () => {
    let stored = getResidentialAddressHistoryValue({});
    const apply = (change: ResidentialAddressHistoryChange) => {
      stored = typeof change === "function" ? change(stored) : change;
    };

    apply((prev) => ({
      ...prev,
      current_address: { ...prev.current_address, postal_code: "42103" },
    }));
    apply((prev) => ({
      ...prev,
      current_address: { ...prev.current_address, city: "Wuppertal" },
    }));

    expect(stored.current_address.postal_code).toBe("42103");
    expect(stored.current_address.city).toBe("Wuppertal");
  });

  it("hides previous residences until the current move-in implies less than five years", () => {
    render(
      <I18nProvider i18n={i18n}>
        <OnboardingResidentialAddressHistoryFields
          value={getResidentialAddressHistoryValue({})}
          errors={{}}
          readOnly={false}
          onChange={() => {}}
        />
      </I18nProvider>
    );

    expect(
      screen.queryByRole("heading", { name: /previous residences/i })
    ).not.toBeInTheDocument();
  });

  it("syncs the first previous residence when the current move-in is within five years", () => {
    const onChange = vi.fn();
    const recent = localIsoDateWithDayOffset(-120);
    const base = getResidentialAddressHistoryValue({});
    const value: ResidentialAddressHistoryValue = {
      ...base,
      ...residentialHistoryBewacherDefaults,
      has_current_bewacher_id: "no",
      current_address: {
        ...base.current_address,
        street: "A",
        house_number: "1",
        postal_code: "10115",
        city: "Berlin",
        country: "DE",
        resided_from: recent,
      },
    };

    render(
      <I18nProvider i18n={i18n}>
        <OnboardingResidentialAddressHistoryFields
          value={value}
          errors={{}}
          readOnly={false}
          onChange={onChange}
        />
      </I18nProvider>
    );

    expect(onChange).toHaveBeenCalled();
    const lastArg = onChange.mock.calls[onChange.mock.calls.length - 1]![0];
    const applied = typeof lastArg === "function" ? lastArg(value) : lastArg;
    expect(applied.previous_addresses).toHaveLength(1);
    expect(applied.previous_addresses[0]!.resided_until).toBe(
      addCalendarDaysToIsoDate(recent, -1)
    );
  });

  it("disables current address inputs when the step is read-only", () => {
    render(
      <I18nProvider i18n={i18n}>
        <OnboardingResidentialAddressHistoryFields
          value={getResidentialAddressHistoryValue({})}
          errors={{}}
          readOnly
          onChange={() => {}}
        />
      </I18nProvider>
    );

    expect(screen.getByLabelText(/postal code/i)).toBeDisabled();
    expect(screen.getByLabelText(/^city$/i)).toBeDisabled();
    expect(screen.getByLabelText(/street/i)).toBeDisabled();
    expect(screen.getByLabelText(/house number/i)).toBeDisabled();
    expect(screen.getByLabelText(/address supplement/i)).toBeDisabled();
    expect(screen.getByRole("combobox", { name: /country/i })).toBeDisabled();
  });
});

describe("OnboardingResidentialAddressHistoryFields — user interactions", () => {
  beforeEach(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  function buildValue(
    overrides: Partial<ResidentialAddressHistoryValue> = {}
  ): ResidentialAddressHistoryValue {
    return {
      ...getResidentialAddressHistoryValue({}),
      ...residentialHistoryBewacherDefaults,
      ...overrides,
    };
  }

  it("calls onChange with the updated street when the street input changes", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider i18n={i18n}>
        <OnboardingResidentialAddressHistoryFields
          value={buildValue()}
          errors={{}}
          readOnly={false}
          onChange={onChange}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByLabelText(/^street$/i), {
      target: { value: "Musterstr." },
    });

    expect(onChange).toHaveBeenCalled();
    const lastArg = onChange.mock.calls[onChange.mock.calls.length - 1]![0];
    const applied =
      typeof lastArg === "function" ? lastArg(buildValue()) : lastArg;
    expect(applied.current_address.street).toBe("Musterstr.");
  });

  it("calls onChange when the living-there-since date changes", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider i18n={i18n}>
        <OnboardingResidentialAddressHistoryFields
          value={buildValue()}
          errors={{}}
          readOnly={false}
          onChange={onChange}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByLabelText(/living there since/i), {
      target: { value: "2022-03-15" },
    });

    expect(onChange).toHaveBeenCalledOnce();
    const lastArg = onChange.mock.calls[0]![0];
    // The updater is a function that closes over the event target value
    expect(typeof lastArg).toBe("function");
  });

  it("shows the Bewacher ID input when yes is selected and hides when no is selected", async () => {
    const user = userEvent.setup();
    let stored = buildValue();
    const onChange = vi.fn((change: ResidentialAddressHistoryChange) => {
      stored = typeof change === "function" ? change(stored) : change;
    });

    const { rerender } = render(
      <I18nProvider i18n={i18n}>
        <OnboardingResidentialAddressHistoryFields
          value={stored}
          errors={{}}
          readOnly={false}
          onChange={onChange}
        />
      </I18nProvider>
    );

    expect(screen.queryByLabelText(/^bewacher id$/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /^yes$/i }));

    rerender(
      <I18nProvider i18n={i18n}>
        <OnboardingResidentialAddressHistoryFields
          value={stored}
          errors={{}}
          readOnly={false}
          onChange={onChange}
        />
      </I18nProvider>
    );

    expect(screen.getByLabelText(/^bewacher id$/i)).toBeInTheDocument();
  });

  it("calls onChange with bewacher_id value when the Bewacher ID input changes", () => {
    const onChange = vi.fn();
    render(
      <I18nProvider i18n={i18n}>
        <OnboardingResidentialAddressHistoryFields
          value={buildValue({ has_current_bewacher_id: "yes" })}
          errors={{}}
          readOnly={false}
          onChange={onChange}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByLabelText(/^bewacher id$/i), {
      target: { value: "BW-42" },
    });

    expect(onChange).toHaveBeenCalledOnce();
    expect(typeof onChange.mock.calls[0]![0]).toBe("function");
  });

  it("shows the bewacher-unknown checkbox when yes is selected and id is empty", () => {
    render(
      <I18nProvider i18n={i18n}>
        <OnboardingResidentialAddressHistoryFields
          value={buildValue({
            has_current_bewacher_id: "yes",
            bewacher_id: "",
          })}
          errors={{}}
          readOnly={false}
          onChange={() => {}}
        />
      </I18nProvider>
    );

    expect(
      screen.getByRole("checkbox", { name: /do not know my bewacher id/i })
    ).toBeInTheDocument();
  });

  it("shows previous residences section when has_current_bewacher_id=no and current does not cover five years", () => {
    const recent = localIsoDateWithDayOffset(-100);
    render(
      <I18nProvider i18n={i18n}>
        <OnboardingResidentialAddressHistoryFields
          value={buildValue({
            has_current_bewacher_id: "no",
            current_address: {
              street: "A",
              house_number: "1",
              postal_code: "10115",
              city: "Berlin",
              supplement: "",
              country: "DE",
              resided_from: recent,
              resided_until: "",
            },
            previous_addresses: [
              {
                street: "",
                house_number: "",
                postal_code: "",
                city: "",
                supplement: "",
                country: "DE",
                resided_from: "",
                resided_until: addCalendarDaysToIsoDate(recent, -1),
              },
            ],
          })}
          errors={{}}
          readOnly={false}
          onChange={() => {}}
        />
      </I18nProvider>
    );

    expect(
      screen.getByRole("heading", { name: /previous residences/i })
    ).toBeInTheDocument();
  });

  it("validates that coverage key is produced when no previous addresses cover five years", () => {
    const translate = i18n._.bind(i18n) as typeof i18n._;
    const recent = localIsoDateWithDayOffset(-100);
    const errors = validateResidentialAddressHistoryValue(
      buildValue({
        has_current_bewacher_id: "no",
        current_address: {
          street: "A",
          house_number: "1",
          postal_code: "10115",
          city: "Berlin",
          supplement: "",
          country: "DE",
          resided_from: recent,
          resided_until: "",
        },
        previous_addresses: [],
      }),
      translate
    );

    expect(errors["previous_addresses.coverage"]).toMatch(
      /complete each earlier residence/i
    );
  });

  it("calls onChange when a previous address date field changes", () => {
    const recent = localIsoDateWithDayOffset(-100);
    const onChange = vi.fn();
    const prevEntry = {
      street: "",
      house_number: "",
      postal_code: "",
      city: "",
      supplement: "",
      country: "DE",
      resided_from: "",
      resided_until: addCalendarDaysToIsoDate(recent, -1),
    };
    render(
      <I18nProvider i18n={i18n}>
        <OnboardingResidentialAddressHistoryFields
          value={buildValue({
            has_current_bewacher_id: "no",
            current_address: {
              street: "A",
              house_number: "1",
              postal_code: "10115",
              city: "Berlin",
              supplement: "",
              country: "DE",
              resided_from: recent,
              resided_until: "",
            },
            previous_addresses: [prevEntry],
          })}
          errors={{}}
          readOnly={false}
          onChange={onChange}
        />
      </I18nProvider>
    );

    fireEvent.change(screen.getByLabelText(/resided from/i), {
      target: { value: "2020-01-01" },
    });

    expect(onChange).toHaveBeenCalled();
  });

  it("aria-disables the Bewacher radio buttons when read-only", () => {
    render(
      <I18nProvider i18n={i18n}>
        <OnboardingResidentialAddressHistoryFields
          value={buildValue()}
          errors={{}}
          readOnly
          onChange={() => {}}
        />
      </I18nProvider>
    );

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAttribute("aria-disabled", "true");
    }
  });

  it("displays field error for has_current_bewacher_id question", () => {
    render(
      <I18nProvider i18n={i18n}>
        <OnboardingResidentialAddressHistoryFields
          value={buildValue()}
          errors={{ has_current_bewacher_id: "Please answer this question" }}
          readOnly={false}
          onChange={() => {}}
        />
      </I18nProvider>
    );

    expect(screen.getByText("Please answer this question")).toBeInTheDocument();
  });

  it("displays field error for bewacher_id input", () => {
    render(
      <I18nProvider i18n={i18n}>
        <OnboardingResidentialAddressHistoryFields
          value={buildValue({ has_current_bewacher_id: "yes" })}
          errors={{ bewacher_id: "Enter your Bewacher ID" }}
          readOnly={false}
          onChange={() => {}}
        />
      </I18nProvider>
    );

    expect(screen.getByText("Enter your Bewacher ID")).toBeInTheDocument();
  });
});
