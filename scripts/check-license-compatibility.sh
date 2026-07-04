#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

set -euo pipefail

echo "Checking for AGPL-3.0-or-later compatibility..."
reuse spdx -o reuse.spdx

compatible_licenses=(
  "0BSD"
  "AGPL-3.0-or-later"
  "GPL-3.0-or-later"
  "LGPL-3.0-or-later"
  "BSD"
  "MIT"
  "MIT-0"
  "BSD-2-Clause"
  "BSD-3-Clause"
  "Apache-2.0"
  "BlueOak-1.0.0"
  "CC-BY-4.0"
  "CC0-1.0"
  "ISC"
  "MPL-2.0"
  "OFL-1.1"
  "ODbL-1.0"
  "Python-2.0"
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
        echo "ERROR: Incompatible license found in ${subject_name}: $license" >&2
        incompatible_found=1
      fi
    done
  done <<< "$license_lines"

  if [ $has_invalid_secpal_attribution_pairing -eq 1 ]; then
    echo "ERROR: LicenseRef-SecPal-Attribution must be conjoined with AGPL-3.0-or-later in ${subject_name}" >&2
    incompatible_found=1
  fi

  if [ $has_secpal_attribution -eq 1 ] && [ $has_agpl -eq 0 ]; then
    echo "ERROR: LicenseRef-SecPal-Attribution must be paired with AGPL-3.0-or-later in ${subject_name}" >&2
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
  if ! dependency_license_entries=$(
    python3 - <<'PY'
import json
import sys
from pathlib import Path

package_lock = Path("package-lock.json")
if not package_lock.exists():
    raise SystemExit(0)

try:
    lockfile = json.loads(package_lock.read_text(encoding="utf-8"))
except (OSError, json.JSONDecodeError) as error:
    print(f"package-lock.json: {error}", file=sys.stderr)
    raise SystemExit(1)

if not isinstance(lockfile, dict):
    print("package-lock.json: expected a JSON object", file=sys.stderr)
    raise SystemExit(1)


def license_expression(metadata):
    if not isinstance(metadata, dict):
        return ""

    value = metadata.get("license", "")
    return value if isinstance(value, str) else ""


def emit_package(package_name, metadata):
    print(f"{package_name}\t{license_expression(metadata)}")


packages = lockfile.get("packages")
if packages is not None:
    if not isinstance(packages, dict):
        print("package-lock.json: packages must be a JSON object", file=sys.stderr)
        raise SystemExit(1)

    for package_name, metadata in packages.items():
        normalized_name = package_name or "."
        emit_package(normalized_name, metadata)
    raise SystemExit(0)


def emit_v1_dependencies(dependencies, parent_path="node_modules"):
    if not isinstance(dependencies, dict):
        print("package-lock.json: dependencies must be a JSON object", file=sys.stderr)
        raise SystemExit(1)

    for dependency_name, metadata in dependencies.items():
        package_name = f"{parent_path}/{dependency_name}"
        emit_package(package_name, metadata)
        if isinstance(metadata, dict) and "dependencies" in metadata:
            emit_v1_dependencies(
                metadata["dependencies"],
                f"{package_name}/node_modules",
            )


dependencies = lockfile.get("dependencies")
if dependencies is not None:
    emit_v1_dependencies(dependencies)
    raise SystemExit(0)

print("package-lock.json: unsupported lockfile shape", file=sys.stderr)
raise SystemExit(1)
PY
  ); then
    echo "ERROR: Unable to parse package-lock.json" >&2
    incompatible_found=1
  else
    while IFS=$'\t' read -r package_name license_expression; do
      [ -z "$package_name" ] && continue

      if [ -z "$license_expression" ]; then
        echo "ERROR: Missing license in package-lock.json package ${package_name}" >&2
        incompatible_found=1
        continue
      fi

      echo "${package_name}"
      printf '  %s\n' "$license_expression"
      validate_license_subject "package-lock.json package ${package_name}" "$license_expression"
    done <<< "$dependency_license_entries"
  fi
fi

if [ $incompatible_found -eq 1 ]; then
  echo "ERROR: Found licenses incompatible with AGPL-3.0-or-later" >&2
  exit 1
fi

echo "All licenses are compatible with AGPL-3.0-or-later ✓"
