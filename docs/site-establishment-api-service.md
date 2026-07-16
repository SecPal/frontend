<!--
SPDX-FileCopyrightText: 2026 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Site-Establishment API Service Contract

## Status and Scope

This is the binding API implementation contract for assigning Sites to
Establishments. A Site belongs to a Customer and to one eligible Establishment
under that Customer's Legal Entity. Request validation is not authority for a
write: the server derives and proves the complete relationship from persisted,
tenant-scoped records.

## Canonical Names and API Surfaces

The migration is atomic across the Site API. `StoreSiteRequest`,
`UpdateSiteRequest`, `IndexSiteRequest`, `SiteController`, `SiteResource`, and
the `Site model` use `establishment_id`. The model exposes
`establishment(): BelongsTo`, its query scope is `forEstablishment`, and its
fillable, audit, policy, factory, assignment, and visibility fields use the
same name. No compatibility request alias, resource alias, dual-write, or
fallback accessor remains.

Controller list and detail queries load `with(['customer', 'establishment',
'assignments.user'])`. The list filter is `establishment_id`; the supported
relationship include is `establishment`. Response resources expose
`establishment_id` and, when requested or loaded, `establishment`. They do not
label that relation as a generic organizational unit.

## Server-Derived Legal Entity

Site requests accept `customer_id` and `establishment_id`. The API never accepts
a client-supplied `legal_entity_id`. The service obtains the authoritative Legal
Entity only from `customer.legal_entity_id`. It then proves a persisted
`customer_establishments` row for the effective `customer_id` and
`establishment_id`; client input cannot create, replace, or infer that
relationship as a side effect of a Site write.

Create and update must prove the same tenant, hierarchy descendant path, and
all of these eligibility predicates together:

```text
site tenant = authenticated tenant
customer.tenant_id = authenticated tenant
establishment.tenant_id = authenticated tenant
customer_establishments.tenant_id = authenticated tenant
customer_establishments.customer_id = effective customer_id
customer_establishments.establishment_id = effective establishment_id
organizational_unit_closures.ancestor_id = customer.legal_entity_id
organizational_unit_closures.descendant_id = effective establishment_id
organizational_unit_closures.depth > 0
establishment.is_establishment = true
establishment.is_active = true
establishment.is_assignable = true
establishment.deleted_at IS NULL
```

A matching tenant, relationship row, hierarchy row, or eligibility flag alone
is not sufficient proof. In particular, a relationship whose stored rows no
longer satisfy the full invariant is rejected fail closed.

## Atomic Create and Update

The application service performs the proof and write in one database
transaction. In a stable order it locks the Customer, the
Customer-Establishment relationship, and the Establishment, then re-checks
tenant, relationship, hierarchy, eligibility, and authorization before it
persists the Site. Database composite foreign keys remain the final tenant
boundary; application validation does not replace them.

For PATCH, the service computes the effective customer_id and effective
establishment_id from submitted values plus the locked Site's unchanged
values. It validates that effective pair as one unit. Changing only the
Customer or only the Establishment can therefore never retain an incompatible
half of the old assignment. The locked current Site is authorized before the
target pair is evaluated, and assignment coverage is recalculated only after
the target invariant succeeds.

Authorization is deny-by-default. Creation requires `sites.create`, view
access to the Customer and its Legal Entity, and organizational write scope for
the target Establishment. Updates require `sites.update`, access to the Site
and effective Customer, organizational write scope for the current
Establishment, and organizational write scope for the target Establishment.
The latter two checks both run when the Site is not moved.

## Rejection and Non-Disclosure

Unknown, foreign-tenant, or inaccessible Customers, relationships, Sites, and
Establishments use the same not-found response. This check happens before
validation details are selected, so neither field errors nor includes reveal a
hidden identifier or relationship. A visible but non-Establishment, deleted,
inactive, unassignable, or wrong-hierarchy target receives the generic
`establishment_id` validation error without hierarchy, flag, tenant, or Legal
Entity metadata. A submitted `legal_entity_id` is rejected as an unknown input;
it is never compared with or substituted for server state.

List filtering and eager loading start from the caller's visible Site query.
The `establishment_id` filter and `establishment` include may only narrow or
project that query. They cannot bypass Site policy, tenant scope, current
Establishment visibility, pagination filtering, or resource field filtering.

## Required Feature Tests

Feature tests exercise the authenticated HTTP boundary for both `POST /sites`
and `PATCH /sites/{site}`. Each rejection asserts status, generic response
shape, unchanged database state, and absence of foreign IDs, hierarchy facts,
or authorization detail. Fixtures include two tenants, two Legal Entities in
one tenant, scoped users, and soft-deleted units.

| Scenario                                    | Required proof                                                                                                    |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| valid assignment                            | Create and update succeed for an eligible related Establishment below the Customer's Legal Entity.                |
| customer Legal Entity mismatch              | A same-tenant Establishment below another Legal Entity is rejected on create and for either half of a PATCH move. |
| cross-tenant customer                       | A foreign Customer is non-disclosing and no Site is written.                                                      |
| cross-tenant Establishment                  | A foreign Establishment is non-disclosing even when its UUID is well formed.                                      |
| missing Customer-Establishment relationship | A hierarchy-valid pair without the persisted relationship is rejected.                                            |
| non-Establishment unit                      | A descendant organizational unit without the Establishment flag is rejected.                                      |
| deleted Establishment                       | A soft-deleted target is rejected, including deletion after preliminary validation.                               |
| inactive Establishment                      | An inactive target is rejected, including deactivation after preliminary validation.                              |
| unassignable Establishment                  | An active but unassignable target is rejected.                                                                    |
| missing sites.create                        | An otherwise valid create is forbidden before target details can leak.                                            |
| missing sites.update                        | An otherwise valid update is forbidden and leaves the Site unchanged.                                             |
| missing customer access                     | Customer invisibility is non-disclosing on create and update.                                                     |
| missing current Establishment scope         | A caller cannot move a Site away from a current Establishment they cannot write.                                  |
| missing target Establishment scope          | A caller cannot create or move a Site into an Establishment they cannot write.                                    |
| spoofed legal_entity_id                     | Extra Legal Entity input is rejected and cannot authorize an otherwise invalid pair.                              |

Additional feature coverage proves that list filtering and the include expose
only visible Establishments, that responses use `establishment_id` and
`establishment`, and that concurrent eligibility or hierarchy changes are
caught by the locked re-check. Focused service tests prove lock order,
transaction rollback, effective-pair handling for every PATCH combination, and
composite-constraint enforcement.
