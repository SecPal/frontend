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
import { AddressDataAttribution } from "@/components/AddressDataAttribution";
import type { AddressReferenceMeta } from "@/types/api";

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

function AddressSuggestionFeedback({
  state,
  hasSuggestions,
  attribution,
  attributionId,
}: {
  state?: SuggestionRequestState;
  hasSuggestions: boolean;
  attribution: AddressReferenceMeta | null;
  attributionId: string;
}) {
  return (
    <>
      <div role="status">
        {!state || state.loading ? (
          <Description className="sr-only">
            <Trans>Loading...</Trans>
          </Description>
        ) : state.error ? (
          <ErrorMessage className="px-3 py-2">{state.error}</ErrorMessage>
        ) : !hasSuggestions ? (
          <Description className="px-3 py-2">
            <Trans>No address suggestions found.</Trans>
          </Description>
        ) : null}
      </div>
      {attribution ? (
        <div className="border-border border-t px-3 py-2">
          <AddressDataAttribution id={attributionId} meta={attribution} />
        </div>
      ) : null}
    </>
  );
}

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

interface EmployeeAddressFieldsProps {
  draft: PostalAddressDraft;
  onChange: (field: keyof PostalAddressDraft, value: string) => void;
  readOnly?: boolean;
  fieldIdPrefix?: string;
  fieldNamePrefix?: string;
  invalidFields?: Partial<Record<keyof PostalAddressDraft, boolean>>;
  fieldDescriptions?: Partial<Record<keyof PostalAddressDraft, string>>;
}

export function EmployeeAddressFields({
  draft,
  onChange,
  readOnly = false,
  fieldIdPrefix = "address",
  fieldNamePrefix = fieldIdPrefix,
  invalidFields = {},
  fieldDescriptions = {},
}: EmployeeAddressFieldsProps) {
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
  const [localityRequest, setLocalityRequest] = useState<
    (SuggestionRequestState & { queryKey: string }) | null
  >(null);

  const [attribution, setAttribution] = useState<AddressReferenceMeta | null>(
    null
  );
  const postalCodeInputRef = useRef<HTMLInputElement>(null);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const streetInputRef = useRef<HTMLInputElement>(null);
  const houseNumberInputRef = useRef<HTMLInputElement>(null);

  /** Delayed blur must not wipe focus when TAB moves between autocomplete fields. */
  const blurHideSuggestionsTimeoutRef = useRef<number | null>(null);

  const normalizedCountry = draft.country.trim().toUpperCase();
  const usesGermanAddressLookup =
    normalizedCountry === "" || normalizedCountry === "DE";
  const autocompleteEnabled = !readOnly && usesGermanAddressLookup;
  const postalCode = draft.postalCode.trim();
  const postalCodeQuery = /^[0-9]{1,5}$/.test(postalCode)
    ? postalCode
    : undefined;
  const locality = draft.city.trim();
  const localityQuery =
    locality.length >= 2 && locality.length <= 100 ? locality : undefined;
  const searchFromPostalCode =
    autocompleteEnabled &&
    focusedField === "postalCode" &&
    postalCodeQuery !== undefined;
  const searchFromCity =
    autocompleteEnabled &&
    focusedField === "city" &&
    localityQuery !== undefined;
  const searchLocalities = searchFromPostalCode || searchFromCity;
  const localityQueryKey = JSON.stringify([postalCodeQuery, localityQuery]);
  const localityRequestState =
    localityRequest?.queryKey === localityQueryKey
      ? localityRequest
      : undefined;

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
  const postalListboxId = `${fieldIdPrefix}-postal-listbox`;
  const cityListboxId = `${fieldIdPrefix}-city-listbox`;
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
        postalCode: postalCodeQuery,
        locality: localityQuery,
        limit: 8,
      })
        .then((result) => {
          if (cancelled) {
            return;
          }

          setStreetSuggestions(result.data);
          setAttribution(result.meta);
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
    draft.street,
    getAutocompleteErrorMessage,
    localityQuery,
    postalCodeQuery,
  ]);

  useEffect(() => {
    if (!searchLocalities) {
      const timeoutId = window.setTimeout(() => {
        setLocalitySuggestions([]);
        setLocalityRequest(null);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    let cancelled = false;

    const timeoutId = window.setTimeout(() => {
      setLocalityRequest({
        queryKey: localityQueryKey,
        loading: true,
        error: null,
        hasResolved: false,
      });

      void fetchAddressLocalitySuggestions({
        postalCode: postalCodeQuery,
        locality: localityQuery,
        limit: 8,
      })
        .then((result) => {
          if (cancelled) {
            return;
          }

          setLocalitySuggestions(result.data);
          setAttribution(result.meta);
          setLocalityRequest({
            queryKey: localityQueryKey,
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
          setLocalityRequest({
            queryKey: localityQueryKey,
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
    getAutocompleteErrorMessage,
    localityQuery,
    localityQueryKey,
    postalCodeQuery,
    searchLocalities,
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

  const showStreetPopup =
    autocompleteEnabled &&
    focusedField === "street" &&
    (streetRequestState.hasResolved || streetSuggestions.length > 0) &&
    draft.street.trim().length >= 2;
  const localitySuggestionsAreCurrent =
    localityRequestState?.hasResolved === true;
  const showLocalityPopup =
    localitySuggestionsAreCurrent || localitySuggestions.length > 0;
  const showPostalPopup = searchFromPostalCode && showLocalityPopup;
  const showCityPopup = searchFromCity && showLocalityPopup;

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

  function describedBy(field: keyof PostalAddressDraft, listboxId?: string) {
    return (
      [
        fieldDescriptions[field],
        listboxId && attribution ? `${listboxId}-attribution` : undefined,
      ]
        .filter(Boolean)
        .join(" ") || undefined
    );
  }

  function localityPopupFeedback(listboxId: string) {
    return (
      <AddressSuggestionFeedback
        state={localityRequestState}
        hasSuggestions={localitySuggestions.length > 0}
        attribution={attribution}
        attributionId={`${listboxId}-attribution`}
      />
    );
  }

  return (
    <>
      <Field>
        <Label htmlFor={fieldId("postal_code")}>
          <Trans>Postal Code</Trans>
        </Label>
        <AutocompleteListbox
          open={showPostalPopup}
          onOpenChange={(open) => {
            if (!open) {
              setFocusedField((field) =>
                field === "postalCode" ? null : field
              );
            }
          }}
          onValueChange={(value) => {
            if (!localitySuggestionsAreCurrent) return;
            const suggestion = localitySuggestions.find(
              (candidate) => localitySuggestionValue(candidate) === value
            );
            if (suggestion) {
              selectLocalitySuggestion(suggestion);
              focusNextFieldAfterLocalitySelect();
            }
          }}
          listboxId={postalListboxId}
          footer={
            showPostalPopup ? localityPopupFeedback(postalListboxId) : null
          }
          anchor={
            <Input
              ref={postalCodeInputRef}
              id={fieldId("postal_code")}
              name={fieldName("postal_code")}
              aria-busy={
                (searchFromPostalCode && localityRequestState?.loading) ||
                undefined
              }
              aria-invalid={invalidFields.postalCode || undefined}
              autoComplete="postal-code"
              inputMode={usesGermanAddressLookup ? "numeric" : undefined}
              disabled={readOnly}
              role="combobox"
              aria-autocomplete="list"
              aria-describedby={describedBy(
                "postalCode",
                showPostalPopup ? postalListboxId : undefined
              )}
              aria-expanded={showPostalPopup}
              aria-controls={postalListboxId}
              value={draft.postalCode}
              onFocus={() => handleAutocompleteFocus("postalCode")}
              onBlur={handleAutocompleteInputBlur}
              onChange={(event) => {
                const nextValue = event.target.value;
                handleAutocompleteFocus("postalCode");
                onChange("postalCode", nextValue);
                applyPostalSuggestion(nextValue);
              }}
            />
          }
        >
          {showPostalPopup
            ? localitySuggestions.map((suggestion) => (
                <AutocompleteOption
                  key={`${suggestion.postal_code}-${suggestion.locality}`}
                  value={localitySuggestionValue(suggestion)}
                  disabled={!localitySuggestionsAreCurrent}
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
      </Field>

      <Field>
        <Label htmlFor={fieldId("city")}>
          <Trans>City</Trans>
        </Label>
        <AutocompleteListbox
          open={showCityPopup}
          onOpenChange={(open) => {
            if (!open) {
              setFocusedField((field) => (field === "city" ? null : field));
            }
          }}
          onValueChange={(value) => {
            if (!localitySuggestionsAreCurrent) return;
            const suggestion = localitySuggestions.find(
              (candidate) => localitySuggestionValue(candidate) === value
            );
            if (suggestion) {
              selectLocalitySuggestion(suggestion);
              focusNextFieldAfterLocalitySelect();
            }
          }}
          listboxId={cityListboxId}
          footer={showCityPopup ? localityPopupFeedback(cityListboxId) : null}
          anchor={
            <Input
              ref={cityInputRef}
              id={fieldId("city")}
              name={fieldName("city")}
              aria-busy={
                (searchFromCity && localityRequestState?.loading) || undefined
              }
              aria-invalid={invalidFields.city || undefined}
              autoComplete="address-level2"
              disabled={readOnly}
              role="combobox"
              aria-autocomplete="list"
              aria-describedby={describedBy(
                "city",
                showCityPopup ? cityListboxId : undefined
              )}
              aria-expanded={showCityPopup}
              aria-controls={cityListboxId}
              value={draft.city}
              onFocus={() => handleAutocompleteFocus("city")}
              onBlur={handleAutocompleteInputBlur}
              onChange={(event) => {
                const nextValue = event.target.value;
                handleAutocompleteFocus("city");
                onChange("city", nextValue);
                applyCitySuggestion(nextValue);
              }}
            />
          }
        >
          {showCityPopup
            ? localitySuggestions.map((suggestion) => (
                <AutocompleteOption
                  key={`${suggestion.locality}-${suggestion.postal_code}`}
                  value={localitySuggestionValue(suggestion)}
                  disabled={!localitySuggestionsAreCurrent}
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
      </Field>

      <Field>
        <Label htmlFor={fieldId("street")}>
          <Trans>Street</Trans>
        </Label>
        <AutocompleteListbox
          open={showStreetPopup}
          onOpenChange={(open) => {
            if (!open) {
              setFocusedField((field) => (field === "street" ? null : field));
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
          footer={
            showStreetPopup ? (
              <AddressSuggestionFeedback
                state={streetRequestState}
                hasSuggestions={streetSuggestions.length > 0}
                attribution={attribution}
                attributionId={`${streetListboxId}-attribution`}
              />
            ) : null
          }
          anchor={
            <Input
              ref={streetInputRef}
              id={fieldId("street")}
              name={fieldName("street")}
              aria-busy={streetRequestState.loading || undefined}
              aria-invalid={invalidFields.street || undefined}
              autoComplete="street-address"
              disabled={readOnly}
              role="combobox"
              aria-autocomplete="list"
              aria-describedby={describedBy(
                "street",
                showStreetPopup ? streetListboxId : undefined
              )}
              aria-expanded={showStreetPopup}
              aria-controls={streetListboxId}
              value={draft.street}
              onFocus={() => handleAutocompleteFocus("street")}
              onBlur={handleAutocompleteInputBlur}
              onChange={(event) => {
                const nextValue = event.target.value;
                handleAutocompleteFocus("street");
                onChange("street", nextValue);
                applyStreetSuggestion(nextValue);
              }}
            />
          }
        >
          {showStreetPopup
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
      </Field>

      <Field>
        <Label htmlFor={fieldId("house_number")}>
          <Trans>House Number</Trans>
        </Label>
        <Input
          ref={houseNumberInputRef}
          id={fieldId("house_number")}
          name={fieldName("house_number")}
          aria-invalid={invalidFields.houseNumber || undefined}
          aria-describedby={describedBy("houseNumber")}
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
          aria-invalid={invalidFields.supplement || undefined}
          aria-describedby={describedBy("supplement")}
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
          invalid={invalidFields.country}
          describedBy={describedBy("country")}
          onValueChange={(countryCode) => onChange("country", countryCode)}
        />
      </Field>
    </>
  );
}
