## Codebase Patterns
- API service tests mock `apiFetch` responses directly and assert request URLs, methods, headers, and JSON bodies; validation errors are verified through the shared Laravel error formatting path.
- Site read responses may include a loaded `customer` relationship; frontend typing should keep this optional while tests assert the list/detail/nested endpoint shapes needed by UI screens.

## US-001: Objekt-MVP im API-Schreibmodell definieren
- Reduced the Site create write model so `organizational_unit_id` and `type` are optional, leaving the Objekt MVP fields `customer_id`, `name`, `address`, and optional `contact` as the minimal payload.
- Added API service tests for successful create/update calls with the Objekt MVP payload and validation error propagation for missing customer, missing name, and incomplete address.
- Files changed: `src/types/customers.ts`, `src/services/customersApi.test.ts`, `.context/progress.md`.
- **Learnings for future iterations:**
  - Site write contracts are represented in `src/types/customers.ts`; update requests were already PATCH-style partials.
  - The frontend API layer does not validate these payloads locally; it forwards server validation errors via `handleApiValidationError`.
  - Linked API and contracts workspaces still show the legacy server/OpenAPI Site shape, but this story was implemented only in the current workspace per workspace instructions.

## US-002: Objekt-Leseoberfläche und Kundenbezug im API stabilisieren
- Added an optional `SiteCustomer` relation to the Objekt/Site read type so list and detail responses can expose customer identity, customer address, and customer contact consistently.
- Aligned the nested customer Objekt list call with the rest of the API service by using the configured API base URL.
- Added API service tests for Objekt list, detail, customer-id filtering, nested customer lists, missing permissions (`403`), and tenant-hidden detail access (`404`).
- Files changed: `src/types/customers.ts`, `src/services/customersApi.ts`, `src/services/customersApi.test.ts`, `.context/progress.md`.
- **Learnings for future iterations:**
  - The linked API loads `customer` for Site list/detail responses, but that relation is still conditional at the resource level, so frontend types should model it as optional.
  - Collection permission failures should surface as `403`, while tenant-hidden or inaccessible concrete Objekt detail records surface as `404`.
  - Customer-specific Objekt reads are available both as `/v1/sites?customer_id=...` and `/v1/customers/{customer}/sites`; tests should keep both paths covered because they serve different frontend contexts.
