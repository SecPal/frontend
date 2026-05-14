// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import clsx from "clsx";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Combobox,
  ComboboxDescription,
  ComboboxLabel,
  ComboboxOption,
} from "../../components/combobox";
import {
  Description,
  ErrorMessage,
  Field,
  Label,
} from "../../components/fieldset";
import { Input } from "../../components/input";
import type { PostalAddressDraft } from "../../lib/employeeAddresses";
import {
  getCountrySelectOptions,
  type CountrySelectOption,
} from "../../lib/iso3166CountryOptions";
import { ApiError } from "../../services/ApiError";
import {
  fetchAddressLocalitySuggestions,
  fetchAddressStreetSuggestions,
  type AddressLocalitySuggestion,
  type AddressStreetSuggestion,
} from "../../services/addressApi";

interface SuggestionRequestState {
  loading: boolean;
  error: string | null;
  hasResolved: boolean;
}

const idleSuggestionRequestState: SuggestionRequestState = {
  loading: false,
  error: null,
  hasResolved: false,
};

export function EmployeeAddressFields({
  draft,
  onChange,
  readOnly = false,
  fieldIdPrefix = "address",
  fieldNamePrefix = fieldIdPrefix,
}: {
  draft: PostalAddressDraft;
  onChange: (field: keyof PostalAddressDraft, value: string) => void;
  readOnly?: boolean;
  fieldIdPrefix?: string;
  fieldNamePrefix?: string;
}) {
  const { i18n } = useLingui();
  const [focusedField, setFocusedField] = useState<
    "street" | "postalCode" | "city" | null
  >(null);
  const [streetSuggestions, setStreetSuggestions] = useState<
    AddressStreetSuggestion[]
  >([]);
  const [localitySuggestions, setLocalitySuggestions] = useState<
    AddressLocalitySuggestion[]
  >([]);
  const [streetRequestState, setStreetRequestState] =
    useState<SuggestionRequestState>(idleSuggestionRequestState);
  const [localityRequestState, setLocalityRequestState] =
    useState<SuggestionRequestState>(idleSuggestionRequestState);

  const postalCodeInputRef = useRef<HTMLInputElement>(null);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const streetInputRef = useRef<HTMLInputElement>(null);
  const houseNumberInputRef = useRef<HTMLInputElement>(null);

  /** Delayed blur must not wipe focus when TAB moves between autocomplete fields. */
  const blurHideSuggestionsTimeoutRef = useRef<number | null>(null);

  /** Keyboard highlight within open suggestion list (-1 = none). */
  const [streetHighlightIndex, setStreetHighlightIndex] = useState(-1);
  const [localityHighlightIndex, setLocalityHighlightIndex] = useState(-1);

  const normalizedCountry = draft.country.trim().toUpperCase();
  const autocompleteEnabled =
    normalizedCountry === "" || normalizedCountry === "DE";

  const countryOptions = useMemo(
    () => getCountrySelectOptions(i18n.locale),
    [i18n.locale]
  );

  const selectedCountryOption = useMemo((): CountrySelectOption | null => {
    const raw = draft.country.trim().toUpperCase();
    if (raw.length !== 2) {
      return null;
    }

    return (
      countryOptions.find((o) => o.code === raw) ?? {
        code: raw,
        label: raw,
      }
    );
  }, [countryOptions, draft.country]);

  const fieldId = useCallback(
    (suffix: string) => `${fieldIdPrefix}_${suffix}`,
    [fieldIdPrefix]
  );
  const fieldName = useCallback(
    (suffix: string) => `${fieldNamePrefix}_${suffix}`,
    [fieldNamePrefix]
  );
  const localityListboxId = `${fieldIdPrefix}-locality-listbox`;
  const streetListboxId = `${fieldIdPrefix}-street-listbox`;

  const getAutocompleteErrorMessage = useCallback(
    (error: unknown): string => {
      if (error instanceof ApiError) {
        if (error.message && error.statusCode) {
          return `${error.message} (${error.statusCode})`;
        }

        if (error.message) {
          return error.message;
        }
      }

      if (error instanceof Error && error.message) {
        return error.message;
      }

      return i18n._(msg`Address autocomplete request failed.`);
    },
    [i18n]
  );

  useEffect(() => {
    if (
      !autocompleteEnabled ||
      focusedField !== "street" ||
      draft.street.trim().length < 2
    ) {
      const timeoutId = window.setTimeout(() => {
        setStreetSuggestions([]);
        setStreetHighlightIndex(-1);
        setStreetRequestState(idleSuggestionRequestState);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    let cancelled = false;

    const timeoutId = window.setTimeout(() => {
      setStreetRequestState({
        loading: true,
        error: null,
        hasResolved: false,
      });

      void fetchAddressStreetSuggestions({
        name: draft.street.trim(),
        postalCode: draft.postalCode.trim() || undefined,
        locality: draft.city.trim() || undefined,
        limit: 8,
      })
        .then((result) => {
          if (cancelled) {
            return;
          }

          setStreetSuggestions(result);
          setStreetHighlightIndex(-1);
          setStreetRequestState({
            loading: false,
            error: null,
            hasResolved: true,
          });
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return;
          }

          setStreetSuggestions([]);
          setStreetHighlightIndex(-1);
          setStreetRequestState({
            loading: false,
            error: getAutocompleteErrorMessage(error),
            hasResolved: true,
          });
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    autocompleteEnabled,
    focusedField,
    draft.city,
    draft.postalCode,
    draft.street,
    getAutocompleteErrorMessage,
  ]);

  useEffect(() => {
    const postalCodeQuery = draft.postalCode.trim();
    const localityQuery = draft.city.trim();

    if (
      !autocompleteEnabled ||
      (focusedField !== "postalCode" && focusedField !== "city") ||
      (postalCodeQuery.length < 1 && localityQuery.length < 2)
    ) {
      const timeoutId = window.setTimeout(() => {
        setLocalitySuggestions([]);
        setLocalityHighlightIndex(-1);
        setLocalityRequestState(idleSuggestionRequestState);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    let cancelled = false;

    const timeoutId = window.setTimeout(() => {
      setLocalityRequestState({
        loading: true,
        error: null,
        hasResolved: false,
      });

      void fetchAddressLocalitySuggestions({
        postalCode: postalCodeQuery || undefined,
        locality: localityQuery || undefined,
        limit: 8,
      })
        .then((result) => {
          if (cancelled) {
            return;
          }

          setLocalitySuggestions(result);
          setLocalityHighlightIndex(-1);
          setLocalityRequestState({
            loading: false,
            error: null,
            hasResolved: true,
          });
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return;
          }

          setLocalitySuggestions([]);
          setLocalityHighlightIndex(-1);
          setLocalityRequestState({
            loading: false,
            error: getAutocompleteErrorMessage(error),
            hasResolved: true,
          });
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    autocompleteEnabled,
    draft.city,
    draft.postalCode,
    focusedField,
    getAutocompleteErrorMessage,
  ]);

  useEffect(() => {
    return () => {
      if (blurHideSuggestionsTimeoutRef.current !== null) {
        window.clearTimeout(blurHideSuggestionsTimeoutRef.current);
      }
    };
  }, []);

  function resetSuggestionHighlights() {
    setStreetHighlightIndex(-1);
    setLocalityHighlightIndex(-1);
  }

  function cancelScheduledBlurHideSuggestions() {
    if (blurHideSuggestionsTimeoutRef.current !== null) {
      window.clearTimeout(blurHideSuggestionsTimeoutRef.current);
      blurHideSuggestionsTimeoutRef.current = null;
    }
  }

  function focusIsOnAutocompleteInput(): boolean {
    const active = document.activeElement;
    return (
      active === postalCodeInputRef.current ||
      active === cityInputRef.current ||
      active === streetInputRef.current
    );
  }

  function handleAutocompleteFocus(
    field: "postalCode" | "city" | "street"
  ): void {
    cancelScheduledBlurHideSuggestions();
    resetSuggestionHighlights();
    setFocusedField(field);
  }

  function handleAutocompleteInputBlur() {
    cancelScheduledBlurHideSuggestions();
    blurHideSuggestionsTimeoutRef.current = window.setTimeout(() => {
      blurHideSuggestionsTimeoutRef.current = null;
      if (focusIsOnAutocompleteInput()) {
        return;
      }
      resetSuggestionHighlights();
      setFocusedField(null);
    }, 100);
  }

  function applyStreetSuggestion(name: string) {
    const matches = streetSuggestions.filter(
      (suggestion) => suggestion.name === name
    );
    if (matches.length !== 1) {
      return;
    }

    const match = matches[0];
    if (!match) {
      return;
    }

    onChange("street", match.name);
    onChange("postalCode", match.postal_code);
    onChange("city", match.locality);
  }

  function applyPostalSuggestion(postalCode: string) {
    const matches = localitySuggestions.filter(
      (suggestion) => suggestion.postal_code === postalCode
    );
    if (matches.length !== 1) {
      return;
    }

    const match = matches[0];
    if (!match) {
      return;
    }

    onChange("postalCode", match.postal_code);
    onChange("city", match.locality);
  }

  function applyCitySuggestion(locality: string) {
    const matches = localitySuggestions.filter(
      (suggestion) => suggestion.locality === locality
    );
    if (matches.length !== 1) {
      return;
    }

    const match = matches[0];
    if (!match) {
      return;
    }

    onChange("city", match.locality);
    onChange("postalCode", match.postal_code);
  }

  function selectStreetSuggestion(suggestion: AddressStreetSuggestion) {
    onChange("street", suggestion.name);
    onChange("postalCode", suggestion.postal_code);
    onChange("city", suggestion.locality);
    resetSuggestionHighlights();
    setFocusedField(null);
  }

  function selectLocalitySuggestion(suggestion: AddressLocalitySuggestion) {
    onChange("postalCode", suggestion.postal_code);
    onChange("city", suggestion.locality);
    resetSuggestionHighlights();
    setFocusedField(null);
  }

  const showStreetSuggestions =
    autocompleteEnabled &&
    focusedField === "street" &&
    streetSuggestions.length > 0 &&
    draft.street.trim().length >= 2;
  const showPostalSuggestions =
    autocompleteEnabled &&
    focusedField === "postalCode" &&
    localitySuggestions.length > 0 &&
    draft.postalCode.trim().length >= 1;
  const showCitySuggestions =
    autocompleteEnabled &&
    focusedField === "city" &&
    localitySuggestions.length > 0 &&
    draft.city.trim().length >= 2;
  const showStreetFeedback =
    autocompleteEnabled &&
    focusedField === "street" &&
    draft.street.trim().length >= 2;
  const showPostalFeedback =
    autocompleteEnabled &&
    focusedField === "postalCode" &&
    draft.postalCode.trim().length >= 1;
  const showCityFeedback =
    autocompleteEnabled &&
    focusedField === "city" &&
    draft.city.trim().length >= 2;

  function focusNextFieldAfterLocalitySelect() {
    window.requestAnimationFrame(() => {
      streetInputRef.current?.focus();
    });
  }

  function focusNextFieldAfterStreetSelect() {
    window.requestAnimationFrame(() => {
      houseNumberInputRef.current?.focus();
    });
  }

  function handleStreetSuggestionKeyDown(
    event: KeyboardEvent<HTMLInputElement>
  ) {
    if (
      !showStreetSuggestions ||
      streetSuggestions.length === 0 ||
      streetRequestState.loading
    ) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setStreetHighlightIndex((prev) =>
        prev < streetSuggestions.length - 1 ? prev + 1 : prev
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setStreetHighlightIndex((prev) => (prev <= 0 ? -1 : prev - 1));
      return;
    }

    if (event.key === "Enter") {
      const pick =
        streetHighlightIndex >= 0
          ? streetSuggestions[streetHighlightIndex]
          : undefined;
      if (pick) {
        event.preventDefault();
        selectStreetSuggestion(pick);
        focusNextFieldAfterStreetSelect();
        return;
      }
      event.preventDefault();
      return;
    }

    if (event.key === "Tab" && !event.shiftKey && streetHighlightIndex >= 0) {
      const pick = streetSuggestions[streetHighlightIndex];
      if (pick) {
        event.preventDefault();
        selectStreetSuggestion(pick);
        focusNextFieldAfterStreetSelect();
      }
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setStreetHighlightIndex(-1);
      setFocusedField(null);
    }
  }

  function handleLocalitySuggestionKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    listActive: boolean
  ) {
    if (
      !listActive ||
      localitySuggestions.length === 0 ||
      localityRequestState.loading
    ) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setLocalityHighlightIndex((prev) =>
        prev < localitySuggestions.length - 1 ? prev + 1 : prev
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setLocalityHighlightIndex((prev) => (prev <= 0 ? -1 : prev - 1));
      return;
    }

    if (event.key === "Enter") {
      const pick =
        localityHighlightIndex >= 0
          ? localitySuggestions[localityHighlightIndex]
          : undefined;
      if (pick) {
        event.preventDefault();
        selectLocalitySuggestion(pick);
        focusNextFieldAfterLocalitySelect();
        return;
      }
      event.preventDefault();
      return;
    }

    if (event.key === "Tab" && !event.shiftKey && localityHighlightIndex >= 0) {
      const pick = localitySuggestions[localityHighlightIndex];
      if (pick) {
        event.preventDefault();
        selectLocalitySuggestion(pick);
        focusNextFieldAfterLocalitySelect();
      }
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setLocalityHighlightIndex(-1);
      setFocusedField(null);
    }
  }

  return (
    <>
      <Field>
        <Label htmlFor={fieldId("postal_code")}>
          <Trans>Postal Code</Trans>
        </Label>
        <Input
          ref={postalCodeInputRef}
          id={fieldId("postal_code")}
          name={fieldName("postal_code")}
          autoComplete="postal-code"
          disabled={readOnly}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPostalSuggestions}
          aria-controls={localityListboxId}
          aria-activedescendant={
            showPostalSuggestions && localityHighlightIndex >= 0
              ? `${fieldIdPrefix}-locality-option-${localityHighlightIndex}`
              : undefined
          }
          value={draft.postalCode}
          onFocus={() => handleAutocompleteFocus("postalCode")}
          onBlur={handleAutocompleteInputBlur}
          onKeyDown={(event) =>
            handleLocalitySuggestionKeyDown(event, showPostalSuggestions)
          }
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange("postalCode", nextValue);
            applyPostalSuggestion(nextValue);
          }}
        />
        {showPostalSuggestions ? (
          <div
            id={localityListboxId}
            role="listbox"
            className="mt-2 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            {localitySuggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.postal_code}-${suggestion.locality}`}
                id={`${fieldIdPrefix}-locality-option-${index}`}
                type="button"
                tabIndex={-1}
                role="option"
                aria-selected={localityHighlightIndex === index}
                className={clsx(
                  "block w-full px-3 py-2 text-left text-sm text-zinc-900 hover:bg-zinc-50 dark:text-white dark:hover:bg-zinc-800",
                  "border-b border-zinc-100 last:border-b-0 dark:border-zinc-800",
                  localityHighlightIndex === index &&
                    "bg-zinc-100 dark:bg-zinc-800"
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectLocalitySuggestion(suggestion);
                }}
              >
                <span className="block font-medium">
                  {suggestion.postal_code}
                </span>
                <span className="block text-zinc-500 dark:text-zinc-400">
                  {suggestion.locality}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {showPostalFeedback && localityRequestState.loading ? (
          <Description>
            <Trans>Loading...</Trans>
          </Description>
        ) : null}
        {showPostalFeedback &&
        !localityRequestState.loading &&
        localityRequestState.error ? (
          <ErrorMessage>{localityRequestState.error}</ErrorMessage>
        ) : null}
        {showPostalFeedback &&
        !localityRequestState.loading &&
        !localityRequestState.error &&
        localityRequestState.hasResolved &&
        localitySuggestions.length === 0 ? (
          <Description>
            <Trans>No address suggestions found.</Trans>
          </Description>
        ) : null}
      </Field>

      <Field>
        <Label htmlFor={fieldId("city")}>
          <Trans>City</Trans>
        </Label>
        <Input
          ref={cityInputRef}
          id={fieldId("city")}
          name={fieldName("city")}
          autoComplete="address-level2"
          disabled={readOnly}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showCitySuggestions}
          aria-controls={localityListboxId}
          aria-activedescendant={
            showCitySuggestions && localityHighlightIndex >= 0
              ? `${fieldIdPrefix}-locality-option-${localityHighlightIndex}`
              : undefined
          }
          value={draft.city}
          onFocus={() => handleAutocompleteFocus("city")}
          onBlur={handleAutocompleteInputBlur}
          onKeyDown={(event) =>
            handleLocalitySuggestionKeyDown(event, showCitySuggestions)
          }
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange("city", nextValue);
            applyCitySuggestion(nextValue);
          }}
        />
        {showCitySuggestions ? (
          <div
            id={localityListboxId}
            role="listbox"
            className="mt-2 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            {localitySuggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.locality}-${suggestion.postal_code}`}
                id={`${fieldIdPrefix}-locality-option-${index}`}
                type="button"
                tabIndex={-1}
                role="option"
                aria-selected={localityHighlightIndex === index}
                className={clsx(
                  "block w-full px-3 py-2 text-left text-sm text-zinc-900 hover:bg-zinc-50 dark:text-white dark:hover:bg-zinc-800",
                  "border-b border-zinc-100 last:border-b-0 dark:border-zinc-800",
                  localityHighlightIndex === index &&
                    "bg-zinc-100 dark:bg-zinc-800"
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectLocalitySuggestion(suggestion);
                }}
              >
                <span className="block font-medium">{suggestion.locality}</span>
                <span className="block text-zinc-500 dark:text-zinc-400">
                  {suggestion.postal_code}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {showCityFeedback && localityRequestState.loading ? (
          <Description>
            <Trans>Loading...</Trans>
          </Description>
        ) : null}
        {showCityFeedback &&
        !localityRequestState.loading &&
        localityRequestState.error ? (
          <ErrorMessage>{localityRequestState.error}</ErrorMessage>
        ) : null}
        {showCityFeedback &&
        !localityRequestState.loading &&
        !localityRequestState.error &&
        localityRequestState.hasResolved &&
        localitySuggestions.length === 0 ? (
          <Description>
            <Trans>No address suggestions found.</Trans>
          </Description>
        ) : null}
      </Field>

      <Field>
        <Label htmlFor={fieldId("street")}>
          <Trans>Street</Trans>
        </Label>
        <Input
          ref={streetInputRef}
          id={fieldId("street")}
          name={fieldName("street")}
          autoComplete="street-address"
          disabled={readOnly}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showStreetSuggestions}
          aria-controls={streetListboxId}
          aria-activedescendant={
            showStreetSuggestions && streetHighlightIndex >= 0
              ? `${fieldIdPrefix}-street-option-${streetHighlightIndex}`
              : undefined
          }
          value={draft.street}
          onFocus={() => handleAutocompleteFocus("street")}
          onBlur={handleAutocompleteInputBlur}
          onKeyDown={handleStreetSuggestionKeyDown}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange("street", nextValue);
            applyStreetSuggestion(nextValue);
          }}
        />
        {showStreetSuggestions ? (
          <div
            id={streetListboxId}
            role="listbox"
            className="mt-2 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            {streetSuggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.name}-${suggestion.postal_code}-${suggestion.locality}`}
                id={`${fieldIdPrefix}-street-option-${index}`}
                type="button"
                tabIndex={-1}
                role="option"
                aria-selected={streetHighlightIndex === index}
                className={clsx(
                  "block w-full px-3 py-2 text-left text-sm text-zinc-900 hover:bg-zinc-50 dark:text-white dark:hover:bg-zinc-800",
                  "border-b border-zinc-100 last:border-b-0 dark:border-zinc-800",
                  streetHighlightIndex === index &&
                    "bg-zinc-100 dark:bg-zinc-800"
                )}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectStreetSuggestion(suggestion);
                }}
              >
                <span className="block font-medium">{suggestion.name}</span>
                <span className="block text-zinc-500 dark:text-zinc-400">
                  {suggestion.postal_code} {suggestion.locality}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {showStreetFeedback && streetRequestState.loading ? (
          <Description>
            <Trans>Loading...</Trans>
          </Description>
        ) : null}
        {showStreetFeedback &&
        !streetRequestState.loading &&
        streetRequestState.error ? (
          <ErrorMessage>{streetRequestState.error}</ErrorMessage>
        ) : null}
        {showStreetFeedback &&
        !streetRequestState.loading &&
        !streetRequestState.error &&
        streetRequestState.hasResolved &&
        streetSuggestions.length === 0 ? (
          <Description>
            <Trans>No address suggestions found.</Trans>
          </Description>
        ) : null}
      </Field>

      <Field>
        <Label htmlFor={fieldId("house_number")}>
          <Trans>House Number</Trans>
        </Label>
        <Input
          ref={houseNumberInputRef}
          id={fieldId("house_number")}
          name={fieldName("house_number")}
          disabled={readOnly}
          value={draft.houseNumber}
          onChange={(event) => onChange("houseNumber", event.target.value)}
        />
      </Field>

      <Field>
        <Label htmlFor={fieldId("supplement")}>
          <Trans>Address Supplement</Trans>
        </Label>
        <Input
          id={fieldId("supplement")}
          name={fieldName("supplement")}
          disabled={readOnly}
          value={draft.supplement}
          onChange={(event) => onChange("supplement", event.target.value)}
        />
      </Field>

      <Field>
        <Label>
          <Trans>Country</Trans>
        </Label>
        <Combobox
          aria-label={i18n._(msg`Country`)}
          name={fieldName("country")}
          disabled={readOnly}
          by={(a, z) => a?.code === z?.code}
          options={countryOptions}
          placeholder={i18n._(msg`Search or select country`)}
          value={selectedCountryOption}
          displayValue={(option) => option?.label ?? ""}
          filter={(option, query) => {
            if (!option) {
              return false;
            }

            const q = query.trim().toLowerCase();
            if (!q) {
              return true;
            }
            return (
              option.label.toLowerCase().includes(q) ||
              option.code.toLowerCase().includes(q)
            );
          }}
          onChange={(option) => onChange("country", option?.code ?? "")}
        >
          {(option) => (
            <ComboboxOption key={option.code} value={option}>
              <ComboboxLabel>{option.label}</ComboboxLabel>
              <ComboboxDescription>{option.code}</ComboboxDescription>
            </ComboboxOption>
          )}
        </Combobox>
      </Field>
    </>
  );
}
