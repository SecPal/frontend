#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

set -euo pipefail

echo "Checking for AGPL-3.0-or-later compatibility..."
reuse spdx -o reuse.spdx

license_expressions=$(grep "^LicenseInfoInFile:" reuse.spdx | cut -d':' -f2- | sort -u)
echo "Found license expressions:"
printf '%s\n' "$license_expressions"

compatible_licenses=(
  "AGPL-3.0-or-later"
  "GPL-3.0-or-later"
  "LGPL-3.0-or-later"
  "MIT"
  "BSD-2-Clause"
  "BSD-3-Clause"
  "Apache-2.0"
  "CC0-1.0"
  "ISC"
  "OFL-1.1"
  "ODbL-1.0"
  "LicenseRef-SecPal-Attribution"
)

incompatible_found=0
while IFS= read -r license_expression; do
  [ -z "$license_expression" ] && continue

  if [[ "$license_expression" == *"LicenseRef-SecPal-Attribution"* ]] &&
    [[ "$license_expression" != *"AGPL-3.0-or-later"* ]]; then
    echo "ERROR: LicenseRef-SecPal-Attribution must be paired with AGPL-3.0-or-later"
    incompatible_found=1
  fi

  normalized_expression=${license_expression//\(/( }
  normalized_expression=${normalized_expression//\)/ )}

  for license in $normalized_expression; do
    case "$license" in
      AND|OR|WITH|"("|")")
        continue
        ;;
    esac

    found=0
    for compatible in "${compatible_licenses[@]}"; do
      if [[ "$license" == "$compatible" ]]; then
        found=1
        break
      fi
    done

    if [ $found -eq 0 ]; then
      echo "ERROR: Incompatible license found: $license"
      incompatible_found=1
    fi
  done
done <<< "$license_expressions"

if [ $incompatible_found -eq 1 ]; then
  echo "ERROR: Found licenses incompatible with AGPL-3.0-or-later"
  exit 1
fi

echo "All licenses are compatible with AGPL-3.0-or-later ✓"
