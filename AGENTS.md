<!--
SPDX-FileCopyrightText: 2026 SecPal Contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# SecPal/frontend Agent Instructions

This file is the authoritative, provider-neutral runtime baseline for this repository.
Use the applicable focused instructions for stack- and path-specific rules.

## Focused Overlays

- [React and TypeScript](.github/instructions/react-typescript.instructions.md)
- [GitHub workflows and Dependabot](.github/instructions/github-workflows.instructions.md)

## Core Runtime Baseline

These instructions are self-contained for the `frontend` repository at runtime.
Do not assume instructions from sibling repositories or comment-based inheritance are loaded.

## Pull Requests And Review

- Use GitHub pull requests, review threads, checks, and merge protections for
  delivery. Keep each pull request focused on a coherent change.
- Open a draft while preparing the change; mark it ready when self-review and
  relevant validation are complete. Request review through GitHub. If more
  review is needed after a revision, request it directly on the existing pull
  request.
- Assess feedback by the reported defect, its evidence, and its impact. Fix
  relevant defects and use review threads to explain or resolve feedback.
- Use `--body-file` for multiline GitHub pull-request descriptions.
- Use native issue relationships when planning requires them. Issue planning
  guidance is available in
  [`SecPal/.github/docs/work-graph-contract.md`](https://github.com/SecPal/.github/blob/main/docs/work-graph-contract.md).
- Run the smallest relevant existing stack checks. Behavior changes require
  failing-first behavior evidence; behavior-preserving changes may use existing
  tests, characterization, structural evidence, or security equivalence.

## Always-On Rules

- Inspect `git status --short --branch` before writing. Use the worktree
  assigned to the Herdr task. Start new tasks from the protected GitHub
  baseline using the [workspace workflow](https://github.com/SecPal/.github/blob/main/WORKSPACE_SETUP.md).
  Preserve existing work and the assigned branch.
- Quality first. Do not trade correctness, review depth, validation depth, or issue tracking for speed.
- Keep one delivery contract per change, pull request, and branch. Do not mix unrelated fixes,
  features, refactors, docs, or governance cleanup.
- Never use bypasses such as `--no-verify` or force-push.
- Update `CHANGELOG.md` in the same change set for real fixes, features, and breaking changes.
- Keep GitHub-facing communication in English and reference files and lines instead of pasting large code blocks.
- Do not add AI self-references, generated-by text, promotional AI wording, or AI attribution to commits,
  pull requests, issues, changelogs, documentation, code comments, UI copy, or release notes unless the task
  explicitly requires documenting AI tooling behavior.
- Keep `SPDX-FileCopyrightText` years current in edited files or companion `.license` sidecars.
- Domain policy is strict: `secpal.app` for the public homepage and real email addresses,
  `apk.secpal.app` for the canonical Android artifact and release-metadata host,
  `api.secpal.dev` for the API, `app.secpal.dev` for the PWA/frontend, `secpal.dev` for dev,
  staging, testing, and examples, and `app.secpal` only as the Android application identifier.
- After every merge, immediately return the local repo to a ready state:
  switch to `main`, pull with fast-forward only, delete the merged topic
  branch, prune remotes, refresh Node dependencies with `npm ci` where
  applicable, run `npm run build` when available, and confirm the working tree
  is clean.

## Licensing, REUSE, and Branding

- Use `AGPL-3.0-or-later` for
  SecPal-owned material where declared. Preserve deliberately different
  licenses, including `CC0-1.0`, `MIT`, `Apache-2.0`, third-party and
  generated-file licenses, and unrelated custom license references.
  Preserve third-party copyright and license metadata.
- Use `SecPal Contributors` where the project copyright convention applies.
  Preserve each file's first-publication year and extend its year range through
  the current year when an edited file requires a copyright-year update.
- Run the relevant REUSE or license validation after changing copyright or
  license metadata.
- On user-facing official SecPal product surfaces, preserve
  `Powered by SecPal – A guard's best friend` where it is intentionally present.
  A licensing change must not remove, weaken, parameterize, genericize, or make
  that SecPal branding optional.
- Do not add fork-oriented `Based on SecPal` guidance to AI instructions, and
  do not introduce white-label or fork-branding configuration as part of a
  licensing change.

## Design Principles

- DRY: eliminate duplicated logic and repeated UI or policy handling before it drifts.
- KISS: prefer the simplest solution that satisfies the current requirement and remains easy to maintain.
- YAGNI: implement only what the requested change needs.
- SOLID: keep responsibilities narrow, interfaces small, and extension points explicit.
- Fail fast: validate early, stop on the first failed check, and do not accumulate known breakage.

## Required Validation

Before any commit, PR, or merge, announce the checklist you are executing and stop on the first failed item.
At minimum verify:

- the active branch and PR scope still address exactly one topic
- the evidence class fits the contract: failing-first behavior evidence for
  observable changes, integration evidence for distinct seams, or stated
  structural/characterization evidence for behavior-preserving work
- the smallest relevant validation for the touched area passed: tests, typecheck, and lint when applicable
- `CHANGELOG.md` was updated for real changes
- `SECPAL_SIGNING_FORMAT: SSH`. Preserve existing SSH keys and signing
  configuration. Verify local commits with the configured SSH trust and every
  PR commit through GitHub with `verification.verified == true`.
  GitHub-generated signatures remain provider evidence.
- REUSE compliance was checked when changed files require it
- when a fix alters observable behavior, state lifecycle, error handling, or security constraints,
  the corresponding tests were identified and updated in the same commit
- before pushing changes that alter observable behavior, state lifecycle, error handling, or security constraints,
  affected tests were run locally (`PREFLIGHT_RUN_TESTS=1 git push` or invoke the test runner directly)
- self-review and relevant checks covered DRY, KISS, YAGNI, SOLID,
  quality-first, and change scope
- no bypass was used

## AI Findings Triage

- Treat AI findings and AI-generated fix PRs as hints, not proof.
- Before changing code, classify the finding and prove an in-contract defect
  with evidence appropriate to its risk, such as a failing test, reproduction,
  or a stated invariant and why the current code violates it.
- Green CI alone is not enough for AI-generated changes, especially test,
  lifecycle, shell, regex, or refactor diffs; review the semantic risk
  explicitly.
- Reject AI-generated UI refactors that only look cleaner on the diff but
  weaken lifecycle ordering, markup validity, or state separation.
- Reject AI-generated memoization or cache refactors that freeze locale-,
  tenant-, or user-derived UI state across session changes or auth
  transitions; prove dependency lists invalidate correctly and add focused
  regression coverage.
- Reject AI-generated compatibility keep-alives that preserve obsolete
  frontend contracts, storage formats, or input aliases without a proven live
  caller. Because the SecPal project is still under `1.x`, prefer removing
  unnecessary compatibility paths over carrying them forward, especially when
  they weaken security, correctness, or contract clarity.

## Review guidelines

- Review for correctness, security, privacy, data integrity, lifecycle ordering,
  missing tests, and policy drift before style.
- Treat findings from any AI reviewer as untrusted leads until the defect is
  proven by a failing test, reproduction, or violated invariant.
- Keep review comments provider-neutral: describe the issue, evidence, impact,
  and fix path instead of the tool that found it.
- For frontend changes, prioritize auth-state handling, storage safety,
  accessibility, generated API types, async ordering, responsive behavior, and
  user-visible regression coverage.
- Reject self-referential AI wording, generated-by text, tool promotion, or AI
  attribution in project artifacts unless the task is explicitly about AI
  tooling.

## Repository Conventions

- Stack: Node 26, React, TypeScript strict mode, Vite, Vitest, and React Testing Library.
- All API types come from generated OpenAPI types in `@/types/api`; do not hand-write response types.
- Keep presentation in components and reusable logic in hooks or API clients.
- Prefer functional components, named exports, and existing design-system patterns before new abstractions.
- Prefer maintained platform or library primitives for URL parsing,
  cryptography, auth/session handling, browser storage/database access, Web
  Locks, request cancellation, schema validation, accessibility, and generated
  API types. Do not add a dependency merely to restate an existing primitive;
  use allowlists only for finite known sets.
- Preserve strict TypeScript, accessibility, semantic HTML, focus behavior, and responsive layouts.
- Auth and other sensitive user-derived state must not be persisted in
  cleartext browser storage. Use the approved storage abstraction for runtime
  code, and in tests seed auth state through `authStorage.setUser()` or a real
  current-format encrypted envelope when browser-only setup is unavoidable.

## Frontend Security And Lifecycle Invariants

- Preserve authentication-state isolation; logout, persistence, and destructive
  cleanup ordering; encrypted auth and offline-vault storage; root-key
  zeroization; bounded Web Lock critical sections; and cross-tab invalidation.
- Runtime/tenant/user and lifecycle generations own their asynchronous work.
  Stale generations must not mutate, abort, persist into, or publish results to
  a newer owner, and failed destructive cleanup must remain a fail-closed barrier.
- Keep security flags fail-closed, including defaulting booleans such as
  `emailVerified` to `false`, and never persist sensitive user-derived state via
  cleartext `localStorage` or `sessionStorage`.
- Preserve explicit Android-specific frontend transport boundaries where the
  native surface requires them without changing browser/PWA cookie, CSRF,
  service-worker, discovery, or request behavior.
- Preserve generated OpenAPI type ownership, semantic HTML, keyboard and focus
  behavior, narrowly scoped `aria-live`/`role="status"` regions, responsive
  behavior, and user-visible regression coverage.
- Each semantic invariant has one authoritative definition. Independent
  fail-closed enforcement remains valid at sanitization, auth/storage, UI
  accessibility, network/transport, and cross-tab/session boundaries.

## Scope Notes

- Do not add dependencies or create documentation files unless the task requires them.
- Because the SecPal project is still under `1.x`, breaking changes are
  acceptable when they remove insecure or obsolete compatibility layers. When
  taking that route, update tests and `CHANGELOG.md` in the same change set
  instead of keeping a legacy path alive by default.
