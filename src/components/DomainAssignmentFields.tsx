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
  const effectiveLegalEntityId =
    value.legal_entity_id || (required ? soleLegalEntityId : "");
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
  const customers =
    customerResult.establishmentId === value.establishment_id
      ? customerResult.items
      : [];
  const customerError =
    customerResult.establishmentId === value.establishment_id
      ? customerResult.error
      : null;
  const loadingCustomers = Boolean(
    includeCustomer &&
    value.establishment_id &&
    customerResult.establishmentId !== value.establishment_id
  );

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
    if (required && !value.legal_entity_id && soleLegalEntityId) {
      onChange({
        legal_entity_id: soleLegalEntityId,
        establishment_id: "",
        customer_id: includeCustomer
          ? (fixedCustomerId ?? "")
          : value.customer_id,
      });
    }
    // `onChange` is intentionally omitted: this synchronization is driven by
    // lookup/value changes, while callers commonly pass an inline callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    includeCustomer,
    fixedCustomerId,
    required,
    soleLegalEntityId,
    value.customer_id,
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
    const request = ++customerRequest.current;
    if (!includeCustomer || !value.establishment_id) {
      return;
    }
    void listCustomerLookups(value.establishment_id)
      .then((items) => {
        if (request !== customerRequest.current) return;
        setCustomerResult({
          establishmentId: value.establishment_id,
          items,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (request === customerRequest.current)
          setCustomerResult({
            establishmentId: value.establishment_id,
            items: [],
            error:
              error instanceof Error
                ? error.message
                : _(msg`Failed to load customers`),
          });
      });
  }, [_, includeCustomer, value.establishment_id]);

  function errorId(field: keyof DomainAssignmentValue) {
    const suffix =
      field === "legal_entity_id"
        ? "legal-entity"
        : field === "establishment_id"
          ? "establishment"
          : "customer";
    return errors[field] ? `${idPrefix}-${suffix}-error` : undefined;
  }

  function errorText(field: keyof DomainAssignmentValue) {
    const error = errors[field];
    return Array.isArray(error) ? error.join(", ") : error;
  }

  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-legal-entity`}>
          <Trans>Legal Entity</Trans>
          {required && " *"}
        </FieldLabel>
        <Select
          value={effectiveLegalEntityId}
          onValueChange={(legal_entity_id) => {
            establishmentRequest.current += 1;
            customerRequest.current += 1;
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
            aria-describedby={errorId("legal_entity_id")}
            disabled={
              disabled ||
              loadingLegalEntities ||
              (required && legalEntities.length === 1)
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
        {legalEntityError && <FieldError>{legalEntityError}</FieldError>}
        {errors.legal_entity_id && (
          <FieldError id={errorId("legal_entity_id")}>
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
            aria-describedby={errorId("establishment_id")}
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
        {establishmentError && <FieldError>{establishmentError}</FieldError>}
        {errors.establishment_id && (
          <FieldError id={errorId("establishment_id")}>
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
            value={fixedCustomerId ?? value.customer_id ?? ""}
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
              aria-describedby={errorId("customer_id")}
              disabled={
                disabled ||
                loadingCustomers ||
                !value.establishment_id ||
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
          {customerError && <FieldError>{customerError}</FieldError>}
          {errors.customer_id && (
            <FieldError id={errorId("customer_id")}>
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
