#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2025 SecPal Contributors
# SPDX-License-Identifier: MIT

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

# Auto-detect default branch (fallback to main)
BASE="$(git remote show origin 2>/dev/null | sed -n '/HEAD branch/s/.*: //p')"
[ -z "${BASE:-}" ] && BASE="main"

echo "Using base branch: $BASE"

# Fetch base branch for PR size check (failure is handled later)
git fetch origin "$BASE" 2>/dev/null || true

# 0) Formatting & Compliance
FORMAT_EXIT=0
if command -v npx >/dev/null 2>&1; then
  npx --yes prettier --check '**/*.{md,yml,yaml,json,ts,tsx,js,jsx}' || FORMAT_EXIT=1
  npx --yes markdownlint-cli2 '**/*.md' || FORMAT_EXIT=1
fi
# Workflow linting (part of documented gates)
if [ -d .github/workflows ]; then
  if command -v actionlint >/dev/null 2>&1; then
    actionlint || FORMAT_EXIT=1
  else
    echo "Warning: .github/workflows found but actionlint not installed - skipping workflow lint" >&2
  fi
fi
if command -v reuse >/dev/null 2>&1; then
  reuse lint || FORMAT_EXIT=1
fi
if [ "$FORMAT_EXIT" -ne 0 ]; then
  echo "Formatting/compliance checks failed. Fix issues above." >&2
  exit 1
fi

# 1) Node.js / React / TypeScript
if [ -f pnpm-lock.yaml ] && command -v pnpm >/dev/null 2>&1; then
  pnpm install --frozen-lockfile
  pnpm run --if-present lint
  pnpm run --if-present typecheck
  pnpm run --if-present test
elif [ -f package-lock.json ] && command -v npm >/dev/null 2>&1; then
  npm ci
  npm audit --audit-level=high || {
    echo "High or critical severity vulnerabilities detected by npm audit. Please address the issues above before continuing." >&2
    exit 1
  }
  npm run --if-present lint
  npm run --if-present typecheck
  npm run --if-present test
elif [ -f yarn.lock ] && command -v yarn >/dev/null 2>&1; then
  yarn install --frozen-lockfile
  if command -v jq >/dev/null 2>&1; then
    jq -e '.scripts.lint' package.json >/dev/null 2>&1 && yarn lint
    jq -e '.scripts.typecheck' package.json >/dev/null 2>&1 && yarn typecheck
    jq -e '.scripts.test' package.json >/dev/null 2>&1 && yarn test
  elif command -v node >/dev/null 2>&1; then
    node -e "process.exit(require('./package.json').scripts?.lint ? 0 : 1)" && yarn lint
    node -e "process.exit(require('./package.json').scripts?.typecheck ? 0 : 1)" && yarn typecheck
    node -e "process.exit(require('./package.json').scripts?.test ? 0 : 1)" && yarn test
  else
    echo "Warning: jq and node not found - attempting to run yarn scripts (failures will be ignored)" >&2
    yarn lint 2>/dev/null || true
    yarn typecheck 2>/dev/null || true
    yarn test 2>/dev/null || true
  fi
fi

# 2) Check PR size locally (against BASE)
if ! git rev-parse -q --verify "origin/$BASE" >/dev/null 2>&1; then
  echo "Warning: Cannot verify base branch origin/$BASE - skipping PR size check." >&2
  echo "Tip: Run 'git fetch origin $BASE' to enable PR size checking." >&2
else
  MERGE_BASE=$(git merge-base "origin/$BASE" HEAD 2>/dev/null)
  if [ -z "$MERGE_BASE" ]; then
    echo "Warning: Cannot determine merge base with origin/$BASE. Skipping PR size check." >&2
  else
    # Use --numstat for locale-independent parsing (sum insertions + deletions)
    CHANGED=$(git diff --numstat "$MERGE_BASE"..HEAD 2>/dev/null | awk '{ins+=$1; del+=$2} END {print ins+del+0}')
    [ -z "$CHANGED" ] && CHANGED=0
    if [ "$CHANGED" -gt 600 ]; then
      echo "PR too large ($CHANGED > 600 lines). Please split into smaller slices." >&2
      exit 2
    fi
    echo "Preflight OK · Changed lines: $CHANGED"
  fi
fi

# All checks passed
exit 0
