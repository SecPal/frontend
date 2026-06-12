## Codebase Patterns
- Route guards should treat `isLoading && user === null` as blocking auth bootstrap; when `isLoading` has a user snapshot, authenticated app routes keep shell chrome mounted and show `RouteContentFallback` instead of a full-screen guard loader.
- Layout components own route-level `Suspense` boundaries so authenticated lazy routes keep shell chrome mounted and render `RouteContentFallback` only in the content region.
- Shared `src/ui` primitives avoid built-in English fallback copy; page-owned code passes localized labels such as `loadingLabel`.
- Non-blocking refreshes should keep rendered data visible and mark the wrapper busy with `LoadingRegion` instead of replacing content with a full loader.

## US-001: Create Shared Skeleton and Loading Standards
- Implemented shared `Skeleton`, `PageSkeleton`, `SectionSkeleton`, `TableSkeleton`, `FormSkeleton`, and `LoadingRegion` primitives in `src/ui`.
- Documented the loading contract in `src/ui/MIGRATION.md`, including skeleton, spinner, blocking, and non-blocking refresh guidance.
- Added Vitest coverage for decorative skeletons, page/section/table/form placeholders, and non-blocking loading accessibility behavior.
- Files changed: `src/ui/primitives.tsx`, `src/ui/ui.test.tsx`, `src/ui/MIGRATION.md`, `.context/progress.md`.
- **Learnings for future iterations:**
  - Patterns discovered: `src/ui` is the migration target for shadcn/Radix-aligned primitives and exports through `src/ui/index.ts`.
  - Gotchas encountered: `role="status"` should receive an explicit `aria-label` when tests or users need a stable accessible name; hidden status text alone did not produce the queried name in Testing Library.

## US-002: Keep the App Shell Visible During App Boot and Route Changes
- Activated the default English catalog synchronously and removed the blocking locale boot `Loading...` state from `AppWithI18n`.
- Replaced the global route loader spinner with a shell-shaped skeleton fallback, and added localized content-region route fallbacks through `ApplicationLayout` and `OnboardingLayout`.
- Kept authenticated shell chrome visible during persisted-session startup revalidation when a user snapshot exists.
- Added coverage for authenticated startup shell persistence, authenticated lazy route transitions, the shell-equivalent global loader, and the non-blocking locale boot path.
- Files changed: `src/main.tsx`, `src/App.tsx`, `src/i18n.ts`, `src/components/application-layout.tsx`, `src/components/onboarding-layout.tsx`, `src/components/RouteLoader.tsx`, `src/components/RouteContentFallback.tsx`, `src/app-shell-loading.test.tsx`, `src/main.test.tsx`, `src/components/RouteLoader.test.tsx`, `src/locales/messages.d.ts`, locale catalogs, `.context/progress.md`.
- **Learnings for future iterations:**
  - Patterns discovered: authenticated route chunk loading should be handled inside the active layout rather than by the app-wide `Suspense` fallback.
  - Gotchas encountered: React Router may retain the previous route content during a transition instead of showing a Suspense fallback, so tests should verify shell persistence and absence of global loaders rather than requiring the fallback to flash.

## US-003: Deduplicate Auth and Route Guard Loading States
- Consolidated route guard bootstrap checks through `routeGuardAuth`, replaced the guard-specific `Loading...` screen with the shared shell skeleton, and kept feature routes on the app shell/content fallback during authenticated snapshot revalidation.
- Updated `ProtectedRoute`, `FeatureRoute`, `PermissionRoute`, `OrganizationalRoute`, `LoginRoute`, and app-shell guard tests to assert the shared bootstrap loader and no full-screen handoff when a session snapshot exists.
- Files changed: `src/App.tsx`, `src/components/routeGuardAuth.ts`, `src/components/RouteGuardState.tsx`, route guard components and tests, `src/app-shell-loading.test.tsx`, locale catalogs, `.context/progress.md`.
- **Learnings for future iterations:**
  - Patterns discovered: app-level guard wrappers should branch on snapshot revalidation before invoking feature guards so feature routes do not briefly render the global auth loader.
  - Gotchas encountered: auth storage and offline vault tests can race through shared IndexedDB state in parallel runs; route-guard tests should mock the vault boundary when they only need to verify guard state transitions.
