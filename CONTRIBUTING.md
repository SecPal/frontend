<!--
SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Contributing to SecPal Frontend

Read the [Code of Conduct](CODE_OF_CONDUCT.md),
[SecPal contribution guide](https://github.com/SecPal/.github/blob/main/CONTRIBUTING.md)
and [frontend repository instructions](AGENTS.md). Use GitHub issues and pull requests
for coordination. [WorkGraph contract](https://github.com/SecPal/.github/blob/main/docs/work-graph-contract.md)

## Local development

Use **Node.js** `^26.10.0` and npm 10 or newer. Follow the
[quick start](README.md#quick-start) for a standalone clone and
[workspace setup](https://github.com/SecPal/.github/blob/main/WORKSPACE_SETUP.md)
for issue-bound assignments.

In a standalone clone, install pre-commit and set up the repository hooks.
Run preflight before pushing:

```bash
./scripts/setup-pre-commit.sh
./scripts/setup-pre-push.sh
./scripts/preflight.sh
```

If a hook behaves unexpectedly in a standalone clone, run
[`./scripts/diagnose-hooks.sh`](scripts/diagnose-hooks.sh). In a linked worktree,
use `git rev-parse --git-path hooks` and check `core.hooksPath` for the active
hook directory. The [preflight script](scripts/preflight.sh) and
[pre-commit configuration](.pre-commit-config.yaml) define the local checks.
The [conflict-marker workflow](.github/workflows/check-conflict-markers.yml)
runs the shared GitHub check.

## Validation

Run focused tests appropriate to the change. `npm test -- <path>` runs Vitest
with the native Vite configuration loader. If invoking Vitest directly, use
`npx vitest --configLoader=native run <path>`. Preflight skips tests by default.
Run them directly or set `PREFLIGHT_RUN_TESTS=1` for preflight when required.

Use the [app surfaces guide](docs/app-surfaces.md#playwright-surface-selection)
to choose a browser or native-facing test target. See
[API development and tests](https://github.com/SecPal/api/blob/main/DEVELOPMENT.md#test-database)
for backend validation. Use the evidence required by the
[frontend validation rules](AGENTS.md#required-validation), including failing-first
evidence for behavior changes. The
[evidence architecture contract](https://github.com/SecPal/.github/blob/main/docs/evidence-architecture-contract.md)
applies to external-system validation. See [Web Vitals and local telemetry](docs/web-vitals-monitoring.md) for browser metrics and Lighthouse CI.

## Pull requests

Keep one reviewable topic per pull request and open it as a draft during
preparation. Mark it ready after self-review and the relevant checks. Use a
closing reference for an issue the pull request completes. Update the
[changelog](CHANGELOG.md) as required by the repository instructions.
[PR-size reporting](.github/workflows/pr-size.yml) is advisory.

Use the existing SSH signing identity. Run `git verify-commit HEAD` locally and
verify every pull-request commit on GitHub. Follow the
[quality workflow](.github/workflows/quality.yml) and protected review and merge
requirements.

Preserve file-level SPDX licensing and the [REUSE metadata](REUSE.toml),
including deliberately different and third-party licenses. Contributions to
SecPal are licensed under [AGPL-3.0-or-later](LICENSE).
