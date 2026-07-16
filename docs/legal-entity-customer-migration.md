<!--
SPDX-FileCopyrightText: 2026 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Customer Identity and Establishment Migration Decision

## Status

Migration status: approved for contract and implementation work.

This decision is the binding product rule for customer identity, duplicate
resolution, Customer-Establishment relationship authorization, and migration of
existing data. Migration execution remains subject to the safeguards and
reconciliation gates below.

## Identity Rule per Legal Entity

A customer identity is tenant-bound and Legal-Entity-bound. Records from
different tenants or Legal Entities are never the same customer identity, even
when their names, addresses, or tax identifiers match.

Within one Legal Entity, a syntactically valid VAT ID is canonicalized by
trimming it, converting letters to uppercase, and removing spaces and
punctuation. The tuple `(tenant_id, legal_entity_id, normalized VAT ID)` is the
unique customer identity. New writes must enforce that uniqueness. A legacy
collision is a recognized duplicate and follows the conflict process below; it
must not be resolved by whichever record is processed first.

A customer without a VAT ID is identified only by its immutable customer UUID
within its tenant and Legal Entity. Similar names, addresses, contacts, customer
numbers, or fuzzy scores may flag records for review, but those records must
never be merged automatically. An authorized reviewer may merge them only after
recording authoritative evidence that they represent the same legal customer.
Until then they remain separate identities.

## Master Data Conflicts

Automatic consolidation is allowed only when the identity rule matches and all
non-empty master data agrees after documented normalization. Empty values may be
filled from a non-empty duplicate.

If name, billing address, VAT ID source value, contact, status, or other
non-empty master data differs, migration must stop consolidation for that group
and place it in the exception queue. It must preserve every source record and a
pre-migration snapshot. An authorized reviewer resolves the record field by
field against an authoritative source, records the reason and source, and
selects the canonical customer UUID. Only then may relationships be redirected;
the replaced UUID remains as an audited alias and is not silently deleted.

## Customer-Establishment Relationship Authorization

Creating, changing, or deleting a Customer-Establishment relationship requires
all of the following:

- the explicit `customers.update` permission;
- view access to the customer and organizational write scope for the customer's
  Legal Entity;
- organizational write scope for the current Establishment when changing or
  deleting an existing relationship; and
- organizational write scope for the target Establishment when creating or
  moving a relationship.

The customer, Legal Entity, and Establishment must belong to the same tenant.
The target must be an active, assignable, non-deleted organizational unit marked
as an Establishment. Authorization is evaluated by the API for every write and
must deny by default if any permission, scope, or invariant is missing.

An Establishment lookup returns only eligible, in-scope targets and only the
minimal identifier and display name. Relationship access must not grant access
to global customer contacts, notes, other Establishments, or organizational
hierarchy data.

## Approved Migration Path

Migration proceeds in these ordered stages:

1. Inventory every customer, global contact, global note, and related object,
   retaining tenant IDs, source IDs, and a read-only pre-migration snapshot.
2. Assign a Legal Entity only from explicit, auditable source data. Apply the
   identity rule within that Legal Entity, and route identity or master-data
   conflicts to review before consolidation.
3. Keep each global contact and note on the canonical customer. Global data
   must not be copied to Customer-Establishment relationships or individual
   Establishments. Relationship-specific fields start empty and can be filled
   only by an authorized user after migration. Users with only Establishment
   access do not gain access to global customer data.
4. Create a relationship for an existing object only when its stored
   organizational-unit reference identifies exactly one same-tenant, active,
   assignable, non-deleted Establishment. Otherwise retain the object unchanged
   in an unassigned migration exception queue; do not expose it through a
   guessed relationship.
5. Resolve every exception through an audited manual decision before that
   customer or object is activated in the new relationship model.

No silent default assignment is allowed. In particular, a migration must not
choose the first or only Legal Entity or Establishment, infer ownership from a
name or address, use a global placeholder, or copy global data to make an
ambiguous record appear assigned.

Before production execution, an idempotent dry run must report counts for every
source, canonical, duplicate, relationship, and exception record, prove tenant
consistency, and reconcile totals without loss. Product and data owners approve
that report. Production migration runs with the same input and rules, writes an
audit trail, supports rollback from the snapshot, and fails closed if the
reconciled counts differ.

The contracts, API, frontend, and migration tooling must implement the same
identity, authorization, visibility, and exception rules.

## Tenant Consistency Invariants

Every implementation must enforce these invariants:

- the selected Legal Entity belongs to the same tenant as the customer;
- a relationship never crosses a tenant or the customer's Legal Entity scope;
- records without a provable tenant-consistent assignment remain unavailable in
  the relationship model and are reported for review; and
- no lookup or relationship response broadens the caller's existing customer or
  organizational scope.

## Tracking

The work is split across one epic with repository-specific sub-issues:

- Epic: <https://github.com/SecPal/frontend/issues/1391>
- SecPal/contracts sub-issue: <https://github.com/SecPal/contracts/issues/351>
- SecPal/api sub-issue: <https://github.com/SecPal/api/issues/1278>
- SecPal/frontend sub-issue: <https://github.com/SecPal/frontend/issues/1390>
