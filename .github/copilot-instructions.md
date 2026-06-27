<!--
SPDX-FileCopyrightText: 2026 SecPal
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# SecPal/frontend Copilot Instructions

This file mirrors the authoritative root `AGENTS.md` for tooling
that automatically loads `.github/copilot-instructions.md`.
Edit `AGENTS.md` first. Keep the focused overlay files aligned
for path-specific or stack-specific rules.

## Authoritative Sources

- `AGENTS.md`
- `.github/instructions/org-shared.instructions.md`
- `.github/instructions/react-typescript.instructions.md`
- `.github/instructions/github-workflows.instructions.md`

## Core Runtime Baseline

These instructions are self-contained for the `frontend` repository at runtime.
Do not assume instructions from sibling repositories or comment-based inheritance are loaded.

## Always-On Rules

- Run `git status --short --branch` before any write action. For new work,
  start from a clean, up-to-date local `main`: switch to `main`, pull with
  fast-forward only, verify a clean state, then create the dedicated topic
  branch. When continuing existing work in a dirty worktree, first identify the
  existing changes, keep the current topic scope, and never overwrite changes
  you did not make.
- TDD is mandatory. Write or update the smallest relevant failing test FIRST, then implement, then refactor with tests green.
- Quality first. Do not trade correctness, review depth, validation depth, or issue tracking for speed.
- Keep one topic per change. 1 topic = 1 PR = 1 branch. Do not mix unrelated fixes,
  features, refactors, docs, or governance cleanup.
- Never use bypasses such as `--no-verify` or force-push.
- Update `CHANGELOG.md` in the same change set for real fixes, features, and breaking changes.
- Create a GitHub issue immediately for every real out-of-scope bug, technical debt, missing test,
  documentation gap, warning, audit finding, or deprecation you cannot fix now. Do not leave untracked
  `TODO`, `FIXME`, or follow-up work.
- Use EPIC plus sub-issues before implementation whenever work will span more than one PR; if in doubt,
  choose EPIC plus sub-issues.
- Keep GitHub-facing communication in English and reference files and lines instead of pasting large code blocks.
- Treat warnings, audit findings, and deprecations as actionable. Fix them in scope or track them immediately.
- Never reply to AI review comments with GitHub comment tools. Fix the code, push,
  and resolve threads through the approved non-comment workflow.
- Do not add AI self-references, generated-by text, promotional AI wording, or AI attribution to commits,
  pull requests, issues, changelogs, documentation, code comments, UI copy, or release notes unless the task
  explicitly requires documenting AI tooling behavior.
- Keep `SPDX-FileCopyrightText` years current in edited files or companion `.license` sidecars.
- Domain policy is strict: `secpal.app` for the public homepage and real email addresses,
  `changelog.secpal.app` for the public changelog site,
  `apk.secpal.app` for the canonical Android artifact and release-metadata host,
  `api.secpal.dev` for the API, `app.secpal.dev` for the PWA/frontend, `secpal.dev` for dev,
  staging, testing, and examples, and `app.secpal` only as the Android application identifier.
- After every merge, immediately return the local repo to a ready state:
  switch to `main`, pull with fast-forward only, delete the merged topic
  branch, prune remotes, refresh Node dependencies with `npm ci` where
  applicable, run `npm run build` when available, and confirm the working tree
  is clean.

## Design Principles

- DRY: eliminate duplicated logic and repeated UI or policy handling before it drifts.
- KISS: prefer the simplest solution that satisfies the current requirement and remains easy to maintain.
- YAGNI: implement only what the current issue or acceptance criteria require;
  track future ideas as issues instead of building them now.
- SOLID: keep responsibilities narrow, interfaces small, and extension points explicit.
- Fail fast: validate early, stop on the first failed check, and do not accumulate known breakage.

## Issue And PR Discipline

- Every real out-of-scope finding becomes a GitHub issue immediately; no untracked follow-up work is allowed.
- Complex work uses EPIC plus sub-issues before implementation. PRs should close
  sub-issues, not the epic, until the final linked step.
- When local review finds zero issues, commit and push the finished branch before opening any PR.
- The first PR state must be draft. Do not open a normal PR first.
- Mark a draft PR ready only after the final self-review in the PR view still finds zero issues.
- When creating or editing PRs programmatically, write multi-line body content to a file and use
  `--body-file` to prevent shell escaping issues.

## Required Validation

Before any commit, PR, or merge, announce the checklist you are executing and stop on the first failed item.
At minimum verify:

- the active branch and PR scope still address exactly one topic
- TDD happened: the relevant test failed first and now passes
- the smallest relevant validation for the touched area passed: tests, typecheck, and lint when applicable
- out-of-scope findings were turned into GitHub issues immediately
- `CHANGELOG.md` was updated for real changes
- commits are GPG-signed
- REUSE compliance was checked when changed files require it
- when a fix alters observable behavior, state lifecycle, error handling, or security constraints,
  the corresponding tests were identified and updated in the same commit
- before pushing changes that alter observable behavior, state lifecycle, error handling, or security constraints,
  affected tests were run locally (`PREFLIGHT_RUN_TESTS=1 git push` or invoke the test runner directly)
- the local 4-pass review was completed, including DRY, KISS, YAGNI, SOLID,
  quality-first, and issue-management checks
- no bypass was used

## AI Findings Triage

- Treat AI findings and AI-generated fix PRs as hints, not proof.
- Before merge, prove the defect with a failing test, a reproducible defect,
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
- Preserve strict TypeScript, accessibility, semantic HTML, focus behavior, and responsive layouts.
- Auth and other sensitive user-derived state must not be persisted in
  cleartext browser storage. Use the approved storage abstraction for runtime
  code, and in tests seed auth state through `authStorage.setUser()` or a real
  current-format encrypted envelope when browser-only setup is unavoidable.

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
- Non-negotiable: TDD first, quality first, 1 topic = 1 PR = 1 branch,
  immediate GitHub issue creation for every real out-of-scope finding, and no
  bypass.
- If work needs more than one PR, or probably will, create an EPIC with linked
  sub-issues before implementation.
- Design discipline is always-on: DRY, KISS, YAGNI, SOLID, and fail fast.
- GitHub communication stays in English and uses file and line references instead of large verbatim code quotes.
- Do not add AI self-references, generated-by text, tool promotion, or AI
  attribution unless the task explicitly requires documenting AI tooling.
- Keep changes repo-local, minimal, and consistent with React, strict TypeScript, and generated API type conventions.
- Apply the SecPal domain policy and immediate warning and issue triage rules from the repo baseline.

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
