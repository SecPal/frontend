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
- Upload-heavy onboarding blocks should keep file-selection state and submission handlers unchanged while using onboarding-local `Input type="file"`, `FieldLabel`, `FieldDescription`, `FieldError`, and Radix-backed `RadioGroup` controls; keep pending file names outside the file input so navigation guards can still key off selected files.
- Login-specific shadcn-style primitives live under `src/pages/Auth/ui` and should be imported through that barrel for login, passkey, and MFA surfaces so auth migration work does not depend on Tailwind Plus/Catalyst wrappers.
- Shadcn login-shell migrations should keep route behavior in `src/pages/Login.tsx` and express the responsive split-shell structure through auth-local primitives such as `LoginShell`, `LoginCard`, and `LoginBrandPanel`; keep footer legal/source links route-local when they are part of the unauthenticated shell.
- Login credential form migrations should centralize route-owned disabled predicates before passing them into auth-local `LoginFieldGroup`, `LoginInput`, and `LoginFormActions` primitives so offline, health, submit, lockout, passkey, and MFA challenge state stays identical while the markup changes.
- Login secondary auth actions should keep their provider-specific button identity visible in the shadcn composition while preserving the same accessible names used by browser and native passkey flow tests.
- Login MFA surfaces should render TOTP through auth-local `LoginOtpInput` with route-owned digit sanitization/length constraints, while keeping `recovery_code` on a free text `LoginInput`; tests should assert the submitted method/code payload rather than only the visible control.
- Login-specific shared controls such as dialogs and language selectors should stay in `src/pages/Auth/ui` or `src/pages/Login.tsx` with native/shadcn-style markup so unauthenticated auth routes do not pull old Catalyst/Headless component chains through shared app components.
- Auth/Login and Onboarding migration boundaries should be executable Vitest audits over the route scope, checking for forbidden legacy packages, Tailwind Plus license markers, and direct imports from old shared component wrappers so regressions fail in the normal `npm test` path.
- Shared shadcn-style utilities live in `src/lib/utils.ts` and should be imported through route-local barrels (`src/pages/Auth/ui`, `src/pages/Onboarding/ui`) or the `@/lib/utils` alias when new shared primitives need canonical `cn` behavior.
- Radix-backed onboarding primitives should keep the route-local API stable where practical: `Select` may accept existing `<option>` children and expose the current trigger `value` for legacy tests, while route tests should select Radix options by opening the combobox and clicking `[data-slot="onboarding-select-item"][data-value]`.
- Radix-backed command popovers should require caller-provided placeholder/search/empty-state copy, keep filtering/selection behavior local, and let Radix own portal positioning plus outside/focus dismissal; cover trigger, searchbox, option, selected, disabled, empty, Escape, and Tab boundaries in primitive tests.

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

## US-017: MFA-Dialog auf shadcn input-otp "Form"/"Pattern"-Vorlage umstellen

- Direkt aus UX-Review: die Radio-Gruppe "Verification method" mit den zwei Karten (Authenticator / Recovery code) war für den Default-Fall (TOTP) störend prominent. Vorbild ist jetzt das shadcn `input-otp` "Form"-Beispiel: nur die OTP-Eingabe sichtbar, darunter ein dezenter Inline-Toggle für den Recovery-Code-Fallback.
- Default-Flow (`mfaMethod === "totp"`):
  - 6-stellige `LoginOtpInput` direkt nach Title/Description sichtbar.
  - Unter dem Input: Button `Trans id="login.mfa.switchToRecovery"` ("I don't have access to my authenticator app" / "Ich habe keinen Zugriff auf meine Authenticator-App"), nur sichtbar wenn `recovery_code` in `pendingMfaChallenge.available_methods` enthalten ist.
- Recovery-Flow (`mfaMethod === "recovery_code"`):
  - Alphanumerischer `LoginOtpInput` mit `length={8}`, `groups={[4, 4]}`, `pattern={REGEXP_ONLY_DIGITS_AND_CHARS}`, `inputMode="text"`, `textTransform="uppercase"` — visuell identisch zum shadcn `input-otp` "Pattern"-Beispiel mit `XXXX – XXXX`-Trenner.
  - Toggle-Button wechselt zu `Trans id="login.mfa.switchToTotp"` ("Use authenticator code instead" / "Stattdessen Authenticator-Code verwenden"), wenn `totp` in `available_methods` enthalten ist.
- Neue Primitive in `src/pages/Auth/ui/primitives.tsx`:
  - `LoginInputOtpSeparator` — `data-slot="login-input-otp-separator"`, `role="separator"`, `aria-hidden="true"`, rendert einen Lucide `Minus`-Icon in `text-zinc-400/dark:text-zinc-500`.
  - `LoginOtpInput` um drei optionale Props erweitert:
    - `pattern?: string` (Default `REGEXP_ONLY_DIGITS`) — input-otp's per-Zeichen-Regex.
    - `groups?: readonly number[]` (Default `[length]`) — z. B. `[4, 4]` rendert zwei `LoginInputOtpGroup` getrennt durch `LoginInputOtpSeparator`. Slot-Offsets werden via `reduce` vorab berechnet (React-19-Lint verbietet mutierende `let`-Akkumulatoren im Render).
    - `inputMode?: ComponentProps<typeof OTPInput>["inputMode"]` (Default `"numeric"`) — `"text"` für alphanumerische Codes, damit mobile Tastaturen nicht auf den Zahlenblock einrasten.
    - `textTransform?: "none" | "uppercase"` (Default `"none"`) — uppercased sowohl visuell (`uppercase`-Klasse pro Slot) als auch in der ausgegebenen `onChange`-Value, sodass das Backend nie Mixed-Case-Codes sieht.
- Validierung in `Login.tsx`:
  - `RECOVERY_CODE_LENGTH = 8`-Konstante eingeführt.
  - `isIncompleteRecoveryCode = mfaMethod === "recovery_code" && normalizedMfaCode.length !== RECOVERY_CODE_LENGTH` ergänzt `isMfaSubmitDisabled`, damit der Verify-Button erst klickbar wird wenn alle 8 Slots gefüllt sind (parallel zur bestehenden 6-stelligen TOTP-Längenprüfung).
  - `handleMfaMethodChange` resettet den Draft-Code immer (alter Code ist nie eine valide Eingabe für das andere Alphabet/length-Pärchen).
- i18n:
  - Neue Keys `login.mfa.switchToRecovery`, `login.mfa.switchToTotp` in EN + DE.
  - Obsolete Keys `login.mfa.method`, `login.mfa.method.totp`, `login.mfa.method.recovery_code`, `login.mfa.preferred` von `sync:purge` automatisch entfernt.
  - `login.mfa.recoveryHelp` von "exactly as stored" auf "unused 8-character recovery code exactly as stored" / "unbenutzten 8-stelligen Wiederherstellungscode genau wie gespeichert" geschärft, weil die Länge jetzt UI-relevant ist.
- Tests:
  - `src/pages/Auth/ui/auth-ui.test.tsx`: neuer Primitive-Test "supports alphanumeric input with split groups, separator and uppercase normalization (recovery-code shape)" deckt die 4-Sep-4-Slot-Struktur, `inputmode="text"`, `maxlength="8"`, Slot-Uppercase-Klasse, `textTransform`-Normalisierung (`b6f42q8p` → `B6F42Q8P`), und Pattern-Reject (`b6f4-2q8` wird nicht durchgelassen) ab.
  - `src/pages/Login.test.tsx`: drei Bestands-MFA-Tests neu verdrahtet (kein `getByRole("radio")` mehr; `switchToRecoveryCodeMode()`/`enterRecoveryCode()` Helper-Funktionen ergänzt). Asserts auf `data-slot="login-input-otp-slot"` × 8 + `data-slot="login-input-otp-separator"` × 1 + `inputmode="text"` + Backend-Roundtrip mit normalisiertem Uppercase-Code.
- JSDOM-Hardening (`tests/setup.ts`):
  - Stub für `document.elementFromPoint` (input-otp's interne Pointer-Reset-Heuristik), damit Tests nicht mit "TypeError: document.elementFromPoint is not a function" einige Sekunden nach Test-Ende crashen.
  - Stub für `window.scrollTo` (input-otp's Self-Scroll-into-View), damit JSDOM's "Not implemented: Window's scrollTo() method"-Diagnose den Output nicht flutet.
  - `afterEach`-Flush-Pause von 0ms → 60ms erhöht, damit die 0/10/50ms-Tier-Timer aus `input-otp` (interne `setTimeout(r, 0|10|50)` pro Value/Focus-Change) feuern können, bevor vitest die JSDOM-Umgebung abreißt. Sonst feuert React's `dispatchSetState` → `resolveUpdatePriority` auf einem nicht mehr existierenden `window` und vitest reportet die Suite als rot.
- Files changed:
  - `src/pages/Auth/ui/primitives.tsx`
  - `src/pages/Auth/ui/auth-ui.test.tsx`
  - `src/pages/Login.tsx`, `src/pages/Login.test.tsx`
  - `src/locales/{en,de}/messages.po`, `src/locales/{en,de}/messages.mjs`
  - `tests/setup.ts`
  - `CHANGELOG.md`, `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: wenn ein OTP-Input zwei wechselbare Code-Formate trägt (z. B. 6-Digit-TOTP vs 8-Char-Recovery), reicht eine einzige Wrapper-Primitive (`LoginOtpInput`) mit `pattern` + `groups` + `inputMode` + `textTransform` aus, um sowohl die `REGEXP_ONLY_DIGITS`- als auch die `REGEXP_ONLY_DIGITS_AND_CHARS`-Variante des shadcn-Examples zu liefern, ohne eine zweite parallele Komponente zu pflegen.
  - Gotchas encountered: (1) React 19's neuer `react-hooks/immutability`-Linter verbietet `let cursor; cursor += groupLength` im Render — der Slot-Offset-Akkumulator muss als `.reduce<number[]>` vorab berechnet werden. (2) `input-otp` schedult drei `setTimeout(r, 0|10|50)`-Callbacks pro Value/Focus-Change (für selection-restore + Selection-Sync); die feuern asynchron React `setState`, was bei JSDOM-Teardown vor dem Timer einen "ReferenceError: window is not defined" zur Folge hat — die Lösung ist ein 60ms-Flush in `afterEach`, nicht das Mocken von input-otp. (3) `LoginField` ist `space-y-2` (kein flex), also reicht `mx-auto block` für ein zentriertes Inline-Toggle-Button-Element — `self-center` würde stillschweigend ohne Wirkung bleiben.
  - Process: bei jeder Methodenumschaltung den Code-Draft sofort leeren — ein 6-stelliger TOTP-Draft ist nie ein valider 8-Char-Recovery-Code (und umgekehrt), das Transferieren wäre verwirrend für den Nutzer (Verify-Button wäre disabled mit unklarer Begründung).

## US-016: Login-Layout auf Landscape-Mobile reparieren

- Reported direkt aus der Hand: auf Mobile im Landscape-Modus (Viewport-Höhe ≈ 390 px) traten zwei Bugs auf der `/login`-Route auf:
  1. Der Legal-Footer überlappte den Passkey-Button im zentrierten Card-Stack — Card und Footer teilten sich denselben mittig-zentrierten Flex-Stack ohne Reserve am unteren Rand.
  2. Der MFA-Dialog war unbenutzbar: durch `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2` lief der Inhalt (Methodenauswahl + 6 OTP-Slots + Verify/Cancel-Buttons) oben und unten aus dem Viewport, und es gab weder ein `max-height` noch ein `overflow-y`, also auch kein Scrollen innerhalb des Dialogs.
- (1) wurde von einem parallel laufenden Cursor-Agent in `c6f9b00` adressiert: `LoginShell` bekommt `pb-32 md:pb-32`, reserviert also 8 rem Bodenraum, damit der absolut positionierte Footer (`bottom-4`) nicht in den Card-Stack hineinragt; ein neuer Login-Test (`reserves bottom space for the legal footer`) sichert die Klassenanwendung. Lokal nur per Rebase übernommen.
- (2) hier in dieser Iteration gefixt: `DialogPrimitive.Content` in `src/pages/Auth/ui/primitives.tsx` bekommt vier zusätzliche Tailwind-Utilities:
  - `max-h-[calc(100dvh-2rem)]` — kappt die Dialoghöhe auf den sichtbaren Viewport minus 1 rem Marge oben/unten.
  - `w-[calc(100%-2rem)]` (statt nur `w-full`) — gleiche 1 rem-Marge an den Seiten, damit der Dialog auch auf schmalen Geräten nicht an die Bildschirmkanten stößt; `dialogSizes[size]` (z. B. `sm:max-w-md`) gewinnt via `tailwind-merge` bei größeren Breakpoints.
  - `overflow-y-auto` — der Dialog-Body scrollt, sobald der Inhalt höher als der Viewport wird.
  - `overscroll-contain` — verhindert Scroll-Chaining zur Page, sodass die Seite hinter dem Dialog nicht mitruckelt, wenn man am unteren Dialog-Rand weiterscrollt.
- Tests: bestehender `renders the MFA dialog with shadcn Radix dialog semantics`-Case in `src/pages/Auth/ui/auth-ui.test.tsx` um vier zusätzliche `toHaveClass`-Assertions erweitert, damit die responsiven Klassen auf der Dialog-Content nicht versehentlich entfernt werden können.
- Files changed:
  - `src/pages/Auth/ui/primitives.tsx`
  - `src/pages/Auth/ui/auth-ui.test.tsx`
  - `CHANGELOG.md`, `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: für fixed-positionierte Modals immer sowohl `max-h-[calc(100dvh-2rem)]` als auch `overflow-y-auto` setzen — `dvh` folgt dem dynamischen Viewport (Adressleiste eingeklappt vs. ausgefahren), und der Scroll-Container sorgt dafür, dass Footer-Actions (Verify/Cancel) selbst auf 390 px hohen Landscape-Viewports erreichbar bleiben. `overscroll-contain` ergänzt den Pattern, damit der Page-Scroll dahinter ruhig bleibt.
  - Gotchas encountered: `w-full` im Portal-gerenderten Dialog kann an die Bildschirmkanten stoßen, weil das Overlay den Viewport voll bedeckt; `w-[calc(100%-2rem)]` reserviert konsistente seitliche Atemluft und greift trotzdem nicht in die `sm:max-w-md`-Breite via `tailwind-merge`.
  - Process: vor dem lokalen Fix erst rebasen — ein paralleler Cursor-Agent hatte bereits einen Teilfix (`c6f9b00`) für Issue 1 gepusht, der ohne Rebase eine vermeidbare Doppelarbeit / Merge-Konflikt geworden wäre.

## US-015: Login-Copy straffen und MFA-Fehlerfeedback härten

- Three connected polish strokes on the Login route, all driven by direct UX review on the live page:
  1. Dropped the `login.subtitle` "Sign in to your operations workspace." line below the brand-card title (`src/pages/Login.tsx`) — the title alone is enough on a brand-only login surface. Removed the corresponding entry from `src/locales/{en,de}/messages.po` (compiled `.mjs` re-synced).
  2. Lowercased the `login.separator` from "Or" / "Oder" to "or" / "oder" so it reads as a connector rather than a heading.
  3. Removed the `login.mfa.expiry` "This verification step expires at …" `LoginStatusMessage` from the MFA dialog (`src/pages/Login.tsx`); the modal presentation already conveys the urgency and the ISO-style timestamp added cognitive noise without actionable value. Dropped the now-orphan `formatDateTime` helper and `formatApiDateTime` import.
- Localized the new backend wording in `getLocalizedMfaErrorMessage`: both the existing `^MFA verification failed\.?$` pattern and the new `^The provided multi-factor authentication code is invalid\.?$` pattern map to the same canonical message (`MFA verification failed. Please check your code.` / `MFA-Verifizierung fehlgeschlagen. Bitte prüfen Sie Ihren Code.`), so users get a translated and actionable error regardless of which API wording lands in their session.
- Highlighted invalid OTP slots: `LoginOtpInput` (`src/pages/Auth/ui/primitives.tsx`) now forwards its `aria-invalid` prop to every `LoginInputOtpSlot` it renders, so the per-slot `aria-invalid:border-red-600` class actually paints when MFA verify fails. Previously `aria-invalid` only landed on the hidden `<input>` driven by `OTPInput`, leaving the six visible slot boxes without the red border feedback the user expects after a wrong code.
- Centered the OTP slots: the same `LoginOtpInput` wrapper now sets `containerClassName={cn("justify-center", className)}` so the six slot boxes sit horizontally centered in the MFA dialog instead of left-aligned; the `className` prop still wins via `tailwind-merge`, so call sites can override the alignment without forking the primitive.
- Tests:
  - Added a `Login.test.tsx` case that asserts the new backend wording "The provided multi-factor authentication code is invalid." gets localized via the existing canonical MFA-failure message in DE (`mfa-verifizierung fehlgeschlagen`).
  - Added a second `Login.test.tsx` case that drives a failed MFA verify and asserts every one of the six `[data-slot="login-input-otp-slot"]` elements carries `aria-invalid="true"`, proving the red-border styling actually applies after a wrong code.
- Files changed:
  - `src/pages/Login.tsx`, `src/pages/Auth/ui/primitives.tsx`, `src/pages/Login.test.tsx`
  - `src/locales/{en,de}/messages.po`, `src/locales/{en,de}/messages.mjs`
  - `CHANGELOG.md`, `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: backend-error localization for an auth surface should be a `pattern → canonical Lingui msg` table; adding a new backend wording is then a one-line pattern add, not a new translation. Reuse the same canonical message when the user-visible recovery is identical.
  - Gotchas encountered: `OTPInput` from `input-otp` accepts `aria-invalid` and renders it on the hidden text input, but the visible slot `<div>` elements are rendered by the consumer and never see it — propagate `aria-invalid` explicitly to each `LoginInputOtpSlot` so the per-slot `aria-invalid:*` classes can take effect. Equally for centered alignment: the `OTPInput`'s `containerClassName` is the flex container that holds the slots, so `justify-center` belongs there (not on the slot itself).
  - Compatibility constraint: `LoginOtpInput`'s public API is unchanged — both `aria-invalid` forwarding and `justify-center` defaulting happen inside the wrapper. Call sites that previously passed a `className` to override alignment still win because `tailwind-merge` keeps the last-set utility.

## US-014: Login-Footer am Viewport-Rand verankern und Mobile-Hintergrundstreifen entfernen

- Pinned the login legal footer to the bottom of the viewport on every breakpoint instead of letting it ride inside the `LoginShell`'s vertical-center flex stack. The footer is now `absolute bottom-4 left-1/2 w-full max-w-sm -translate-x-1/2 px-6` so it sits 1rem above the viewport edge and stays horizontally centered (with `px-6` safety padding for narrow viewports), and the credential card no longer competes with it for the centered slot — it stays perfectly mid-viewport on mobile (previously the centering was pushed up by the footer + `gap-6`).
- Switched the `LoginShell` (`src/pages/Auth/ui/primitives.tsx`) from `min-h-svh` to `min-h-dvh` so the shell grows with the visible viewport when the mobile browser's URL bar collapses. With `svh` the shell stayed at the small-viewport height and exposed a strip of the body's default background once the URL bar hid; `dvh` makes the shell track the dynamic viewport.
- Added explicit body background colors in `src/index.css`: `body { background-color: #ffffff }` plus a `prefers-color-scheme: dark` override that sets `#09090b` (the same `zinc-950` token the `LoginShell` uses for dark mode). This is the defensive layer: any region the shell does not cover (safe-area-inset under iOS notches, URL-bar fade transitions, scroll over-shoot) now reads the same color as the login surface instead of the UA's `color-scheme: dark` default (~`#1c1b22` / `#1e1e1e`), which the user observed as a "slightly lighter dark gray stripe" along the mobile bottom edge.
- Files changed:
  - `src/pages/Login.tsx` (footer positioning)
  - `src/pages/Auth/ui/primitives.tsx` (`min-h-svh` → `min-h-dvh`)
  - `src/index.css` (body bg color light/dark)
  - `CHANGELOG.md`, `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: any auth surface that fills the viewport should use `min-h-dvh`, not `min-h-svh`. `svh` is the right unit when you explicitly want to layout for the smallest stable viewport (form-only flows that must never reflow when the URL bar toggles); `dvh` is the right unit when you want the surface to always cover what the user sees.
  - Gotchas encountered: the body's default background depends on `color-scheme`; declaring `color-scheme: dark` does NOT also set a dark background color, it only switches UA-rendered controls (scrollbars, default form widgets). Pages that want a specific dark canvas must set `body { background-color: ... }` explicitly under the `prefers-color-scheme: dark` media query (or via Tailwind tokens once the project standardizes them).
  - Compatibility constraint: pinning the footer absolutely is safe because the `LoginShell` already declares `relative`. Other routes that mount `LoginLegalFooter` (currently none) would need their own `relative` ancestor — but the footer is route-local to `Login.tsx`, so the constraint is contained.

## US-013: MFA-Abschluss-Spinner ("Empty"/Spinner) zur Vermeidung des Login-Form-Flackerns

- Diagnosed a visible flicker on `/login` after a successful MFA verify: between `setPendingMfaChallenge(null)` (which starts the Radix Dialog's close animation) and `navigate("/")` (route transition), the dialog fade-out exposed the credential form for a few frames before the redirect. The credential form was already filled with the user's email which felt jarring on a verified login.
- Added the canonical shadcn `Spinner` + `Empty` primitives in `src/pages/Auth/ui/primitives.tsx` so the route can render a loading surface that mirrors the shadcn `new-york-v4` registry: `LoginSpinner` wraps `Loader2` (lucide) with `role="status"`, an overridable `aria-label`, and `animate-spin`; `LoginEmpty`, `LoginEmptyHeader`, `LoginEmptyMedia` (with `cva` `default` / `icon` variants), `LoginEmptyTitle`, `LoginEmptyDescription`, and `LoginEmptyContent` keep the shadcn DOM/data-slot structure but swap `bg-muted` / `text-foreground` for the existing zinc palette to fit the auth chrome.
- Wired the completion state in `src/pages/Login.tsx`: a new `isCompletingLogin` flag flips to `true` in `handleVerifyMfa` immediately before `setPendingMfaChallenge(null)`, hides the credential card via `hidden` + `aria-hidden`, hides the language switcher, and renders a centered `LoginEmpty` block with `LoginSpinner`, the localized title (`login.completing.title` – "Completing sign-in" / "Anmeldung wird abgeschlossen"), and a short description (`login.completing.description` – "Please wait…" / "Bitte warten…"). The title is overridden locally with `text-sm/relaxed font-bold` so title and description share the same font-size while only the title is bold, which feels cleaner than the default shadcn `text-lg` title for a single-line transient state. The MFA dialog closes over the spinner, so users never see the credential form between dialog and redirect.
- Restored the credential form on completion failure: when the asynchronous tail (`login(user)`, `navigate("/")`) throws after the completion state was entered, the catch resets `isCompletingLogin` to `false` so the user lands back on the credential form with the surfaced `setError(...)` message instead of a stuck spinner.
- Tests:
  - Added `auth-ui.test.tsx` coverage for `LoginSpinner` (`role="status"`, `data-slot="login-spinner"`, `animate-spin` via `toHaveClass`) and the full `LoginEmpty` composition (all `data-slot` markers including the `icon` variant on `LoginEmptyMedia`).
  - Added a new `Login.test.tsx` integration test that drives a successful MFA verify and asserts the spinner state is visible (`data-testid="login-completing"`, `aria-live="polite"`, `aria-busy="true"`, the spinner status node, the title, and the description), that the credential controls (`Log in` button, `email` textbox) are no longer reachable by accessible queries during completion, and that the MFA heading is gone.
  - Locales: added `login.completing.title` and `login.completing.description` to `src/locales/en/messages.po` and `src/locales/de/messages.po` with manual EN/DE strings; recompiled message catalogs.
- Files changed:
  - `src/pages/Auth/ui/primitives.tsx` (Spinner + Empty primitives, Loader2 import)
  - `src/pages/Login.tsx` (state, render branch, completion handler updates, new primitive imports)
  - `src/pages/Login.test.tsx` (completion-state integration test)
  - `src/pages/Auth/ui/auth-ui.test.tsx` (spinner + empty primitive tests)
  - `src/locales/{en,de}/messages.po`, `src/locales/{en,de}/messages.mjs` (new completion strings + recompiled)
  - `CHANGELOG.md`, `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: when a Radix Dialog wraps a long async operation that resolves while the dialog is closing, swap the page background to a spinner state BEFORE closing the dialog (same render batch). React 18 auto-batching collapses the two state updates into one commit, so the dialog's close animation reveals the spinner instead of the previous content.
  - Gotchas encountered: an SVG icon's `className` is a `SVGAnimatedString` in JSDOM, so asserting `.className.toContain("animate-spin")` fails — use `toHaveClass(...)`. `react-testing-library`'s `getByRole` excludes `aria-hidden` ancestors by default, which is convenient: hiding the credential card with `aria-hidden={true}` simultaneously hides it from accessibility queries during completion.
  - Compatibility constraint: the Empty/Spinner primitives are exported through the existing `src/pages/Auth/ui/index.ts` barrel (`export *`) so future auth surfaces (e.g. passkey completion, password reset) can reuse the same loading layer without new imports.

## US-012: Login-Button auf class-variance-authority und MFA-Karten auf Radix Label kanonisieren

- Closed two minor non-canonical-shadcn gaps left over from US-011: `LoginButton` still managed its variants through a hand-written `Record<Variant, string>` and the MFA-method picker wrapped each `LoginRadioGroupItem` in a native HTML `<label>` instead of `LoginFieldLabel` (Radix Label).
- Refactored `LoginButton` in `src/pages/Auth/ui/primitives.tsx` to use `cva()`: a single `loginButtonVariants` definition holds the base classes plus the per-`variant` map (`default`, `secondary`, `outline`, `ghost`) with `defaultVariants.variant = "default"`; the standalone `focusRing` helper was inlined into the cva base; the public `LoginButtonVariant` type is now derived from `VariantProps<typeof loginButtonVariants>` so adding a new variant only touches the cva definition.
- Replaced the native `<label>` wrapping each `LoginRadioGroupItem` in `src/pages/Login.tsx` with `LoginFieldLabel` (which itself wraps `@radix-ui/react-label`); the radio item gets an explicit `id={`mfa-method-${method}`}` and the label sets `htmlFor` to the same id so Radix Label handles click forwarding to the `<button role="radio">`. Added `font-normal` to the card override so `tailwind-merge` cleanly cancels the label primitive's `font-medium`.
- Files changed:
  - `src/pages/Auth/ui/primitives.tsx`
  - `src/pages/Login.tsx`
  - `CHANGELOG.md`, `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: when a `LoginFieldLabel` wraps a non-text "card" surface, override the primitive's `font-medium` with `font-normal` in the call site so `tailwind-merge` keeps the card body weight uniform; the label itself stays bold-capable for true form labels.
  - Gotchas encountered: `cva()` infers `variant` as `"default" | "secondary" | ... | null | undefined` through `VariantProps`; wrap the public type with `NonNullable<...>` when re-exporting it, otherwise consumers see a `null`-tainted union that does not match the original hand-written variant type.

## US-011: Login-Route vollständig auf echte shadcn-Komponenten (Radix-basiert) umstellen

- Diagnosed that the existing `LoginXxx` primitives were only **visually** shadcn (Tailwind classes in the shadcn idiom) but technically had **zero** Radix backing — no `@radix-ui/*` package was installed in the repo. The login route additionally still contained three native HTML controls (`<select>` for the language switcher, `<fieldset>` + `<input type="radio">` for the MFA-method selector, and an inner `<form>` in the MFA dialog) that no shadcn primitive wrapped.
- Installed the canonical shadcn dependency set: `@radix-ui/react-dialog`, `@radix-ui/react-label`, `@radix-ui/react-radio-group`, `@radix-ui/react-select`, `class-variance-authority`, and `tailwind-merge`. Upgraded `cn` in `src/pages/Auth/ui/utils.ts` to compose `clsx` with `twMerge` so conflicting Tailwind classes deduplicate predictably, matching the canonical shadcn implementation.
- Refactored `LoginDialog` in `src/pages/Auth/ui/primitives.tsx` from a custom `div role="dialog"` + bugbot's hand-rolled focus-trap to a thin wrapper around `@radix-ui/react-dialog` (Portal + Overlay + Content). The custom focus-trap, the manual `aria-hidden` / `inert` background mutation, the `focusableElementSelector` / `getFocusableElements` helpers, and the `LoginDialogContext` were all removed because Radix Dialog handles focus trap, auto-focus, escape dismissal, and outside-click dismissal internally. `LoginDialogTitle` / `LoginDialogDescription` are now thin wrappers around `DialogPrimitive.Title` / `DialogPrimitive.Description`. The public API of `LoginDialog` (`open`, `onClose`, `size`, `children`, `className`) is unchanged so `Login.tsx` did not need touching for the dialog migration.
- Refactored `LoginFieldLabel` to wrap `@radix-ui/react-label` so it correctly associates with non-`<input>` form controls (notably the Radix RadioGroup item which renders as `<button role="radio">`).
- Added new primitives in `src/pages/Auth/ui/primitives.tsx`:
  - `LoginRadioGroup` + `LoginRadioGroupItem` wrap `@radix-ui/react-radio-group`. The item renders the radio button with a filled `Circle` indicator from `lucide-react` and SecPal's zinc theme.
  - `LoginSelect` + `LoginSelectGroup` + `LoginSelectValue` + `LoginSelectTrigger` + `LoginSelectContent` + `LoginSelectItem` wrap `@radix-ui/react-select`. Trigger uses `ChevronDown`, Item uses `Check` for the selected indicator, and the Content portal includes hidden `LoginSelectScrollUpButton` / `LoginSelectScrollDownButton` for overflow viewports. Root/Group/Value are explicit function wrappers (not `const x = Primitive.Root` re-exports) so that `react-refresh/only-export-components` stays clean.
- Migrated `src/pages/Login.tsx` to use the new primitives end-to-end:
  - Replaced the MFA dialog's inner `<form className="space-y-6">` with `LoginForm` (matches the primary login form's primitive choice).
  - Replaced the MFA-method `<fieldset>` + `<legend>` + per-method `<label>` wrapping `<input type="radio">` with a `LoginRadioGroup` containing `LoginRadioGroupItem` instances; each item carries an `aria-label` (`Recovery code` / `Authenticator code`) so screen readers announce a meaningful name even when the surrounding "card" label wraps the radio button.
  - Replaced `LoginLanguageSwitcher`'s native `<select>` with the `LoginSelect` stack. The trigger keeps the `aria-label="Select language"` from the previous implementation and uses `w-auto min-w-[7rem]` so it stays compact in the shell's top-right slot.
  - Dropped the now-unused `ChangeEvent` type import.
- Tests:
  - Added JSDOM stubs in `tests/setup.ts` for `Element.prototype.hasPointerCapture`, `setPointerCapture`, `releasePointerCapture`, and `scrollIntoView` so Radix Select can be opened in Vitest. Without these, opening a Select trigger throws.
  - Added a `selectLanguage(visibleName)` helper in `src/pages/Login.test.tsx` that dispatches the canonical `pointerDown` + `pointerUp` + `click` sequence on the Radix Select trigger and option, since `fireEvent.change` no longer works against a Radix combobox button. Updated the two language-switcher tests to use it.
  - Rewrote the `auth-ui.test.tsx` MFA-dialog test for the Radix DOM: removed the `aria-modal="true"` assertion (Radix Dialog does not set this attribute), checked `data-state="open"` instead, and verified background hiding via `closest('[aria-hidden="true"]')` since Radix's `HideOthers` sets aria-hidden on the dialog portal's body-level siblings rather than directly on the test fixture's "Language" button. Dropped the manual backdrop-click assertion and kept the Escape-to-close assertion (Radix DismissableLayer handles both; the test now asserts the close happens, not the exact event path).
- Files changed:
  - `package.json`, `package-lock.json` (new Radix + cva + tailwind-merge deps)
  - `src/pages/Auth/ui/primitives.tsx`
  - `src/pages/Auth/ui/utils.ts`
  - `src/pages/Auth/ui/auth-ui.test.tsx`
  - `src/pages/Login.tsx`
  - `src/pages/Login.test.tsx`
  - `tests/setup.ts`
  - `src/locales/de/messages.po`, `src/locales/en/messages.po`, `src/locales/{en,de}/messages.mjs` (catalogs re-synced for the new Login.tsx Recovery/Authenticator code msg references)
  - `CHANGELOG.md`, `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: a Login surface that claims "shadcn" must be backed by Radix for the interactive primitives (Dialog, Select, RadioGroup, Label); CSS-only mimicry leaks once a password manager, screen reader, or pointer-capture-aware browser shows up. Wrap each shadcn primitive in a `LoginXxx` re-export so the route imports stay barrel-only (`./Auth/ui`).
  - Gotchas encountered: Radix Dialog does not set `aria-modal="true"`; tests must rely on `role="dialog"` + `data-state="open"` + the `aria-hidden` overlay-managed by `HideOthers`. Radix Select needs JSDOM pointer-capture stubs in the global test setup, otherwise opening the trigger throws synchronously. `react-refresh/only-export-components` flags `export const X = Primitive.Root` re-exports — wrap each in a function so the dev-time HMR stays happy.
  - Compatibility constraint: the public API of `LoginDialog` is preserved (`open`/`onClose`/`size`/`children`/`className`), so future consumers can keep their call-sites untouched even though the implementation now goes through Radix.

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

## US-001: Lock Auth/Onboarding Migration Baseline

- Added a Vitest migration-boundary audit that recursively covers `src/pages/Auth`, `src/pages/Login.tsx`, `src/pages/Onboarding`, `src/components/onboarding-layout.tsx`, and `src/components/auth-layout.tsx`.
- The audit fails on `@headlessui/react`, `LicenseRef-TailwindPlus`, and static imports/exports that point at old shared Catalyst/Tailwind Plus component wrappers under `src/components`.
- Replaced the remaining Tailwind Plus-marked `AuthLayout` shell with a SecPal-owned layout so the public onboarding complete flow can stay inside the audited scope.
- Added `npm run test:migration-boundary` for focused local runs; the audit is also included in the normal `npm test` Vitest suite.
- Files changed:
  - `package.json`
  - `src/components/auth-layout.tsx`
  - `tests/auth-onboarding-migration-boundary.test.ts`
  - `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: use a route-scope audit with a small import resolver instead of one-off text search so local shadcn barrels stay allowed while old shared wrappers are blocked.
  - Gotchas encountered: Vitest transforms `import.meta.url` in this setup, so repo-root filesystem audits should resolve from `process.cwd()` when the test is run through npm scripts.

## US-002: Create Shared Shadcn Utilities

- Added canonical shadcn-compatible `cn` in `src/lib/utils.ts`, implemented with `clsx` plus `tailwind-merge`.
- Re-exported the shared helper through both Auth and Onboarding UI utility barrels so existing route-local import paths stay stable while both primitive sets use the same implementation.
- Added unit coverage for conditional class merging, Tailwind conflict resolution, and the shared Auth/Onboarding `cn` binding.
- Files changed:
  - `src/lib/utils.ts`
  - `src/lib/utils.test.ts`
  - `src/pages/Auth/ui/utils.ts`
  - `src/pages/Onboarding/ui/utils.ts`
  - `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: keep route-local UI barrels as the public import surface, but delegate shared shadcn infrastructure to `@/lib/utils` so Auth and Onboarding cannot diverge.
  - Gotchas encountered: unit tests should assert both class conflict output and function identity through the route barrels; otherwise a future copy-paste helper could still satisfy output-only checks while reintroducing split implementations.

## US-003: Radix-Back Onboarding Controls

- Replaced onboarding-local `Checkbox`, `RadioGroup`, `RadioGroupItem`, `Select`, `FieldLabel`, and `Progress` wrappers with shadcn-style Radix-backed primitives while leaving Button, Input, Textarea, Card, Badge, and Alert as local shadcn-style components.
- Preserved existing onboarding call sites by adapting Radix Checkbox change events to the previous `event.target.checked` shape and by mapping existing `<Select><option /></Select>` children into Radix Select items.
- Migrated onboarding radio sections to Radix controlled `value`/`onValueChange` flows in the wizard and residential address history blocks, preserving disabled, invalid, required, label, and dark-mode styling.
- Updated onboarding primitive and wizard tests for Radix combobox/listbox semantics, radio keyboard behavior, and Radix option selection helpers.
- Files changed:
  - `package.json`
  - `package-lock.json`
  - `src/pages/Onboarding/ui/primitives.tsx`
  - `src/pages/Onboarding/ui/onboarding-ui.test.tsx`
  - `src/pages/Onboarding/OnboardingWizard.tsx`
  - `src/pages/Onboarding/OnboardingWizard.test.tsx`
  - `src/pages/Onboarding/OnboardingResidentialAddressHistoryFields.tsx`
  - `tests/unit/pages/Onboarding/OnboardingWizard.test.tsx`
  - `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: keep Radix-backed onboarding primitives behind the existing onboarding UI barrel and adapt only narrow compatibility seams (`onChange` event shape, option mapping) so feature code can migrate incrementally.
  - Gotchas encountered: closed Radix Select content is unmounted, so tests cannot assert native `<option>` text in the DOM or use `user.selectOptions` against a combobox button.

## US-004: Replace Onboarding Command Popover

- Replaced the onboarding `CommandPopover`'s absolute, hand-rendered popover shell with Radix Popover `Root`/`Trigger`/`Portal`/`Content`, preserving the existing searchable listbox behavior, ArrowUp/ArrowDown/Enter/Escape handling, disabled option behavior, selected option state, empty state, and value callback shape.
- Made `placeholder`, `searchPlaceholder`, and `emptyMessage` required `CommandPopover` props so all user-facing copy is owned and translated by call sites; existing onboarding nationality and country call sites already pass localized strings.
- Added primitive regressions for Radix outside interaction dismissal and form-friendly tab flow through the searchbox/options and onward to the next control.
- Files changed:
  - `package.json`
  - `package-lock.json`
  - `src/pages/Onboarding/ui/primitives.tsx`
  - `src/pages/Onboarding/ui/onboarding-ui.test.tsx`
  - `.context/progress.md`
- **Learnings for future iterations:**
  - Patterns discovered: Radix Popover is a good replacement boundary for command-style onboarding controls when the route-local API stays stable and only the popover lifecycle/positioning moves to Radix.
  - Gotchas encountered: Radix Popover portal content uses a looping focus scope at the content boundary, so command controls that act like form fields need an explicit Tab boundary handler to close the popover and continue to the next control.
