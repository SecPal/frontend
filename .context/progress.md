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
- Login-specific shadcn-style primitives live under `src/pages/Auth/ui` and should be imported through that barrel for login, passkey, and MFA surfaces so auth migration work does not depend on Tailwind Plus/Catalyst wrappers.
- Shadcn login-shell migrations should keep route behavior in `src/pages/Login.tsx` and express the responsive split-shell structure through auth-local primitives such as `LoginShell`, `LoginCard`, and `LoginBrandPanel`; keep footer legal/source links route-local when they are part of the unauthenticated shell.
- Login credential form migrations should centralize route-owned disabled predicates before passing them into auth-local `LoginFieldGroup`, `LoginInput`, and `LoginFormActions` primitives so offline, health, submit, lockout, passkey, and MFA challenge state stays identical while the markup changes.
- Login secondary auth actions should keep their provider-specific button identity visible in the shadcn composition while preserving the same accessible names used by browser and native passkey flow tests.
- Login MFA surfaces should render TOTP through auth-local `LoginOtpInput` with route-owned digit sanitization/length constraints, while keeping `recovery_code` on a free text `LoginInput`; tests should assert the submitted method/code payload rather than only the visible control.
- Login-specific shared controls such as dialogs and language selectors should stay in `src/pages/Auth/ui` or `src/pages/Login.tsx` with native/shadcn-style markup so unauthenticated auth routes do not pull old Catalyst/Headless component chains through shared app components.

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

## US-001: Shadcn-Auth-Bausteine für Login einführen

- Added a login-specific shadcn-style UI layer for shell/card/header, form fields, buttons, themed status messages, and a controlled OTP input under `src/pages/Auth/ui`.
- Migrated the existing login surface, passkey action button, and MFA dialog form/status controls to the new auth-local primitives while leaving the auth, rate-limit, passkey, and MFA flow logic unchanged.
- Added focused rendering tests for the auth UI layer covering shell/card semantics, explicit label/error wiring, themed status messages, and OTP paste/cell updates.
- Files changed:
  - `src/pages/Auth/ui/index.ts`
  - `src/pages/Auth/ui/primitives.tsx`
  - `src/pages/Auth/ui/utils.ts`
  - `src/pages/Auth/ui/auth-ui.test.tsx`
  - `src/pages/Login.tsx`
  - `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: mirror the onboarding migration boundary for auth by keeping login-local shadcn wrappers in a route-adjacent barrel and preserving stable IDs/ARIA relationships when swapping out Headless/Catalyst field wrappers.
  - Gotchas encountered: a component prop named `title` collides with the native HTML `title` attribute when intersecting with `ComponentPropsWithoutRef<"div">`, so wrapper APIs that accept React nodes need to omit or rename native attributes explicitly.

## US-002: Login-Shell auf Shadcn `login-05` umstellen

- Rebuilt `/login` around a shadcn `login-05`-style split shell with a mobile-first form column, desktop brand panel, retained SecPal logo, retained language switcher, and unchanged email/password, passkey, health, rate-limit, offline, and MFA behavior.
- Replaced the old full footer placement with route-local SecPal slogan, AGPL, and source-code links oriented to the current footer template, and synced Lingui catalog source references for those existing strings.
- Added auth UI primitive coverage for the brand panel and kept the login route footer/link assertions passing.
- Files changed:
  - `src/pages/Auth/ui/primitives.tsx`
  - `src/pages/Auth/ui/auth-ui.test.tsx`
  - `src/pages/Login.tsx`
  - `src/locales/en/messages.po`
  - `src/locales/de/messages.po`
  - `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: keep split login shell layout in auth-local primitives while placing shell-specific legal/footer content in the route so shared auth controls stay form-focused.
  - Gotchas encountered: moving existing translated footer strings into the login route does not change translations but still requires Lingui extraction so catalog source references stay current.

## US-003: E-Mail/Passwort-Formular in Shadcn-Komposition migrieren

- Migrated the email/password credential block and primary/passkey action area into auth-local shadcn-style `LoginFieldGroup` and `LoginFormActions` composition while preserving the existing submit, passkey, MFA, health, offline, and lockout handlers.
- Centralized the route-owned credential, login-submit, and passkey-submit disabled predicates so the existing disable rules remain unchanged and are applied consistently across the migrated form controls.
- Kept server and local error feedback visible through the existing `LoginStatusMessage` alerts, added explicit `aria-invalid` on credential fields while errors are active, and extended login unit coverage for MFA-active disabling plus accessible error descriptions.
- Files changed:
  - `src/pages/Auth/ui/primitives.tsx`
  - `src/pages/Auth/ui/auth-ui.test.tsx`
  - `src/pages/Login.tsx`
  - `src/pages/Login.test.tsx`
  - `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: pull shared auth form spacing into small route-local primitives such as `LoginFieldGroup` and `LoginFormActions`, but keep all behavioral predicates in the route component where auth flow state already lives.
  - Gotchas encountered: once the MFA dialog opens, Headless UI hides the background login form from the accessibility tree, so tests that prove the disabled submit state during an active challenge need to inspect the preserved background form DOM directly.

## US-004: Passkey-Aktion als sekundären Login-Pfad integrieren

- Made the secondary login action explicitly passkey-specific inside the shadcn login action stack by adding a passkey/key icon to the idle and in-progress passkey button states without changing button labels or handlers.
- Preserved the existing browser WebAuthn and native-bridge passkey behavior, including challenge, browser prompt, native prompt, verification, cancellation, timeout, provider guidance, and error rendering.
- Extended the passkey rendering regression to assert the login surface exposes the passkey button instead of Apple/Google-style social continuation controls.
- Files changed:
  - `src/pages/Login.tsx`
  - `src/pages/Login.test.tsx`
  - `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: provider-specific secondary login actions can be made visually explicit with an aria-hidden icon while keeping the existing accessible name stable for route and e2e tests.
  - Gotchas encountered: the passkey tests already rely on the exact accessible button names for every in-progress state, so visual changes should wrap the existing translated labels rather than replacing them.

## US-005: MFA-Dialog auf Shadcn mit digits-only OTP umstellen

- Replaced the login MFA challenge surface with auth-local shadcn-style dialog primitives and kept the existing expiry, method switching, cancel, disabled, and verification flow behavior.
- Switched TOTP entry to the auth-local six-cell `LoginOtpInput` with digits-only sanitization for typed and pasted values, while preserving a free text `LoginInput` for recovery codes.
- Extended login coverage for the new TOTP UI, digits-only TOTP submission, recovery-code fallback verification, inline MFA errors, and method switching; synced Lingui catalog references for the reused authenticator-code label.
- Files changed:
  - `src/pages/Auth/ui/primitives.tsx`
  - `src/pages/Auth/ui/auth-ui.test.tsx`
  - `src/pages/Login.tsx`
  - `src/pages/Login.test.tsx`
  - `src/locales/en/messages.po`
  - `src/locales/de/messages.po`
  - `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: keep MFA dialog chrome in the auth-local primitive barrel, but keep method-specific sanitization and verification payload construction in `Login.tsx` where challenge state already lives.
  - Gotchas encountered: switching a labeled single input to an OTP group requires moving `htmlFor` to the first OTP cell and asserting the group role in tests so label-based coverage remains stable.

## US-009: Login-Icons von heroicons auf lucide-react umstellen

- Replaced the three `@heroicons/react/24/outline` imports on the login surface with their `lucide-react` equivalents: `KeyIcon` → `KeyRound` (passkey-action button, five usages), `ScaleIcon` → `Scale` (AGPL license link), `CodeBracketIcon` → `Code2` (source-code link), matching the shadcn `login-05` reference's icon library while keeping `aria-hidden="true"` and the existing `h-4 w-4` sizing untouched.
- Confirmed the login surface no longer transitively depends on `@headlessui/react`: `src/pages/Login.tsx`, `src/pages/Auth/ui/*`, `src/components/Logo.tsx`, the auth hooks (`useAuth`, `useLoginRateLimiter`, `useOnlineStatus`), the auth services (`authTransport`, `authApi`, `authState`, `passkeyBrowser`, `healthApi`), and the i18n entry are all free of `@headlessui` imports. The dependency remains in `package.json` because legacy Catalyst components under `src/components/` still rely on it.
- Files changed:
  - `package.json`, `package-lock.json` (new `lucide-react` dependency)
  - `src/pages/Login.tsx`
  - `CHANGELOG.md`, `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: a shadcn login surface should target `lucide-react` directly so future copy-paste from shadcn blocks lands without a translation step from heroicons.
  - Gotchas encountered: `lucide-react` icon names rarely match heroicons one-to-one; `KeyRound` and `Code2` were chosen over the more literal `Key` and `Code` to match the visual weight and modern feel of the new login card.

## US-008: Login-Card auf shadcn `login-05` Komposition umstellen (Passwort bleibt)

- Restructured the unauthenticated login surface from the previous split brand-panel shell into a centered shadcn `login-05` card (`max-w-sm`, brand block on top, primary submit, `FieldSeparator` "Or", passkey as secondary action) while keeping the existing email + password flow, passkey path, MFA dialog, health-check, offline, rate-limit, and language-switching behavior intact.
- Reworked `LoginShell` into a centered flex container (`relative flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10`) and `LoginCard` into a slim `max-w-sm` section; `LoginCardHeader`/`LoginCardTitle` now drive the centered brand block, and a new `LoginFieldSeparator` primitive provides the "Or" divider between primary and secondary auth actions.
- Moved the SecPal language switcher into an absolute-positioned slot at the shell's top-right and lifted the legal footer (Powered-by + AGPL + Source-Code links) out of the card to a centered `max-w-sm` strip below it, so the card itself stays focused on the auth form per `login-05`.
- Updated the localized login title to "Welcome to SecPal" / "Willkommen bei SecPal" plus new `login.subtitle` and `login.separator` catalog entries; adjusted `App.test.tsx` and `main.test.tsx` to disambiguate the login route by the email field instead of the removed `Log in` heading.
- Files changed:
  - `src/pages/Auth/ui/primitives.tsx` (`LoginShell`, `LoginCard`, `LoginCardHeader`, `LoginCardTitle`, `LoginForm`, new `LoginFieldSeparator`)
  - `src/pages/Login.tsx` (centered `login-05` composition; absolute language switcher; legal footer outside card)
  - `src/locales/en/messages.po`, `src/locales/en/messages.mjs`, `src/locales/de/messages.po`, `src/locales/de/messages.mjs`
  - `src/App.test.tsx`, `src/main.test.tsx`
  - `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: when migrating a shell from a split-panel layout to a centered card, keep `<main>` and `<section aria-labelledby>` roles intact so existing role-based test queries continue to pass while only the class-driven layout changes.
  - Gotchas encountered: explicit-id Lingui messages are not auto-rewritten when the source string changes, so the English catalog had to be updated by hand (and the German equivalent translated) for the new `login.title`/`login.subtitle`/`login.separator` strings before tests asserting the heading would pass.

## US-007: TOTP-OTP-Feld auf offizielles shadcn `input-otp` umstellen

- Added the `input-otp@1.4.2` dependency and wrapped its `OTPInput`/`OTPInputContext`/`REGEXP_ONLY_DIGITS` exports in auth-local primitives `LoginInputOtp`, `LoginInputOtpGroup`, and `LoginInputOtpSlot` styled to the existing zinc/blue auth theme.
- Rewrote `LoginOtpInput` as a thin convenience wrapper that renders the new primitives with a six-slot group, digits-only `pattern`, `inputMode="numeric"`, and `autoComplete="one-time-code"`, while preserving the existing `(value, onChange, length, idPrefix, disabled, aria-*)` signature so the MFA dialog call site only had to drop the `mfa-code-0` cell suffix in the `FieldLabel htmlFor`.
- Updated the auth UI primitive test for the new slot-based DOM (single labeled OTP input, six `data-slot="login-input-otp-slot"` cells, pattern rejection of mixed input) and adjusted the login MFA tests to use a disambiguated `getTotpInput` helper that prefers the `autocomplete="one-time-code"` input over the radio option labeled "Authenticator code".
- Files changed:
  - `package.json`, `package-lock.json` (new `input-otp@1.4.2` dependency)
  - `src/pages/Auth/ui/primitives.tsx`
  - `src/pages/Auth/ui/auth-ui.test.tsx`
  - `src/pages/Login.tsx` (`htmlFor="mfa-code"` instead of `mfa-code-0`)
  - `src/pages/Login.test.tsx` (`getTotpInput` helper, slot-based DOM assertions)
  - `.context/login-spec-vs-implementation.md`, `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: when an OTP input shares its accessible name with a radio option label, disambiguate via the unique `autocomplete="one-time-code"` attribute rather than introducing a different aria-label.
  - Gotchas encountered: the `input-otp` library's `pattern` enforcement rejects mixed-character inputs entirely (no partial sanitization), so the digits-only regression test now asserts that an invalid paste leaves the value empty and the verify button disabled before the valid 6-digit happy path.

## US-006: Login-Flow lokalisieren, bereinigen und regressionssicher abschließen

- Removed the remaining login-specific Headless/Catalyst dependency chain by replacing the auth-local MFA dialog with native shadcn-style modal semantics and moving the login language selector to route-local native markup.
- Localized known login and MFA fallback/error messages, the login form accessible label, and the route-local language selector strings in English and German with synced Lingui catalogs.
- Extended auth UI and login regressions for native dialog semantics, German invalid-credentials localization, German MFA verification localization, and canonicalized credential errors; reran the Chromium auth e2e smoke against the migrated surface.
- Files changed:
  - `src/pages/Auth/ui/primitives.tsx`
  - `src/pages/Auth/ui/auth-ui.test.tsx`
  - `src/pages/Login.tsx`
  - `src/pages/Login.test.tsx`
  - `src/locales/en/messages.po`
  - `src/locales/en/messages.mjs`
  - `src/locales/de/messages.po`
  - `src/locales/de/messages.mjs`
  - `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: keep login-only cross-cutting controls route-local or auth-local when a shared app component still wraps old Catalyst/Headless primitives.
  - Gotchas encountered: locale-switching tests need to account for translated accessible names on both action buttons and OTP digit inputs, so enter values before switching locale when the assertion is about the translated failure output.
