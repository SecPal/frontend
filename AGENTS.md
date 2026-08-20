<!--
SPDX-FileCopyrightText: 2026 SecPal Contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# SecPal/frontend Agent Instructions

This file is the authoritative, provider-neutral runtime baseline for this repository.
Edit this file first. Keep the focused overlay files below aligned when a rule
also needs path-specific or stack-specific enforcement.

## Focused Overlays

- `.github/instructions/org-shared.instructions.md`
- `.github/instructions/react-typescript.instructions.md`
- `.github/instructions/github-workflows.instructions.md`

## Core Runtime Baseline

These instructions are self-contained for the `frontend` repository at runtime.
Do not assume instructions from sibling repositories or comment-based inheritance are loaded.

## Canonical Work-Graph Delegation

`SecPal/.github/docs/work-graph-contract.md` is the single authoritative
definition of generic SecPal work-graph and engineering-governance semantics.
Apply it for node roles, decomposition, native edges, `READY`/`NEXT`, delivery,
replanning, review-finding classification, and proportional evidence. This
repository defines only frontend-specific technical and validation constraints.

- GitHub-native issue data, parent/sub-issue relationships, dependencies,
  sibling order, and open/closed state are authoritative. Body relationship/status
  mirrors are not authoritative and must be retired when native truth
  exists.
- One leaf owns one delivery contract and one primary implementation pull
  request. Decompose or replan when work contains multiple independently
  reviewable contracts; pull-request count, diff size, and elapsed time do not
  determine whether an epic is required.
- Classify review findings before acting. An in-contract defect stays in the
  current leaf. A missing prerequisite changes the native graph. A new
  outside-contract node is created only when the responsibility is proven,
  material, actionable, non-duplicate, and still relevant; cosmetic,
  speculative, redundant, or immaterial observations do not automatically
  become issues.
- Review is finite: perform one bounded full review, remediate named in-contract
  blockers, verify only the resulting delta, and stop when the contract and
  evidence are satisfied. A later independent responsibility changes the graph
  instead of expanding the current pull request.
- Use the smallest non-redundant evidence set. Observable behavior changes need
  failing-first contract or behavior evidence. Distinct integration seams need
  integration evidence where appropriate. Behavior-preserving work may use
  existing behavior tests, characterization, structural, source-shape, or
  security evidence without manufacturing a new failing test.

## Always-On Rules

- Run `git status --short --branch` before any write action. For new work,
  start from a clean, up-to-date local `main`: switch to `main`, pull with
  fast-forward only, verify a clean state, then create the dedicated topic
  branch. When continuing existing work in a dirty worktree, first identify the
  existing changes, keep the current topic scope, and never overwrite changes
  you did not make.
- Quality first. Do not trade correctness, review depth, validation depth, or issue tracking for speed.
- Keep one delivery contract per change, pull request, and branch. Do not mix unrelated fixes,
  features, refactors, docs, or governance cleanup.
- Never use bypasses such as `--no-verify` or force-push.
- Update `CHANGELOG.md` in the same change set for real fixes, features, and breaking changes.
- Keep GitHub-facing communication in English and reference files and lines instead of pasting large code blocks.
- Classify warnings, audit findings, and deprecations under the canonical
  materiality and replanning rules. Do not leave a required acceptance-criteria
  gap or real prerequisite untracked.
- Never reply to AI review comments with GitHub comment tools. Fix the code, push,
  and resolve threads through the approved non-comment workflow.
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

- Use `AGPL-3.0-or-later` for SecPal-owned agent-governance material,
  application code, and tests wherever it is declared by `REUSE.toml` or
  file-level SPDX metadata.
- Preserve deliberately different licenses, including `CC0-1.0`, `MIT`,
  `Apache-2.0`, third-party and generated-file licenses, and unrelated custom
  license references. Do not rewrite third-party copyright or license metadata.
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
- YAGNI: implement only what the current issue or acceptance criteria require;
  classify future ideas under the canonical materiality rule instead of building
  them now.
- SOLID: keep responsibilities narrow, interfaces small, and extension points explicit.
- Fail fast: validate early, stop on the first failed check, and do not accumulate known breakage.

## Issue And PR Discipline

- Verify that the selected leaf is `READY` from native graph state before
  implementation. Use native parent/sub-issue relationships for containment,
  native dependencies only for real blockers, and native sibling order only for
  preference.
- A primary implementation pull request closes exactly one leaf and never an
  epic. If the leaf contains multiple independent contracts, promote or replan
  it before implementation continues.
- The first PR state must be draft. Do not open a normal PR first.
- Mark a draft PR ready after its contract, bounded review, and proportional
  evidence are complete.
- When creating or editing PRs programmatically, write multi-line body content to a file and use
  `--body-file` to prevent shell escaping issues.

## Required Validation

Before any commit, PR, or merge, announce the checklist you are executing and stop on the first failed item.
At minimum verify:

- the active branch and PR scope still address exactly one topic
- the evidence class fits the contract: failing-first behavior evidence for
  observable changes, integration evidence for distinct seams, or stated
  structural/characterization evidence for behavior-preserving work
- the smallest relevant validation for the touched area passed: tests, typecheck, and lint when applicable
- findings were classified and any required prerequisite or material
  outside-contract responsibility was reflected in the native graph
- `CHANGELOG.md` was updated for real changes
- commits are GPG-signed
- REUSE compliance was checked when changed files require it
- when a fix alters observable behavior, state lifecycle, error handling, or security constraints,
  the corresponding tests were identified and updated in the same commit
- before pushing changes that alter observable behavior, state lifecycle, error handling, or security constraints,
  affected tests were run locally (`PREFLIGHT_RUN_TESTS=1 git push` or invoke the test runner directly)
- one bounded full review and any delta-only verification were completed,
  including DRY, KISS, YAGNI, SOLID, quality-first, and graph-scope checks
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

- Stack: Node 22, React, TypeScript strict mode, Vite, Vitest, and React Testing Library.
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

## Additional Rules: org-shared.instructions.md

This file auto-applies to all files in this repo so strict SecPal governance stays always present at runtime.

- `AGENTS.md` is the authoritative runtime baseline for this repo.
  `.github/copilot-instructions.md` is only a compatibility mirror.
- Apply the canonical work-graph contract for decomposition, findings, finite
  review, and proportional evidence. Keep one delivery contract per leaf and
  one primary implementation pull request; never use pull-request count as the
  epic threshold.
- Design discipline is always-on: DRY, KISS, YAGNI, SOLID, and fail fast.
- GitHub communication stays in English and uses file and line references instead of large verbatim code quotes.
- Do not add AI self-references, generated-by text, tool promotion, or AI
  attribution unless the task explicitly requires documenting AI tooling.
- Keep changes repo-local, minimal, and consistent with React, strict TypeScript, and generated API type conventions.
- Apply the SecPal domain policy and canonical finding-classification rules from
  the repo baseline.
- Apply the baseline licensing and REUSE rules: plain `AGPL-3.0-or-later` for
  SecPal-owned material where declared. Preserve deliberately different
  licenses and third-party metadata, use `SecPal Contributors` where the
  project convention applies, retain and extend first-publication years when
  required, and run relevant license validation after metadata changes.
- Preserve `Powered by SecPal – A guard's best friend` on official user-facing
  SecPal surfaces where intentionally present. Licensing work must not weaken
  or make this branding optional, add `Based on SecPal` guidance, or introduce
  white-label or fork-branding configuration.

## Additional Rules: react-typescript.instructions.md

- Keep components presentational where possible and move reusable logic into hooks or API clients.
- Use functional components, named exports, and explicit props interfaces.
- Preserve strict TypeScript and generated API types from `@/types/api`.
- Test user-visible behavior with Testing Library. Prefer MSW for API boundaries.
- Run the smallest relevant validation for each change: tests, typecheck, and lint.
- Maintain accessibility, semantic markup, and responsive behavior.
- Default boolean security flags (e.g. `emailVerified`) to `false` in sanitization layers; never leave them
  `undefined` on authenticated state.
- Do not persist auth state or other sensitive user-derived data via direct
  cleartext `localStorage`/`sessionStorage` writes. Use the approved storage
  abstraction in runtime code, and in tests seed authenticated state through
  `authStorage.setUser()` or a real current-format encrypted envelope.
- Scope `role="status"` and `aria-live` to the exact dynamic content region, not to wider containers that
  also hold headings or interactive controls.
- For AI-suggested async fixes, prove ordering with tests; when cleanup must happen after an awaited call settles,
  prefer `try/finally` over early local-state clearing.
- Keep plain-text-only HTML contexts such as `<option>` children free of wrapper components; use translated strings,
  not `<Trans>` or other element-producing helpers.
- Keep load, action, and destructive-flow error state separate when they drive different UI branches.
- Because the SecPal project is still under `1.x`, do not preserve obsolete
  compatibility shims by default. If a legacy storage format, input alias, or
  deprecated frontend contract has no proven live caller, prefer removing it
  and updating tests and changelog coverage in the same change.

## Additional Rules: github-workflows.instructions.md

- Always set `timeout-minutes` on every job.
- Set explicit `permissions` on every workflow and start with the least privilege needed.
- Pin every `uses:` reference, including GitHub-maintained actions and organization reusable workflows,
  to a full 40-character commit SHA. Preserve the reviewed version or branch in a nearby comment for
  update visibility.
- Use reusable workflows from the organization templates when they fit the task.
- Use `continue-on-error: true` only for intentional polling or wait steps, never for build or test steps.
- Reference secrets via `${{ secrets.NAME }}` and vars via `${{ vars.NAME }}`. Never hardcode or echo secrets.
- Run `yamllint` on workflow changes before finalizing.
