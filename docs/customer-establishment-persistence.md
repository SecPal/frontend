<!--
SPDX-FileCopyrightText: 2026 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Customer-Establishment Persistence Contract

## Status and Scope

This is the binding persistence target for the API migration. It refines the
approved fail-closed rules in
`docs/legal-entity-customer-migration.md`; it does not authorize a default or
inferred assignment. The API migration and models must implement this contract
atomically before the relationship endpoints are enabled.

## Relationship Table

`customer_establishments` contains `id`, `tenant_id`, `customer_id`,
`establishment_id`, `contact`, `notes`, `created_at`, and `updated_at`.
Identifiers are UUIDs, `tenant_id` uses the tenant key type, `contact` is
nullable JSONB, and `notes` is nullable text. The relationship has no soft
delete: removing it removes the current association while the activity log
retains the audit history.

The database must enforce all of the following named constraints and indexes:

```sql
PRIMARY KEY (id)
UNIQUE (customer_id, establishment_id)
FOREIGN KEY (tenant_id, customer_id) REFERENCES customers (tenant_id, id)
FOREIGN KEY (tenant_id, establishment_id) REFERENCES organizational_units (tenant_id, id)
INDEX idx_customer_establishments_tenant_customer (tenant_id, customer_id)
INDEX idx_customer_establishments_tenant_establishment (tenant_id, establishment_id)
```

The composite foreign keys are mandatory, not application-only checks. Their
referenced `(tenant_id, id)` pairs must be unique. Application validation also
rejects a deleted unit or a unit for which `is_establishment`, `is_active`, or
`is_assignable` is false. It must prove through
`organizational_unit_closures` that the Establishment is a descendant of the
customer's `legal_entity_id`; sharing a tenant alone is insufficient.

## Model Ownership

Customer owns the aggregate through
`Customer::establishmentRelationships`. The inverse relations are
`CustomerEstablishment::customer` and
`CustomerEstablishment::establishment`. Relationship writes use the aggregate
service so tenant, Legal Entity hierarchy, authorization, and duplicate checks
run together in one transaction.

Contact and notes describe one Customer-Establishment relationship. They are
not writable or readable as Customer attributes. After the preflight and all
manual exceptions have been resolved, `customers.contact` and
`customers.notes` are dropped. The Customer model, factories, casts, audit
lists, requests, resources, and repositories must drop both attributes in the
same release. A compatibility accessor or dual-write path is prohibited.

## Site Persistence

`sites.organizational_unit_id` is replaced by non-null
`sites.establishment_id`. The target has a composite
`sites_tenant_establishment_fk` on `(tenant_id, establishment_id)` to
`organizational_units (tenant_id, id)` and an
`idx_sites_tenant_establishment` index on the same local columns. Site model,
requests, resources, repositories, filters, factories, and assignment queries
must use only `establishment_id` after the migration.

A legacy site is eligible only when all of these predicates hold for its
stored `organizational_unit_id`:

```text
sites.tenant_id = customers.tenant_id
sites.tenant_id = organizational_units.tenant_id
organizational_units.id = sites.organizational_unit_id
organizational_units.is_establishment = true
organizational_units.is_active = true
organizational_units.is_assignable = true
organizational_units.deleted_at IS NULL
organizational_unit_closures.ancestor_id = customers.legal_entity_id
organizational_unit_closures.descendant_id = sites.organizational_unit_id
organizational_unit_closures.depth > 0
```

The customer is joined by `sites.customer_id`. Exactly one row must satisfy the
full predicate. A tenant match, an `is_establishment` flag, or a hierarchy match
on its own is not proof.

## Controlled Migration

The migration begins with an idempotent preflight transaction against a stable
snapshot. It inventories every legacy customer contact/note and site, evaluates
the complete predicates, writes the proposed mapping and reason codes to the
audited migration exception queue, and reconciles source, eligible, and
exception totals. The preflight performs zero writes to target business tables.

Legacy global contact and note values have no provable Establishment meaning.
They must not be guessed or copied. Any non-null value is an exception requiring
an audited reviewer decision that either assigns the value to one explicit
relationship or discards it with recorded evidence. Only after that decision
may the relationship be written and the legacy value removed. For migrated
relationships without an approved value, relationship-specific contact and
notes start empty.

Any site with zero or multiple qualifying hierarchy rows is an exception.
No first, only, or default Establishment may be selected. If any unresolved
customer or site exception exists, if reconciliation differs, or if the source
changes between preflight and execution, the migration throws a
`RuntimeException` before schema mutation. It keeps the legacy columns and rows
unchanged and reports stable source IDs and reason codes for the audited
migration exception queue. Production execution uses the approved preflight
input, rechecks every predicate, and commits relationship rows, renamed site
references, constraints, and legacy-column removal in one controlled rollout.

## Required API Tests

Migration and model coverage must prove at least:

- a duplicate `(customer_id, establishment_id)` fails the unique constraint;
- a cross-tenant customer relationship fails the customer composite foreign
  key;
- a cross-tenant Establishment relationship fails the Establishment composite
  foreign key;
- Customer owns multiple relationships and contact/notes serialize only on the
  relationship model;
- ambiguous legacy customer data aborts before target or schema writes and is
  reported with stable reason codes;
- an invalid legacy site hierarchy, a non-Establishment unit, or a unit outside
  the customer's Legal Entity aborts with the legacy row unchanged;
- one proven site mapping moves to `establishment_id`, and its foreign key and
  index exist; and
- repeated preflight runs produce identical counts and mappings.

Tests must exercise database constraint failures as well as application model
validation. A source-text assertion alone is not sufficient in the API
repository.
