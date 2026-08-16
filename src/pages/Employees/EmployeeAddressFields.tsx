// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EmployeeAutocompleteListbox as AutocompleteListbox,
  EmployeeAutocompleteOption as AutocompleteOption,
  Field,
  FieldDescription as Description,
  FieldError as ErrorMessage,
  FieldLabel as Label,
  Input,
  EmployeeCommandPopover as CommandPopover,
  type CommandOption,
} from "@/ui";
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

function localitySuggestionValue(suggestion: AddressLocalitySuggestion) {
  return JSON.stringify([suggestion.postal_code, suggestion.locality]);
}

function streetSuggestionValue(suggestion: AddressStreetSuggestion) {
  return JSON.stringify([
    suggestion.name,
    suggestion.postal_code,
    suggestion.locality,
  ]);
}

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

  const normalizedCountry = draft.country.trim().toUpperCase();
  const autocompleteEnabled =
    normalizedCountry === "" || normalizedCountry === "DE";

  const countryOptions = useMemo(
    () => getCountrySelectOptions(i18n.locale),
    [i18n.locale]
  );
  const countryCommandOptions = useMemo<CommandOption[]>(
    () =>
      countryOptions.map((option) => ({
        value: option.code,
        label: option.label,
        keywords: [option.code],
      })),
    [countryOptions]
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
    setFocusedField(field);
  }

  function handleAutocompleteInputBlur() {
    cancelScheduledBlurHideSuggestions();
    blurHideSuggestionsTimeoutRef.current = window.setTimeout(() => {
      blurHideSuggestionsTimeoutRef.current = null;
      if (focusIsOnAutocompleteInput()) {
        return;
      }
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
    setFocusedField(null);
  }

  function selectLocalitySuggestion(suggestion: AddressLocalitySuggestion) {
    onChange("postalCode", suggestion.postal_code);
    onChange("city", suggestion.locality);
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

  return (
    <>
      <Field>
        <Label htmlFor={fieldId("postal_code")}>
          <Trans>Postal Code</Trans>
        </Label>
        <AutocompleteListbox
          open={showPostalSuggestions}
          onOpenChange={(open) => {
            if (!open) {
              setFocusedField(null);
            }
          }}
          onValueChange={(value) => {
            const suggestion = localitySuggestions.find(
              (candidate) => localitySuggestionValue(candidate) === value
            );
            if (suggestion) {
              selectLocalitySuggestion(suggestion);
              focusNextFieldAfterLocalitySelect();
            }
          }}
          listboxId={localityListboxId}
          anchor={
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
              value={draft.postalCode}
              onFocus={() => handleAutocompleteFocus("postalCode")}
              onBlur={handleAutocompleteInputBlur}
              onChange={(event) => {
                const nextValue = event.target.value;
                onChange("postalCode", nextValue);
                applyPostalSuggestion(nextValue);
              }}
            />
          }
        >
          {showPostalSuggestions
            ? localitySuggestions.map((suggestion) => (
                <AutocompleteOption
                  key={`${suggestion.postal_code}-${suggestion.locality}`}
                  value={localitySuggestionValue(suggestion)}
                >
                  <span className="block font-medium">
                    {suggestion.postal_code}
                  </span>
                  <span className="text-muted-foreground block">
                    {suggestion.locality}
                  </span>
                </AutocompleteOption>
              ))
            : null}
        </AutocompleteListbox>
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
        <AutocompleteListbox
          open={showCitySuggestions}
          onOpenChange={(open) => {
            if (!open) {
              setFocusedField(null);
            }
          }}
          onValueChange={(value) => {
            const suggestion = localitySuggestions.find(
              (candidate) => localitySuggestionValue(candidate) === value
            );
            if (suggestion) {
              selectLocalitySuggestion(suggestion);
              focusNextFieldAfterLocalitySelect();
            }
          }}
          listboxId={localityListboxId}
          anchor={
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
              value={draft.city}
              onFocus={() => handleAutocompleteFocus("city")}
              onBlur={handleAutocompleteInputBlur}
              onChange={(event) => {
                const nextValue = event.target.value;
                onChange("city", nextValue);
                applyCitySuggestion(nextValue);
              }}
            />
          }
        >
          {showCitySuggestions
            ? localitySuggestions.map((suggestion) => (
                <AutocompleteOption
                  key={`${suggestion.locality}-${suggestion.postal_code}`}
                  value={localitySuggestionValue(suggestion)}
                >
                  <span className="block font-medium">
                    {suggestion.locality}
                  </span>
                  <span className="text-muted-foreground block">
                    {suggestion.postal_code}
                  </span>
                </AutocompleteOption>
              ))
            : null}
        </AutocompleteListbox>
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
        <AutocompleteListbox
          open={showStreetSuggestions}
          onOpenChange={(open) => {
            if (!open) {
              setFocusedField(null);
            }
          }}
          onValueChange={(value) => {
            const suggestion = streetSuggestions.find(
              (candidate) => streetSuggestionValue(candidate) === value
            );
            if (suggestion) {
              selectStreetSuggestion(suggestion);
              focusNextFieldAfterStreetSelect();
            }
          }}
          listboxId={streetListboxId}
          anchor={
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
              value={draft.street}
              onFocus={() => handleAutocompleteFocus("street")}
              onBlur={handleAutocompleteInputBlur}
              onChange={(event) => {
                const nextValue = event.target.value;
                onChange("street", nextValue);
                applyStreetSuggestion(nextValue);
              }}
            />
          }
        >
          {showStreetSuggestions
            ? streetSuggestions.map((suggestion) => (
                <AutocompleteOption
                  key={`${suggestion.name}-${suggestion.postal_code}-${suggestion.locality}`}
                  value={streetSuggestionValue(suggestion)}
                >
                  <span className="block font-medium">{suggestion.name}</span>
                  <span className="text-muted-foreground block">
                    {suggestion.postal_code} {suggestion.locality}
                  </span>
                </AutocompleteOption>
              ))
            : null}
        </AutocompleteListbox>
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
        <input
          type="hidden"
          name={fieldName("country")}
          value={selectedCountryOption?.code ?? ""}
          disabled={readOnly}
        />
        <CommandPopover
          label={i18n._(msg`Country`)}
          options={countryCommandOptions}
          value={selectedCountryOption?.code}
          placeholder={i18n._(msg`Search or select country`)}
          searchPlaceholder={i18n._(msg`Search or select country`)}
          emptyMessage={i18n._(msg`No results found`)}
          disabled={readOnly}
          onValueChange={(countryCode) => onChange("country", countryCode)}
        />
      </Field>
    </>
  );
}
