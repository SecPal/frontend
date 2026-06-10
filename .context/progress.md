<!--
SPDX-FileCopyrightText: 2026 SecPal
SPDX-License-Identifier: AGPL-3.0-or-later
-->

## Codebase Patterns

- Onboarding-only shadcn-style primitives live under `src/pages/Onboarding/ui` and are imported from that local barrel so migrated onboarding routes do not depend on Catalyst wrappers in `src/components`.
- Migrated onboarding forms should pair local `FieldLabel`/`Input` primitives with stable `id`, `htmlFor`, `aria-invalid`, and `aria-describedby` wiring so existing label-based tests and accessible error descriptions keep working after leaving Headless/Catalyst field wrappers.
- Authenticated onboarding shell and passive route states should use semantic containers plus onboarding-local `Button`, `Card`, and `Alert` primitives while leaving auth gating and logout sequencing in the route/layout layer.
- Wizard chrome should use onboarding-local `CardHeader`/`CardContent`, `AlertDescription`, `Badge`, `Progress`, and `Button` primitives while keeping navigation conditions and state transitions in the existing wizard handlers.
- Schema-driven wizard field paths should use onboarding-local `FieldLabel`, `FieldDescription`, `FieldError`, `Input`, `Select`, `Textarea`, `Checkbox`, and `CommandPopover` primitives with deterministic `onboarding-field-*` IDs; keep special upload and address-history blocks isolated until their own migrations.
- Interaction-heavy onboarding custom blocks can keep their behavior hooks/effects intact while swapping presentation imports to onboarding-local `Field`, `Input`, `Checkbox`, `RadioGroupItem`, `FieldError`, and `CommandPopover`; preserve stable field IDs and explicit `aria-invalid`/`aria-describedby` wiring at the migration boundary.
- Upload-heavy onboarding blocks should keep file-selection state and submission handlers unchanged while using onboarding-local `Input type="file"`, `FieldLabel`, `FieldDescription`, `FieldError`, and native radio items; keep pending file names outside the file input so navigation guards can still key off selected files.

## US-001: Shadcn-Basis für Onboarding schaffen

- Implemented a minimal onboarding-ready shadcn primitive set: button, input, textarea, select, checkbox, radio group, alert, card, form layout helpers, `cn`, and a keyboard-searchable command popover select.
- Added accessibility-focused tests that prove labels, disabled states, invalid/error descriptions, keyboard focus order, radio group semantics, alert/card semantics, and command popover keyboard selection.
- Files changed:
  - `src/pages/Onboarding/ui/index.ts`
  - `src/pages/Onboarding/ui/primitives.tsx`
  - `src/pages/Onboarding/ui/utils.ts`
  - `src/pages/Onboarding/ui/onboarding-ui.test.tsx`
  - `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: keep onboarding UI migration primitives in the onboarding route namespace and export through `src/pages/Onboarding/ui` for direct route imports.
  - Gotchas encountered: the project treats unused props/imports as hard failures in both typecheck and lint, so fixed native checkbox/radio props by omitting the overridable `type`.

## US-002: Öffentlichen Onboarding-Complete-Flow auf shadcn migrieren

- Migrated the public `/onboarding/complete` form, inline field feedback, submit button, and invalid/rate-limit feedback states from Catalyst/Tailwind UI wrappers to the onboarding-local shadcn primitives.
- Preserved the token-validation state machine, submit-time rate-limit handling, generic backend identity mismatch behavior, password rules, and authenticated redirect into `/onboarding`.
- Updated the onboarding-complete e2e contract so validate-token mocks return only `valid: true`, identity fields are asserted empty, and successful submissions fill the identity proof explicitly.
- Files changed:
  - `src/pages/Onboarding/OnboardingComplete.tsx`
  - `tests/e2e/onboarding-complete.spec.ts`
  - `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: when replacing Headless/Catalyst field components with plain shadcn-style primitives, stable IDs and explicit ARIA relationships are the migration boundary that preserves user-facing accessibility and test queries.
  - Gotchas encountered: existing e2e mocks still returned legacy identity data from token validation, so they had to be updated to the no-prefill security contract before the UI migration could be considered covered.

## US-003: Onboarding-Shell und Abschlusszustände auf shadcn migrieren

- Rebuilt the authenticated onboarding layout shell with semantic `<main>`/`<header>` structure and the onboarding-local shadcn `Button`, preserving the existing transport logout timeout, local logout cleanup, and `/login` redirect behavior.
- Migrated the submitted-state screen, entry feedback, global wizard feedback, initial loading, initial error, and empty onboarding-state wrappers to onboarding-local shadcn `Card`/`Alert` primitives while keeping existing copy and localization output intact where behavior already existed.
- Added focused unit coverage for the shell banner/sign-out action, submitted landmark region, and wizard loading/error/empty passive states; synced Lingui catalogs for the new empty-state copy.
- Files changed:
  - `src/components/onboarding-layout.tsx`
  - `src/components/onboarding-layout.test.tsx`
  - `src/pages/Onboarding/OnboardingSubmitted.tsx`
  - `tests/unit/pages/Onboarding/OnboardingSubmitted.test.tsx`
  - `src/pages/Onboarding/OnboardingWizard.tsx`
  - `tests/unit/pages/Onboarding/OnboardingWizard.test.tsx`
  - `src/pages/Onboarding/ui/primitives.tsx`
  - `src/locales/en/messages.po`
  - `src/locales/en/messages.mjs`
  - `src/locales/de/messages.po`
  - `src/locales/de/messages.mjs`
  - `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: ref-forwarding shadcn feedback primitives keeps existing focus management intact when replacing hand-rolled alert wrappers.
  - Gotchas encountered: the empty onboarding branch previously fell through to a blank wizard frame, so migrating the passive wrapper required adding a localized empty-state string and syncing catalogs.

## US-004: Wizard-Chrome und Schritt-Navigation auf shadcn migrieren

- Migrated the onboarding wizard header, progress presentation, first-step overview, optional badge, inline feedback, validation detail region, and step action bar to onboarding-local shadcn-style primitives without changing the existing navigation/save/submit handlers.
- Added onboarding-local `Badge` and `Progress` primitives with accessible progressbar state, plus unit coverage for the migrated wizard chrome and primitive behavior.
- Preserved Previous, Next, Save Draft, Skip this step, and Submit for Review visibility/disabled conditions, required-vs-optional presentation, and the first actionable step state logic.
- Files changed:
  - `src/pages/Onboarding/OnboardingWizard.tsx`
  - `src/pages/Onboarding/ui/primitives.tsx`
  - `src/pages/Onboarding/ui/onboarding-ui.test.tsx`
  - `tests/unit/pages/Onboarding/OnboardingWizard.test.tsx`
  - `src/locales/en/messages.po`
  - `src/locales/en/messages.mjs`
  - `src/locales/de/messages.po`
  - `src/locales/de/messages.mjs`
  - `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: role-based assertions for progressbar, named step overview regions, and navigation landmarks make shadcn chrome migrations less coupled to wrapper markup.
  - Gotchas encountered: adding a localized aria label for a new primitive-driven progressbar requires catalog sync and a translated German entry before `i18n:check` passes.

## US-005: Schema-Feldrenderer des Wizards auf shadcn umstellen

- Rebuilt the standard schema renderer paths in `OnboardingWizard` with onboarding-local shadcn primitives for text, numeric, enum select, boolean, array checkbox, textarea, and nationality selection fields.
- Preserved validation/error mapping and stored value behavior, including single-value `nationalities` arrays and hidden-field sanitization, while leaving address-history and upload/residence-title special blocks on their existing controls.
- Updated unit and live e2e helpers to drive both old editable comboboxes and the new command-popover combobox, and added regression coverage for migrated standard schema fields.
- Files changed:
  - `src/pages/Onboarding/OnboardingWizard.tsx`
  - `src/pages/Onboarding/OnboardingWizard.test.tsx`
  - `tests/unit/pages/Onboarding/OnboardingWizard.test.tsx`
  - `tests/e2e/onboarding-wizard-live-helpers.ts`
  - `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: deterministic field IDs plus explicit `aria-label`, `aria-describedby`, and `aria-invalid` let schema fields move off Catalyst wrappers without weakening label-based tests.
  - Gotchas encountered: popover-backed comboboxes expose a button first and the editable searchbox only after opening, so test helpers need to branch between native selects, editable combobox inputs, and command-popover buttons.

## US-006: Adresshistorie und Autovervollständigung auf shadcn migrieren

- Migrated the residential address history sections, Bewacher ID branching controls, conditional previous-residence rows, date fields, and inline feedback to onboarding-local shadcn primitives with stable labels and ARIA error wiring.
- Swapped the reused address field presentation to shadcn-style `Field`, `Input`, feedback, and `CommandPopover` controls while preserving the existing debounced street/locality autocomplete requests, keyboard navigation, focus handoff, country-based enablement, empty states, and API error display.
- Added an onboarding-level autocomplete regression that drives the address-history street combobox through debounce and keyboard selection, alongside the existing conditional rendering and shared address autocomplete unit coverage.
- Files changed:
  - `src/pages/Employees/EmployeeAddressFields.tsx`
  - `src/pages/Onboarding/OnboardingResidentialAddressHistoryFields.tsx`
  - `src/pages/Onboarding/OnboardingResidentialAddressHistoryFields.test.tsx`
  - `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: keep custom onboarding behavior in place and migrate the control surface by replacing imports plus explicit accessibility wiring, especially for dynamic sections with synchronized hidden rows.
  - Gotchas encountered: local onboarding e2e specs exist but are skipped in this workspace configuration, so story proof needed an additional focused onboarding unit regression around the actual address-history wrapper.

## US-007: Dokument-Upload und Sonderlogik im Wizard auf shadcn finalisieren

- Rebuilt the onboarding wizard identity-document upload choice, German identity-document kind select, upload file inputs, residence-title type/date/employment fields, residence-title upload choice, residence-title upload inputs, uploaded-file list, and remove-file actions with onboarding-local shadcn primitives or semantic elements.
- Preserved the existing behavior hooks for nationality-driven residence-title logic, upload-now branching, draft creation before first upload, editable-only upload enforcement, selected-file navigation blocking, residence-title business rules, required draft-step validation, and workflow-conflict refresh handling.
- Files changed:
  - `src/pages/Onboarding/OnboardingWizard.tsx`
  - `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: file upload sections can migrate presentation cleanly by leaving upload context, pending file arrays, and `handleUpload`/remove handlers untouched while replacing only labels, descriptions, native file inputs, and radio/select controls.
  - Gotchas encountered: the wizard upload tests query radio groups by accessible role and name, so shadcn-style native radio groups need explicit `role="radiogroup"` plus stable `aria-label` when replacing the previous wrapper components.
