<!--
SPDX-FileCopyrightText: 2026 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Customer-Establishment API Service Contract

## Status and Scope

This is the binding implementation contract for the API customer aggregate
service. It implements the identity decision and persistence target without
granting new access through customer relationships. Controllers validate only
request shape; lookup, authorization, locking, identity resolution, writes,
and response projection remain server-side aggregate-service responsibilities.

## Establishment Lookup

`GET /customers/establishments?legal_entity_id={uuid}` requires
`customers.update`, view access to the selected Legal Entity, and
organizational write scope. The query starts from units in the caller's tenant
and returns only units in the same tenant below the selected Legal Entity when
`is_establishment = true`, `is_active = true`, `is_assignable = true`,
`deleted_at IS NULL`, and the caller has organizational write scope. The query
enforces those rules through all of these predicates:

```text
organizational_units.tenant_id = authenticated tenant
organizational_unit_closures.ancestor_id = selected Legal Entity
organizational_unit_closures.descendant_id = organizational_units.id
organizational_unit_closures.depth > 0
organizational_units.is_establishment = true
organizational_units.is_active = true
organizational_units.is_assignable = true
organizational_units.deleted_at IS NULL
caller has organizational write scope for organizational_units.id
```

The selected Legal Entity itself must be active, non-deleted, in the same
tenant, and visible to the caller. An unknown, foreign, deleted, inactive, or
inaccessible Legal Entity produces the same not-found response. The result is
ordered deterministically and contains only `id` and `name`; it has no hidden
row count, hierarchy metadata, or distinction between absent and unauthorized
units.

## Transactional Customer Creation

`CustomerAggregateService::create` performs one database transaction. It first
locks the same-tenant Legal Entity row and then locks the Establishment row in
that stable order. After both locks are held, it must re-check tenant equality,
the closure-table descendant path, active/assignable/deleted flags, and the
caller's customer and organizational scopes. Validation before the transaction
is never sufficient authority for the write.

The service then applies the approved identity rule. A normalized VAT ID is
unique within the tenant and Legal Entity. A request without a VAT ID does not
match by name, address, contact, notes, or another mutable field: its identity
is the newly allocated customer UUID. Matching VAT identity plus compatible
master data reuses the existing customer; conflicting non-empty master data
returns the deterministic duplicate conflict without revealing relationships.

Within that same transaction the service atomically creates either a new Customer
with its initial relationship or an additional relationship on the
matching Customer. Contact and notes are written only to the relationship. The
database unique constraint is the final concurrency guard. If concurrent
requests race on customer identity or `(customer_id, establishment_id)`, the
losing transaction catches only the recognized unique constraint, re-reads the
canonical customer and relationship under the same eligibility and
authorization predicates, and returns the same successful aggregate or the
same deterministic conflict. It never returns raw constraint names, foreign
identifiers, or hidden relationship data.

## Relationship Mutations

Creating or updating a relationship requires all of `customers.update`, view
access to the customer, organizational write scope for the customer's Legal
Entity, organizational write scope for the current Establishment on update,
and organizational write scope for the target Establishment. A create has no
current Establishment; an update that does not move the relationship still
checks its current Establishment. Tenant, hierarchy, eligibility, and soft
deletion are re-checked while the aggregate and affected units are locked.
Authorization must deny by default.

Route binding must not resolve a relationship outside its customer aggregate.
Unknown and inaccessible customers, relationships, current Establishments, and
target Establishments use the same not-found response. A duplicate visible
pair uses the documented conflict response, but a collision involving a hidden
relationship uses the same not-found response as an inaccessible target.

## Read Projection and Non-Disclosure

Customer list and detail queries join relationships through the caller's
tenant and organizational visibility predicate before pagination or resource
serialization. Each visible relationship may contain its Establishment name,
contact, and notes. No Establishment name, contact, notes, relationship ID, or
existence marker from a non-visible relationship may reach the resource layer.

Pagination totals, filtered counts, duplicate detection, validation messages,
logs returned to clients, and conflict metadata are calculated from the same
visible relation. Duplicate checks may use hidden rows internally, but their
external result is the same not-found response used for an absent or
inaccessible target; they never identify or count a hidden Establishment.

## Required Test Matrix

Feature tests exercise the authenticated HTTP boundary, status and response
shape. Service tests exercise transactions, locks, identity, authorization,
and race recovery directly. Both layers use at least two tenants, two Legal
Entities, scoped users, soft-deleted fixtures, and visibility assertions.

| Scenario                           | Required proof                                                                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| authorized multi-assignment        | An existing VAT-identified customer gains one relationship in a second writable Establishment without duplicated customer master data.              |
| parallel duplicate creation        | Two concurrent creates leave one canonical customer and one pair per Establishment; both responses are deterministic and leak no constraint detail. |
| different tenant                   | Lookup and every mutation reject the unit with the standard non-disclosing not-found response.                                                      |
| wrong Legal Entity                 | A same-tenant Establishment outside the selected/customer Legal Entity is absent from lookup and rejected under lock.                               |
| deleted Establishment              | A soft-deleted unit is absent from lookup and rejected even when deleted after request validation.                                                  |
| inactive Establishment             | An inactive unit is absent from lookup and rejected even when deactivated during the request.                                                       |
| unassignable Establishment         | An active but unassignable unit is absent from lookup and rejected.                                                                                 |
| missing organizational write scope | Read-only or unrelated scope cannot list the target or create/update its relationship.                                                              |
| hidden relationship fields         | Customer list and detail omit the hidden Establishment name, relationship contact, notes, ID, and all count evidence.                               |
| non-disclosing duplicate response  | A duplicate involving a hidden relationship is indistinguishable from an absent or inaccessible target.                                             |

Tests also prove missing `customers.update`, inaccessible customers, mismatched
route relationships, current-scope loss, target-scope loss, deleted or inactive
Legal Entities, no-VAT non-merging, master-data conflicts, rollback after a
relationship failure, and a retry after a recognized unique-constraint race.
