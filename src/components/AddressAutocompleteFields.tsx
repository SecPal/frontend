// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  SearchableAutocompleteListbox as AutocompleteListbox,
  SearchableAutocompleteOption as AutocompleteOption,
  Field,
  FieldDescription as Description,
  FieldError as ErrorMessage,
  FieldLabel as Label,
  Input,
} from "@/ui";
import { ApiError } from "@/services/ApiError";
import {
  fetchAddressLocalitySuggestions,
  fetchAddressStreetSuggestions,
  type AddressLocalitySuggestion,
  type AddressStreetSuggestion,
} from "@/services/addressApi";
import { AddressDataAttribution } from "@/components/AddressDataAttribution";
import type { Address, AddressReferenceMeta } from "@/types/api";

interface SuggestionRequestState {
  queryKey: string;
  loading: boolean;
  error: string | null;
  hasResolved: boolean;
}

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

type AddressFieldsValue = Pick<
  Address,
  "street" | "house_number" | "city" | "postal_code" | "country"
>;
type AddressField = Exclude<keyof AddressFieldsValue, "country">;
type SearchField = Exclude<AddressField, "house_number">;
type LocalityField = Exclude<SearchField, "street">;

interface AddressAutocompleteFieldsProps {
  address: AddressFieldsValue;
  onChange: (field: AddressField, value: string) => void;
  readOnly?: boolean;
  required?: boolean;
  fieldIdPrefix: string;
  fieldNamePrefix?: string;
  invalidFields?: Partial<Record<AddressField, boolean>>;
  fieldDescriptions?: Partial<Record<AddressField, string>>;
  fieldErrors?: Partial<Record<AddressField, string>>;
}

export function AddressAutocompleteFields({
  address,
  onChange,
  readOnly = false,
  required = false,
  fieldIdPrefix,
  fieldNamePrefix = fieldIdPrefix,
  invalidFields = {},
  fieldDescriptions = {},
  fieldErrors = {},
}: AddressAutocompleteFieldsProps) {
  const { i18n } = useLingui();
  const [focusedField, setFocusedField] = useState<SearchField | null>(null);
  const [streetSuggestions, setStreetSuggestions] = useState<
    AddressStreetSuggestion[]
  >([]);
  const [localitySuggestions, setLocalitySuggestions] = useState<
    AddressLocalitySuggestion[]
  >([]);
  const [streetRequest, setStreetRequest] =
    useState<SuggestionRequestState | null>(null);
  const [localityRequest, setLocalityRequest] =
    useState<SuggestionRequestState | null>(null);

  const [attribution, setAttribution] = useState<AddressReferenceMeta | null>(
    null
  );
  const postalCodeInputRef = useRef<HTMLInputElement>(null);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const streetInputRef = useRef<HTMLInputElement>(null);
  const houseNumberInputRef = useRef<HTMLInputElement>(null);

  /** Delayed blur must not wipe focus when TAB moves between autocomplete fields. */
  const blurHideSuggestionsTimeoutRef = useRef<number | null>(null);

  const normalizedCountry = address.country.trim().toUpperCase();
  const usesGermanAddressLookup =
    normalizedCountry === "" || normalizedCountry === "DE";
  const autocompleteEnabled = !readOnly && usesGermanAddressLookup;
  const postalCode = address.postal_code.trim();
  const postalCodeQuery = /^[0-9]{1,5}$/.test(postalCode)
    ? postalCode
    : undefined;
  const locality = address.city.trim();
  const localityQuery =
    locality.length >= 2 && locality.length <= 100 ? locality : undefined;
  const streetQuery = address.street.trim();
  const searchFromStreet =
    autocompleteEnabled && focusedField === "street" && streetQuery.length >= 2;
  const searchFromPostalCode =
    autocompleteEnabled &&
    focusedField === "postal_code" &&
    postalCodeQuery !== undefined;
  const searchFromCity =
    autocompleteEnabled &&
    focusedField === "city" &&
    localityQuery !== undefined;
  const searchLocalities = searchFromPostalCode || searchFromCity;
  const streetQueryKey = JSON.stringify([
    streetQuery,
    postalCodeQuery,
    localityQuery,
  ]);
  const streetRequestState =
    streetRequest?.queryKey === streetQueryKey ? streetRequest : undefined;
  const localityQueryKey = JSON.stringify([postalCodeQuery, localityQuery]);
  const localityRequestState =
    localityRequest?.queryKey === localityQueryKey
      ? localityRequest
      : undefined;

  const fieldId = (field: AddressField) => `${fieldIdPrefix}_${field}`;
  const fieldName = (field: AddressField) =>
    fieldNamePrefix ? `${fieldNamePrefix}_${field}` : field;
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
    if (!searchFromStreet) {
      const timeoutId = window.setTimeout(() => {
        setStreetSuggestions([]);
        setStreetRequest(null);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    let cancelled = false;

    const timeoutId = window.setTimeout(() => {
      setStreetRequest({
        queryKey: streetQueryKey,
        loading: true,
        error: null,
        hasResolved: false,
      });

      void fetchAddressStreetSuggestions({
        name: streetQuery,
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
          setStreetRequest({
            queryKey: streetQueryKey,
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
          setStreetRequest({
            queryKey: streetQueryKey,
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
    postalCodeQuery,
    searchFromStreet,
    streetQuery,
    streetQueryKey,
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

  function handleAutocompleteFocus(field: SearchField): void {
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

  function applyStreetSuggestion(suggestion: AddressStreetSuggestion) {
    onChange("street", suggestion.name);
    onChange("postal_code", suggestion.postal_code);
    onChange("city", suggestion.locality);
  }

  function applyExactStreetSuggestion(name: string) {
    if (!streetSuggestionsAreCurrent) return;

    const matches = streetSuggestions.filter(
      (suggestion) => suggestion.name === name
    );
    const match = matches[0];
    if (matches.length === 1 && match) applyStreetSuggestion(match);
  }

  function applyExactLocalitySuggestion(field: LocalityField, value: string) {
    if (!localitySuggestionsAreCurrent) return;

    const isPostalCode = field === "postal_code";
    const primary = isPostalCode ? "postal_code" : "locality";
    const matches = localitySuggestions.filter(
      (suggestion) => suggestion[primary] === value
    );
    const match = matches[0];
    if (matches.length !== 1 || !match) return;

    onChange(
      isPostalCode ? "city" : "postal_code",
      isPostalCode ? match.locality : match.postal_code
    );
  }

  function selectLocalitySuggestion(value: string | null) {
    if (!localitySuggestionsAreCurrent) return;
    const suggestion = localitySuggestions.find(
      (candidate) => localitySuggestionValue(candidate) === value
    );
    if (!suggestion) return;

    onChange("postal_code", suggestion.postal_code);
    onChange("city", suggestion.locality);
    setFocusedField(null);
    window.requestAnimationFrame(() => {
      streetInputRef.current?.focus();
    });
  }

  const streetSuggestionsAreCurrent =
    autocompleteEnabled && streetRequestState?.hasResolved === true;
  const showStreetPopup =
    searchFromStreet &&
    (streetSuggestionsAreCurrent || streetSuggestions.length > 0);
  const localitySuggestionsAreCurrent =
    autocompleteEnabled && localityRequestState?.hasResolved === true;
  const showLocalityPopup =
    localitySuggestionsAreCurrent || localitySuggestions.length > 0;

  function isInvalid(field: AddressField) {
    return invalidFields[field] || Boolean(fieldErrors[field]) || undefined;
  }

  function fieldErrorId(field: AddressField) {
    return `${fieldId(field)}-error`;
  }

  function fieldError(field: AddressField) {
    const error = fieldErrors[field];
    return error ? (
      <ErrorMessage id={fieldErrorId(field)}>{error}</ErrorMessage>
    ) : null;
  }

  function describedBy(field: AddressField, listboxId?: string) {
    return (
      [
        fieldDescriptions[field],
        fieldErrors[field] ? fieldErrorId(field) : undefined,
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

  function localityOptions(primary: "postal_code" | "locality") {
    const secondary = primary === "postal_code" ? "locality" : "postal_code";
    return localitySuggestions.map((suggestion) => {
      const value = localitySuggestionValue(suggestion);
      return (
        <AutocompleteOption
          slotPrefix="address"
          key={value}
          value={value}
          disabled={!localitySuggestionsAreCurrent}
        >
          <span className="block font-medium">{suggestion[primary]}</span>
          <span className="text-muted-foreground block">
            {suggestion[secondary]}
          </span>
        </AutocompleteOption>
      );
    });
  }

  return (
    <>
      {(["postal_code", "city"] as const).map((field) => {
        const isPostalCode = field === "postal_code";
        const searching = isPostalCode ? searchFromPostalCode : searchFromCity;
        const open = searching && showLocalityPopup;
        const listboxId = isPostalCode ? postalListboxId : cityListboxId;

        return (
          <Field key={field}>
            <Label htmlFor={fieldId(field)}>
              {isPostalCode ? <Trans>Postal Code</Trans> : <Trans>City</Trans>}
              {required && " *"}
            </Label>
            <AutocompleteListbox
              slotPrefix="address"
              open={open}
              onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                  setFocusedField((focused) =>
                    focused === field ? null : focused
                  );
                }
              }}
              onValueChange={selectLocalitySuggestion}
              listboxId={listboxId}
              footer={open ? localityPopupFeedback(listboxId) : null}
              anchor={
                <Input
                  ref={isPostalCode ? postalCodeInputRef : cityInputRef}
                  id={fieldId(field)}
                  name={fieldName(field)}
                  required={required}
                  aria-busy={
                    (searching && localityRequestState?.loading) || undefined
                  }
                  aria-invalid={isInvalid(field)}
                  autoComplete={isPostalCode ? "postal-code" : "address-level2"}
                  inputMode={
                    isPostalCode && usesGermanAddressLookup
                      ? "numeric"
                      : undefined
                  }
                  disabled={readOnly}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-describedby={describedBy(
                    field,
                    open ? listboxId : undefined
                  )}
                  aria-expanded={open}
                  aria-controls={listboxId}
                  value={address[field]}
                  onFocus={() => handleAutocompleteFocus(field)}
                  onBlur={handleAutocompleteInputBlur}
                  onChange={(event) => {
                    const value = event.target.value;
                    handleAutocompleteFocus(field);
                    onChange(field, value);
                    applyExactLocalitySuggestion(field, value);
                  }}
                />
              }
            >
              {open
                ? localityOptions(isPostalCode ? "postal_code" : "locality")
                : null}
            </AutocompleteListbox>
            {fieldError(field)}
          </Field>
        );
      })}

      <Field>
        <Label htmlFor={fieldId("street")}>
          <Trans>Street</Trans>
          {required && " *"}
        </Label>
        <AutocompleteListbox
          slotPrefix="address"
          open={showStreetPopup}
          onOpenChange={(open) => {
            if (!open) {
              setFocusedField((field) => (field === "street" ? null : field));
            }
          }}
          onValueChange={(value) => {
            if (!streetSuggestionsAreCurrent) return;
            const suggestion = streetSuggestions.find(
              (candidate) => streetSuggestionValue(candidate) === value
            );
            if (suggestion) {
              applyStreetSuggestion(suggestion);
              setFocusedField(null);
              window.requestAnimationFrame(() => {
                houseNumberInputRef.current?.focus();
              });
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
              required={required}
              aria-busy={
                (searchFromStreet && streetRequestState?.loading) || undefined
              }
              aria-invalid={isInvalid("street")}
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
              value={address.street}
              onFocus={() => handleAutocompleteFocus("street")}
              onBlur={handleAutocompleteInputBlur}
              onChange={(event) => {
                const nextValue = event.target.value;
                handleAutocompleteFocus("street");
                onChange("street", nextValue);
                applyExactStreetSuggestion(nextValue);
              }}
            />
          }
        >
          {showStreetPopup
            ? streetSuggestions.map((suggestion) => (
                <AutocompleteOption
                  slotPrefix="address"
                  key={`${suggestion.name}-${suggestion.postal_code}-${suggestion.locality}`}
                  value={streetSuggestionValue(suggestion)}
                  disabled={!streetSuggestionsAreCurrent}
                >
                  <span className="block font-medium">{suggestion.name}</span>
                  <span className="text-muted-foreground block">
                    {suggestion.postal_code} {suggestion.locality}
                  </span>
                </AutocompleteOption>
              ))
            : null}
        </AutocompleteListbox>
        {fieldError("street")}
      </Field>

      <Field>
        <Label htmlFor={fieldId("house_number")}>
          <Trans>House Number</Trans>
        </Label>
        <Input
          ref={houseNumberInputRef}
          id={fieldId("house_number")}
          name={fieldName("house_number")}
          aria-invalid={isInvalid("house_number")}
          aria-describedby={describedBy("house_number")}
          disabled={readOnly}
          value={address.house_number ?? ""}
          onChange={(event) => onChange("house_number", event.target.value)}
        />
        {fieldError("house_number")}
      </Field>
    </>
  );
}
