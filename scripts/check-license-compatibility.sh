#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

set -euo pipefail

echo "Checking for AGPL-3.0-or-later compatibility..."
reuse spdx -o reuse.spdx

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

validate_license_subject() {
  local subject_name=$1
  local license_lines=$2
  local has_agpl=0
  local has_secpal_attribution=0
  local has_invalid_secpal_attribution_pairing=0

  [ -z "$subject_name" ] && return

  while IFS= read -r license_expression; do
    [ -z "$license_expression" ] && continue

    if [[ "$license_expression" == *"LicenseRef-SecPal-Attribution"* ]] &&
      [[ "$license_expression" == *" OR "* ]]; then
      has_invalid_secpal_attribution_pairing=1
    fi

    normalized_expression=${license_expression//\(/( }
    normalized_expression=${normalized_expression//\)/ )}

    for license in $normalized_expression; do
      case "$license" in
        AND|OR|WITH|"("|")")
          continue
          ;;
      esac

      if [[ "$license" == "AGPL-3.0-or-later" ]]; then
        has_agpl=1
      fi

      if [[ "$license" == "LicenseRef-SecPal-Attribution" ]]; then
        has_secpal_attribution=1
      fi

      found=0
      for compatible in "${compatible_licenses[@]}"; do
        if [[ "$license" == "$compatible" ]]; then
          found=1
          break
        fi
      done

      if [ $found -eq 0 ]; then
        echo "ERROR: Incompatible license found in ${subject_name}: $license"
        incompatible_found=1
      fi
    done
  done <<< "$license_lines"

  if [ $has_invalid_secpal_attribution_pairing -eq 1 ]; then
    echo "ERROR: LicenseRef-SecPal-Attribution must be conjoined with AGPL-3.0-or-later in ${subject_name}"
    incompatible_found=1
  fi

  if [ $has_secpal_attribution -eq 1 ] && [ $has_agpl -eq 0 ]; then
    echo "ERROR: LicenseRef-SecPal-Attribution must be paired with AGPL-3.0-or-later in ${subject_name}"
    incompatible_found=1
  fi
}

echo "Found file license entries:"
current_file=""
current_license_lines=""
while IFS= read -r line; do
  case "$line" in
    FileName:\ *)
      validate_license_subject "$current_file" "$current_license_lines"
      current_file=${line#FileName: }
      current_license_lines=""
      echo "$current_file"
      ;;
    LicenseInfoInFile:\ *)
      license_expression=${line#LicenseInfoInFile: }
      printf '  %s\n' "$license_expression"
      if [ -n "$current_license_lines" ]; then
        current_license_lines+=$'\n'
      fi
      current_license_lines+="$license_expression"
      ;;
  esac
done < reuse.spdx

validate_license_subject "$current_file" "$current_license_lines"

if [ -f package-lock.json ]; then
  echo "Found dependency license entries from package-lock.json:"
  while IFS=$'\t' read -r package_name license_expression; do
    [ -z "$package_name" ] && continue

    if [ -z "$license_expression" ]; then
      echo "ERROR: Missing license in package-lock.json package ${package_name}"
      incompatible_found=1
      continue
    fi

    echo "${package_name}"
    printf '  %s\n' "$license_expression"
    validate_license_subject "package-lock.json package ${package_name}" "$license_expression"
  done < <(
    python3 - <<'PY'
import json
from pathlib import Path

package_lock = Path("package-lock.json")
if not package_lock.exists():
    raise SystemExit(0)

packages = json.loads(package_lock.read_text(encoding="utf-8")).get("packages", {})
for package_name, metadata in packages.items():
    normalized_name = package_name or "."
    license_expression = metadata.get("license", "")
    print(f"{normalized_name}\t{license_expression}")
PY
  )
fi

if [ $incompatible_found -eq 1 ]; then
  echo "ERROR: Found licenses incompatible with AGPL-3.0-or-later"
  exit 1
fi

echo "All licenses are compatible with AGPL-3.0-or-later ✓"
