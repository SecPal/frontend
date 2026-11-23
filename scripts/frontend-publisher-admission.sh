#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
# Invoked from the preceding protected tree, with the complete next tree present.
set -euo pipefail
before=$1
head=$2
git diff --name-only --no-renames -z "$before" "$head" -- > "$RUNNER_TEMP/publication-paths"
mapfile -d '' -t paths < "$RUNNER_TEMP/publication-paths"
if (( ${#paths[@]} == 0 )); then
  echo '::error::No changed paths available for publication admission.'
  exit 1
fi

# A change to publishing authority needs protected source adoption first.
for file in "${paths[@]}"; do
  case "$file" in
    .github/workflows/publish-container.yml|.github/workflows/frontend-container.yml|\
    .github/workflows/reusable-repository-security.yml|\
    scripts/frontend-publisher-admission.sh|scripts/publish-container.sh|\
    scripts/container-publisher.py|scripts/scan-container-artifact.sh|\
    scripts/container-tools.sh|scripts/container-attestation-auth.py|\
    scripts/build-container.sh|scripts/container-smoke.sh|scripts/container-browser.sh)
      echo '::notice::Publisher authority changed. No release was requested.'
      exit 1 ;;
  esac
done

for file in "${paths[@]}"; do
  case "$file" in
    .github/workflows/released-artifact-security.yml|.github/workflows/daily-repository-security.yml|\
    tests/released-artifact-security-workflow.test.ts|tests/daily-repository-security-workflow.test.ts) ;;
    *) exit 0 ;;
  esac
done
echo '::notice::Source-only push. No release was requested.'
exit 1
