// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { useEffect, useRef, useState } from "react";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import type {
  CustomerLookup,
  EstablishmentLookup,
  LegalEntityLookup,
} from "@/types/api/customers";
import { Field, FieldError, FieldLabel } from "@/ui";
import { Button } from "@/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { listCustomerLegalEntities } from "../services/customerLegalEntitiesApi";
import {
  listCustomerLookups,
  listEstablishmentLookups,
} from "../services/customerDomainApi";

export interface DomainAssignmentValue {
  legal_entity_id: string;
  establishment_id: string;
  customer_id?: string;
}

interface DomainAssignmentFieldsProps {
  value: DomainAssignmentValue;
  onChange: (value: DomainAssignmentValue) => void;
  includeCustomer?: boolean;
  errors?: Partial<Record<keyof DomainAssignmentValue, string | string[]>>;
  disabled?: boolean;
  idPrefix?: string;
  required?: boolean;
  onClearErrors?: (fields: Array<keyof DomainAssignmentValue>) => void;
  fixedCustomerId?: string;
  triggerRefs?: Partial<
    Record<
      keyof DomainAssignmentValue,
      (element: HTMLButtonElement | null) => void
    >
  >;
}

export function DomainAssignmentFields({
  value,
  onChange,
  includeCustomer = false,
  errors = {},
  disabled = false,
  idPrefix = "domain-assignment",
  required = true,
  onClearErrors,
  fixedCustomerId,
  triggerRefs,
}: DomainAssignmentFieldsProps) {
  const { _ } = useLingui();
  const [legalEntities, setLegalEntities] = useState<LegalEntityLookup[]>([]);
  const [establishmentResult, setEstablishmentResult] = useState<{
    legalEntityId: string;
    items: EstablishmentLookup[];
    error: string | null;
  }>({ legalEntityId: "", items: [], error: null });
  const [customerResult, setCustomerResult] = useState<{
    establishmentId: string;
    items: CustomerLookup[];
    error: string | null;
  }>({ establishmentId: "", items: [], error: null });
  const [loadingLegalEntities, setLoadingLegalEntities] = useState(true);
  const [legalEntityError, setLegalEntityError] = useState<string | null>(null);
  const establishmentRequest = useRef(0);
  const customerRequest = useRef(0);
  const soleLegalEntityId =
    legalEntities.length === 1 ? legalEntities[0]!.id : "";
  const legalEntitiesLoaded = !loadingLegalEntities && !legalEntityError;
  const legalEntityIsAuthorized = legalEntities.some(
    (item) => item.id === value.legal_entity_id
  );
  const effectiveLegalEntityId = legalEntitiesLoaded
    ? legalEntityIsAuthorized
      ? value.legal_entity_id
      : required
        ? soleLegalEntityId
        : ""
    : "";
  const establishments =
    establishmentResult.legalEntityId === effectiveLegalEntityId
      ? establishmentResult.items
      : [];
  const establishmentError =
    establishmentResult.legalEntityId === effectiveLegalEntityId
      ? establishmentResult.error
      : null;
  const loadingEstablishments = Boolean(
    effectiveLegalEntityId &&
    establishmentResult.legalEntityId !== effectiveLegalEntityId
  );
  const establishmentsLoaded = Boolean(
    effectiveLegalEntityId &&
    establishmentResult.legalEntityId === effectiveLegalEntityId &&
    !establishmentResult.error
  );
  const establishmentIsAuthorized = establishments.some(
    (item) => item.id === value.establishment_id
  );
  const effectiveEstablishmentId =
    establishmentsLoaded && establishmentIsAuthorized
      ? value.establishment_id
      : "";
  const customers =
    customerResult.establishmentId === effectiveEstablishmentId
      ? customerResult.items
      : [];
  const customerError =
    customerResult.establishmentId === effectiveEstablishmentId
      ? customerResult.error
      : null;
  const loadingCustomers = Boolean(
    includeCustomer &&
    effectiveEstablishmentId &&
    customerResult.establishmentId !== effectiveEstablishmentId
  );
  const customersLoaded = Boolean(
    effectiveEstablishmentId &&
    customerResult.establishmentId === effectiveEstablishmentId &&
    !customerResult.error
  );
  const selectedCustomerId = fixedCustomerId ?? value.customer_id ?? "";
  const customerIsAuthorized = customers.some(
    (item) => item.id === selectedCustomerId
  );
  const displayedLegalEntityId =
    value.legal_entity_id || (required ? soleLegalEntityId : "");

  useEffect(() => {
    let active = true;
    void listCustomerLegalEntities()
      .then((items) => {
        if (!active) return;
        setLegalEntities(items);
        setLegalEntityError(null);
      })
      .catch((error: unknown) => {
        if (active)
          setLegalEntityError(
            error instanceof Error
              ? error.message
              : _(msg`Failed to load legal entities`)
          );
      })
      .finally(() => {
        if (active) setLoadingLegalEntities(false);
      });
    return () => {
      active = false;
    };
    // Initial lookup only; selection changes are handled by the dependent effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!legalEntitiesLoaded || legalEntityIsAuthorized) return;

    const legal_entity_id = required ? soleLegalEntityId : "";
    const customer_id = includeCustomer
      ? (fixedCustomerId ?? "")
      : value.customer_id;
    if (
      value.legal_entity_id === legal_entity_id &&
      !value.establishment_id &&
      value.customer_id === customer_id
    )
      return;

    establishmentRequest.current += 1;
    customerRequest.current += 1;
    onClearErrors?.(["legal_entity_id", "establishment_id", "customer_id"]);
    onChange({ legal_entity_id, establishment_id: "", customer_id });
    // `onChange` is intentionally omitted: this synchronization is driven by
    // lookup/value changes, while callers commonly pass an inline callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    includeCustomer,
    fixedCustomerId,
    legalEntitiesLoaded,
    legalEntityIsAuthorized,
    required,
    soleLegalEntityId,
    value.customer_id,
    value.establishment_id,
    value.legal_entity_id,
  ]);

  useEffect(() => {
    const request = ++establishmentRequest.current;
    if (!effectiveLegalEntityId) {
      return;
    }
    void listEstablishmentLookups(effectiveLegalEntityId)
      .then((items) => {
        if (request !== establishmentRequest.current) return;
        setEstablishmentResult({
          legalEntityId: effectiveLegalEntityId,
          items,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (request === establishmentRequest.current)
          setEstablishmentResult({
            legalEntityId: effectiveLegalEntityId,
            items: [],
            error:
              error instanceof Error
                ? error.message
                : _(msg`Failed to load establishments`),
          });
      });
  }, [_, effectiveLegalEntityId]);

  useEffect(() => {
    if (
      !establishmentsLoaded ||
      !value.establishment_id ||
      establishmentIsAuthorized
    )
      return;

    customerRequest.current += 1;
    onClearErrors?.(["establishment_id", "customer_id"]);
    onChange({
      ...value,
      legal_entity_id: effectiveLegalEntityId,
      establishment_id: "",
      customer_id: includeCustomer
        ? (fixedCustomerId ?? "")
        : value.customer_id,
    });
    // `onChange` is intentionally omitted: see the legal-entity synchronization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    effectiveLegalEntityId,
    establishmentIsAuthorized,
    establishmentsLoaded,
    fixedCustomerId,
    includeCustomer,
    value.customer_id,
    value.establishment_id,
    value.legal_entity_id,
  ]);

  useEffect(() => {
    const request = ++customerRequest.current;
    if (!includeCustomer || !effectiveEstablishmentId) {
      return;
    }
    void listCustomerLookups(effectiveEstablishmentId)
      .then((items) => {
        if (request !== customerRequest.current) return;
        setCustomerResult({
          establishmentId: effectiveEstablishmentId,
          items,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (request === customerRequest.current)
          setCustomerResult({
            establishmentId: effectiveEstablishmentId,
            items: [],
            error:
              error instanceof Error
                ? error.message
                : _(msg`Failed to load customers`),
          });
      });
  }, [_, effectiveEstablishmentId, includeCustomer]);

  useEffect(() => {
    if (
      !includeCustomer ||
      !customersLoaded ||
      !selectedCustomerId ||
      customerIsAuthorized
    )
      return;

    if (fixedCustomerId) {
      customerRequest.current += 1;
      onClearErrors?.(["establishment_id", "customer_id"]);
      onChange({
        ...value,
        establishment_id: "",
        customer_id: fixedCustomerId,
      });
    } else {
      onClearErrors?.(["customer_id"]);
      onChange({ ...value, customer_id: "" });
    }
    // `onChange` is intentionally omitted: see the legal-entity synchronization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    customerIsAuthorized,
    customersLoaded,
    fixedCustomerId,
    includeCustomer,
    selectedCustomerId,
    value.customer_id,
    value.establishment_id,
    value.legal_entity_id,
  ]);

  function fieldSuffix(field: keyof DomainAssignmentValue) {
    return field === "legal_entity_id"
      ? "legal-entity"
      : field === "establishment_id"
        ? "establishment"
        : "customer";
  }

  function validationErrorId(field: keyof DomainAssignmentValue) {
    const suffix = fieldSuffix(field);
    return errors[field] ? `${idPrefix}-${suffix}-error` : undefined;
  }

  function lookupError(field: keyof DomainAssignmentValue) {
    return field === "legal_entity_id"
      ? legalEntityError
      : field === "establishment_id"
        ? establishmentError
        : customerError;
  }

  function lookupErrorId(field: keyof DomainAssignmentValue) {
    return lookupError(field)
      ? `${idPrefix}-${fieldSuffix(field)}-lookup-error`
      : undefined;
  }

  function describedBy(field: keyof DomainAssignmentValue) {
    return (
      [lookupErrorId(field), validationErrorId(field)]
        .filter(Boolean)
        .join(" ") || undefined
    );
  }

  function errorText(field: keyof DomainAssignmentValue) {
    const error = errors[field];
    return Array.isArray(error) ? error.join(", ") : error;
  }

  function invalidateEstablishmentLookup() {
    setEstablishmentResult({ legalEntityId: "", items: [], error: null });
    invalidateCustomerLookup();
  }

  function invalidateCustomerLookup() {
    setCustomerResult({ establishmentId: "", items: [], error: null });
  }

  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-legal-entity`}>
          <Trans>Legal Entity</Trans>
          {required && " *"}
        </FieldLabel>
        <Select
          value={displayedLegalEntityId}
          onValueChange={(legal_entity_id) => {
            establishmentRequest.current += 1;
            customerRequest.current += 1;
            invalidateEstablishmentLookup();
            onClearErrors?.([
              "legal_entity_id",
              "establishment_id",
              "customer_id",
            ]);
            onChange({
              legal_entity_id,
              establishment_id: "",
              customer_id: includeCustomer
                ? (fixedCustomerId ?? "")
                : value.customer_id,
            });
          }}
        >
          <SelectTrigger
            ref={triggerRefs?.legal_entity_id}
            id={`${idPrefix}-legal-entity`}
            aria-required={required || undefined}
            aria-invalid={Boolean(errors.legal_entity_id) || undefined}
            aria-describedby={describedBy("legal_entity_id")}
            disabled={
              disabled ||
              loadingLegalEntities ||
              (required &&
                Boolean(soleLegalEntityId) &&
                effectiveLegalEntityId === soleLegalEntityId)
            }
          >
            <SelectValue placeholder={_(msg`Select legal entity...`)} />
          </SelectTrigger>
          <SelectContent>
            {legalEntities.map((item) => (
              <SelectItem key={item.id} value={item.id} data-value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {legalEntityError && (
          <FieldError id={lookupErrorId("legal_entity_id")}>
            {legalEntityError}
          </FieldError>
        )}
        {errors.legal_entity_id && (
          <FieldError id={validationErrorId("legal_entity_id")}>
            {errorText("legal_entity_id")}
          </FieldError>
        )}
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-establishment`}>
          <Trans>Establishment</Trans>
          {required && " *"}
        </FieldLabel>
        <Select
          value={value.establishment_id}
          onValueChange={(establishment_id) => {
            customerRequest.current += 1;
            invalidateCustomerLookup();
            onClearErrors?.(["establishment_id", "customer_id"]);
            onChange({
              ...value,
              legal_entity_id: effectiveLegalEntityId,
              establishment_id,
              customer_id: includeCustomer
                ? (fixedCustomerId ?? "")
                : value.customer_id,
            });
          }}
        >
          <SelectTrigger
            ref={triggerRefs?.establishment_id}
            id={`${idPrefix}-establishment`}
            aria-required={required || undefined}
            aria-invalid={Boolean(errors.establishment_id) || undefined}
            aria-describedby={describedBy("establishment_id")}
            disabled={
              disabled || loadingEstablishments || !effectiveLegalEntityId
            }
          >
            <SelectValue placeholder={_(msg`Select establishment...`)} />
          </SelectTrigger>
          <SelectContent>
            {establishments.map((item) => (
              <SelectItem key={item.id} value={item.id} data-value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {establishmentError && (
          <FieldError id={lookupErrorId("establishment_id")}>
            {establishmentError}
          </FieldError>
        )}
        {errors.establishment_id && (
          <FieldError id={validationErrorId("establishment_id")}>
            {errorText("establishment_id")}
          </FieldError>
        )}
      </Field>
      {includeCustomer && (
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-customer`}>
            <Trans>Customer</Trans>
            {required && " *"}
          </FieldLabel>
          <Select
            value={selectedCustomerId}
            onValueChange={(customer_id) => {
              onClearErrors?.(["customer_id"]);
              onChange({
                ...value,
                legal_entity_id: effectiveLegalEntityId,
                customer_id,
              });
            }}
          >
            <SelectTrigger
              ref={triggerRefs?.customer_id}
              id={`${idPrefix}-customer`}
              aria-required={required || undefined}
              aria-invalid={Boolean(errors.customer_id) || undefined}
              aria-describedby={describedBy("customer_id")}
              disabled={
                disabled ||
                loadingCustomers ||
                !effectiveEstablishmentId ||
                Boolean(fixedCustomerId)
              }
            >
              <SelectValue placeholder={_(msg`Select customer...`)} />
            </SelectTrigger>
            <SelectContent>
              {customers.map((item) => (
                <SelectItem key={item.id} value={item.id} data-value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {customerError && (
            <FieldError id={lookupErrorId("customer_id")}>
              {customerError}
            </FieldError>
          )}
          {errors.customer_id && (
            <FieldError id={validationErrorId("customer_id")}>
              {errorText("customer_id")}
            </FieldError>
          )}
        </Field>
      )}
      {!required && (value.legal_entity_id || value.establishment_id) && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            establishmentRequest.current += 1;
            customerRequest.current += 1;
            invalidateEstablishmentLookup();
            onClearErrors?.([
              "legal_entity_id",
              "establishment_id",
              "customer_id",
            ]);
            onChange({
              legal_entity_id: "",
              establishment_id: "",
              customer_id: includeCustomer ? "" : value.customer_id,
            });
          }}
        >
          <Trans>Clear domain filters</Trans>
        </Button>
      )}
    </>
  );
}
