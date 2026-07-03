<!--
SPDX-FileCopyrightText: 2026 SecPal
SPDX-License-Identifier: CC0-1.0
-->

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added deployment-backed `/source` metadata contracts so the public AGPL
  source-offer page can consume immutable corresponding source URLs for the
  deployed release set without exposing broader runtime diagnostics:
  `/source-offer.json` now covers `frontend` / `contracts` plus optional
  `android`, `GET /v1/release` provides the live `api` source URL, the
  frontend tolerates mixed valid/invalid metadata sources without discarding
  still-valid release links, and `docs/deployment-spa-routing.md` documents the
  frontend versus deployment/API responsibilities.
- Added the canonical shadcn `components.json` baseline for the frontend
  (`new-york`, Tailwind v4 `src/index.css`, `zinc`, Lucide, and repo aliases)
  plus a guardrail inventory test for the remaining non-canonical UI
  compatibility layers.
- Added mobile Playwright regression coverage for the authenticated shell's
  nested sidebar-sheet user menu: `tests/e2e/auth.spec.ts` now proves that the
  `mobile-chrome` flow can lock the app, unlock it again, and sign out from the
  locked state without a page reload, so Radix `Sheet` + `DropdownMenu`
  interaction regressions surface in automated browser runs instead of only in
  manual mobile testing.
- Standardized the authenticated app's loading experience around a shared `src/ui` skeleton layer (`Skeleton`, `PageSkeleton`, `SectionSkeleton`, `TableSkeleton`, `FormSkeleton`, `LoadingRegion`) and documented the contract in `src/ui/MIGRATION.md`. List pages (customers, sites, employees, activity logs, Android provisioning) now keep their table/header chrome mounted during the first load with skeleton rows, switch to row-level skeletons only when no rows are cached, and wrap subsequent refresh/pagination/filter cycles in `LoadingRegion` so previously rendered rows stay visible while the request is in flight. Detail/edit screens (customer, site, employee, employee contacts, employee create) keep page titles and action regions visible during initial entity loads and render `SectionSkeleton`/`FormSkeleton` only in the data region; `SiteDetail` renders the site record as soon as it loads and falls back to inline placeholders for customer and organizational-unit lookups (US-001..US-006).
- Replaced the global route loader spinner with a shell-shaped `PageSkeleton` fallback, kept authenticated shell chrome mounted during persisted-session bootstrap revalidation, and routed authenticated route chunk loading through layout-owned `Suspense` boundaries that render `RouteContentFallback` instead of a full-screen guard loader. Route guards now share a single `routeGuardAuth` bootstrap check so `ProtectedRoute`, `FeatureRoute`, `PermissionRoute`, `OrganizationalRoute`, and `LoginRoute` no longer flash a guard-specific `Loading…` screen when a session snapshot exists (US-002, US-003).
- Converted operational modules (`OrganizationalUnitTree`, `ActivityLogList`, `AndroidProvisioningPage`, `SettingsPage`) to keep their headers, filters, forms, and action controls mounted on first load. Loading-heavy panes now render `SectionSkeleton`/row skeletons inside the existing card/table chrome and fall back to `LoadingRegion` or inline busy indicators for safe refreshes such as activity-log manual refresh, organizational unit cache refreshes, Android revoke errors, and passkey post-registration list refreshes (US-007).
- Kept the login card mounted during post-MFA/session completion via a card-local progress overlay and disabled credentials instead of swapping to a separate "completing" screen, and replaced the onboarding wizard initial/step-template loading with a stable wizard frame plus `FormSkeleton`. Token validation on `/onboarding/complete` now renders `FormSkeleton` inside the auth card instead of plain "Validating onboarding link" text (US-008).
- Activated a shared route/data prefetch strategy backed by `src/routeModules.ts`: capability-gated shell idle warmups prefetch only route chunks (`scheduleRoutePrefetch` with `includeApi: false`) while `PrefetchLink` warms both the chunk and the matching API GET data on `mouseenter`/`focus`. Touch interactions now warm the route chunk only (`prefetchPathModuleOnly`) to avoid spurious API requests during scroll. The shared `usePrefetch` hook owns route plans for primary navigation and customer/site/employee detail paths, deduplicates in-flight and completed prefetches, caches only `Response.ok` results, and falls back to `console.warn` in dev for non-ok responses or rejected requests (US-009 plus audit fix-up).

- Migrated the Login page from the legacy Catalyst component set to a new self-contained `src/pages/Auth/ui/primitives.tsx` design-system layer (`LoginShell`, `LoginCard`, `LoginCardHeader`, `LoginCardTitle`, `LoginForm`, `LoginButton`, `LoginInput`, `LoginField`, `LoginFieldGroup`, `LoginFieldLabel`, `LoginFieldDescription`, `LoginFieldError`, `LoginFieldSeparator`, `LoginStatusMessage`, `LoginDialog`, `LoginInputOtp`, `LoginInputOtpGroup`, `LoginInputOtpSlot`, `LoginOtpInput`, and related helpers), removing the dependency on external Catalyst primitives for the auth flow and aligning the visual language with the rest of the shadcn-based UI.
- Restructured `/login` around the shadcn `login-05` block: a centered `max-w-sm` card with brand block on top, primary submit, `LoginFieldSeparator` "Or", and the passkey button as the secondary action, with the language switcher pinned to the shell's top-right and the legal footer rendered as a centered strip below the card.
- Adopted the official shadcn `input-otp` library (`input-otp@1.4.2`) and wrapped it in route-local `LoginInputOtp` / `LoginInputOtpGroup` / `LoginInputOtpSlot` primitives styled to the existing zinc theme; `LoginOtpInput` is now a thin convenience wrapper over the new primitives with digits-only pattern enforcement (`REGEXP_ONLY_DIGITS`) for TOTP entry in the MFA challenge dialog.
- Inlined `LoginLanguageSwitcher` and `LoginLegalFooter` into the Login page, removing the dependency on the shared `LanguageSwitcher` and `Footer` components for the auth flow.
- Extended `INVALID_CREDENTIALS_PATTERN` to also match the short `"Invalid credentials"` backend message so both forms are localized consistently.
- Added i18n coverage for previously hardcoded error strings in the Login page: passkey completion errors, MFA completion errors, unexpected submission errors, and the MFA verification failure message.
- Added localized `login.title` ("Welcome to SecPal" / "Willkommen bei SecPal") and `login.separator` ("or" / "oder") strings for the new `login-05` brand block and separator.

### Changed

- Moved the AGPL/license and source-code notices out of the authenticated and
  login footers so those footers keep only the "Powered by SecPal" slogan; the
  authenticated sidebar now exposes a collapsible `Legal` section above the
  user menu with dedicated `AGPL v3+` and `Source Code` entries, and the
  source entry preserves the current route in navigation state for the return
  flow.
- Hardened `/source` deployment manifests by trimming validated source URLs
  before rendering them and by waiting for the manifest request to settle
  before showing fallback repository guidance, so deployments do not flash
  mutable fallback links ahead of immutable release URLs.
- Kept `/source` deployment manifests effective when the separate live API
  release fetch fails before returning an HTTP response, so valid same-origin
  immutable frontend and contracts source links no longer fall back to mutable
  repository URLs on mixed deployment/API outages.
- Restored the `/source` fallback repository links while the
  `/source-offer.json` request is still pending, so stalled manifest fetches
  do not leave the corresponding-source section empty on the public AGPL page.
- Narrowed the `/source` deployment notice so optional repositories that still
  fall back to a public repository link are no longer described as immutable
  deployment source, and added explicit short-cache delivery rules for
  `/source-offer.json` to the shipped Apache/Nginx deployment templates.
- Fixed the shipped Apache rewrite rule for `/source-offer.json` so deployed
  manifests are served when present while missing manifests still return HTTP
  404 instead of the SPA shell.
- Limited the `/source` Android repository block to deployments that publish an
  explicit Android release entry in `/source-offer.json`, so frontend-only
  deployments no longer advertise Android source links without a matching
  released Android version.
- Refined the `/source` explanatory copy in English and German so the
  deployment and fallback notices read naturally while still describing the
  source-offer behavior precisely.
- Refined the new legal-menu follow-up so the collapsed desktop sidebar opens
  `Legal` in a separate dropdown instead of expanding the whole sidebar, the
  login `Legal` trigger keeps the same neutral surface styling as the language
  picker in dark mode, the authenticated `Legal` triggers no longer compose
  sidebar tooltips through Radix `asChild` wrappers, the `Legal` section now
  lives in the scrollable sidebar content instead of the fixed footer, the
  vault-locked login shell keeps bottom safe-area breathing room when no footer
  is present, the user menu stays bounded for long profile names and email
  addresses, and pointer dismissal now clears trigger focus for the shared
  dropdown primitives used by both flows.
- Fixed pointer-dismissed dropdown menus that use trigger-child composition so
  Radix menu triggers rendered through shared `Button` and
  `SidebarMenuButton` children still blur their restored focus ring instead of
  staying visibly focused after pointer-driven close.
- Limited pointer-dismiss blur handling to the dropdown or select trigger that
  actually owns the closing overlay, so clicking a different menu trigger no
  longer strips focus from the newly targeted control.
- Aligned the remaining footer slogan with the standard `text-xs` type scale
  and tightened the surrounding vertical spacing now that the legal-link row is
  gone.
- `AuthContext` now keeps new logins behind the full sensitive logout cleanup
  completion path, so the five-second best-effort logout timeout no longer lets
  a replacement session race the previous session's IndexedDB and cache
  teardown.
- Widened the shared authenticated shell content stage to a 1600px desktop cap
  and aligned the shell footer, route loader, and update banner with the same
  container so large desktop screens can use materially more horizontal space
  while page-local form and detail views keep their narrower limits.
- Rebuilt the authenticated application shell navigation on the canonical shadcn
  `sidebar-07` composition: the old bespoke menu shell is replaced by shared
  shadcn/Radix/Lucide `Sidebar`, `Collapsible`, `DropdownMenu`, `Sheet`,
  `Breadcrumb`, `Separator`, and avatar primitives, with the desktop sidebar
  collapsing to icons, the mobile menu using the matching sheet pattern, and
  regression coverage updated to assert the real `sidebar-07` structure instead
  of the removed custom grouping model.
- Fixed the mobile authenticated shell so nested user-menu actions close the
  sidebar sheet before navigation, lock, and logout side effects run. The user
  menu and workspace switcher now disable Radix dropdown modality while they
  live inside the mobile sidebar `Sheet`, which prevents the stale
  `pointer-events: none` / scroll-lock state that previously trapped the app
  behind the lock screen until a manual reload.
- Tightened the authenticated shell's mobile/accessibility follow-up fixes: the
  top-level authenticated-route loader now keeps the update prompt mounted while
  lazy route modules are still loading, the mobile sidebar close button uses
  localized labels with a touch-sized hit area, primary mobile nav items keep a
  larger tap target, and the shell header now grows by the top safe-area inset
  instead of only padding inside a fixed height.
- Hardened the nested mobile sidebar overlays and logout cleanup lifecycle so
  the user menu and team switcher portal into the active shell container, the
  mobile trigger keeps the canonical touch target sizing, and logout cleanup
  continues after bounded analytics or vault-cleanup waits instead of leaving
  the authenticated shell trapped behind stale overlay or cleanup barriers.
- Tightened the logout cleanup barrier follow-up so pre-timeout sensitive
  cleanup failures are logged again instead of being swallowed by the timeout
  wrapper, and stale barrier-owner reconciliation now runs before the current
  logout cleanup owner token is removed from storage-backed barrier state.
- Followed up the shell/auth review findings again by keeping the sidebar rail
  hidden through the mobile sheet breakpoints and bounding post-logout login
  waits to a second five-second best-effort timeout so a hung sensitive cleanup
  cannot block the next successful session forever.
- Followed up the auth/app-shell edge cases again by normalizing public
  trailing-slash routes before suppressing the root `UpdatePrompt`, by keeping
  new logins blocked on destructive logout cleanup even when trailing browser
  push teardown is still bounded by the five-second best-effort handoff wait,
  and by releasing the logout barrier owner as soon as destructive cleanup
  finishes so later logouts do not inherit stale owner state.
- Completed the shadcn/Radix/Lucide UI migration proof by tightening the
  repo-wide legacy UI guardrail to a zero allowlist, removing the final shared
  shell compatibility aliases, and documenting `src/ui` as the complete
  canonical production UI layer (US-007).
- Removed the remaining UI-surface holdouts that still only imitated the
  canonical shared primitives: destructive load/error states now render through
  shared `Alert*` slots instead of ad-hoc text blocks or route-local alert
  shells, shared auth status messaging now composes the canonical `Alert`
  primitive directly, and the repository documentation now describes the final
  `src/ui` architecture instead of an in-progress migration state (US-007).
- Moved the remaining Customers, Sites, Employees, and admin/domain surface UI
  consumers onto direct `@/ui` imports, promoted the still-needed customer/site
  and employee compositions to prefixed shared exports, and deleted the
  route-local `CustomerSites` / `Employees` UI barrels plus obsolete generic
  `src/components/*` wrapper files from the compatibility inventory (US-006).
- Moved the auth and onboarding route-local primitive layers into the canonical
  shared `@/ui` surface, updated login, MFA, onboarding wizard, completion, and
  submitted screens to import shared primitives directly, and deleted
  `src/pages/Auth/ui` plus `src/pages/Onboarding/ui` from the remaining
  compatibility inventory while preserving command-popover Tab focus handoff
  through the shared primitive (US-005).
- Replaced the shared searchable/selectable control compatibility layer with
  canonical shadcn `Command*` primitives backed by `cmdk`, migrated the
  onboarding and employee command-popover adapters onto that pattern, and
  removed the obsolete generic `combobox`, `listbox`, `select`, and
  `src/ui/searchableControls.tsx` wrappers from the remaining legacy UI
  inventory (US-004).
- Migrated the authenticated application shell navigation from bespoke
  app-shell sidebar, mobile drawer, and dropdown approximations to shadcn/Radix
  `Sidebar`, `Sheet`, and `DropdownMenu` composition. The global user menu,
  mobile navigation overlay, sidebar links, and shell layout now expose
  canonical shadcn slot names with regression coverage for focusable menu and
  sheet behavior (US-003).
- Migrated the shared `src/ui` core primitives to canonical shadcn slot names,
  CSS-variable theme tokens, and Radix-backed avatar structure. Buttons,
  inputs, textareas, fields, selects, checkboxes, switches, radios, dialogs,
  alerts, cards, badges, progress, avatars, tables, skeletons, and loading
  states now share the shadcn token layer from `src/index.css`, and affected
  primitive tests assert the canonical structure directly (US-002).
- Replaced the repo-local `markdownlint-cli2` pre-commit and preflight path with pinned `markdownlint-cli@0.49.0` usage so markdown validation now matches the shared `.github` governance baseline
- Included `.github/instructions/github-workflows.instructions.md` in the frontend AI-governance baseline so provider-neutral agents and Copilot-derived tooling load the same workflow-policy overlay when reviewing or editing GitHub automation.
- Updated `docs/development/TDD_WORKFLOW.md` to keep the SPDX copyright year current after the 2026 governance-link refresh.
- `/login` no longer renders the legacy split brand-panel layout on large viewports; the `login-05` centered card is now the single layout across breakpoints. The `LoginBrandPanel` primitive remains available in `src/pages/Auth/ui/primitives.tsx` for future use but is no longer composed on the login route.
- Swapped the three icons on the login surface from the legacy outline icon package to `lucide-react`: passkey-action `KeyIcon` → `KeyRound`, AGPL-license `ScaleIcon` → `Scale`, source-code `CodeBracketIcon` → `Code2`.
- Migrated every remaining non-shadcn surface on the login route to true Radix-backed shadcn primitives, fulfilling the "Login uses shadcn exclusively" requirement:
  - `LoginDialog` (MFA challenge) now wraps `@radix-ui/react-dialog` with Portal + Overlay + Content + auto-focus + focus-trap + Esc/outside-click dismissal handled by Radix (the previous custom div + hand-rolled focus-trap is removed; `LoginDialogTitle` / `LoginDialogDescription` are thin wrappers around `DialogPrimitive.Title` / `DialogPrimitive.Description`).
  - `LoginFieldLabel` wraps `@radix-ui/react-label` for proper `<button role="radio">` association.
  - New `LoginRadioGroup` / `LoginRadioGroupItem` wrap `@radix-ui/react-radio-group` and replace the native `<fieldset>` + `<input type="radio">` MFA-method selector.
  - New `LoginSelect` / `LoginSelectTrigger` / `LoginSelectValue` / `LoginSelectContent` / `LoginSelectItem` (plus internal `LoginSelectScrollUpButton` / `LoginSelectScrollDownButton`) wrap `@radix-ui/react-select` and replace the native `<select>` + `<option>` language switcher.
  - The MFA dialog's inner `<form className="space-y-6">` is now `LoginForm`, consistent with the primary login form.
- Upgraded the `cn` helper in `src/pages/Auth/ui/utils.ts` to compose `clsx` with `tailwind-merge` so conflicting Tailwind classes deduplicate predictably (matches the canonical shadcn `cn` implementation).
- Added JSDOM stubs for `Element.prototype.hasPointerCapture` / `setPointerCapture` / `releasePointerCapture` / `scrollIntoView` in `tests/setup.ts` so Radix Select can be opened and interacted with in Vitest under JSDOM.
- Refactored `LoginButton` in `src/pages/Auth/ui/primitives.tsx` to use `class-variance-authority` (`cva`) for variant management, matching the canonical shadcn stylistic approach: `loginButtonVariants` is now a `cva()` definition with a `variants.variant` map (`default` / `secondary` / `outline` / `ghost`) and `defaultVariants`; the public `LoginButtonVariant` type is derived from `VariantProps<typeof loginButtonVariants>`; the standalone `focusRing` helper class is inlined into the cva base so it is always applied without an extra `cn(...)` argument.
- Replaced the native `<label>` element that wrapped each `LoginRadioGroupItem` "card" in the MFA-method selection (`src/pages/Login.tsx`) with `LoginFieldLabel` (Radix Label) bound to the radio via `htmlFor` / `id` (`mfa-method-${method}`), so the entire card click target is dispatched through Radix Label instead of a raw HTML label and the login route now contains zero native form-control HTML on the MFA flow.
- Added the canonical shadcn `Spinner` + `Empty` primitives as `LoginSpinner`, `LoginEmpty`, `LoginEmptyHeader`, `LoginEmptyMedia` (with `default` / `icon` `cva` variants), `LoginEmptyTitle`, `LoginEmptyDescription`, and `LoginEmptyContent` in `src/pages/Auth/ui/primitives.tsx`. `LoginSpinner` wraps `Loader2` from `lucide-react` with `role="status"`, an overridable `aria-label`, and `animate-spin`; the Empty primitives mirror the shadcn `new-york-v4` registry, with `bg-muted` / `text-foreground` swapped for the existing zinc palette so the surface matches the rest of the auth chrome.
- Added a successful-MFA completion UI on `/login`: after `verifyMfaChallenge` resolves, `Login.tsx` flips a new `isCompletingLogin` state, hides the credential card behind `hidden` + `aria-hidden`, hides the language switcher, and renders a centered `LoginEmpty` block (`aria-live="polite"`, `aria-busy="true"`) with `LoginSpinner` + `LoginEmptyTitle` ("Completing sign-in") + `LoginEmptyDescription` ("Please wait…") that stays on screen while `login()` and `navigate("/")` finish. The MFA dialog closes over this completion state, so the user never sees the login form re-flash between the dialog closing and the route transitioning. On failure during completion the state is reset and the credential form is restored with the surfaced error message intact.

### Fixed

- Removed the duplicate `AGPL v3+` and `Source Code` footer links from the
  vault-locked login shell now that the interactive login `Legal` menu already
  exposes those notices there.
- Restored the login bootstrap screen's AGPL and source-code footer links so
  legal notices stay reachable while auth bootstrap is still pending.
- Localized the sidebar user-menu trigger label, corrected destructive
  dropdown-menu icon tinting to use the canonical shadcn descendant selector,
  and removed the unused quick-access sidebar section that was no longer part
  of the approved static menu shell.
- Restored the PWA update banner on authenticated onboarding routes, close the
  mobile sidebar sheet after primary navigation, persist the desktop sidebar
  collapse preference across reloads, and keep the authenticated breadcrumb
  label aligned with standalone routes such as `/about`.
- Fixed shadcn/Radix migration regressions in dev proxy startup, mobile sheet
  overlays, address autocomplete active-descendant IDs, login status message
  markup, and passive advisory alert roles.
- Restored the checked/unchecked icon state on shared `Switch` controls with
  `showIcons`, corrected dropdown-menu item labels to render as inline content
  instead of nested Radix menu-section labels, and split system color-scheme
  bootstrap from listener installation so startup no longer registers a
  duplicate media-query subscription.
- Added the missing `SecPal/android` repository to the `/source` AGPL
  source-offer page so the frontend's corresponding-source list again
  reflects the Android wrapper that consumes the shared frontend build output.
- Native-bridge logout now tears down the frontend auth session even when logout is triggered directly through `SecPalNativeAuthBridge.logout()`, so protected routes immediately fall back to `/login` instead of leaving the WebView on the authenticated `/` shell with stale frontend auth state.
- Native logout events now update the foreground WebView auth state before storage cleanup and avoid service-worker client redirects, preventing stale authenticated shells when Android logout overlaps an in-flight session teardown.
- Native-bridge auth bootstrap now handles a writable but non-configurable `SecPalNativeAuthBridge.logout()` property without throwing while wiring the direct-logout event dispatch wrapper.
- Consolidated the shared frontend UI layer on `@/ui`, removed remaining
  legacy shell and auth wrapper paths, replaced productive custom inline UI
  icon usage with Lucide components, and added guardrails so migrated routes
  stay on the shared shadcn/Radix/Lucide stack.
- Kept the shared command-popover listbox's committed selection separate from
  its keyboard highlight and carried validation descriptions onto the focused
  search input, so screen readers announce the selected value and error state
  correctly while the popover is open.
- Added an authenticated/public AGPL source-offer route at `/source`, kept the shared `AGPL v3+ | Source Code` footer links visible on both login and app shells, exempted `/source` from logged-out service-worker/auth bootstrap redirects, and integrated the source-offer screen into the SecPal PWA with repository/license links and focused regression coverage for footer navigation plus public route access.
- Gave the move organizational unit dialog more horizontal room and tightened
  truncation handling so long unit names and hierarchy labels stay contained in
  the move flow.
- Redirected pre-contract users away from normal app routes before the email
  verification gate, so deep links such as `/profile`, `/settings`, or feature
  sections land in the onboarding flow first.
- Tightened runtime-style CSP delivery on the nginx PWA host with SSI-injected
  nonces, moved third-party runtime style shims into app CSS where possible,
  kept Apache `.htaccess` deployments on a functional inline-style fallback
  instead of emitting an invalid empty nonce, and stopped precaching
  nonce-bearing HTML shells so service-worker-controlled navigations fetch a
  fresh CSP nonce online.
- Aligned the root/all-units organizational-unit select options with the rest of the hierarchical unit rows, keeping their icons from shrinking and their labels truncatable in narrow menus.
- Reworked the Activity Logs overview to avoid unnecessary horizontal page scrolling on narrow viewports. Below the `sm` breakpoint the page now renders each activity as a stacked card instead of forcing the desktop table layout into the available width, and the pagination controls wrap vertically on mobile. The responsive layout switch now reads the breakpoint once on mount, listens only via `MediaQueryList.addEventListener("change")`, and updates on viewport resize without redundant state writes. Added `tests/e2e/activity-logs.spec.ts` to assert that the mobile card layout is active, the desktop table stays unmounted, and the overview stays free of horizontal overflow across multiple narrow viewport widths (`320`, `360`, `390`, `412`, `430`).
- Restored API-required organizational-unit and type fields in site creation payloads and aligned the sites table loading skeleton with the added customer/contact columns.

- Made service-worker explicit logout redirects resilient across multiple open app windows: protected clients are redirected to `/login` independently, so a failed `WindowClient.navigate()` call is logged without blocking remaining protected clients from being redirected, and the per-client failure log now redacts query strings and fragments from the client URL.

- Fixed service-worker notification click handler to focus an existing app window when its pathname matches the notification target URL, then navigate it to the full target URL (including query and hash). The handler previously only matched on `pathname` without navigating the window to the specific deep-link, and an intermediate refactor erroneously required an exact `pathname + search + hash` match which prevented focusing any window already open on the same page. The push-notification data builder now also correctly makes the top-level `url` field authoritative over any `url` key nested inside the `data` sub-object.

- Eliminated the gap that appeared below the footer on iOS Safari and PWA standalone installs by adding `viewport-fit=cover` to the viewport meta tag and replacing hardcoded `min-h-dvh` / `min-h: 100vh` values with CSS custom properties (`--app-shell-min-height`, `--app-auth-card-min-height`, `--app-footer-padding-bottom`) that select `100svh` as a baseline, upgrade to `100dvh` where supported, revert to `100svh` in standalone mode, and include `env(safe-area-inset-bottom)` padding on footer elements.
- Restored full-row hit targets for every item in the authenticated user dropdown. `My profile` and `Settings` already occupied the full menu width, but the button-backed `Lock app` and `Sign out` entries only reacted across their intrinsic content width after the app-shell migration. `src/components/dropdown.tsx` now applies `w-full` to every `DropdownItem` variant, and `src/components/dropdown.test.tsx` adds a regression test that covers both link and button menu items.
- Split the browser-session `src/services/authApi.ts` login/bootstrap client from the statically imported account/MFA helpers so Vite/Rolldown no longer emits the `INEFFECTIVE_DYNAMIC_IMPORT` warning for `authApi` during `npm run build`. Shared auth API error/JSON parsing now lives in `src/services/authApiShared.ts`, account-scoped calls live in `src/services/authAccountApi.ts`, and the login/bootstrap lazy-import boundary remains effective.
- Reworked the public browser-session bootstrap path so `/login` no longer issues an unauthenticated `/v1/me` probe when there is no local auth snapshot and no `XSRF-TOKEN` cookie, eliminating the spurious 401 console error on logged-out refreshes while keeping protected-route recovery and authenticated session restoration intact.
- Split the public login flow from the authenticated shell so logged-out loads no longer flash post-login navigation skeletons, heavy private route chunks, or browser passkey capability rows after first paint. The login route now uses dedicated public loading states, lazy-loads MFA/passkey/auth modules where safe, and keeps the visible card stable during session completion to remove mobile reload jitter.
- Restored the visible login logo while preserving the Lighthouse image fixes by rendering higher-resolution raster assets with their real intrinsic aspect ratios instead of stretching the small square PNG placeholders.

- Treated HTTP `401` status from auth bootstrap revalidation as an invalid session regardless of the localized API error message, so stale browser-session snapshots now clear and return to login when Laravel responds with messages such as German `"Nicht authentifiziert."` instead of leaving protected routes stuck behind the bootstrap recovery screen.
- Bumped the transitive `undici` dependency from `7.25.0` to `7.28.0` in `package-lock.json` (via `jsdom`), clearing the high-severity `GHSA-vmh5-mc38-953g` and `GHSA-pr7r-676h-xcf6` npm audit findings so `npm audit` again reports zero vulnerabilities.
- Prevented auth bootstrap recovery from forcing a full page navigation through the service worker when the browser has no valid session or when a stored session fails startup revalidation. The offline session state is still persisted for PWA navigation gating, but open clients are now redirected by the service worker only for explicit logout/barrier teardown paths, keeping the first protected-route-to-login transition inside the React router while preserving offline logout privacy.
- Auth bootstrap now skips the automatic silent retry for deterministic API client failures such as a non-JSON `404` from a misrouted preview API host, while preserving the retry for transient network, timeout, rate-limit, and server-error cases. This prevents protected routes from issuing a duplicate session check when the response cannot succeed without a configuration fix.
- Hardened the native passkey error assertions in `src/pages/Login.test.tsx` so CI no longer flakes on `Login > shows native passkey AuthApiError messages inline`. The previous test used synchronous `fireEvent.click` and a free-text `findByText` query; under full-suite Vitest load the click handler's async native-bridge rejection (`await loginWithPasskey()` → `setError`) could settle after the default async-util poll started, producing intermittent `Unable to find an element with the text: /native passkey failed/i` failures (see GitHub Actions runs 27431169540, 27561430770, 27597655832 on `main`). The fix routes passkey clicks through `userEvent.click` (flushes microtasks after the interaction), asserts against the `LoginStatusMessage` `role="alert"` region, and adds a regression test that defers the bridge rejection with `queueMicrotask`. The same helpers now cover the other native-bridge passkey error cases in that block. Closes #1222.
- Serialized the **Quality Checks → Vitest Tests** job with a repository-wide concurrency group (`queue: max`), raised the job timeout from 15 to 25 minutes, capped CI Vitest workers at two, and trimmed CI coverage reporters to `text`/`lcov`/`clover` only. Dependabot mass-rebases were launching many full-suite coverage runs at once; contested runs completed 150/152 test files and then stalled until GitHub cancelled the job at the 15-minute ceiling with no failing assertion (frontend#1233).
- Aligned all runtime and toolchain `@lingui/*` packages to `6.4.0`, grouped future Dependabot `@lingui/*` minor/patch updates, and added an npm override so transitive `@lingui/core` resolves to the root dependency version. Dependabot PRs that bumped only `@lingui/react` or `@lingui/cli` while `@lingui/core` stayed on `6.3.0` were failing **Quality Checks → TypeScript Check** and **Lighthouse CI** with mixed-version `I18n` type errors across test files that wrap components in `I18nProvider`.
- Closed four reviewer-reported gaps in the loading-skeleton audit:
  - `src/hooks/usePrefetch.ts` now tracks a `prefetchEpoch` counter so a stale in-flight prefetch that resolves after `resetPrefetchCache()` cannot leak its key back into `completedPrefetches`. Without the counter the AuthContext logout reset only emptied the dedupe sets while pending `runPrefetch` callbacks were still queued to add to them, breaking the cross-session isolation the previous fix-up advertised.
  - `src/hooks/usePrefetch.ts` now warms `/v1/organizational-units?per_page=100` for the `/sites/new`, `/sites/:id/edit`, and `/sites/new/customer/:id` prefetch plans so the dedupe key and HTTP request match the page's actual `listOrganizationalUnits({ per_page: 100 })` call. Previously these routes prefetched the no-query form, which was a wasted request on warm-up and a different dedupe key from the real lookup.
  - `src/components/ProtectedRoute.tsx` and `src/components/FeatureRoute.tsx` now accept a `revalidatingFallback` prop. When a stored session snapshot is being revalidated (`isLoading && user !== null`), each guard renders the fallback **inside** `EmailVerificationGate`, so the email gate keeps firing for unverified persisted users instead of briefly leaking the full authenticated shell.
  - `src/App.tsx` moves its previous `isRouteAuthSnapshotRevalidating` branch from `AppLayoutRoute`/`AppFeatureRoute` onto the new `revalidatingFallback` prop, so app routes still show `ApplicationLayout` + `RouteContentFallback` during revalidation but now go through `EmailVerificationGate` first. The same prop wires the onboarding routes (`/onboarding`, `/onboarding/submitted`) so the wizard no longer renders during revalidation; the onboarding shell is shown instead, matching the main-app behavior.
  - `src/components/OrganizationalRoute.tsx` and `src/components/PermissionRoute.tsx` adopt the same `revalidatingFallback` contract so any future route wired through them inherits the email-gate-during-revalidation guarantee instead of repeating the previous `AppLayoutRoute`-style bypass. Regression tests in `src/components/OrganizationalRoute.test.tsx` and `src/components/PermissionRoute.test.tsx` cover both the verified-snapshot (fallback rendered) and unverified-snapshot (email gate wins) branches.
  - `tests/setup.ts` raises React Testing Library's default async-util timeout from 1s to 5s. CI runs the Vitest job with v8 coverage instrumentation, which slows the JSDOM environment to the point where the 1s default occasionally lost the race against React state updates that follow an `await` boundary (e.g. `src/pages/Login.test.tsx > shows native passkey AuthApiError messages inline`, which failed twice in a row on the audit branch despite passing in isolation). The new 5s budget stays well under the 20s per-test `testTimeout` already configured in `vite.config.ts`, so legitimately stuck assertions still fail fast.
  - `src/contexts/AuthContext.tsx` now resets the prefetch cache from inside `clearAuthenticatedState` whenever a sensitive teardown is requested, instead of only from the explicit `logout()` callback. The previous wiring left every other teardown path (the `session:expired` 401 handler, the invalid-payload recovery, the cross-tab and pageshow logout reconcilers, the bootstrap-time clears) carrying stale entries from the prior user, which weakened the cross-session isolation that the prefetch epoch counter in `src/hooks/usePrefetch.ts` is meant to guarantee. The `logout()` callback no longer needs its own `resetPrefetchCache()` line — `clearAuthenticatedState(true)` covers it for all callers. `src/contexts/AuthContext.test.tsx` adds two regression tests: explicit logout still resets the cache, and `session:expired` resets it as well (the latter failed against the old code).
  - `src/pages/Customers/CustomerDetail.tsx`, `src/pages/Customers/CustomerEdit.tsx`, and `src/pages/Sites/SiteEdit.tsx` now clear the previously-loaded record (and, for the edit pages, the previously-prepopulated form data) at the top of the load `useEffect`. The US-005 refactor changed each gate from `if (loading) return Loading...` to `isInitialLoading = loading && record === null`, which inadvertently allowed React Router's param-only reuse of these routes to leave the prior record's details and Save button visible under the new URL until the new fetch resolved — so a quick Save before that point would have written the previous record's values to the new id, and the Delete action on `CustomerDetail` would have acted on the wrong record. Regression tests in `src/pages/Customers/CustomerDetail.test.tsx`, `src/pages/Customers/CustomerEdit.test.tsx`, and `src/pages/Sites/SiteEdit.test.tsx` drive a `pushState` + `popstate` param-only navigation across two ids and assert that the loading skeleton appears (with no stale name/number visible) before the new fetch resolves.
  - `src/ui/primitives.tsx` adds a `decorative` prop to `SectionSkeleton`. When `true`, the skeleton renders the same visual placeholder but drops its own `role="status"`/`aria-live`/`aria-label` wrapper (and the sr-only label text), and adopts `aria-hidden="true"` instead. `src/pages/Customers/CustomerDetail.tsx > CustomerDetailSkeleton` and the site-detail loading scaffold in `src/pages/Sites/SiteDetail.tsx` now mark all but the first section skeleton as decorative, so a single composite page no longer announces the same `loadingLabel` three times in parallel through three sibling live regions. Existing assertions in `src/pages/Customers/CustomerDetail.test.tsx` and `src/pages/Sites/SiteDetail.test.tsx` are updated from `toHaveLength(3)` to `toHaveLength(1)`, and a fresh `ui.test.tsx` case pins down the `decorative` behaviour.
  - `src/hooks/usePrefetch.ts` no longer exports a `clearPrefetchCache` member from the `usePrefetch()` hook. The previous version wired the hook return through `resetPrefetchCacheForTests()` (which is explicitly `@internal Use only in tests.`) and was unused outside the hook itself; `resetPrefetchCache()` is the production reset entry-point used by `AuthContext`, so the hook return is the wrong place to expose it and the test-only helper has no place in a production code path.
  - `tests/setup.ts` clarifies the rationale comment behind the `configure({ asyncUtilTimeout: 5000 })` call: the previous note used the ambiguous "~100s" shorthand that read like 100 seconds even though the supporting figure (CI environment phase ≈ 114 seconds) was accurate. The comment now spells out the units and cites the exact GitHub Actions job that motivated the bump.
  - `src/pages/Customers/CustomerDetail.tsx`, `src/pages/Customers/CustomerEdit.tsx`, `src/pages/Sites/SiteDetail.tsx`, and `src/pages/Sites/SiteEdit.tsx` each capture a per-`id` `cancelled` flag in their load `useEffect` so a slow fetch for the _previous_ id can no longer overwrite state after the user has navigated to a new `:id`. Without the guard, the synchronous state-clear from the earlier "stale state" fix only addressed the gap _before_ the new fetch resolves: if the previous record's request was slower, it could still resolve afterwards and clobber the new record's data under the new URL — letting destructive actions (Edit/Delete on the detail pages, Save on the edit pages) operate on the wrong entity. Regression tests in the matching `*.test.tsx` files drive a `pushState` + `popstate` param-only navigation, resolve the lagging fetch after the new one has already rendered, and assert that the displayed record still matches the current URL. All four tests fail against the previous code and pass with the new cleanup function.

- Hardened opportunistic route prefetching against side effects on the active session: `src/hooks/usePrefetch.ts` no longer routes API prefetch requests through `apiFetch`, so a stale-cache `401` response from a warm-up never reaches `sessionEvents.emit("session:expired")` and never knocks the current user out of the app. Prefetch responses still send `credentials: "include"`, but a non-`Response.ok` result is no longer cached (and only logs a `console.warn` in dev). `encodePathSegment` now wraps the `decodeURIComponent` step in `try/catch` so a malformed percent-encoded id (for example `/customers/100%`) re-encodes from the raw segment instead of throwing during plan resolution. `AuthContext.logout()` now calls a new `resetPrefetchCache()` on the way out so a logged-out tenant cannot reuse the previous user's warm-up state. `PrefetchLink` now distinguishes `mouseenter`/`focus` (chunk + API prefetch) from `touchstart` (chunk only via `prefetchPathModuleOnly`) so iOS scroll gestures no longer fire spurious authenticated GETs. `RouteLoader` now renders the `PageSkeleton` `loadingLabel` through Lingui (``msg`Loading application` ``) instead of a hardcoded English string. Regression coverage in `src/hooks/usePrefetch.test.ts` and `src/components/PrefetchLink.test.tsx` proves the not-ok branch (HTTP 500), the 401 no-logout branch, the malformed-segment branch, and the touch-only-module branch fail without the fix and pass after it.

- Onboarding wizard: clicking _Submit for Review_ on the final step now correctly auto-submits earlier required draft steps that contain the residential address history template (template_key `residential_address_history`). `submitRequiredDraftSteps` previously validated every draft step with the generic JSON-Schema helpers in `src/pages/Onboarding/OnboardingWizard.tsx`, but `current_address` is declared as `type: "object"` and `isRequiredFieldFilled` has no branch for object-typed properties — it always returned `false`, so a fully filled address-history draft failed local validation, the user was bumped back to that step with the misleading "Please review the highlighted fields" banner (no field is actually highlighted because the residential UI uses nested keys like `current_address.street`), and the final submit only succeeded on the second attempt because the step that genuinely transitioned to `submitted` between attempts was then skipped. The fix routes residential-history draft validation through the same `validateResidentialAddressHistoryValue` / `getResidentialAddressHistoryValue` pair that `validateCurrentStepRequiredFields` already uses for the active step, by extending the previous `resolveStepValidationSchema` helper to a richer `resolveStepValidationContext` that also returns the resolved template so the special-case detector (`isResidentialAddressHistoryTemplate`) can fire on previously-saved drafts; the redundant `template && step.template_id === currentStepTemplateId` shortcut and the thin `resolveStepValidationSchema` wrapper were inlined / removed because the cache path covers them and they were untestable defensive paths. Regression coverage in `src/pages/Onboarding/OnboardingWizard.test.tsx` ("OnboardingWizard final-submit auto-submits earlier drafts") now exercises three scenarios: (a) finalizing the wizard from a non-residential last step with a valid residential history draft asserts `updateOnboardingSubmission` is called with `status: "submitted"` for the residential submission and that the user lands on `/onboarding/submitted`; (b) finalizing with a valid earlier non-residential draft (tax ID) covers the schema-validation branch that runs for non-residential drafts; (c) the API rejecting an earlier draft submission with a 422 surfaces the validation message and bumps the user back to that step. The first scenario fails on `main` and passes after the fix.

- Pinned every "live-only" Playwright suite to the current Polyscope workspace preview instead of `app.secpal.dev` / `api.secpal.dev`, resolving the literal `Headquarters` brittleness on the live organization proof (issue #1199) and aligning the broader live-E2E surface with the Polyscope workflow where each workspace ships its own isolated preview backend. Concretely:
  - `tests/e2e/organization.spec.ts` — all four `Live organization proof` tests now gate on `isWorkspacePreviewTarget()` (from `tests/e2e/target-urls.ts`) instead of `isRemoteE2ETarget()`, so they only run against `frontend-<workspace>.preview.secpal.dev` / `api-<workspace>.preview.secpal.dev`, where the API workspace's `database/seeders/DatabaseSeeder.php` calls `OrganizationalUnit::firstOrCreate(['name' => 'Headquarters', 'tenant_id' => $tenantId], ['type' => 'holding'])` and therefore contractually guarantees a `Headquarters` `holding` root unit. The previously hard-coded literal is lifted into a documented `WORKSPACE_PREVIEW_ROOT_UNIT_NAME` constant (plus a precompiled `WORKSPACE_PREVIEW_ROOT_UNIT_NAME_PATTERN` regex) that points back at the API workspace's seeder as the source of truth; the four test titles now spell out "on the Polyscope workspace preview".
  - `tests/e2e/auth.spec.ts` — both `live no-secret auth smoke` tests (`should surface the current login readiness state …` and `should resolve protected route auth bootstrap …`) moved from `!isRemoteE2ETarget()` to `!isWorkspacePreviewTarget()` and their titles/skip messages now say "on the Polyscope workspace preview"; the deterministic mock-only skips (`test.skip(isRemoteE2ETarget(), …)`) intentionally stay on the broader `isRemoteE2ETarget` predicate because they are still correct on workspace previews.
  - `tests/e2e/leadership-levels.spec.ts` — both `Live employee proof` tests (non-management + leadership) gate on `isWorkspacePreviewTarget()` + `PLAYWRIGHT_LIVE_EMPLOYEE_CRUD=1`; the `|| "https://api.secpal.dev"` API fallback is replaced with `?? ""` since the workspace-preview path always resolves a real API origin and the fallback can no longer be reached at runtime.
  - `tests/e2e/passkeys.live.spec.ts` — the suite-wide `test.skip` now requires `isWorkspacePreviewTarget()` in addition to `PLAYWRIGHT_LIVE_PASSKEY=1`; the new skip message explains that the WebAuthn RP id is derived from the page origin so the proof binds passkeys to the workspace preview's own RP id; the `|| "https://api.secpal.dev"` API fallback is replaced with `?? ""` for the same reason as above.
  - `tests/e2e/onboarding-wizard.live.spec.ts` — `beforeEach`-skip now demands `isWorkspacePreviewTarget()` + `PLAYWRIGHT_LIVE_ONBOARDING=1`; the file header is rewritten to describe the suite as a workspace-preview proof, drops the `PLAYWRIGHT_BASE_URL=https://your-workspace.example` setup example (the workspace is auto-detected from the working directory), and removes the now-orphaned `velvet-zebra` example block.

  Net effect: a default `npm run test:e2e` inside any Polyscope workspace keeps running every live suite end-to-end, while invocations against any non-workspace remote target now skip the live-only blocks cleanly instead of failing on missing or differently-seeded data — so the full suite no longer needs `--grep-invert "Live organization proof"` against any target.

- Retired the entire `app.secpal.dev` / `api.secpal.dev`-pinned E2E surface so the Polyscope workspace preview is the only "live" target across the test infrastructure (issue #1199, follow-up cleanup of the test-level migration above):
  - `tests/e2e/web-push-live-mode.ts` + `tests/e2e/web-push.live.spec.ts` — the live browser Web Push smoke is now gated by `isWorkspacePreviewTarget()` instead of the previous "any HTTPS deployment" gate; skip messages, the suite-wide test title ("on the Polyscope workspace preview"), and the `TEST_USER_*` error wording all describe the workspace-preview-only contract, and a "non-canonical HTTPS host" branch is no longer required because the workspace-preview gate fires first.
  - `tests/e2e/target-urls.ts` — removed `LIVE_FRONTEND_ORIGIN`, `LIVE_API_ORIGIN`, `isLiveRemoteTarget`, and the `app.secpal.dev → api.secpal.dev` API derivation; `resolvePlaywrightApiBaseUrl` now returns `undefined` for non-preview frontend overrides instead of synthesising `api.secpal.dev`, which is the correct behaviour for the Polyscope-only contract.
  - `tests/e2e/auth-helpers.ts` — `buildTestUser` now throws when `PLAYWRIGHT_BASE_URL` points at a non-workspace HTTPS remote (e.g. `app.secpal.dev`) without explicit `TEST_USER_*` credentials; silently injecting the seeded dev user against an arbitrary production host was a security regression. Workspace-preview and local-dev paths continue to use the standard seeded defaults (`test@example.com` / `password`, or `onboarding@example.com` / `password` for live-onboarding), while explicit `TEST_USER_*` overrides win for all targets.
  - `tests/e2e/performance-mode.ts` — `getPerformanceAuditThresholds` now uses `isWorkspacePreviewTarget(baseUrl)` instead of the broad `isRemotePlaywrightTarget(baseUrl)`, so only Polyscope workspace previews receive the relaxed `LIVE_LIGHTHOUSE_THRESHOLDS` (performance: 85); local HTTPS environments such as `*.ddev.site` correctly keep the stricter `DEFAULT_LIGHTHOUSE_THRESHOLDS` (performance: 90).
  - `package.json` — removed the `app.secpal.dev`-pinned scripts `test:e2e:staging`, `test:e2e:performance:staging`, `test:e2e:offline-logout:staging`, and `test:e2e:live:onboarding:velvet-zebra`. Replaced `test:e2e:performance:staging` with the workspace-auto-detecting `test:e2e:performance:workspace` (no hard-coded `PLAYWRIGHT_BASE_URL`). Dropped the pre-flight `PLAYWRIGHT_BASE_URL` check from `test:e2e:live:onboarding` and removed the hard-coded URLs from `test:e2e:live:passkeys`; both scripts now resolve the workspace preview through `resolvePlaywrightBaseUrl()` like the rest of the suite.
  - `scripts/run-live-web-push-smoke.mjs` — pre-flight check replaced with `hasResolvableLiveWebPushTarget()`, which accepts a Polyscope workspace clone path or a `PLAYWRIGHT_BASE_URL` that points at a workspace-preview frontend URL (`https://frontend-<workspace>.preview.secpal.dev`); plain `https://` URLs such as `app.secpal.dev` are now correctly rejected by the guard (the previous implementation accepted any `https://` URL, contradicting its own error message).
  - `playwright.config.ts` — refreshed the JSDoc to describe "Polyscope Workspace Preview" as the recommended live mode, dropped the "Staging/Performance Tests against app.secpal.dev" paragraph, and clarified the `isRemotePlaywrightTarget` comment now that the predicate's primary remote target is the workspace preview itself.
  - `.github/workflows/playwright-live-lighthouse.yml` — deleted. The workflow ran `npm run test:e2e:performance:staging` against `app.secpal.dev` on every push and pull request, which is incompatible with the Polyscope-only "live" surface; the corresponding `tests/build.test.ts` guard ("keeps live Lighthouse CI provisioned with a stable Chrome binary") is removed along with the workflow.
  - `.github/workflows/quality.yml` — removed the `playwright-live-smoke` job, which ran two `tests/e2e/auth.spec.ts` cases against `PLAYWRIGHT_BASE_URL=https://app.secpal.dev` via `--grep "should surface the current login readiness state on live targets|should resolve protected route auth bootstrap on live targets"`. The corresponding spec titles were already renamed to "on the Polyscope workspace preview" in the test-level migration above, so the `--grep` expression no longer matched anything, and the job's hard-coded `app.secpal.dev` target is incompatible with the Polyscope-only live surface.
  - Vitest coverage — `tests/playwright-target-resolution.test.ts`, `tests/auth-e2e-helpers.test.ts`, `tests/performance-audit-mode.test.ts`, `tests/web-push-live-mode.test.ts`, and `tests/unit/offlineLiveHelpers.test.ts` are updated end-to-end: tests that previously asserted live-target behaviour now assert the workspace-preview contract, and a new guard documents that `resolvePlaywrightApiBaseUrl` returns `undefined` for non-preview frontend overrides instead of synthesising `api.secpal.dev`. Helper scripts (`scripts/deploy-perf-to-dev.sh`, `scripts/deploy-to-dev.sh`) and the `tests/e2e/performance.spec.ts` header are repointed at `npm run test:e2e:performance:workspace`.

- Addressed the PR #1202 review comments on the Polyscope-only live E2E migration:
  - `tests/e2e/organization.spec.ts` — `WORKSPACE_PREVIEW_ROOT_UNIT_NAME_PATTERN` now flows through the existing `escapeRegExp()` helper instead of feeding the seed string directly into `new RegExp(...)`, so the root-unit locator stays a literal match even if the seed ever picks up a regex meta-character. The `!isWorkspacePreviewTarget()` gate also moves from each of the four `Live organization proof` tests' bodies up to a single describe-level `test.skip(...)` so the workspace check runs as a `beforeEach` (per Playwright semantics) — before the `authenticatedPage` fixture spins up and performs a real UI login through `auth.setup.ts`. Previously the late skip meant a non-workspace HTTPS target with `TEST_USER_*` set still triggered a login round-trip through the retired live deployment before the test body reached `test.skip(...)`. The per-test `LIVE_ORGANIZATION_CRUD_ENABLED` / `testInfo.project.name !== "chromium"` opt-ins stay test-level because they are project-specific and only meaningful once the workspace gate has already passed.
  - `tests/e2e/leadership-levels.spec.ts` — mirrors the same fix for the `Live employee proof` describe (two `authenticatedPage`-using tests): a single describe-level `test.skip(!isWorkspacePreviewTarget(), …)` now prevents the auth fixture from logging into a non-workspace remote, and the per-test gates reduce to `!LIVE_EMPLOYEE_CRUD_ENABLED || project.name !== "chromium"`.
  - `tests/e2e/auth-helpers.ts` — `getConfiguredTestUserOrThrow()` is collapsed to a thin delegate around `buildTestUser()`. The previous `if (testUser.email && testUser.password) return …; throw new Error(…)` branch was unreachable after the security-hardening change in `buildTestUser` (which now either throws for non-workspace remotes without `TEST_USER_*` or returns non-empty seeded defaults for local-dev and workspace-preview targets); keeping the dead fallback made the contract harder to read.
  - `package.json` + new `scripts/assert-polyscope-workspace.mjs` + new `scripts/polyscope-workspace.mjs` — `test:e2e:performance:workspace`, `test:e2e:live:onboarding`, and `test:e2e:live:passkeys` now run a preflight assertion that fails fast (exit 1) when no Polyscope workspace can be resolved, instead of letting Playwright silently exit 0 because every spec self-skipped. The shared `scripts/polyscope-workspace.mjs` module hosts the workspace-detection helpers (`detectPolyscopeWorkspaceName`, `getResolvableWorkspacePreviewName`, `hasResolvableWorkspacePreviewTarget`) so `scripts/run-live-web-push-smoke.mjs` and the new CLI preflight share a single source of truth for the canonical / `frontend-<workspace>` preview hostnames.
- Stopped tracking `.context/progress.md` so `.gitignore` matches reality (issue #1200): `.gitignore` line 79 already lists `.context` as ignored, but the workspace-local agent scratchpad was added to the index in PR #1197 and silently carried in every shadcn-migration commit (`cfc7da3` through `dd65991` on PR #1198) because `.gitignore` does not apply to paths that are already tracked. Ran `git rm --cached .context/progress.md` so the file stays on disk for local agent collaboration but is no longer part of the public repository, and added `tests/repo-hygiene-context-untracked.test.ts` — a Vitest guard that shells out to `git ls-files -- .context` and asserts the result is empty — so the regression cannot return silently on a future PR. Historical commits are intentionally left untouched (see "Out of scope" in the issue); only the working-tree tracking and the regression guard change.
- Stopped the migrated app-shell wrappers `NavbarItem`, `SidebarItem`, `DropdownItem`, and `AvatarButton` from spreading the wrapper-level `href` prop into `react-router-dom`'s `<Link>`. `<Link>` consumes `to` (not `href`) and was already overriding the leaked attribute with its own `useHref(to)`-derived value, so the leak was silent at runtime today, but it coupled the wrapper API to undocumented router prop ordering and made future router upgrades fragile. The four wrappers now destructure `href` from rest props before forwarding the remaining props to `<Link to={href}>`. Added a focused regression suite (`src/components/router-link-wrappers.test.tsx`) that mocks `react-router-dom`'s `Link` and asserts the captured props expose `to` only, with no `href` leak.
- Approved the install scripts for `esbuild` and the macOS-only `fsevents` (both the top-level `fsevents@2.3.3` and the nested `playwright/node_modules/fsevents@2.3.2`) via a project-level `allowScripts` entry in `package.json`, so `npm install` under npm 11 no longer prints the `allow-scripts` pending-approval warning on either Linux/Windows (esbuild) or macOS (fsevents). Both install scripts only set up the platform-specific native binding, so build and test behavior is unchanged. The entries are unpinned (`"esbuild": true`, `"fsevents": true`) so future Dependabot bumps do not re-introduce the warning under fresh versions.
- Fixed `LoginLanguageSwitcher` error handling: locale-load failures now always display the localized fallback message instead of leaking raw internal `Error.message` strings (network errors, chunk URLs) into the UI.
- Pinned the login legal footer to the bottom of the viewport on every breakpoint (`absolute bottom-4 left-1/2 -translate-x-1/2 px-6`) so it sits flush against the viewport edge instead of sharing the vertically centered flex stack with the credential card; the card now stays perfectly mid-viewport on mobile (previously it was pushed up by the footer + `gap-6`).
- Switched the `LoginShell` from `min-h-svh` (small viewport height — frozen when the address bar is visible) to `min-h-dvh` (dynamic viewport height) so the auth shell follows the visible viewport instead of leaving a strip of body background exposed when the mobile browser's URL bar collapses.
- Added an explicit `body { background-color: #ffffff }` in `src/index.css`, plus a `prefers-color-scheme: dark` variant that sets `background-color: #09090b` (zinc-950) to match the `LoginShell` defaults; the previous body had no background-color so the user-agent's dark `color-scheme` default (~`#1c1b22` / `#1e1e1e`) showed through as a "slightly lighter dark gray" stripe under the shell on mobile dark mode, and behind any safe-area / address-bar transition area.
- Tightened the login credential card and MFA dialog copy: dropped the redundant `login.subtitle` "Sign in to your operations workspace." line beneath the title (the title alone is sufficient on a brand-only login surface), lowercased the field separator `login.separator` from "Or" / "Oder" to "or" / "oder" so it reads as a connector instead of a heading, and removed the `login.mfa.expiry` "This verification step expires at …" status box from the MFA dialog (the dialog already conveys urgency through its modal presentation; the explicit ISO-style timestamp added noise). Dropped the now-unused `formatDateTime` helper and the `formatApiDateTime` import in `src/pages/Login.tsx`.
- Centered the TOTP entry by default in `LoginOtpInput`: the convenience wrapper now sets `containerClassName={cn("justify-center", className)}` so the 6 slot boxes sit horizontally centered in the MFA dialog instead of left-aligned. The `className` prop still wins via `tailwind-merge`, so call sites can override the alignment.
- Localized the backend wording "The provided multi-factor authentication code is invalid." in `getLocalizedMfaErrorMessage` (`src/pages/Login.tsx`): both the existing `"MFA verification failed"` pattern and the new `"The provided multi-factor authentication code is invalid"` pattern now map to the same localized message ("MFA verification failed. Please check your code." / "MFA-Verifizierung fehlgeschlagen. Bitte prüfen Sie Ihren Code.") so users see a translated, actionable error regardless of which backend wording the API returns.
- Propagated `aria-invalid` from `LoginOtpInput` to every `LoginInputOtpSlot` so the per-slot `aria-invalid:border-red-600` styling now actually paints when MFA verification fails: previously `aria-invalid` only landed on the hidden `<input>` behind `OTPInput`, leaving the six visible slot boxes without the red border feedback the user expects after a wrong code.
- Constrained the MFA dialog (`LoginDialog` content) to the visible viewport on short screens: added `max-h-[calc(100dvh-2rem)]`, `w-[calc(100%-2rem)]`, `overflow-y-auto`, and `overscroll-contain` to `DialogPrimitive.Content` in `src/pages/Auth/ui/primitives.tsx`. Previously, on landscape mobile (`~390px` viewport height) the centered fixed-position dialog ran off both edges with the OTP entry and the Verify / Cancel actions cropped beyond the viewport and no internal scroll, leaving the MFA challenge unusable; the dialog now caps to the visible viewport, scrolls its body when content overflows, and contains the scroll so the page underneath does not jump.
- Restructured the MFA challenge dialog to mirror the shadcn `input-otp` "Form" example: removed the radio-group method picker that was always visible and replaced it with a direct TOTP entry by default, plus a small inline toggle button below the OTP field ("I don't have access to my authenticator app") that swaps the input for the recovery-code flow (or "Use authenticator code instead" when switching back). The toggle only renders when the challenge actually exposes a second method, so single-method challenges show no chrome at all. The recovery-code input is now an alphanumeric `LoginOtpInput` styled like the shadcn `input-otp` "Pattern" example — 8 slots split 4-separator-4 with a `LoginInputOtpSeparator` (Lucide `Minus`), `pattern={REGEXP_ONLY_DIGITS_AND_CHARS}`, `inputMode="text"`, and `textTransform="uppercase"` so users see uppercase letters regardless of caps-lock and the backend only ever receives uppercase normalized codes. New i18n keys `login.mfa.switchToRecovery` ("I don't have access to my authenticator app" / "Ich habe keinen Zugriff auf meine Authenticator-App") and `login.mfa.switchToTotp` ("Use authenticator code instead" / "Stattdessen Authenticator-Code verwenden"); obsolete `login.mfa.method`, `login.mfa.method.totp`, `login.mfa.method.recovery_code`, and `login.mfa.preferred` keys are now removed from both catalogs.
- Suppressed the stray horizontal scrollbar on the MFA dialog by adding `overflow-x-hidden` to `DialogPrimitive.Content` in `src/pages/Auth/ui/primitives.tsx`. The US-016 `overflow-y-auto` (added to make the dialog body scroll on landscape mobile) implicitly promotes `overflow-x: visible` to `overflow-x: auto` per the CSS overflow spec; any sub-pixel rounding or the input-otp PWM-badge width extension (+40px hidden input) was then enough to surface a near-empty but visually disruptive horizontal scrollbar. Setting `overflow-x` explicitly to `hidden` keeps the vertical scroll-on-overflow behavior intact while removing the unwanted horizontal axis. Also relaxed the MFA-method toggle button (`src/pages/Login.tsx`) with `max-w-full text-center text-balance` so the long German label "Ich habe keinen Zugriff auf meine Authenticator-App" wraps to multiple lines on narrow mobile viewports instead of either overflowing the dialog or being silently clipped by the new `overflow-x-hidden`.
- Hardened the rest of the login surface against horizontal scrollbars (defense in depth on top of the MFA-dialog fix): `LoginShell` (`src/pages/Auth/ui/primitives.tsx`) now sets `overflow-x-clip` so the page itself can never offer a horizontal page scrollbar regardless of what an inner subtree or a third-party browser extension does; `clip` is preferred over `hidden` because it does not form a scroll-containing block, so Radix Portal overlays and any `position: sticky` descendants keep working unchanged. In parallel, the text-heavy primitives that render localized backend strings or long German compound words — `LoginFieldDescription`, `LoginFieldError`, `LoginDialogTitle`, `LoginDialogDescription`, `LoginEmptyTitle`, `LoginEmptyDescription`, `LoginStatusMessage` — gain a `break-words` class so words like `Wiederherstellungscode`, `MFA-Verifizierung`, `Authentifizierungscode` wrap mid-word inside their container on narrow viewports instead of pushing the container wider.

- Migrated the onboarding wizard, onboarding-complete, and onboarding-submitted pages from the legacy Catalyst component set to a new self-contained `src/pages/Onboarding/ui/primitives.tsx` design-system layer (Button, Input, Textarea, Select, Checkbox, RadioGroup, Alert, Card, Badge, Progress, Field, CommandPopover, and related helpers), removing the dependency on external Catalyst primitives for this flow and aligning the visual language with the rest of the shadcn-based UI.
- Added `CommandPopover` with full keyboard navigation (ArrowDown/ArrowUp/Enter/Escape), ARIA combobox/listbox pattern with `aria-activedescendant`, and stable per-option `id` attributes for screen-reader announcement of the active item; used for nationality selection in the onboarding wizard.
- Added `ProgressIndicator` using the new `Progress` primitive with `aria-label` for accessible progress announcement.
- Added `OnboardingAuthShell`, `OnboardingAuthCard`, and `OnboardingAuthHeader` layout primitives to `src/pages/Onboarding/ui/primitives.tsx`; `OnboardingComplete` now uses these via a local `OnboardingCompleteFrame` wrapper instead of repeating the layout markup in every render branch.
- Extracted shared `cn()` utility to `src/lib/utils.ts` (clsx + tailwind-merge); both `src/pages/Auth/ui/utils.ts` and `src/pages/Onboarding/ui/utils.ts` now re-export from this canonical location.
- Added `auth/onboarding migration boundary` static-analysis test (`tests/auth-onboarding-migration-boundary.test.ts`) that asserts the auth and onboarding route scope is free of legacy UI imports and proprietary license markers.
- Migrated `Select`, `Checkbox`, `RadioGroup`, `RadioGroupItem`, `Progress`, and `FieldLabel` in `src/pages/Onboarding/ui/primitives.tsx` from native HTML elements to Radix UI primitives (`@radix-ui/react-select`, `@radix-ui/react-checkbox`, `@radix-ui/react-radio-group`, `@radix-ui/react-progress`, `@radix-ui/react-label`, `@radix-ui/react-popover`).
- Added `AutocompleteListbox` and `AutocompleteOption` components to `src/pages/Onboarding/ui/primitives.tsx` for accessible combobox autocomplete surfaces backed by `@radix-ui/react-popover`.

### Changed

- **Breaking:** `LoginOtpInput` `aria-label` prop is now required (no default). Callers that omitted `aria-label` must now pass an explicit localized label string.
- **Breaking:** `LoginSpinner` `aria-label` prop is now required (no default `"Loading"`). Callers must pass an explicit localized label.
- **Breaking:** `CommandPopover` props `placeholder`, `searchPlaceholder`, and `emptyMessage` are now required strings (previously optional with English defaults). All call sites must pass localized values.
- `cn()` in the onboarding barrel now applies `tailwind-merge` (previously used bare `clsx` without conflict resolution). Class lists that previously preserved duplicate conflicting Tailwind utilities will now be deduplicated.

### Fixed

- Fixed `emailVerified` flag in the onboarding-complete auth session: the expression now requires an explicit `=== true` rather than `!== false`, preventing a missing or undefined `email_verified` field from silently granting email-verified status.
- Fixed focus management in the onboarding wizard error flow: the `feedback`-error alert and the `error` alert now hold separate refs (`feedbackErrorRef` / `onboardingErrorRef`) so the focus effect always targets the correct element when both are present simultaneously.
- Fixed `role="status"` / `aria-live` placement on the wizard loading state: the live-region attributes are now scoped to the inner `CardContent` element rather than the outer `Card` container, per the ARIA scoping rule for dynamic content regions.
- Fixed `CommandPopover` keyboard ergonomics: pressing `ArrowDown` on the closed combobox now opens the popover and highlights the first option (matching the visible list order) instead of skipping to the second option, and pressing `Escape` now resets the typed query and active option so re-opening the popover never shows stale filtering or an out-of-context active option.
- Fixed `CommandPopover` searchbox accessibility: the search input now exposes the localized `searchPlaceholder` as its accessible name via `aria-label`, so screen readers announce its purpose instead of an unnamed `searchbox` role.
- Fixed onboarding-radiogroup error wiring: the identity-document upload-now, residence-title employment-permitted, and residence-title upload-now `radiogroup`s now set `aria-invalid` and `aria-describedby` to reference their inline `FieldError`, so assistive technologies can announce the failure in context, matching the pattern used by other migrated radio groups in the wizard.
- Fixed `EmployeeAddressFields` read-only mode: the hidden `address_country` input is now also marked `disabled` when the component is rendered with `readOnly`, so the read-only form no longer submits a country value while the visible `CommandPopover` is disabled.

- Added shared `addressApi` service with typed helpers (`fetchAddressStreetSuggestions`, `fetchAddressLocalitySuggestions`) for OpenPLZ-backed postal-code and street lookups against the `/v1/addresses/de/` API endpoints.
- Added `getCountrySelectOptions` in `src/lib/iso3166CountryOptions.ts` to generate a locale-sorted ISO 3166-1 alpha-2 country dropdown with per-code `Intl.DisplayNames` fallback for unsupported region identifiers.
- Added shared `EmployeeAddressFields` component with OpenPLZ street/locality autocomplete, keyboard navigation, and a country combobox; adopted in the employee create, edit, contacts-edit, and inline postal-address dialog flows.
- Added an opt-in live Playwright browser Web Push smoke plus operator runbook coverage for selected HTTPS deployments: the new `test:e2e:live:web-push` flow now runs in a headed persistent Chromium profile, auto-starts `Xvfb` on headless Linux hosts when available, and proves browser bootstrap metadata publication, same-origin service-worker prerequisites, authenticated `PUT /v1/me/notification-installations/{installationId}` registration, and sign-out driven `DELETE /v1/me/notification-installations/{installationId}` cleanup with explicit diagnostics for missing runtime metadata or rejected registration. Closes #1156.

### Fixed

- Fixed protected-route browser-session recovery so the app now performs one
  automatic bootstrap retry after a transient timeout or network failure before
  showing the manual session-recovery screen, and so the loading spinner no
  longer hangs when the browser goes offline between the timeout and the
  automatic retry's bootstrap re-run (the dead synchronous-body offline
  shortcut that previously swallowed the re-run without clearing
  `isLoading` is now removed; the existing `restoreAndRevalidate` offline
  branch handles the browser-session + offline case uniformly).
- Fixed the offline app-lock flow so locking no longer downgrades the service-worker session gate to a logout, cross-tab `auth_vault_state` refreshes no longer get misread as an empty logout while the vault is still locked, and unlocking no longer drops the local session when the browser-session CSRF token rotates while the vault is locked, including focused storage and `useAuth` regression coverage for the lock -> background-tab activity -> unlock path.
- Fixed the public login route so already authenticated users no longer keep seeing the login form when they hit `/login`; the app now waits for auth bootstrap, preserves the vault-unlock state there, and redirects authenticated sessions back into the app instead.
- Fixed browser-session bootstrap persistence on authenticated `/login` loads when the `XSRF-TOKEN` cookie is missing: the frontend now refreshes the CSRF cookie before rewriting the offline auth vault, preventing the restored session from running without persisted vault state and avoiding the follow-on `Offline vault is not available` analytics noise. Added focused App and Playwright regression coverage for the missing-cookie recovery path.
- Fixed the browser-session bootstrap 401 path on protected routes with no locally restored auth state so the app now falls back to a non-sensitive auth clear instead of triggering full logout cleanup, avoiding unnecessary `SecPalDB` deletion, `Dexie.delete(...) was blocked` noise, and follow-on offline-vault analytics warnings when an unauthenticated `/v1/me` check lands on `/`.
- Audited frontend API timestamp handling against the canonical SecPal response standard (`YYYY-MM-DDTHH:MM:SSZ`), added shared timestamp parsing/formatting helpers in `src/lib/dateUtils.ts`, and switched login, activity-log, and Android-provisioning displays to the shared path so runtime code and regression tests no longer rely on endpoint-specific date-time quirks. Closes #1145.
- Sequenced logout cleanup so auth storage and analytics Dexie cleanup finish before the broader `SecPalDB` deletion runs, eliminating `DatabaseClosedError` warnings on the unauthenticated onboarding redirect path and adding focused logout-order regression coverage. Closes #1146.
- Followed up the logout cleanup race fix so late bootstrap, cross-tab, and BFCache barrier cleanup keeps skipping offline vault table deletion after a full logout has already started, including in-flight restore-clear and stale restore/setUser interleavings that could otherwise reopen the Dexie `DatabaseClosedError` window fixed in #1146.
- Tightened the #1146 logout-cleanup follow-up so queued offline-vault table cleanups are serialized behind a shared wait target, sensitive logout teardown still runs after a best-effort vault cleanup failure, late skip-marker upgrades are honored from storage getters and BFCache barrier reconciliation, fresh full logouts reset stale cross-session cleanup owners instead of reusing stranded skip-marker state, active full logouts now coordinate skip-marker release through per-cleanup owner markers instead of a shared non-atomic counter, fresh non-sensitive barriers discard stale owner markers instead of inheriting a skip from an older cleared barrier, sensitive client cleanup waits for browser, cache, and IndexedDB teardown to settle before releasing the skip marker after partial failures, existing cross-tab skip markers survive later `clear()` calls until barrier cleanup can observe them, and overlapping full-logout cleanups keep the temporary skip marker until the last broader cleanup finishes so offline logout state still returns to the single `auth_logout_barrier` key afterward.
- Hardened the browser notification UX to match the real backend-backed Web Push lifecycle: removed misleading local-only category preference state from `NotificationPreferences`, reframed `NotificationPermissionPrompt` around browser-scoped delivery, surfaced explicit denied/unsupported/re-auth/deployment-reset states, and documented customer-owned rollout constraints for HTTPS, same-origin service-worker scope, browser support, and selected deployment domains. Closes #1140.
- Wired authenticated browser Web Push lifecycle management to deployment bootstrap metadata and the notification-installations API: the PWA now reads runtime VAPID metadata from browser bootstrap instead of `VITE_VAPID_PUBLIC_KEY`, upserts existing subscriptions on app load, refreshes stale runtime metadata by rotating the local subscription, re-runs reconciliation after service-worker replacement, revokes the remote installation before browser-session logout, and clears local browser push state during logout/reset and denied-permission cleanup. Closes #1139.
- Fixed the missing `npm run start` script in the frontend workspace by aliasing it directly to `vite`, so Polyscope and other generic start-script callers can boot the dev server without failing on a missing `start` script.
- Updated audit overrides for `brace-expansion` and `ws` so the frontend dependency tree resolves to patched dev-only versions and `npm audit --audit-level=moderate` reports zero vulnerabilities.
- Silenced the spurious Node.js stderr warning "The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set." that appeared on every Playwright worker when the parent shell exported `NO_COLOR` (e.g. on Polyscope/CI sandboxes): `playwright.config.ts` now removes `NO_COLOR` and `NODE_DISABLE_COLORS` from `process.env` before workers fork, including when those variables are set to an empty string. See issue #1121.
- Fixed `resolvePlaywrightApiBaseUrl` in `tests/e2e/target-urls.ts`: when `PLAYWRIGHT_BASE_URL` points to a workspace preview and `PLAYWRIGHT_API_BASE_URL` is set to a non-preview live value, the API origin is now derived from the preview frontend URL so E2E runs stay bound to the same workspace preview instead of drifting to the live API.
- Extended `mockNonPolyscopeCwd()` to the two Lighthouse playwright config tests that were missing it, preventing cwd-based Polyscope workspace detection from disrupting those assertions when tests run from a `.polyscope/clones/...` worktree.
- Fixed `getAuthStateCachePath` in `tests/e2e/auth-helpers.ts` to derive the cache scope from `new URL(resolved).host` for all parseable URLs, so local-HTTPS targets such as `*.ddev.site` and different localhost ports each produce distinct auth state files instead of sharing a single `local-*.json` path.
- Gated the `/v1/employees/*` route mock in `onboarding-complete.spec.ts` and `onboarding-wizard-validation.spec.ts` to `GET` requests only; non-GET methods now fall through to `route.fallback()` (or `originalFetch` in the browser-side fetch mock) so unexpected writes are not silently masked.
- Updated the `playwright.config.ts` comment on `isRemoteTarget` to document that `isRemotePlaywrightTarget` is intentionally used over `isRemoteE2ETarget` for the webServer decision: both real remote targets and local-HTTPS targets (\*.ddev.site) are served by an external process that must not be duplicated by Playwright's own webServer.
- Fixed `buildAddressesPayloadForCurrentEdit` so that `state` is preserved from the current address row when the draft does not supply it, cleared when the draft explicitly passes an empty string, and the current row is omitted entirely (instead of creating a blank placeholder row) when all draft fields are empty.
- Fixed `contractStartDateFallback` priority in `OnboardingWizard`: the authoritative date from the employee API record now takes precedence over a user-submitted contract-start-date value in step form data, preventing incorrect residence-title timing validation when both sources are present.
- Fixed `hasAddressDraftValue` call when initialising the postal-address dialog in `EmployeeDetail`: now passes `{ emptyCountryCodes: ["DE"] }` to consistently treat a default-country-only draft as empty, matching the behaviour of `buildAddressesPayloadForCurrentEdit` and `hasPostalAddressDraftValue`.
- Fixed `getAuthOnboardingWorkflowStatus` in `src/lib/onboardingWorkflow.ts`: removed the redundant nested `employee.onboarding_workflow.status` fallback and its unsafe `as EmployeeOnboardingWorkflowStatus` cast. `sanitizeAuthUser` in `authState.ts` already promotes this field to `User.onboardingWorkflowStatus`, so the helper now reads only the typed top-level field.
- Fixed `isWorkflowConflictError` in `OnboardingWizard`: the generic Laravel 422 top-level message (`"The given data was invalid."`) no longer suppresses structured validation errors. The message-only fallback now applies exclusively to 409 Conflict responses; 422 responses are identified solely via their structured `errors.onboarding_workflow_status` / `errors.form_data` fields.
- Fixed template re-fetch after `handleWorkflowConflict` resolving to the same step: `applyLoadedSteps` now increments a `templateResetKey` counter so the template-loading effect re-runs even when `currentStepIndex` and `currentStepTemplateId` remain unchanged.
- Fixed `isResidentialAddressHistoryFieldKey` to exclude bare aggregate keys (`current_address`, `previous_addresses`) from the inline-error set; only dot-notation nested keys and the three Bewacher leaf fields are rendered inline by `OnboardingResidentialAddressHistoryFields`, so whole-object API errors are no longer silently swallowed.
- Removed dead `export` keywords from `fiveYearHistoryBoundaryIso` and `previousResidencesCoverFiveYearWindow` in `onboardingResidentialAddressHistory.ts`; both functions are internal helpers consumed only within the same module.

### Changed

- Raised the build-toolchain Node floor in `package.json` from `>=20.6.0` to `^22.19.0 || >=24.0.0`, matching the effective range already required by direct dependencies (`vite@8`, `@vitejs/plugin-react@6`, `eslint@10`, `lighthouse@13`, and `vite-plugin-static-copy@4`) and `.nvmrc`/CI (Node 22). Enabled `engine-strict=true` in `.npmrc` so unsupported Node versions fail `npm ci`/`npm install` instead of proceeding with non-fatal `EBADENGINE` warnings. Closes #1221.
- Changed magic-link account setup so invited employees must re-enter their names and date of birth instead of seeing identity fields prefilled; name-similarity feedback now appears only after submit, and the completion request forwards `date_of_birth` for server-side identity verification.
- Removed the optional `PasskeyLoginOptions { email?: string }` argument from the `AuthTransport.loginWithPasskey` and `NativeAuthBridge.loginWithPasskey` interfaces (and the matching native-bridge implementation in `src/services/authTransport.ts`) so the typed transport contract now matches the discoverable-only public passkey challenge surface. The `Login` call site already invoked `loginWithPasskey()` without arguments; the unused parameter could no longer be forwarded anywhere meaningful since the API rejects email-scoped public passkey challenges. Closes #1120.
- Passkey sign-in now always starts a discoverable (resident-credential) challenge without sending an email hint to the server. The previous two-attempt fallback — try discoverable, then retry with an email-scoped `allow_credentials` list — has been removed. Browsers that do not support empty `allowCredentials` lists will now receive an error instead of a silent retry. The native-bridge `loginWithPasskey` call no longer forwards the typed email either.
- Migrated employee contact and detail flows from flat `address_*` fields to the `addresses` relation: responses now use `addresses`, optional `current_address`, and `structured_address`; contact edit and inline postal edits send full replacement `addresses` payloads that keep historical rows and refresh the open-ended current row, with shared helpers in `src/lib/employeeAddresses.ts`.
- Added an inline onboarding-wizard attachment upload section for editable steps, automatically creating a draft submission before the first upload when needed, surfacing upload success/failure inline, and wiring the flow to the current `/v1/onboarding/submissions/{submission}/files` API contract (closes #1029)
- Renamed the onboarding review and Android provisioning frontend API clients to the neutral `/v1/onboarding-review/...` and `/v1/android-enrollment-sessions...` endpoints, and aligned supporting fixtures/examples with the removed Admin model.
- Removed the frontend's role-list based elevated UI gating and obsolete `hasRole` auth-context helper: organization access now follows the authoritative `hasOrganizationalScopes` flag, customer/site/employee/android capability checks now depend on explicit permissions plus scope/access flags, and the obsolete `admin` organizational-scope access level was dropped from frontend types and tests to match the API's removed Admin model (breaking change, closes #1031)
- Reframed the frontend `README.md` around the currently shipped workforce-operations routes and runtime guidance, removing stale Secrets-era password-vault, attachment-encryption, and migration-status sections that no longer matched the live app surface, resolving frontend issue #531.
- Switched the Vite Lingui macro transform from an unfiltered Babel plugin run to a filtered Rolldown Babel preset around `@lingui/babel-plugin-lingui-macro`, reducing unnecessary production-build plugin work and hardening the frontend against renewed Rolldown `PLUGIN_TIMINGS` warnings during `npm run build` (frontend issue #901).
- Migrated the frontend Lingui toolchain to the v6-compatible formatter and split macro entry points (`@lingui/core/macro`, `@lingui/react/macro`) so Dependabot Lingui update PRs no longer fail CI on mixed-version `I18n` types, stale `@lingui/macro` extraction, or the removed `format: "po"` setting.
- Wired the central Copilot-instructions validator into `quality.yml` so frontend pull requests now fail automatically when known React AI-risk guardrails or generic AI-triage guidance are missing from the runtime baseline
- Dropped restoration of legacy cleartext and pre-v2 encrypted `auth_user` localStorage payloads; unsupported auth-storage records are now purged instead of being restored, and frontend test fixtures now seed authenticated state through the encrypted storage path only
- Dropped the legacy `template_id` alias in the onboarding submission client so runtime writes now require `form_template_id` only, matching the current API contract during the project's `0.x` line
- Renamed the build test suite from `Build Output Verification` to `Build Configuration and Source Verification` to match the JSDoc comment on the describe block
- Clarified the `manualChunks` comment in `vite.config.ts` to accurately describe the Rollup/Rolldown output API rather than attributing the requirement to Vite 8 specifically
- Replaced `Buffer.from().toString("base64")` with a chunked `btoa` implementation in the Playwright auth storage utility for browser-compatible base64 encoding
- Added `AUTH_STORAGE_KEY_MATERIAL_PREFIX` constant in the Playwright auth storage utility to avoid the `secpal-auth-storage:` magic string being duplicated between test utility and production code
- Added `stableStringify` helper in the Playwright auth storage utility so the PBKDF2 cache key is deterministic regardless of property insertion order in the user object
- Extracted `TEST_FILE_PATTERN` constant in the issue-889 lint regression test and decomposed `directAuthUserWritePattern` into named sub-pattern constants with an explanatory comment
- Replaced the inline `makeFetchResponse` stub in `onboardingApi.test.ts` with a real `Response` constructor so the mock implements the full browser `Response` interface

### Removed

- Removed the archived performance worklog `docs/development/PERFORMANCE_QUICK_WINS.md`; the repository now keeps active performance guidance in current validation, build, and issue-tracking surfaces only.
- Removed stale and historical documentation: DDEV-era PWA testing guide (`PWA_PHASE3_TESTING.md`), stale PR artefact (`.pr-body.md`), closed-issue implementation plans and summaries (`docs/IMPLEMENTATION_PLAN_ISSUE143.md`, `docs/IMPLEMENTATION_SUMMARY_OFFLINE_ORGANIZATION.md`), and historical performance snapshots (`docs/PERFORMANCE_ANALYSIS_2025-12-06.md`, `docs/PERFORMANCE_ISSUE319_PHASE2_PROFILING.md`, `docs/PERFORMANCE_TBT_ANALYSIS.md`)
- Removed the stale offline follow-up notes `docs/OFFLINE_DATA_PROTECTION_ROADMAP.md` and `docs/OFFLINE_ORGANIZATIONAL_UNITS.md`; the active audit plus tracked issues now remain the source of truth for deferred offline-storage hardening and organization-cache follow-up work.

### Security

- Blocked unsafe server-provided customer and site contact email/phone values from becoming `mailto:` or `tel:` links unless they match the expected address/dial-string shape, preventing mail client query/header injection and dialer parameter abuse.
- Blocked unsafe server-provided BWR export download URLs in the employee panel by allowing only HTTPS URLs, plus HTTP loopback URLs only for local development or loopback app origins, before rendering a download link.
- Added the Phase-2 offline-vault baseline for persisted frontend PII: the authenticated profile now moves out of `auth_user` localStorage into wrapped vault-backed IndexedDB storage, legacy encrypted `auth_user` records are migrated one-way into the vault, and long-term offline analytics plus organizational-unit cache records now persist encrypted at rest with focused regression coverage for frontend issue #1005.
- Added an optional native device-bound wrapper boundary for the offline vault so native-capable runtimes can prefer bridge-backed root-key wrapping while browser and unsupported runtimes keep the browser-session wrapper fallback; the missing Android bridge implementation is now tracked separately in `SecPal/android#191`, resolving the frontend-side scope of issue #1006.
- Added a local offline-vault lock flow that clears in-memory access without deleting encrypted at-rest data, exposes a non-PII unlock screen across protected routes, propagates lock state across tabs, and keeps explicit sign-out destructive for device cleanup, resolving frontend issue #1007.
- Updated the transitive `basic-ftp` dependency from `5.2.2` to `5.3.0` in `package-lock.json`, clearing the high-severity `GHSA-rp42-5vxx-qpwr` npm audit finding tracked in issue #893.
- Extended the `package.json` `overrides` block to clear all 21 outstanding `npm audit` findings (17 moderate, 4 high) without falling back to `npm audit fix --force` (which would have downgraded `lighthouse` 13 → 12 and `@lingui/cli` 6 → 3): pinned `esbuild` to `^0.28.1` (GHSA-gv7w-rqvm-qjhr — high; affected both `@lingui/cli@6.3.0` and `vite@8.0.16` transitive copies of `esbuild@0.25.12`), bumped the existing `ws@^8.0.0` override from `^8.20.1` to `^8.21.0` and added a sibling `ws@^7.0.0` → `^7.5.11` override so the `lighthouse@13.4.0` direct `ws@^7.0.0` copy picks up the backported fix (GHSA-96hv-2xvq-fx4p — high; remote memory-exhaustion DoS), and pinned `@sentry/node` to `^10.54.0` (resolves to `10.58.0`) instead of a bare `@opentelemetry/core` bump. The `@sentry/node@10` line was built against OpenTelemetry 2.x natively (`@opentelemetry/core@^2.6.1`, `@opentelemetry/sdk-trace-base@^2.6.1`) and no longer pulls in the auto-instrumentation suite at the top level, so this single override clears GHSA-8988-4f7v-96qf (moderate; unbounded memory allocation in W3C Baggage propagation in `@opentelemetry/core <2.8.0`) together with the 14 transitive `@opentelemetry/instrumentation-*`, `@opentelemetry/resources`, `@opentelemetry/sdk-trace-base`, `@opentelemetry/sql-common`, `@sentry/node-core`, and `@sentry/opentelemetry` findings dragged in via `lighthouse@13.4.0` → `@sentry/node@9.47.1`. A standalone `@opentelemetry/core` override was rejected after a reviewer pointed out that it leaves `@opentelemetry/instrumentation-http@0.57.2` and `@opentelemetry/sdk-trace-base@1.30.1` calling `core.getEnv()` (removed in `@opentelemetry/core@2.x`); verified locally that `require('@sentry/node')` then crashed with `TypeError: Cannot read properties of undefined (reading 'AlwaysOn')` at `sdk-trace-base/build/src/config.js:25`, while the `@sentry/node@10` override imports cleanly and keeps the entire lighthouse `Sentry.init`/`captureException`/`captureMessage`/`addBreadcrumb`/`setTags`/`setExtras`/`withScope` surface intact (see `lighthouse/core/lib/sentry.js`). The override also dropped 47 packages from `node_modules` because the v10 sentry release moves the OpenTelemetry instrumentations behind opt-in extras. `npm audit` now reports `found 0 vulnerabilities`, and `npm run typecheck`, `npm run lint`, `npm run build`, plus the full Vitest suite (152 files, 2263 tests) stay green after the overrides take effect. Bumped the declared `engines.node` floor from `>=20.0.0` to `>=20.6.0` in the same change so the published package.json no longer advertises support for Node 20.0–20.5, which the newly pinned `@opentelemetry/core@2.8.0` (resolved transitively via `@sentry/node@10`; `engines.node: ^18.19.0 || >=20.6.0`) would surface as `EBADENGINE` warnings on those runtimes; the wider pre-existing floor mismatch (`vite@8` → `>=20.19.0`, `lighthouse@13` → `>=22.19`) is tracked separately.

### Fixed

- Made the current Polyscope workspace preview domains authoritative for Playwright and preview API routing: the active workspace now resolves to `https://frontend-<workspace>.preview.secpal.dev` plus `https://api-<workspace>.preview.secpal.dev`, generic `<workspace>.preview.secpal.dev` frontend inputs are canonicalized to the `frontend-` host, and preview runtime/API resolution now always rebinds stale preview, live, empty, loopback, or SPA-host origins to the current workspace instead of drifting toward unrelated domains.
- Grouped coupled React, React DOM, and React type-package minor/patch Dependabot updates into one frontend pull request, aligned the shared React runtime bump on `react` plus `react-dom` `^19.2.6`, grouped non-breaking GitHub Actions updates, and relaxed the live Lighthouse workflow regression check to require commit pinning instead of one historical `setup-chrome` SHA so Dependabot workflow bumps no longer open red CI from stale version-skew or hard-coded action pins.
- Repaired employee-detail tab switching so hash deep links like `#contacts` no longer lock users on one tab, localized all new employee contact editing placeholders/labels, added explicit non-submit button types for emergency-contact add/remove actions, and centralized shared emergency-contact draft normalization helpers to avoid duplicate logic drift.
- Blocked the dedicated employee contacts edit page from submitting partial overwrite payloads after an initial employee-load failure, and aligned dialog emergency-contact email handling to trim whitespace before validation so optional values behave consistently.
- Routed onboarding pattern-validation guidance strings through Lingui catalogs (including the country-code helper text) so German onboarding flows no longer show hardcoded English validation copy.
- Repaired `scripts/preflight.sh` changed-file detection for pre-push runs with a clean index/worktree by falling back to branch-vs-base (`merge-base..HEAD`) diffs for markdown and REUSE gating, and added regression tests that cover both unstaged markdown edits and committed markdown-only branch deltas.
- Fixed onboarding wizard schema-validation regressions by preserving hidden second-contact values during in-progress edits, clearing conditional required-field errors when their triggering condition is removed, falling back to supplemental submit feedback when backend 422 keys target non-rendered HR-managed fields, and preserving backend-provided `tax_identification_number` onboarding schema rules instead of forcing additional frontend-only tax/SSN requirements.
- Seeded Playwright's live mock-session cookies for both the browser host and the configured API host, so split-host remote runs against `app.secpal.dev` plus `api.secpal.dev` no longer fall back to `/login` when employee, Android provisioning, and onboarding-review specs install mocked auth routes.
- Replaced the brittle live organization proof that hard-coded `WSiS Nordwest` with a stable `Headquarters` root-unit assertion, so default remote Playwright runs no longer fail when the live seed data changes while the shipped organization UI still behaves correctly.
- Blocked onboarding review submission when the current schema-rendered step still has empty required fields, surfaced inline field errors plus a clear review-blocked status message, and kept those field errors clearing as users complete the missing inputs, resolving frontend issue #1030.
- Treated an empty production `VITE_API_URL` on `app.secpal.dev` the same as other leaked SPA-side API origins by collapsing it to the canonical `https://api.secpal.dev` host, so browser-session login can fetch `/sanctum/csrf-cookie` and bootstrap remote Playwright auth without failing immediately on the live app, resolving frontend issue #1046.
- Stopped the generic employee edit form from sending `status` through `PATCH /v1/employees/:id` and made the status control read-only there, so non-status edits such as management-level or position updates no longer trip the backend's dedicated status-transition guard, resolving frontend issue #1045.
- Repaired the red Playwright organization and employee management suites on current `main` by scoping explicit employee permissions to the management-level mock session, aligning the moved-unit flow with the current tree-actions UI, and adding live server-backed proofs for the exact sequential company-then-branch create flow, live branch reparenting, and both non-management and leadership employee creation against `app.secpal.dev` and `api.secpal.dev`.
- Preserved `/organization` tree state across back-to-back optimistic creates by keeping newly created parent units in the local tree overlay until the offline-sync hook has fetched them for real, so creating a company and then an immediate child branch no longer collapses the tree back to only the holding until a manual reload.
- Replaced the placeholder pre-contract onboarding wizard with a schema-driven Catalyst form that renders localized template fields, restores saved draft answers, uses inline feedback instead of browser alerts, and updates existing onboarding submissions via `PATCH` before navigation or review submission.
- Corrected the `/organization` Playwright XSRF-rotation regression to rotate the browser-visible app cookie instead of asserting a brittle cross-origin cookie detail, added end-to-end coverage that keeps restricted child-unit delete actions hidden across reloads, guarded the repaired live parent relationship on `app.secpal.dev`, and added an opt-in live CRUD proof for creating and deleting a child unit under `Headquarters` against the real live stack.
- Hid `/organization` tree actions when the current unit permissions deny them and extended the child-create reload regression to assert the selected unit still shows its parent after refresh, so users no longer get offered unauthorized delete/edit/move actions and the child-create cache regression stays covered end-to-end
- Kept `/organization` hierarchy state consistent after child creation and moves by regression-covering the create/edit/reload and move/edit/reload flows, updating optimistic tree reparenting to refresh the moved unit's parent metadata, and surfacing backend scope-self-lockout `403` messages in the scope-assignment dialog instead of collapsing them into a generic save failure.
- Stopped browser-session offline-vault state from being cleared when Laravel rotates the `XSRF-TOKEN` cookie on authenticated `GET` requests such as `/v1/me` and `/v1/organizational-units`; the frontend now rewraps the live in-memory vault session to the new CSRF token instead of treating the vault as corrupted, so `/organization` no longer falls into `Offline vault is not available.` on `app.secpal.dev` after a successful login.
- Restored indexed offline-vault organizational-unit lookups for `type` and parent filters by persisting plaintext vault index metadata and lazily backfilling older encrypted org-unit cache records, so filtered queries no longer decrypt the full vault cache on every lookup, resolving frontend issue #1013.
- Hardened the Vite Lingui plugin wiring to resolve `lingui()` from either named exports or a CommonJS `default` export, and paired it with a filtered local Rolldown preset for Lingui macros, so frontend builds stay compatible with the current Node/Vite CJS-interop behavior and issue #1003 is regression-covered.
- Switched both `viteStaticCopy` `assetlinks.json` copy targets back to the `rename: { stripBase: true, name: "assetlinks.json" }` form and added a build-output regression test, so frontend builds once again emit `dist/assetlinks.json` and `dist/.well-known/assetlinks.json` instead of broken nested `config/` paths for Android Digital Asset Links, resolving frontend issue #1022.
- Mirrored backend `429` login lockouts into the frontend login rate limiter via `Retry-After` and added Playwright regression coverage, so the login UI now stays in the authoritative cooldown state instead of falling back to local failed-attempt tracking, resolving frontend issue #803.
- Fixed RFC-correct handling of `Retry-After: 0` on `429` login responses; the header value is now parsed as valid rather than discarded, and `syncAuthoritativeLockout(0)` clears the local lockout state so the form remains immediately usable, matching the server's intent to allow an instant retry.
- Stopped the login page from treating transient readiness-probe transport failures as a backend `not_ready` state, so sign-in now stays enabled unless the API explicitly reports `status: "not_ready"`, resolving frontend issue #991.
- Added a deploy-safe Digital Asset Links fallback by shipping `assetlinks.json` at the build root, serving `/.well-known/assetlinks.json` through an exact-match Nginx fallback, and adding a live smoke check so `app.secpal.dev` no longer regresses to the SPA shell or a stale DAL payload during Android passkey rollout, resolving frontend issue #925.
- Localized the shared login-page passkey sign-in cancellation, timeout, provider-availability, and fallback messages so the Android native Credential Manager path no longer falls back to English on German devices after a cancelled passkey prompt, resolving frontend issue #978.
- Limited Playwright Lighthouse audits to the desktop `chromium` project so strict all-project live E2E runs no longer fail in `mobile-chrome`, which lacks the fixed CDP port required by `playwright-lighthouse` for `app.secpal.dev` audits.
- Split the live no-secret Playwright auth smoke away from the deterministic local invalid-credential and hard-login-redirect assertions, so `app.secpal.dev` now validates the shipped health-gated login state and browser-session protected-route recovery flow instead of failing on outdated assumptions, resolving frontend issue #975.
- Shifted the remote `onboarding-complete` Playwright suite from pure network-route mocks to a page-level fetch shim for the deterministic public onboarding endpoints, so live runs against `app.secpal.dev` no longer collapse into CSP-blocked `Failed to fetch` invalid-link screens when the deployed app points public onboarding traffic at a broken absolute API origin, resolving frontend issue #933.
- Added a runtime guard for the live `app.secpal.dev` host so leaked preview-mode or loopback API bases such as `http://localhost:4173`, relative `/api`, or the SPA host itself now collapse back to the canonical `https://api.secpal.dev` origin instead of shipping CSP-blocked `/v1/me` bootstrap traffic, addressing frontend issue #973.
- Made the Playwright smoke console-error filter evaluate expected logged-out `/v1/me` bootstrap 401s after navigation from the collected response list instead of relying on response-versus-console event ordering, so the suite no longer flakes on the intended auth probe while still surfacing real CSP or loopback-origin failures such as the live `app.secpal.dev` drift tracked in issue #973, further hardening frontend issue #943.
- Rebased the live `app.secpal.dev` Lighthouse performance threshold from 90 to 85 while keeping the stricter preview threshold and the existing accessibility, best-practices, and Core Web Vitals assertions unchanged, so repeated stable-Chrome live audits no longer fail on borderline 87-90 scores, resolving frontend issue #970.
- Added a dedicated Playwright live-Lighthouse workflow that provisions a stable Chrome binary, exports `CHROME_PATH`, and runs the guarded `app.secpal.dev` performance suite so live Lighthouse can collect real scores in CI instead of skipping on the bundled Playwright Chromium snapshot, resolving frontend issue #962.
- Stopped live Playwright Lighthouse runs from failing with misleading 0-score threshold errors when they use the bundled Playwright Chromium snapshot against `app.secpal.dev`; live audits now require `CHROME_PATH` to point to a stable Chrome/Chromium binary and skip with an explicit capability message until that browser prerequisite is provided, keeping preview performance coverage intact while making issue #932 actionable.
- Pinned Playwright CI preview builds to the preview origin so mocked browser-session E2E flows no longer drift onto the live API host, enabled Chromium's fixed CDP port for Lighthouse audits, mocked preview smoke auth-bootstrap endpoints so static-preview unauthenticated checks return deterministic 401/ready responses instead of 404 recovery screens, hardened the smoke CLS probe against SPA redirect timing, and corrected the missing Apple touch icon reference in `index.html`.
- Hardened production API base URL resolution to reject loopback and preview-only origins such as `localhost`, `127.0.0.1`, and `::1`, so shipped frontend builds fail fast instead of deploying with a broken local-preview API endpoint.
- Serialized remote Playwright workers for `https://app.secpal.dev` targets so Chromium runs that need the fixed Lighthouse CDP port no longer fail intermittently with `Address already in use (98)` during parallel browser launches.
- Moved Playwright's Lighthouse performance audits onto an explicit `PLAYWRIGHT_LIGHTHOUSE=1` mode that defaults to the repo-local preview build, pins the preview API base to `http://localhost:4173`, reuses the shared authenticated E2E fixture for preview auth wiring, and aligns Playwright Lighthouse with the repo's desktop `lighthouserc` settings while live opt-in for `app.secpal.dev` remains tracked in issue #957.
- Stopped default local Playwright E2E runs from inheriting developer-only `VITE_API_URL` overrides out of `.env.local`, and aligned the local Playwright auth defaults with the API seeder's `test@example.com` admin so `npm run test:e2e` no longer fails before the suite reaches real assertions, resolving frontend issue #942.
- Replaced the obsolete Playwright leadership-level CRUD expectations with deterministic management-level coverage against the shipped employee create and employee list UI, aligning the suite with the ADR-011 frontend and resolving frontend issue #931.
- Replaced the Playwright onboarding-complete assertions that depended on unstable live magic-link tokens and removed photo-upload fields with deterministic mocked onboarding contracts, and preserved the verified pre-contract session state after successful completion so the flow reaches the onboarding wizard, resolving frontend issue #933.
- Stopped the Playwright smoke suite from failing on the expected logged-out `/v1/me` bootstrap probe so the home-page console assertion now only reports unexpected frontend errors, resolving frontend issue #943.
- Stabilized the live Playwright offline coverage by moving the flaky service-worker offline route assertions onto deterministic mocked auth and organizational-unit fixtures, correcting the offline banner expectation to the shipped copy, and marking the mocked offline-logout session as verified so the privacy flow reaches the profile page before logout.
- Stabilized the live Playwright offline-logout privacy coverage by waiting for the final persisted logout state before asserting cleared auth storage and offline-session cache contents, so the spec no longer races a last login-route navigation on `app.secpal.dev`, resolving frontend issue #960.
- Stopped browser-session auth from collapsing into an immediate frontend logout on protected routes when the local `auth_user` snapshot is missing or becomes unreadable after an `XSRF-TOKEN` rotation; bootstrap now falls back to `/v1/me` revalidation instead of treating client-side storage drift as a confirmed sign-out.
- Taught the Playwright auth bootstrap helper to detect the protected-route secure-session recovery screen immediately and refresh the saved auth state after a fallback UI login, so stale reused live auth storage no longer burns the full auth-resolution timeout before re-authenticating, resolving frontend issue #936.
- Isolated the destructive Playwright logout coverage from the shared authenticated fixture so parallel live auth tests no longer invalidate each other's reused browser-session state during the auth-spec regression set.
- Hardened Playwright login setup for the live app by waiting for the health-gated submit button to become actionable before clicking, reusing that guard in mocked offline-auth flows, and requiring explicit `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` whenever Playwright targets a remote HTTPS environment like `app.secpal.dev` so live E2E runs fail clearly instead of silently using invalid local placeholder credentials.
- Expanded `app.secpal.dev` Digital Asset Links to publish both `delegate_permission/common.handle_all_urls` and `delegate_permission/common.get_login_creds`, matching Android Credential Manager's documented app-to-web trust prerequisites for passkey validation.
- Reused a shared `buildEnvelopeMacPayload()` helper for auth-storage MAC construction in both runtime storage code and the Playwright passkey fixture, removing the duplicated inline field assembly that could drift and resolving frontend issue #917.
- Published `/.well-known/assetlinks.json` for `app.secpal.dev` and copied it through the Vite build so release-signed SecPal Android builds can complete Credential Manager passkey registration instead of falling through to the SPA shell at the Digital Asset Links endpoint.
- Cached the encrypted auth-storage envelope used by the Playwright passkey fixture so repeated `installStoredAuthUser()` calls no longer pay the 600,000-iteration PBKDF2 cost more than once per identical seeded user/token combination, resolving frontend issue #916.
- Split the heavy `issue874-react-hooks-set-state-in-effect` lint regression into smaller tracked-file batches and gave each batch a dedicated 30-second timeout so `npm run test:coverage` no longer times out on one monolithic ESLint spawn under full-suite coverage load, resolving frontend issue #899.
- Increased PBKDF2 iteration count from 5,000 to 600,000 (OWASP minimum for PBKDF2-HMAC-SHA256) for new auth-storage envelopes while preserving reads of legacy v1 envelopes during rollout, hardening key derivation without forcing deploy-time logouts.
- Replaced `Buffer.from` with `TextEncoder` in `Login.test.tsx` `textBytes` helper for cross-platform Web API compatibility.
- Fixed incorrect `ApiError` constructor argument order in `employeeApi.ts` BWR export and BWR status update error paths: the third argument now correctly passes `normalizeApiErrorErrors(error.errors) ?? undefined` (errors array) instead of `response` (the Response object).
- Added JSON parse error boundary in `decryptPersistedAuthUser` so malformed `auth_user` storage values return `null` cleanly instead of throwing.
- Extracted `clearInvalidStoredUser` and `handleStoredUserError` private helpers in `LocalStorageAuthStorage` to eliminate duplicated remove-and-return-null patterns in `getUserSnapshot` and `getUser`.
- Clarified the auth-storage CSRF-missing warning message to explain the root cause.
- Replaced `seededAuthUser` module-scoped coupling in `App.test.tsx` with direct `mockGetCurrentUser.mockResolvedValue` calls in seed helpers, and replaced empty `waitFor(() => {})` with `Promise.resolve()`.
- Extracted `ROUTE_NAVIGATION_TIMEOUT_MS` constant in `App.test.tsx` to replace the repeated magic number `20000`.
- Replaced plaintext `localStorage.setItem` test setup in `useAuth.test.ts` with `await authStorage.setUser()` to exercise the actual encryption layer, and updated affected assertions to use `authStorage.getUser()`.
- Removed stale memoization from `NotificationPreferences` so translated preference labels now recompute correctly when the active Lingui locale changes, resolving frontend issues #877 and #878.
- Wrapped `authStorage.setUser()` persistence in a WebCrypto error boundary so rare PBKDF2/AES failures now log, clear stale `auth_user` state, and return cleanly instead of bubbling an unhandled rejection during login/bootstrap flows; includes focused regression coverage for issue #871.
- Resolved issue #874 by refactoring the remaining `react-hooks/set-state-in-effect` violations across list/detail loaders, dialog reset flows, and organizational-unit tree state derivation; restored the rule to `error` in `eslint.config.js` and added a focused lint regression test for the tracked files.
- Guarded auth-storage event and pageshow handlers with an in-memory `hasLogoutBarrierRef` check after `await authStorage.getUser()` to prevent an async race where an in-flight bootstrap `setUser()` clears the localStorage logout barrier (via `clearLogoutBarrier()`) before the stale-storage handler resumes, which caused a post-logout StorageEvent to restore the authenticated user.
- Stabilized the Lingui catalog sort: switched `lingui.config.cjs` from the default `orderBy: "message"` to `orderBy: "messageId"` so entries sharing the same translated text (e.g. the generic Cancel button and the `login.mfa.cancel` explicit-ID entry both translate to "Cancel") are ordered by their unique key rather than producing a non-deterministic oscillation between two orderings on successive `sync:purge` runs.
- Fixed all ProtectedRoute bootstrap tests broken by the async auth-storage migration: switched `beforeEach` from `vi.clearAllMocks()` to `vi.resetAllMocks()` to clear queued `mockResolvedValueOnce` implementations between tests, flushed both async levels of `authStorage.getUser()` before advancing fake timers so the stall-timeout is guaranteed to be registered, and restored real timers before the retry-bootstrap assertion to avoid incomplete PBKDF2 promise chains under fake scheduling.
- Replaced the `crypto-js`-based auth-storage envelope with native WebCrypto PBKDF2/AES-CBC/HMAC handling, updated auth bootstrap/login persistence for the new async storage path, preserved legacy cleartext reads during the migration, and removed the redundant `crypto-js` packages to close issue #868.
- Normalized employee-create POST payloads so non-leadership submissions omit the internal `management_level: 0` sentinel on the wire and match the API's optional create-field contract for onboarding-ready staff creation.
- Encrypted persisted `auth_user` localStorage state with a session-bound PBKDF2-derived AES/HMAC envelope, kept legacy cleartext reads for compatibility during rollout, and added focused coverage for encrypted auth bootstrap and login persistence to resolve the CodeQL clear-text storage finding tracked in issue #784.
- Standardized auth test fixtures and storage-event construction in `useAuth` coverage, aligned `SiteDetail` metadata date rendering with locale-aware `formatDate`, removed a redundant non-null timeout assertion in passkey browser helpers, and tightened Lingui guard tests with JSON import assertions, command/argument checks, and an appropriate unit-test timeout.
- Isolated the Lingui catalog guard's nested `sync:purge` environment from parent Vitest and npm runner variables, and refreshed the checked-in locale artifacts so the guard no longer reports false drift in CI while still catching real catalog changes.
- Added a Lingui catalog sync guard that re-runs the checked-in extract/compile flow during frontend test validation, restores the workspace afterward, and fails CI when new translatable strings were added without committing the resulting catalog updates.
- Stabilized `App` route test reliability by seeding `auth_user` localStorage fixture through the same `sanitizePersistedAuthUser` path the runtime uses, eliminating races on onboarding redirect assertions caused by stale or mismatched fixture shapes.
- Passkey browser credential prompts are now aborted via `AbortController` when the frontend safety timeout fires, so the browser dismisses the credential picker instead of letting it remain open until the browser timeout elapses after a frontend timeout.
- Fixed passkey WebAuthn wrapper timeout calculation so the frontend safety timeout is always the configured WebAuthn timeout plus a 5-second grace period, avoiding premature frontend aborts for longer server-specified timeouts.
- Passkey login now confirms the session with a follow-up GET /v1/me after the verify endpoint succeeds, aligning with the password login flow and catching silent session establishment failures.
- Passkey login and add-passkey buttons now show step-by-step progress so users can tell exactly where each flow is and whether the browser is waiting for their interaction: login uses challenge → browser prompt → verifying → confirming session, while add-passkey uses challenge → browser prompt → saving.
- Added step-by-step `[SecPal]` console diagnostics to the passkey login and registration flows so real-browser failures can be traced through DevTools.

### Added

- Added a Playwright regression that rotates the `XSRF-TOKEN` cookie on mocked authenticated organization GET traffic and proves protected-route reloads stay authenticated without falling into `Offline vault is not available.`, resolving frontend issue #1020.
- Added `docs/OFFLINE_ENCRYPTED_VAULT_DESIGN.md` as the accepted Phase 2 design record for frontend issue #495, documenting the target vault key hierarchy, device-bound key comparison, lock/unlock/logout semantics, and follow-up implementation slices for offline PII protection.
- Added native Android passkey registration fallback in Settings so the shared passkey enrollment flow can delegate attestation creation to the injected Android bridge when the embedded WebView does not support browser WebAuthn registration, while keeping browser behavior unchanged.
- Added native-bridge passkey sign-in to the shared login flow so Android can complete token-based passkey authentication through the injected native auth bridge while browsers keep the existing WebAuthn ceremony and progress states.
- Added a Bewacherregister management panel to employee detail so authorized users can review BWR status and timestamps, generate the initial export, download the generated file, and move supported BWR states through the dedicated backend endpoints with inline validation feedback.
- Added a permission-gated Android provisioning UI with backend-issued enrollment session creation, QR display, status visibility, and revoke controls for Epic SecPal/.github#327.
- Added a live Playwright passkey proof that drives the real app.secpal.dev/api.secpal.dev stack through passkey registration, UI/API consistency checks, passkey removal, and a fresh email-first passkey login using a browser WebAuthn authenticator.
- Added browser passkey sign-in to the login flow, including the WebAuthn challenge client and focused frontend coverage for supported browsers and failure handling.
- Added passkey visibility to the settings page, including enrolled-passkey listing and an unsupported-browser notice that does not hide existing server-side passkey data.
- Added passkey enrollment to the settings page, including user-provided credential labels, browser WebAuthn registration, server-side verification, and focused frontend coverage for successful and failing enrollment flows.
- Added passkey removal to the settings page, including destructive controls for enrolled credentials, backend deletion, list refresh, and focused frontend coverage for successful and failing removal flows.
- Added the missing MFA enrollment slice to the settings page so disabled accounts can start TOTP setup, scan a QR code or use the manual setup key, confirm the authenticator code, and immediately receive one-time recovery codes.
- Added a reusable MFA QR-code component with browser-safe fallback messaging and focused component coverage so upcoming enrollment UI slices can render authenticator setup material without duplicating QR generation logic.
- Added PWA offline persistence security and privacy [audit document](PWA_OFFLINE_PERSISTENCE_AUDIT.md) covering all client-side storage mechanisms (localStorage, sessionStorage, IndexedDB, Cache API, Service Worker state) with 10 findings, issue overlap analysis, and prioritized remediation recommendations.
- Added a platform-aware frontend auth transport boundary that keeps browser/PWA flows on Sanctum session auth, sanitizes auth state before it enters React or local storage, and creates the explicit seam Android can later wire to a native bearer-token bridge without exposing raw tokens to JavaScript.
- Added the first MFA settings management slice with live status loading plus self-service recovery-code regeneration and MFA disablement flows for accounts that already have MFA enabled.
- Added the phase-1 browser-session MFA login challenge flow so the login page can pause after primary credentials, collect the second factor, and complete the session only after the backend challenge verification succeeds.

### Fixed

- Fixed passkey sign-in on browsers that reject discoverable WebAuthn requests without an `allowCredentials` list by retrying the flow with the entered email address, requesting an account-scoped challenge from the API, and showing an explicit prompt to enter an email address when that fallback is required.
- Hardened the passkey browser ceremony helpers so both registration and sign-in now fail with a deterministic timeout even when the browser ignores the supplied `AbortSignal`, and the settings page now re-fetches `/v1/me/passkeys` after successful enrollment so the UI reflects persisted server state instead of relying only on optimistic local state.
- Fixed passkey enrollment hanging on "Adding passkey..." by stripping null `authenticatorAttachment` values from `AuthenticatorSelectionCriteria`, picking only `id` and `name` from the `rp` object (omitting deprecated `icon: null`), and omitting empty `excludeCredentials` arrays before passing options to `navigator.credentials.create()`.
- Added an `AbortController` timeout safety net to both `getPasskeyAttestation` and `getPasskeyAssertion` so the WebAuthn ceremony is cancelled if the browser exceeds the server-specified timeout plus a 5-second grace period, preventing indefinite UI hangs.
- Added explicit `AbortError` handling in the passkey sign-in and passkey registration error paths so timed-out WebAuthn ceremonies show a clear "timed out" message instead of a raw abort error.
- Added a user-friendly cancellation message when the browser WebAuthn dialog is dismissed or denied during passkey registration.
- Fixed passkey browser login failing with "Resident credentials or empty allowCredentials lists are not supported" by omitting empty `allowCredentials` from the WebAuthn options, checking conditional-mediation availability with a safe fallback to `optional`, and surfacing a user-friendly message when passkey sign-in encounters an unsupported-browser or cancelled-ceremony error.
- Added the missing German translations for the remaining passkey action labels in Settings so add and remove flows no longer fall back to English in the shipped `de` locale.
- Removed a React `act(...)` warning from the `SettingsPage` passkey-removal test by wrapping the deferred `resolveDeletion` call in `act` and waiting for the post-deletion UI to settle, so the covered removal flow no longer leaks async state updates out of the test boundary.
- Completed the missing German Lingui translations for current passkey and Android provisioning UI so security and enrollment screens no longer fall back to English in the shipped `de` locale.
- Added the missing German translations for the EmployeeDetail "Confirm Onboarding" action and the onboarding sign-out failure message so those UI states no longer fall back to English.
- Bounded `ApplicationLayout` sign-out with an 8-second timeout so a hung logout request still clears local auth state and returns the browser user to the login screen.
- Bounded `OnboardingLayout` sign-out with an 8-second timeout so hung logout requests still clear local auth state and return the user to `/login`, while real API failures continue to show the inline retry message.
- Persisted the minimal employee lifecycle state in offline auth storage so pre-contract users are still redirected to `/onboarding` even when the full employee record is unavailable.
- Fixed a race condition in the `ApplicationLayout` logout handler where `logout()` was called before the API request; `logout()` now runs inside the `finally` block so authTransport.logout() can complete before local state is cleared.
- Replaced `<Trans>` component usage inside `<option>` elements in `EmployeeStatusOptions`, `EmployeeCreate` (contract type and org-unit placeholder), `SiteCreate`, `SiteEdit`, `ActivityLogList` (log-name filter), `CustomersPage` (status filter), `EmployeeList` (status filter), and `SitesPage` (type and status filters) with `_(msg\`...\`)`string calls to produce valid HTML, because`<Trans>`renders a wrapper element that is invalid inside`<option>` elements.
- Fixed remaining CodeQL "superfluous trailing arguments" alerts in `useAuth` tests by consolidating `otherKeyEvent`, `crossTabLoginEvent`, and `invalidJsonEvent` constructors to use the full `StorageEventInit` dictionary, removing all residual `Object.defineProperty` boilerplate and making the test file consistent throughout.
- Fixed a race condition in the `OnboardingLayout` sign-out handler where `logout()` was called before the API request; `logout()` and navigation to `/login` now happen only after a successful API logout call so local auth state is not prematurely cleared.
- Added a user-facing inline error message in `OnboardingLayout` when the sign-out API call fails; local auth state is preserved so the user can retry, and an inline alert notifies them the server request did not complete.
- Replaced invalid `<Trans>` component usage inside `<option>` elements in `EmployeeEdit` with `i18n._(msg\`...\`)` calls to produce valid HTML and avoid rendering issues with the organisational unit dropdown placeholder.
- Fixed inconsistent mock user `id` type (number vs string) in specific `useAuth.test.ts` assertions affected by sanitizer coercion; the updated expectations now reflect the sanitizer's string-coercion behavior.
- Fixed perpetual loading state in `CustomerDetail` when route `id` param is absent; `setLoading(false)` is now called on the early-return path.
- Replaced hardcoded `site(s)` pluralization in `CustomerDetail` with Lingui `<Plural>` for correct singular/plural handling.
- Extracted duplicated date-part computation in `EmployeeEdit.formatDateForDisplay` so `day`, `month`, and `year` are derived once before the locale branch.
- Fixed perpetual `fetchLoading` state in `EmployeeEdit` when `id` param is absent; `setFetchLoading(false)` is now called before the early return.
- Added user-visible error message in `EmployeeEdit` when the form is submitted without a route `id`; previously the submission silently no-oped.
- Replaced hardcoded locale-switched date validation error strings in `EmployeeEdit` with `i18n._(msg\`...\`)` calls so messages are properly translatable.
- Added targeted Android provisioning access-control regressions for hidden navigation and denied route access so the permission-gated provisioning UI in #751 stays covered end-to-end.

### Changed

- Strengthened repo-local Copilot governance for AI findings: frontend work now requires proof of defect before merging AI-generated fix PRs, treats green CI alone as insufficient evidence for semantic UI refactors, and documents the known guardrails around async ordering, `<option>` translation strings, and separated error state.
- Replaced raw Android provisioning rollout-channel and session-status enum values with human-readable labels and operator guidance, so stale, revoked, and already-used enrollment sessions are easier to interpret in the frontend UI.
- Aligned the frontend lint toolchain back to the ESLint 9 line so `eslint-plugin-react-hooks` no longer leaves the repository in an invalid peer-dependency state during installs.
- Made native-bridge login prefer the canonical `GET /v1/me` user payload immediately after authentication, so Android capability-gated navigation no longer depends on the potentially narrower token-login payload during first render.
- Refreshed the Lingui locale catalogs for the Android provisioning UI so the German navigation no longer falls back to the raw message id `62KQbc` in shipped builds.
- Aligned the frontend repo-local domain policy and validation script with the canonical Android artifact host `apk.secpal.app` so Android provisioning fixtures and runtime URLs pass governance checks.
- Strengthened Copilot governance: require test-impact analysis and same-commit test updates when a fix alters observable behavior, explicitly recommend `PREFLIGHT_RUN_TESTS=1` in preflight guidance for behavioral, security, or state-lifecycle changes, and mandate `--body-file` for programmatic PR creation to prevent shell escaping issues.
- Isolated authenticated `pre_contract` users into an onboarding-only shell, redirecting them away from normal app routes until activation and sending non-pre-contract users back to the canonical app entry when they hit `/onboarding`.
- Aligned the public onboarding completion flow with the current backend runtime by removing the unsupported profile-photo bootstrap field, submitting the documented JSON payload to `POST /v1/onboarding/complete`, and accepting the session-based completion response without a frontend token assumption
- Made browser-session login prefer the canonical `GET /v1/me` user payload immediately after authentication, so capability-gated navigation no longer comes up incomplete until the first manual refresh.
- Aligned MFA recovery-code placeholders, frontend fixtures, and service mocks with the canonical API payload shape of raw 8-character uppercase alphanumeric codes so the browser UI no longer teaches a grouped `XXXX-XXXX` format that differs from what the backend stores and returns.
- Made the checked-in Lingui `.po` catalogs the only frontend translation authority, removing the Translation.io-specific sync overlay so catalog maintenance now stays entirely repo-local.
- Refreshed the shipped MFA/login locale artifacts from the repo-local Lingui catalogs so the new MFA settings UI no longer falls back to raw Lingui message IDs in production.
- Removed the inset desktop content frame beneath the top navigation so the page surface now spans edge to edge without the previous side and bottom border effect.
- Clarified the repo-local branch-start and post-merge readiness workflow so new frontend work must start from a clean, updated local `main`, and post-merge cleanup now explicitly returns the repo to `main`, refreshes dependencies with `npm ci` where applicable, runs `npm run build` when available, and confirms a clean working tree
- Added a dedicated email-verification gate for protected routes, wired it to the backend resend-verification endpoint, and stopped surfacing the raw backend `Your email address is not verified.` error inside arbitrary app pages after login.
- Restored explicit repo-local Copilot governance by making TDD-first, quality-first, one-topic-per-PR, immediate issue creation for out-of-scope findings, and EPIC-plus-sub-issue requirements always-on again; the frontend runtime overlay now auto-loads repo-wide so these rules remain present while working
- Clarified the repo-local PR workflow so finished frontend work must be self-reviewed, committed, and pushed before any PR exists, and the first PR state must always be draft until the final PR-view self-review is clean
- Scoped the frontend zero-knowledge documentation to attachment contents only, clarifying in `README.md` and `docs/CRYPTO_ARCHITECTURE.md` that broader application data uses server-side encryption at rest and that file metadata is still visible to the server.
- Corrected the HKDF key-derivation documentation so `CRYPTO_ARCHITECTURE.md` matches the shipped frontend crypto code, which uses an empty HKDF `info` parameter for attachment file keys.
- Replaced the remaining `@secpal.app` auth-service test fixture emails in `authState.test.ts` and `authTransport.test.ts` with `@secpal.dev` so those tests follow the repository domain policy for non-production addresses.
- Aligned repo-local domain governance and validation with the renamed Android application identifier `app.secpal`, removing the old identifier-only exception from current policy text.
- Replaced the raw backend `Server Error` text on login failures with a controlled temporary-unavailable message when the login API returns a `5xx`, so browser and PWA users no longer see the uncaught backend error string on the live login screen.
- Replaced the remaining hand-written frontend auth response shapes with contract-aligned auth and MFA types under `@/types/api`, extended the auth API client to cover login MFA challenges plus the backend self-service MFA endpoints needed by the upcoming UI slices, updated the browser-session auth transport to surface the discriminated `authenticated | mfa_required` result, and added full unit coverage for all new API client methods and transport branches.

- Aligned the frontend browser-session auth contract with the backend UUID-based user payload so successful login, current-user bootstrap, persisted auth state, and onboarding handoff now accept valid string user IDs instead of incorrectly rejecting them as unsafe.
- Hardened the browser-session auth endpoint wiring so login, logout, CSRF bootstrapping, and `GET /v1/me` all build URLs from the same production-safe API resolver, which now requires an explicit absolute `VITE_API_URL` for every production deployment and fails fast on missing or relative API bases instead of guessing a host.
- Aligned repo-local domain governance and validation with the current split of `secpal.app` for the public homepage and real email addresses, `api.secpal.dev` for the API, and `app.secpal.dev` for the PWA, while keeping `app.secpal` as the Android-only application identifier
- Corrected the frontend production API fallback and related examples to use the canonical `https://api.secpal.dev` host.
- Separated customer and site feature visibility from assignment-mutation and cross-resource permissions, so only explicit collection access (`hasCustomerAccess` / `hasSiteAccess` or the matching read permission) unlocks those frontend areas and future custom roles cannot drift into implicit half-authorized states.
- Aligned customer and site feature gating with the backend collection policy by honoring explicit `hasCustomerAccess` and `hasSiteAccess` auth-context flags, so scoped-assignment users can enter the same areas the API intentionally exposes while users without any effective access continue to see the shared access-denied state.
- Clarified the employee status rules in the create and edit UI by showing the full valid status set (`Applicant`, `Pre-Contract`, `Active`, `On Leave`, `Terminated`) and by explaining inline that onboarding invitations are only available in `Pre-Contract`.
- Aligned the frontend auth client, integration tests, and migration guide with the canonical backend auth/self-service surface so browser sessions now use `POST /v1/auth/login`, `POST /v1/auth/logout`, and `GET /v1/me` instead of legacy or guessed paths
- Pinned frontend TypeScript back to the supported `5.9.x` line so `@typescript-eslint` linting no longer runs outside its declared compatibility range while the repository waits for official TypeScript 6 support

### Removed

- Removed the stale `pendingSync` field and index from the offline organizational-unit schema so the reduced IndexedDB surface no longer carries leftover generic sync metadata.

- Removed the stale sync-status translation entries from the Lingui catalogs so the frontend locale artifacts no longer carry messages for the deleted browser sync-status UI.

- Removed the stale `getPendingSyncUnits` helper and its dead organizational-unit store tests so the frontend no longer advertises an unused pending-sync browser path.

- Removed the unused `StorageQuotaIndicator` component and its dead test coverage so the frontend no longer ships that dormant browser-storage UI surface.

- Removed the deleted legacy product module from the frontend, including its obsolete routes, navigation entries, offline caches, background sync wiring, and associated documentation so the repository no longer ships or documents that retired area in 0.x
- Removed the remaining legacy test suites, stale documentation, and outdated frontend schema/cache references that only existed for the deleted module
- Removed the stale `docs/PERFORMANCE_NEXT_STEPS.md` and `docs/PERFORMANCE_README.md` planning summaries because they only captured temporary 2025 performance follow-up plans
- Removed the stale `docs/PROJECT_STATUS.md` snapshot because it no longer matched the current frontend state and duplicated newer repository history
- Removed the stale `docs/PERFORMANCE_ISSUE319_STATUS.md` and `docs/PERFORMANCE_TBT_DEFER_IMPLEMENTATION.md` worklog documents because they no longer reflected the final outcome of the 2025 Issue #319 investigation
- Removed the stale `docs/PERFORMANCE_DEPLOYMENT_STATUS.md` snapshot because it only documented a temporary 2025 deployment checkpoint and no longer reflected the repository's active guidance
- Removed the obsolete `docs/PERFORMANCE_AGGRESSIVE_SPLITTING_RESULTS_ARCHIVED.md` archive because it only preserved a reverted implementation path and no longer served as useful active documentation
- Removed the stale `docs/PERFORMANCE_OPTIMIZATIONS_IMPLEMENTED.md` worklog because it only tracked temporary 2025 optimization steps and duplicated more precise historical analysis records
- Removed the obsolete `docs/PERFORMANCE_OPTIMIZATIONS_2025-12-06-AGGRESSIVE.md` note because it documented a superseded aggressive chunk-splitting experiment that was not retained as active guidance

### Security

- Added a versioned `deploy/nginx/app.secpal.dev.conf` production baseline plus a `test:live:pwa-headers` smoke check so the live PWA host can enforce CSP, Permissions-Policy, HSTS, Referrer-Policy, framing protection, and correct `sw.js` / `manifest.webmanifest` header delivery under Nginx instead of relying on Apache-only `.htaccess` rules.
- Blocked the shipped Apache SPA fallback from answering `/v1/*`, `/sanctum/*`, and `/health*` with `index.html`, and documented the matching Nginx guard so API paths on `app.secpal.dev` now fail clearly instead of returning a misleading `200 text/html` shell.
- Added a live frontend smoke script for auth-route separation so deployments can automatically fail when `app.secpal.dev/v1/me` regresses to the SPA shell or `api.secpal.dev/v1/me` stops returning JSON.
- Hardened the browser/PWA response baseline by enforcing a production CSP without inline scripts, expanding `Permissions-Policy` and modern cross-origin headers, and serving `index.html`, `sw.js`, and `manifest.webmanifest` with update-safe cache rules so PWA security fixes propagate promptly.

- Reduced the shipped PWA client surface further by removing the dormant sync-status path from the runtime app shell and narrowing `SecPalDB` plus logout fallback cleanup to the currently supported offline tables so the frontend no longer ships the unused generic queue/cache runtime.

- Reduced the shipped PWA client surface further by stripping offline organizational-unit cache entries down to route/tree fields and removing dead manifest shortcuts that pointed to non-existent routes.

- Reduced shared-device post-logout bleed further by clearing stored notification preferences during logout cleanup, and added regression coverage for the IndexedDB table-clearing fallback when deleting `SecPalDB` is blocked.

- Minimized post-logout PWA persistence further by deleting `SecPalDB` instead of leaving cleared IndexedDB stores behind, reducing the service-worker offline auth cache to a bare `isAuthenticated` boolean, and preventing the logged-out sync-status UI from recreating offline session storage on the login screen.

- Tightened the PWA post-logout cleanup path so authenticated analytics state is disabled and cleared on logout, `/v1/auth/*` and `/v1/me` requests explicitly bypass browser caches, and offline logout regressions now cover both `/profile` and `/settings` to prevent stale protected content from reappearing.

- Tightened the PWA logout/offline privacy hardening by persisting an explicit logout barrier in local storage, scrubbing any stale `auth_user` payload that reappears after logout, and rejecting BFCache or cross-tab restoration paths until a fresh login writes a new authenticated state.

- Hardened PWA logout/offline privacy by synchronizing explicit auth state to the service worker, redirecting logged-out offline navigation away from protected routes such as `/profile`, and reconciling restored or cross-tab client state so previously viewed user data cannot remain readable after logout.

- Raised the frontend override floors for `brace-expansion` and `serialize-javascript` so `npm audit` now returns 0 vulnerabilities; the remaining install-time deprecation warnings still come from the upstream `vite-plugin-pwa` / `workbox-build` toolchain and remain documented as accepted build-time risk

- Pinned the transitive `picomatch` resolution to `2.3.2` for 2.x consumers and
  `4.0.4` for 4.x consumers via `overrides`, so the frontend no longer ships
  the vulnerable glob-matching releases flagged by Dependabot security alerts for
  CVE-2026-33672 / GHSA-3v7f-55p6-f55p; upstream major-version constraints remain
  unchanged while the patched releases are enforced in the lockfile and the alerts
  are tracked in #598
- Pinned the transitive `glob` resolution to `^13.0.6` via `overrides` so the
  deprecated `glob@11.1.0` (pulled in by `@lingui/cli` and `workbox-build`) is
  replaced by a current, non-deprecated release; the remaining deprecated
  transitive packages inside `workbox-build@7.4.0` (`sourcemap-codec@1.4.8`,
  `source-map@0.8.0-beta.0`) are blocked upstream and tracked separately
  (closes #558, remaining items blocked by upstream `vite-plugin-pwa` /
  `workbox-build`)
- Pinned third-party GitHub Actions in frontend workflows to immutable commit SHAs so Lighthouse and Codecov automation no longer depend on floating action tags at runtime
- Pinned the transitive `flatted` resolution to `3.4.2` so Vitest UI and ESLint cache tooling no longer ship the vulnerable parser affected by CVE-2026-33228 / GHSA-rf6f-7fwh-wjgh

- Pinned the transitive `yauzl` resolution to `3.2.1` so Lighthouse-related tooling no longer ships the vulnerable archive parser flagged by `npm audit` and Dependabot

- **Phase 1 offline-data hardening**
  - Removed PWA runtime caching for authenticated API routes to avoid persistent browser caching of sensitive `/v1/*` responses
  - Added centralized sensitive client-state cleanup for logout and session-expiry flows
  - Sensitive IndexedDB tables and legacy API cache names are now cleared when the client session ends
  - Replaced invalid on-prem example domain in frontend config comments to stay within the `secpal.app` / `secpal.dev` domain policy

### Fixed

- Removed the unreachable inline error panel from `EmployeeEdit` that duplicated the full-screen error view already returned by the early-return guard, eliminating a logically dead conditional branch.
- Aligned the employee detail actions with the onboarding runtime workflow so HR/compliance users can confirm submitted onboarding dossiers via the dedicated admin endpoint and activation is only offered once the backend marks the employee `ready_for_activation`.
- Aligned the authenticated onboarding wizard with the documented runtime API surface so it now loads ordered templates from `/v1/onboarding/templates`, reuses existing submissions from `/v1/onboarding/submissions`, saves and submits through the backend's POST upsert flow with `form_template_id`, and no longer exposes the stale PATCH-only or file-upload paths that the current runtime does not provide.
- Replaced the protected-route startup dead-end on Android with a bounded auth-bootstrap recovery flow, so cached sessions no longer sit on an indefinite `Laden...` spinner when native session revalidation is slow or transiently fails; SecPal now shows an explicit retry/login recovery state and only clears auth immediately for real invalid-session errors.
- Stopped Android cached-session bootstrap from blocking protected routes when the native layer reports the device offline, so the shared frontend now checks native connectivity before `GET /v1/me` and preserves cached access instead of falling back into repeated recovery loops driven by stale `navigator.onLine` state.
- Disabled PWA service-worker registration inside the native Capacitor runtime and added native-runtime cleanup of stale browser service workers and cache storage so Android app updates no longer stay pinned to an outdated cached app shell that misses the injected native auth bridge.
- Retried transient login health-check failures before surfacing the "System not ready" blocker so Android startup races no longer leave the login screen latched in a false offline/configuration error state.
- Split frontend translation catalog maintenance into a local-only `npm run sync` flow and explicit `sync:translationio` commands, so contributors without a Translation.io API key no longer get noisy sync warnings while maintainers still have a fail-fast remote sync path.
- Replaced the remaining frontend documentation-only placeholder-domain references with `secpal.dev` / `app.secpal.dev` host examples and `secpal.app` email examples so the repo stays aligned with the SecPal domain policy outside runtime and test fixtures as well.
- Replaced the remaining non-SecPal frontend test fixtures with `secpal.dev` addresses and updated the login email placeholder to a SecPal domain. This keeps the repository aligned with the `secpal.app` / `secpal.dev` domain policy consistently.
- Filled the remaining generic German Lingui catalog gaps for employee status guidance so the frontend `de` locale no longer falls back to English for those UI strings.
- Updated the `activityLogApi` service tests to expect the configured absolute API URL, matching the current client behavior and restoring the targeted Vitest coverage for activity-log requests
- Surfaced backend `send_invitation` validation errors inline in the employee create form, showed onboarding-invitation availability reasons on employee detail pages, and aligned the terminate action with the backend by allowing it for `on_leave` employees as well as `active` ones.
- Replaced the authenticated wildcard app-route redirect to `/` with a dedicated not-found state, so unknown non-onboarding URLs now fail clearly while protected feature routes continue to use the shared access-denied UX
- distinguish temporary onboarding rate limits from invalid or expired invitation links in the onboarding completion flow, keep form-level `429` feedback inline instead of collapsing into the invalid-link screen, and surface a dedicated retry state when token validation is temporarily throttled
- Centralized frontend UI capabilities for low-privilege users so scope-only accounts stay in self-service areas and direct navigation to elevated feature routes now resolves through one shared capability guard instead of mixed ad hoc checks
- Applied the centralized low-privilege capability model to the main application navigation so management links stay hidden unless the user has the matching feature access
- Hid customer, site, and employee create/update/delete or status-transition CTAs unless the centralized UI capability model grants the matching action, so low-privilege users no longer see misleading management buttons inside accessible pages
- Harmonized low-privilege frontend route handling outside onboarding: hidden management areas now resolve to the shared in-app not-found state when users cannot discover the feature at all, create/edit routes inside known features keep the explicit access-denied state when the action itself is forbidden, and the legacy `/organizational-units` path now redirects authorized users to the canonical `/organization` route
- Aligned the employee create UI and API types with the invite-enabled backend flow by adding `send_invitation` to the create payload and surfacing persisted onboarding invitation delivery status on employee detail pages
- Aligned the frontend employee create payload type with the shared contract by making `EmployeeFormData.position` mandatory, matching the existing required create-form validation and backend/runtime expectations (fixes #578)
- Made the employee create form fail loudly instead of silently by adding Catalyst-aligned submit summaries, inline field errors, first-invalid-field focus, clearer required-field guidance for Date of Birth, Organizational Unit, Status, Contract Type, and the Leadership Position/Management Level relationship, plus structured handling for API validation errors
- Synchronized the employee create Lingui catalogs and finalized the shipped German validation and helper copy so the recent form-usability messages are present in both source and compiled locale bundles
- Replaced the incomplete `public/logo-light.svg` and `public/logo-dark.svg` placeholder contents with valid SVG logo assets that render the canonical frontend light and dark branding outputs correctly
- Moved the local Lighthouse CI CLI to on-demand `npx` execution so regular frontend installs no longer pull the deprecated `@lhci/cli` dependency chain that emitted `rimraf`, `glob@7`, and `inflight` warnings during pre-push installs
- Aligned `eslint` and `@eslint/js` with the `eslint-plugin-react-hooks` peer range by moving both packages back to the latest compatible 9.x line (`9.39.4`), so `npm ls` no longer reports an invalid frontend lint dependency tree; documented in `docs/KNOWN_ISSUES.md` that the global `minimatch: >=10.2.4` override is intentional and confirmed compatible with ESLint 9 by CI
- Replaced the deprecated PWA service-worker build setting `inlineDynamicImports` with `codeSplitting: false` via the plugin's custom SW build hook so `npm run build` no longer emits the Vite 8 deprecation warning
- Stabilized several interaction-heavy frontend tests by reusing the shared test i18n instance, mocking lazy dialog and listbox edges, and making async form/upload assertions deterministic in Vitest
- Hardened the `EmployeeCreate` success-path test to wait for loaded organizational-unit options and async navigation, reducing full-suite timeout flakiness
- Hardened additional full-suite-sensitive submit flows in `Login`, `ApplicationLayout`, and `CustomerCreate` tests to reduce timing-dependent Vitest failures

### Added

- Offline sync queue retry scheduling now persists `nextRetryAt` timestamps so pending operations can wait for their backoff window instead of retrying immediately on every local processing pass
- Sync status UI now surfaces the next scheduled offline retry time and hides the manual sync trigger while pending operations are still in their backoff window
- `.github/instructions/react-typescript.instructions.md` - targeted React and strict TypeScript guidance for frontend source and test files
- `.github/instructions/github-workflows.instructions.md` - targeted workflow and Dependabot guidance for GitHub automation files in this repo
- `.github/instructions/org-shared.instructions.md` — org-wide Copilot principles (TDD, quality gates, PR protocol); `applyTo: "**"` auto-loading was later removed during governance context cleanup

### Changed

- Updated `.npmrc` to document that `legacy-peer-deps=true` is specifically
  required to suppress the `vite-plugin-pwa@1.2.0` peer-dependency conflict
  with Vite 8; the plugin currently declares peer support only through Vite 7
  (see #559 for status); the SPDX copyright year range was extended to `2025-2026`
- `.github/copilot-instructions.md` now requires a branch hygiene check before any write action so frontend work never starts on local `main` and dirty non-`main` branches must be assessed before continuing
- `.github/copilot-instructions.md` now requires stale `SPDX-FileCopyrightText` years in edited files and license sidecars to be normalized to `YYYY` or `YYYY-YYYY` without spaces
- `.github/copilot-instructions.md` now clarifies that if an edited file has no inline SPDX header, its companion `.license` file must be checked and updated instead
- repo-local frontend instructions and overlays now also restate Copilot review handling, signed-commit checks, EPIC/sub-issue requirements, REUSE checks, 4-pass review, and the `secpal.app` vs `secpal.dev` use-case split so project-wide governance is locally complete
- repo-local frontend instructions and overlays now also require warning, audit, and deprecation notices from scripts and package managers to be reviewed and either fixed or tracked immediately
- Changed the English login email field label from `Email` to `Email address` for clearer authentication microcopy without altering the rest of the screen
- Changed the login-page heading from `Login` to `Log in` for consistent authentication microcopy while leaving the rest of the screen unchanged
- Removed the login-page subtitle so the auth entrypoint shows only the product name and keeps the footer slogan as the sole claim treatment
- Synchronized the frontend Lingui catalogs with Translation.io so the updated German login and tagline-related copy is reflected locally after the recent remote translation refresh
- Standardized the frontend-visible SecPal tagline to `Powered by SecPal – A guard's best friend` across footer text, landing copy, tests, and generated locale catalogs; the tagline is intentionally identical in all locales (no translation)
- Marked `docs/PERFORMANCE_ANALYSIS_2025-12-06.md` as historical reference material so it is not mistaken for the current frontend optimization plan
- Marked `docs/IMPLEMENTATION_PLAN_ISSUE143.md` as a historical planning artifact so it is not mistaken for current implementation guidance
- Marked the retained Issue #319 profiling and TBT analysis notes as historical reference material so they are not mistaken for active implementation instructions

- Updated frontend package baselines to the latest currently compatible releases for `@lingui/core`, `@lingui/react`, `@lingui/macro`, and `vite-plugin-static-copy`

- `.github/copilot-instructions.md` - replaced comment-based inheritance assumptions and long-form examples with a self-contained runtime baseline for this repository
- `.github/instructions/org-shared.instructions.md` - reduced to a short repo-local overlay that reinforces the runtime baseline instead of duplicating org documents
- **Git Hooks Diagnostic Tool** (#392)
  - Created `scripts/diagnose-hooks.sh` to troubleshoot pre-push hook issues
  - Comprehensive checks for hook installation, git config, shell environment
  - Detects prompt/tool integrations that may trigger hooks unexpectedly
  - Provides actionable recommendations for fixing hook problems
  - Documentation: `docs/diagnose-hooks.md`
  - Added "Troubleshooting" section to CONTRIBUTING.md with diagnostic guide, performance tips, and common fixes
- **Employee Management & Onboarding Portal** (#332, Epic #211 Phase 7)
  - **API Service Layers:**
    - Employee API service layer (CRUD operations, activate, terminate)
    - Qualification API service (system/custom qualifications, employee assignments)
    - Onboarding API service (multi-step wizard, file upload, HR approval workflow)
    - Employee Document API service (8 document types, policy-based visibility)
  - **UI Components (Catalyst Framework):**
    - Employee List page with Catalyst Table, Field, Input, Select components
    - Employee Detail page with Catalyst Badge, DescriptionList, tabs with proper dark mode support
    - Employee Create form using Catalyst Fieldset, Legend, FieldGroup, Field, Label, Input
    - Employee Edit form (pre-populated data editing with Catalyst components)
    - Pre-contract Onboarding Wizard (8-step process with Catalyst Button, Heading, Text)
  - **Navigation & Access Control:**
    - UserGroupIcon added to component library
    - "Employees" navigation item in navbar and sidebar (conditional on organizational access)
    - OrganizationalRoute wrapper component for RBAC enforcement
    - All employee routes protected with `hasOrganizationalAccess()` permission checks
  - **Routing Integration:**
    - `/employees` - Employee list view
    - `/employees/create` - Create new employee
    - `/employees/:id` - Employee detail view
    - `/employees/:id/edit` - Edit existing employee
    - `/onboarding` - Pre-contract onboarding wizard
  - **Internationalization:**
    - Full i18n support with `<Trans>` and `msg` from @lingui/macro
    - All UI text translatable (German/English)

### Fixed

- **Frontend build now stays compatible with Vite 8**
  - replaced object-based manual chunk configuration with a function-based variant so production builds and Lighthouse CI continue to work with Vite 8
  - switched the React Babel macro configuration to Lingui's dedicated Babel plugin so Lingui macros continue to compile correctly with `@vitejs/plugin-react` 6

- **Auth bootstrap now revalidates stored sessions before unlocking protected routes** (#503)
  - added frontend bootstrap revalidation against `GET /v1/me` when a stored session is present and the client is online
  - protected routes now remain in the loading state until startup revalidation succeeds or fails closed
  - stale local `auth_user` state is cleared, including sensitive client cleanup, when startup revalidation rejects
  - offline startup still preserves existing local session state to keep the offline-first flow available

- **Employee API types now use a shared contract source** (#492)
  - added `src/types/api` as the central frontend import path for employee API types
  - removed employee request and response type declarations from `src/services/employeeApi.ts`
  - rewired employee pages, tests, and auth context away from service-local employee types
  - aligned the employee UI with the contract-backed `applicant` status

- **Login page: Health check retry on offline→online transition**
  - Fixed false "System not ready" error when login page is opened offline and then comes online
  - Health check is now skipped when offline (shows offline warning instead)
  - Health check automatically retries when device comes back online
  - Eliminates need for manual page reload after network reconnection
  - Added test coverage for offline→online transitions

### Changed

- `.github/copilot-instructions.md` — removed dead `@EXTENDS`, `INHERITANCE`, and `applyTo` HTML comment blocks (replaced by `org-shared.instructions.md`)
- **Migrated to Stacked Layout design** (#TBD)
  - Switched from sidebar navigation to horizontal navbar (stacked layout)
  - Navigation items now displayed in top navbar on desktop
  - Mobile experience unchanged (sidebar drawer)
  - Improved space utilization with horizontal navigation
  - All Catalyst components and patterns maintained
  - Footer integration preserved across both layouts
- **Improved "Add Unit" button label in Organizational Unit Tree** (#300, Part of Epic #283)
  - Renamed "Add Unit" button to "Add Root Unit" for clarity
  - Makes it explicit that the button creates a root-level organizational unit
  - Reduces confusion about where new units will be created
  - Empty state button remains as "Create Organizational Unit" for first-time users
  - **Enhanced with hierarchy-based type filtering**: When creating a child unit, the type dropdown now only shows valid child types based on the parent's hierarchy rank. Child units must be **lower** in the hierarchy than their parent (e.g., Division under Branch is valid, but Branch under Branch is not allowed). This prevents users from selecting invalid types upfront, improving UX by avoiding validation errors after submission.

### Added

- **Web Vitals monitoring with thresholds & development warnings** (#310)
  - Performance threshold configuration aligned with Lighthouse CI and Google's Core Web Vitals
  - Development-mode console warnings for poor metrics (zero runtime cost in production)
  - Metrics export API for dashboards: `getPerformanceMetrics()`, `clearPerformanceMetrics()`
  - Severity levels: "good", "needs-improvement", "poor"
  - Full test coverage (14 passing tests)
  - Documentation: `docs/web-vitals-monitoring.md`

- **Playwright E2E testing infrastructure** (#309)
  - Comprehensive E2E test suite with Playwright
  - Three testing modes:
    - Local development (localhost:5173 with DDEV backend proxy)
    - Staging/performance tests (app.secpal.dev)
    - CI smoke tests (localhost:4173 preview build)
  - Test categories:
    - Authentication flow tests (login, logout, session persistence)
    - Smoke tests (page loading, navigation, accessibility basics)
    - Organization management integration tests
    - Lighthouse performance audits (Core Web Vitals)
  - Global setup with session reuse to prevent rate-limiting
  - Configurable test credentials via environment variables
  - npm scripts: `test:e2e`, `test:e2e:staging`, `test:e2e:ci`, `test:e2e:ui`, `test:e2e:headed`

### Fixed

- **PWA Update: Fixed double page reload issue**
  - **Problem:** When clicking "Update now" for a PWA update, the page reloaded twice, causing a jarring user experience
  - **Root Cause:** `swUpdate(true)` already triggers a reload via `vite-plugin-pwa`, but we were also explicitly calling `window.location.reload()` immediately after
  - **Solution:** Removed redundant `window.location.reload()` call from success path in `useServiceWorkerUpdate.ts`
  - **Impact:** Page now reloads once instead of twice, providing a smoother update experience
  - **Files Changed:**
    - `src/hooks/useServiceWorkerUpdate.ts` - Removed duplicate reload, kept as fallback for error cases only
    - `src/components/UpdatePrompt.tsx` - Simplified error handling
    - `src/hooks/useServiceWorkerUpdate.test.ts` - Updated test expectations
  - **Quality:** All tests pass (27/27), no linting or type errors
  - **Documentation:** `docs/PWA_UPDATE_DOUBLE_RELOAD_FIX.md`

- **Console errors detected by Lighthouse CI** (#311)
  - Changed non-critical `console.error` to `console.warn` for graceful degradation:
    - Analytics singleton initialization (browsers without IndexedDB support)
    - Analytics event tracking and sync failures
    - Web Vitals initialization failures
  - Removed verbose Web Vitals initialization log

### Added

- **Lighthouse CI for automated performance testing** (#308)
  - GitHub Actions workflow runs Lighthouse audits on every PR and push to main
  - Performance budgets based on Core Web Vitals thresholds:
    - LCP (Largest Contentful Paint): < 2.5s (error threshold)
    - CLS (Cumulative Layout Shift): < 0.1 (error threshold)
    - TBT (Total Blocking Time): < 200ms (warning threshold)
  - JavaScript console error detection (zero tolerance - fails on any JS error)
  - Accessibility and Best Practices audits with 90% minimum score
  - PR comments with Lighthouse scores and report links
  - Temporary public storage for report sharing
  - Tests for configuration validation

- **Mobile-friendly action menu for organization tree** (Part of Epic #283)
  - Replaced individual action buttons (Add Child, Edit, Move, Delete) with a compact dropdown menu (three dots icon)
  - Actions are now accessible via a single button that expands to show all available options
  - Saves horizontal space on mobile devices where action buttons previously overflowed
  - Uses Catalyst Dropdown, DropdownButton, DropdownMenu, and DropdownItem components

- **Detail panel close functionality** (#306, Part of Epic #283)
  - Close button (×) in detail panel header for explicit panel closing
  - ESC key support to close detail panel
  - Toggle selection: clicking the same unit again deselects it
  - Improved UX for organizational structure management

### Changed

- **Optimistic UI for organizational unit CRUD operations** (SecPal/api#303, Part of Epic #283)
  - After creating a unit, it's immediately added to the tree without reload
  - After updating a unit, changes appear instantly in the tree
  - After moving/reparenting a unit, the tree structure updates immediately
  - After deleting a unit, only the affected row is removed from the tree
  - No full tree reload for any CRUD operation, improving perceived performance and UX
  - Maintains tree state (expanded/collapsed nodes) after all operations
  - New `createdUnit` and `updatedUnit` props for optimistic updates from parent
  - Updated `MoveOrganizationalUnitDialog` to pass new parent ID on success
  - 6 test cases for optimistic UI behavior (delete, create, update)

### Fixed

- **Move dialog UX improvements** (Part of Epic #283)
  - Type labels (Company, Holding, etc.) are now translated in the Move dialog dropdown
  - Options are now sorted hierarchically (matching tree order) with indentation based on depth
  - Added type-specific icons in the dropdown options for better visual clarity
  - Replaced native Select with Catalyst Listbox for consistent UI and accessibility
  - Added `getTypeLabel()` and `flattenTree()` utility functions for hierarchical sorting

- **Inconsistent badge colors between tree and detail view** (#304, Part of Epic #283)
  - Detail panel now uses type-specific badge colors matching the tree view
  - Extracted `getTypeBadgeColor()` to `organizationalUnitUtils.ts` (DRY principle)
  - Added `BadgeColor` type for type-safe color values
  - Color mapping: blue (holding/company), green (department/division), purple (branch), orange (region), zinc (custom/unknown)
  - Added unit tests for `getTypeBadgeColor()`

### Changed

- **Permission-Filtered Organizational Unit Tree View** (#291, Part of Epic SecPal/api#280)
  - Tree component now uses `root_unit_ids` from API response to determine tree roots
  - Users see only organizational units they have access to (Need-to-Know principle)
  - Changed header from "Organizational Structure" to "My Organization" (user-centric)
  - Added `title` prop for customization when needed
  - Updated types: `OrganizationalUnitPaginationMeta` and `OrganizationalUnitPaginatedResponse`
  - 6 new test cases for permission filtering scenarios
  - Implements ADR-007 Need-to-Know pattern

### Fixed

- **OfflineIndicator no longer blocks app interaction** (#283)
  - Replaced blocking modal dialog (`Alert`) with non-blocking toast banner
  - Banner auto-minimizes to icon after 5 seconds to reduce obstruction
  - Users can manually minimize/expand the notification
  - Resets to expanded state when going offline again (for context)
  - Added comprehensive test coverage (19 tests)
  - Improved accessibility with `role="status"`, `aria-live="polite"`
  - Used `ChevronDownIcon` from HeroIcons instead of inline SVG (DRY)

### Added

- **Organizational Hierarchy UI Components** (#241, Part of Epic #228)
  - **API Services** - Four comprehensive API service modules with full CRUD support:
    - `organizationalUnitApi.ts`: Manage organizational units (holding, company, region, branch, division, department, custom)
    - `customerApi.ts`: Customer hierarchy management with parent-child relationships
    - `objectApi.ts`: SecPal objects and object areas with geofence support
    - `guardBookApi.ts`: Guard books and reports with status/report_type filtering
  - **TypeScript Types** (`src/types/organizational.ts`):
    - Complete type definitions for all organizational entities
    - Request/response types following ADR-007 conventions
    - Paginated response wrapper for list endpoints
  - **React Components** - Four feature-rich tree/manager components:
    - `OrganizationalUnitTree`: Hierarchical tree view with icons, badges, expand/collapse, and CRUD actions
    - `CustomerTree`: Customer hierarchy with object count display and filtering
    - `ObjectManager`: Split-panel object/area manager with detail view
    - `GuardBookManager`: Guard book list with report generation and status badges
  - **Features:**
    - Hierarchical tree building from flat API responses
    - Loading skeletons and error states
    - Empty state with create action
    - Type-specific icons and color-coded badges
    - Accessible tree structure with proper ARIA roles
    - Catalyst Design System integration (Button, Badge, Heading, Text)
  - **Test Coverage:** 60 API tests + 49 component tests, all passing
  - **Benefit:** Enables visual management of the organizational structure introduced in backend Epic #228

### Fixed

- **Centralized API Wrapper with Session Expiry for All Requests** (#263)
  - Created `apiFetch()` as centralized API wrapper function in `csrf.ts`
  - Migrated all API services from direct `fetch()` calls to `apiFetch()`:
    - `customerApi.ts`: All customer CRUD + hierarchy operations
    - `objectApi.ts`: All object and area management operations
    - `guardBookApi.ts`: All guard book and report operations
    - `organizationalUnitApi.ts`: All organizational unit operations
    - `authApi.ts`: Migrated from `fetchWithCsrf` to `apiFetch`
  - `apiFetch()` features:
    - Automatic `credentials: "include"` for httpOnly cookie authentication
    - CSRF token inclusion for POST/PUT/PATCH/DELETE methods
    - Emits `session:expired` event on 401 responses (triggers automatic logout)
    - Automatic retry on 419 (CSRF token mismatch) with fresh token
  - `fetchWithCsrf()` retained as alias for backward compatibility
  - **Root Cause:** Some GET requests still used direct `fetch()` without 401 handling, so expired sessions were not detected consistently
  - **Benefit:** All API calls now trigger automatic logout when session expires, improving PWA reliability
  - Updated all test files to mock `apiFetch` via `vi.mock("./csrf")`

- **Session Expiry Handling for PWA** (#257)
  - Added `sessionEvents` module: Pub/sub event system for session lifecycle events
  - Modified `fetchWithCsrf` to emit `session:expired` event on 401 responses when online
  - `AuthContext` now subscribes to `session:expired` events and triggers automatic logout
  - Prevents stale UI state where user appears logged in but backend session has expired
  - **Benefit:** Graceful handling of session expiry - user is logged out cleanly with redirect to login page
  - **Note:** Backend now uses `remember=true` for long-lived sessions (see api#270)

- **PWA Service Worker API_URL mode detection** (#249)
  - Updated `vite.config.ts` to use mode-aware API_URL detection matching `src/config.ts`
  - Development mode now uses empty string (Vite proxy forwards `/v1/*` to DDEV backend)
  - Production mode uses `https://api.secpal.dev` as fallback
  - **Benefit:** Service worker cache patterns now correctly match local proxy configuration, fixing cache misses in development mode
  - Related to: PR #248 (Vite proxy configuration for local DDEV development)

### Added

- **CSRF Token Integration & API Service Updates** (#224, Part of Epic #205)
  - All API services now properly include CSRF tokens via X-XSRF-TOKEN header
  - Automatic 419 (CSRF token mismatch) retry with fresh token refresh
  - Verified comprehensive test coverage: 19 unit tests + 18 integration tests, all passing
  - **Benefit:** Enhanced security against CSRF attacks with seamless token management and automatic retry on token expiration
  - Follows Gebot #1 (Qualität vor Geschwindigkeit) - All existing tests pass, no breaking changes

- **PWA Update Notification** (#222)
  - Changed `vite.config.ts` PWA plugin from `registerType: 'autoUpdate'` to `registerType: 'prompt'`
  - `useServiceWorkerUpdate` hook for detecting and managing PWA updates
    - `needRefresh` state indicates when new version is available
    - `offlineReady` state for offline capability
    - `updateServiceWorker()` method to trigger update and reload
    - `close()` method to dismiss update prompt (with 1-hour snooze - prompt will reappear after 1 hour if update is still available)
    - Automatic hourly update checks via Service Worker registration
    - Comprehensive error handling and logging
  - `UpdatePrompt` component with Catalyst Design System
    - Fixed bottom-right notification when update is available
    - "Update" button to apply new version immediately
    - "Later" button to dismiss and continue with current version
    - Accessible with ARIA attributes (role=status, aria-live=polite)
    - i18n support with lingui
  - Integrated into `App.tsx` for global availability
  - 30 comprehensive tests (14 for hook, 16 for component)
  - **Benefit:** Users are immediately informed when new PWA versions are available and can choose when to update
  - Follows Gebot #1 (Qualität vor Geschwindigkeit) - Full TDD implementation with comprehensive tests

- **Integration Tests & Developer Documentation for httpOnly Cookie Authentication** (#212, Part of Epic #208) - **CURRENT PR**
  - `tests/integration/auth/cookieAuth.test.ts`: Complete integration tests for cookie-based authentication flow
    - Login flow with CSRF token and httpOnly cookies
    - Authenticated requests with automatic cookie inclusion
    - Logout flow and session clearing
    - Security verification (no token in localStorage)
    - Cookie attributes documentation (HttpOnly, Secure, SameSite)
  - `tests/integration/auth/csrfProtection.test.ts`: Comprehensive CSRF protection integration tests
    - CSRF token inclusion in POST/PUT/PATCH/DELETE requests
    - Automatic 419 (CSRF token mismatch) retry with fresh token
    - Error scenarios (401, 403, 500) handled without retry
    - Credentials always included for cross-origin requests
    - GET requests documentation (no CSRF needed for safe methods)
  - `docs/authentication-migration.md`: Complete developer migration guide (600+ lines)
    - Security benefits and XSS protection explanation
    - Architecture diagrams with sequence flows
    - Local development setup with environment configuration
    - API changes for developers with code examples
    - Removed code patterns (localStorage, Authorization header)
    - Testing instructions (unit, integration, manual)
    - Troubleshooting guide for common issues (401, 419, cookie problems)
    - Browser compatibility matrix
    - Production considerations and security headers
  - Updated `README.md`: Added authentication section with httpOnly cookie documentation
  - Updated `CHANGELOG.md`: Added migration entry with complete implementation timeline
  - Code coverage: ≥80% for new integration tests (all tests passing)
  - Security: Comprehensive tests verify no token accessible via JavaScript
  - Part of httpOnly Cookie Authentication Migration Epic #208 (Final Phase - Closes Epic)
  - **Changed in this PR:**
    - `README.md`: Added 🔒 Authentication section with httpOnly cookie documentation
    - `CHANGELOG.md`: Updated with complete Epic #208 implementation timeline

- **CSRF Token Handling & Request Interceptor** (#211, Part of Epic #208) - **MERGED 23.11.2025**
  - `csrf.ts` service module with CSRF token management
  - `fetchCsrfToken()`: Fetches CSRF token from Laravel Sanctum (`/sanctum/csrf-cookie`)
  - `getCsrfTokenFromCookie()`: Extracts XSRF-TOKEN from browser cookies
  - `fetchWithCsrf()`: Request interceptor with automatic CSRF token inclusion
  - 419 (CSRF token mismatch) auto-retry with fresh token
  - Integration in `authApi.ts`: CSRF token fetch before login, all auth endpoints use interceptor
  - `CsrfError` class for CSRF-specific error handling
  - 17 new unit tests for CSRF functionality (all passing)
  - Updated `authApi.test.ts` to mock CSRF token calls (13 tests passing)
  - Total: 677 tests passing, TypeScript strict mode clean, ESLint clean
  - Part of httpOnly Cookie Authentication Migration Epic #208 (Phase 2/3)
  - Security: Protects against CSRF attacks for all state-changing requests

- **Client-Side File Encryption - Phase 5: Security Audit & Documentation** (#174, Part of #143)
  - Comprehensive security documentation in `CRYPTO_ARCHITECTURE.md`
  - Security audit completed for all encryption code
  - Updated README with File Encryption section
  - Zero-knowledge architecture verified and documented
  - All crypto tests passing (42.85% coverage)
  - Part of File Encryption Epic #143 (Phase 5/5)

- **Client-Side File Encryption - Phase 4: Download & Decryption** (#176, Part of #143) - **MERGED 21.11.2025**
  - `AttachmentList` component with download/preview/delete actions
  - `downloadAndDecryptAttachment()` API function with integrity verification
  - Automatic decryption on download with SHA-256 checksum validation
  - File type detection and human-readable size formatting
  - Loading states and error handling for decryption failures
  - 11 active tests passing
  - Part of File Encryption Epic #143 (Phase 4/5)

- **Client-Side File Encryption - Phase 3: Upload Integration** (#175, Part of #143) - **MERGED 21.11.2025**
  - Background sync for encrypted file uploads with exponential backoff
  - `UploadStatus` component with progress indicators and retry functionality
  - IndexedDB-based upload queue with persistent storage
  - Service Worker integration for offline upload capability
  - `registerEncryptedUploadSync()` function for automatic retries
  - Real-time upload status tracking with i18n support
  - 15 active tests passing
  - Part of File Encryption Epic #143 (Phase 3/5)

- **Client-Side File Encryption - Phase 1: Crypto Utilities** (#172, Part of #143) - **MERGED 19.11.2025**
  - AES-GCM-256 encryption/decryption with Web Crypto API
  - HKDF-SHA-256 key derivation for per-file keys
  - SHA-256 checksum calculation for integrity verification
  - Non-extractable CryptoKey management
  - NIST test vectors validation
  - 12 active tests passing (100% coverage)
  - Part of File Encryption Epic #143 (Phase 1/5)

- **Push Notifications Infrastructure** (#166, Part of #144 PWA Phase 3)
  - Service Worker push event handlers for backend notifications
  - Notification click routing with deep-link support
  - `usePushSubscription` hook for VAPID-based subscription management
    - Subscribe/unsubscribe to push notifications
    - Automatic subscription restoration on page load
    - Push subscription data extraction for backend API
  - `NotificationPermissionPrompt` component
    - Non-intrusive banner UI for permission requests
    - Dismissible with session persistence
    - Test notification on successful grant
  - Push notification features:
    - Notification display with custom title, body, icon, badge
    - Action buttons (Open, Dismiss)
    - Deep-link URL routing on click
    - Support for notification tags and custom data
  - 13 tests for push subscription management
  - 10 tests for permission prompt UI/UX
  - Accessibility: keyboard navigation, ARIA labels
  - Security: VAPID key support via environment variables
  - Part of PWA Phase 3 (Epic #64, Sub-Issue #166)

- **Offline Analytics & Telemetry** (#167, Part of #144 PWA Phase 3)
  - Web Vitals integration for performance monitoring:
    - CLS (Cumulative Layout Shift) - Visual stability tracking
    - INP (Interaction to Next Paint) - Responsiveness measurement (Web Vitals v4)
    - LCP (Largest Contentful Paint) - Loading performance
    - FCP (First Contentful Paint) - Perceived load speed
    - TTFB (Time to First Byte) - Server response time
    - Automatic metric collection via `initWebVitals()` in main.tsx
    - Metrics tracked to analytics IndexedDB for offline queuing
  - Error tracking with React Error Boundary:
    - `AnalyticsErrorBoundary` component - Automatic error capture
    - Graceful fallback UI with refresh option
    - Development-mode error details display
    - Analytics integration for error reporting
  - Dependencies: `web-vitals@5.1.0` for Core Web Vitals metrics
  - 13 comprehensive tests for new features (100% coverage)
  - Privacy-first design: No PII, no file paths, anonymous session IDs
  - Part of PWA Phase 3 (Epic #144, Sub-Issue #167)

- **Code Coverage Integration** (#137)
  - Integrated Codecov for automated coverage tracking
  - Vitest now generates LCOV and Clover coverage reports
  - CI pipeline uploads coverage to Codecov dashboard
  - Added coverage badge to README.md
  - Coverage configuration in `vite.config.ts` with v8 provider
  - Supports organization-wide 80% coverage threshold

- **Git Conflict Marker Detection**: Automated check for unresolved merge conflicts
  - `scripts/check-conflict-markers.sh` - Scans all tracked files for conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`, `|||||||`)
  - `.github/workflows/check-conflict-markers.yml` - CI integration (runs on all PRs and pushes to main)
  - `docs/scripts/CHECK_CONFLICT_MARKERS.md` - Complete usage guide with examples and troubleshooting
  - Exit codes: 0 = clean, 1 = conflicts detected
  - Prevents accidental commits of broken code from merge conflicts
  - Colored output shows exact file locations and line numbers

- **Documentation**: Created `docs/KNOWN_ISSUES.md` to track upstream dependency issues
  - Documents npm deprecation warnings from `workbox-build@7.3.0` transitive dependencies
  - Explains why warnings appear and why we cannot fix them directly
  - Provides impact assessment, upstream issue links, and expected resolution timeline
  - Follows Gebot #2 (Qualität vor Geschwindigkeit) by accepting the issue rather than hiding it

- **PWA Phase 3 Features (Issue #67)**: Complete implementation of Push Notifications and Offline Analytics
  - **Push Notifications**: Permission management, Service Worker integration, notification display
    - `useNotifications` hook with permission state management
    - Service Worker notification display with fallback to browser API
    - `NotificationPreferences` component using Catalyst Design System
    - LocalStorage persistence for notification preferences
    - Support for 4 notification categories (alerts, updates, reminders, messages)
    - 13 comprehensive tests
  - **Offline Analytics**: Privacy-first event tracking with offline persistence
    - `OfflineAnalytics` singleton class with IndexedDB storage
    - Automatic sync when online (every 5 minutes)
    - Session ID generation and user ID tracking
    - Event types: page_view, button_click, form_submit, error, performance, feature_usage
    - Statistics API and old event cleanup (30 days retention)
    - 22 comprehensive tests
  - **IndexedDB Schema v2**: Added analytics table with indexes
    - Breaking change: Schema upgraded from v1 to v2
    - Automatic migration handled by Dexie.js
    - New indexes: `++id, synced, timestamp, sessionId, type`
  - **Testing Guide**: Comprehensive PWA_PHASE3_TESTING.md with manual testing instructions
  - Total: 67 new tests added (131 tests passing)

- **Background Sync API**: Automatic retry of failed operations when connection restored
  - Workbox Background Sync integration for API requests
  - Exponential backoff retry strategy (1s, 2s, 4s, 8s, 16s)
  - Max 5 retry attempts before marking operation as failed
  - Batch processing of pending sync operations
  - Status tracking (pending, synced, error) for each operation
  - Auto-cleanup of successfully synced operations
  - 15 comprehensive tests for sync logic and error handling

- **Sync Status Indicator UI Component**: Real-time sync status visualization
  - Live display of pending/error operations count using Dexie React Hooks
  - Auto-sync when device comes online after being offline
  - Manual sync trigger button for user-initiated synchronization
  - Last sync timestamp display
  - Error message display with retry information
  - Offline notice when device is disconnected
  - Fixed bottom-right positioning with shadow and dark mode support
  - 9 comprehensive tests covering all user interactions
  - Dependencies: `dexie-react-hooks@^4.2.0`

- **IndexedDB Integration with Dexie.js**: Structured client-side storage for offline-first architecture
  - Database schema with tables for guards, sync queue, and API cache
  - TypeScript-first implementation with full type safety
  - CRUD operations for all entities
  - Automatic schema versioning and migrations
  - API response caching with TTL (24h default, customizable)
  - Expired cache cleanup functionality
  - Sync queue for offline operations with retry logic
  - Storage quota monitoring utilities
  - Dependencies: `dexie@^4.2.1`, `fake-indexeddb@^6.2.4` (dev)
  - 27 passing tests with 100% coverage of core functionality

- **PWA App Shortcuts**: Quick access to key features from app icon
  - 4 shortcuts: View Schedule, Quick Report, My Profile, Emergency Contact
  - Deep linking to specific app sections
  - Configured in Web App Manifest for all platforms
  - Mobile and desktop support (Android, iOS, Chrome, Edge)

- **Storage Quota Indicator**: UI component for storage monitoring
  - Real-time display of IndexedDB usage (MB / Quota)
  - Percentage-based progress bar with visual feedback
  - Warning indicator when storage exceeds 80% capacity
  - Graceful fallback when Storage API unavailable
  - 4 comprehensive tests for all scenarios

- **Legacy UI setup completion**: Production-ready configuration
  - React Router v7 for client-side navigation with SPA routing
  - Inter font family integration via @fontsource/inter (weights 400-700)
  - Legacy outline icon library for UI consistency
  - Updated Link component for React Router integration
  - Tailwind @theme configuration with Inter and font features
  - Demo routes (Home, About) showcasing routing capabilities
  - Updated tests for new router-based structure

- **PWA Offline-First Foundation**: Progressive Web App infrastructure
  - Vite PWA plugin with Workbox for service worker management
  - Web App Manifest for installability (name, icons, theme)
  - `useOnlineStatus` hook for network detection
  - `OfflineIndicator` component for user feedback
  - Runtime caching strategies (NetworkFirst for API, CacheFirst for assets)
  - Auto-update service worker registration
  - PWA icons (192x192, 512x512) with SecPal branding
  - Comprehensive test coverage for online/offline detection

- **Legacy UI kit integration**: All 27 components
  - Components: Alert, Avatar, Badge, Button, Checkbox, Combobox, Dialog, Dropdown, Input, Select, Table, etc.
  - Dependencies: legacy menu primitives, `motion`, `clsx`
  - Documentation reference in README
  - SPDX license headers for REUSE compliance

### Changed

- **Authentication Migration to httpOnly Cookies** (#210, Part of Epic #208) - **XSS Protection Enhancement**
  - Migrated from localStorage-based token storage to httpOnly cookies for XSS protection
  - Removed client-side token handling from `AuthContext` and `useAuth` hook
  - Updated `authApi.ts` to use `credentials: "include"` for cookie-based authentication
  - Removed `token` parameter from `logout()` and `logoutAll()` API functions
  - Updated `LoginResponse` interface - removed `token` field (authentication now handled via cookies)
  - Deprecated token-related methods in `storage.ts` (marked for future removal)
  - Updated all authentication tests to reflect new API (Header, Login, ProtectedRoute, useAuth)
  - **Security Improvement**: Eliminates XSS attack vector by preventing JavaScript access to authentication tokens
  - Backend dependencies: Laravel Sanctum SPA mode (#209), CSRF protection (#210)
  - Part of Authentication Security Epic #208

- **Preflight Script Performance**: Optimized `scripts/preflight.sh` for significantly faster local development
  - Prettier/markdownlint: Check only changed files in branch instead of all files (10-100x faster for small changes)
  - npm/pnpm/yarn: Skip dependency installation if lockfile unchanged and node_modules exists (saves minutes per push)
  - npm audit: Only run after fresh install, skip when dependencies unchanged (saves 5-10s network call)
  - git fetch: Cache for 5 minutes with 30s timeout to prevent hanging on slow networks
  - Expected improvement: 60s → 10s for small fixes, 90s → 25s for features without dependency changes

### Fixed

- **CI/CD**: Codecov upload now fully functional for Dependabot PRs
  - Added `continue-on-error` for dependabot/renovate bots to prevent blocking
  - Made `CODECOV_TOKEN` optional (tokenless uploads work for public repos)
  - Upload step succeeds even without token access (Dependabot security restriction)
  - Normal PRs still fail CI on codecov errors (security preserved)
  - Fixes issue where Codecov checks remained pending/missing on Dependabot PRs
- **Blank Page Issue**: Fixed blank page caused by incompatible module format in translation catalogs
  - Changed Lingui compilation from CommonJS (`module.exports`) to ES modules (`export`)
  - Updated `package.json` scripts to use `--namespace es` flag for `lingui compile`
  - Changed imports in `i18n.ts` from `.js` to `.mjs` extension
  - Added TypeScript declaration file for `.mjs` message catalogs
  - Added safety checks for `localStorage` and `navigator` access in `detectLocale()`
  - Issue occurred because Vite requires ES modules, but Lingui compiled to CommonJS by default
- Pre-push hook no longer fails with exit code 1 when [Unreleased] is the last CHANGELOG section
- Project automation now triggers on label changes for issues AND pull requests (labeled event)

### Added (Previous)

- Initial repository setup
- React + TypeScript + Vite configuration
- Testing setup with Vitest and React Testing Library
- REUSE 3.3 compliance
- Pre-commit and pre-push quality gates

[unreleased]: https://github.com/SecPal/frontend/commits/main
