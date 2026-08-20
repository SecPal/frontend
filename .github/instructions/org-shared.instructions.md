---
# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
name: Frontend Runtime Overlay
description: Reinforces strict SecPal governance for all files in this repo.
applyTo: "**"
---

# Frontend Runtime Overlay

This file auto-applies to all files in this repo so strict SecPal governance stays always present at runtime.

- `AGENTS.md` is the authoritative runtime baseline for this repo.
  `.github/copilot-instructions.md` is only a compatibility mirror.
- `SecPal/.github/docs/work-graph-contract.md` owns generic work-graph,
  decomposition, finding-classification, finite-review, and evidence semantics.
  GitHub-native issue data is authoritative; body relationship mirrors are not
  authoritative.
- Keep one delivery contract per leaf and one primary implementation pull
  request. Replan multiple independent contracts without using pull-request
  count as the epic threshold.
- Design discipline is always-on: DRY, KISS, YAGNI, SOLID, and fail fast.
- GitHub communication stays in English and uses file and line references instead of large verbatim code quotes.
- Do not add AI self-references, generated-by text, tool promotion, or AI
  attribution unless the task explicitly requires documenting AI tooling.
- Keep changes repo-local, minimal, and consistent with React, strict TypeScript, and generated API type conventions.
- Apply the SecPal domain policy and canonical finding-classification rules from
  the repo baseline. Only proven, material, actionable, non-duplicate, still
  relevant outside-contract findings become new nodes automatically; required
  prerequisites always change the native graph.
- Use one bounded full review followed by named remediation and delta-only
  verification. Behavior-preserving work may use structural or characterization
  evidence; observable behavior changes need failing-first behavior evidence.
- Apply the baseline licensing and REUSE rules: plain `AGPL-3.0-or-later` for
  SecPal-owned material where declared. Preserve deliberately different
  licenses and third-party metadata, use `SecPal Contributors` where the
  project convention applies, retain and extend first-publication years when
  required, and run relevant license validation after metadata changes.
- Preserve `Powered by SecPal – A guard's best friend` on official user-facing
  SecPal surfaces where intentionally present. Licensing work must not weaken
  or make this branding optional, add `Based on SecPal` guidance, or introduce
  white-label or fork-branding configuration.
