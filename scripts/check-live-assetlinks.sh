#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 SecPal
# SPDX-License-Identifier: MIT

set -euo pipefail

APP_URL="${APP_URL:-https://app.secpal.dev}"
ASSETLINKS_URL="${APP_URL%/}/.well-known/assetlinks.json"
EXPECTED_PACKAGE_NAME="${EXPECTED_PACKAGE_NAME:-app.secpal}"
EXPECTED_FINGERPRINT="${EXPECTED_FINGERPRINT:-C3:E9:FD:07:69:F3:34:9B:B0:B0:56:BA:E6:69:47:23:40:E1:CB:28:66:26:DE:30:C9:C9:FA:F9:5F:1E:47:B5}"

last_response_headers() {
    local raw="$1"

    printf '%s\n' "$raw" | awk '
        /^HTTP\/[0-9.]+ / { block = "" }
        { block = block "\n" $0 }
        END { print block }
    '
}

get_header_value() {
    local headers="$1"
    local header_name="$2"

    printf '%s\n' "$headers" | awk -v target="$header_name" '
        BEGIN {
            FS = ": "
        }
        tolower($1) == tolower(target) {
            gsub(/\r/, "", $2)
            print $2
            exit
        }
    '
}

get_status_code() {
    local headers="$1"

    printf '%s\n' "$headers" | awk '/^HTTP\/[0-9.]+ / { code = $2 } END { if (code != "") print code }'
}

tmp_headers="$(mktemp)"
tmp_body="$(mktemp)"
trap 'rm -f "$tmp_headers" "$tmp_body"' EXIT

if ! curl --silent --show-error --location --retry 2 --retry-delay 2 \
    --header 'Accept: application/json' \
    --dump-header "$tmp_headers" \
    --output "$tmp_body" \
    "$ASSETLINKS_URL"; then
    echo "ERROR: request failed for ${ASSETLINKS_URL}"
    exit 1
fi

raw_headers="$(cat "$tmp_headers")"
headers="$(last_response_headers "$raw_headers")"
status="$(get_status_code "$raw_headers")"
content_type="$(get_header_value "$headers" 'Content-Type')"

if [[ "$status" != "200" ]]; then
    echo "ERROR: expected HTTP 200 for ${ASSETLINKS_URL}"
    echo "  actual status: ${status:-<missing>}"
    exit 1
fi

if [[ "$content_type" != application/json* ]]; then
    echo "ERROR: ${ASSETLINKS_URL} did not return JSON"
    echo "  expected: application/json"
    echo "  actual:   ${content_type:-<missing>}"
    exit 1
fi

node - "$tmp_body" "$EXPECTED_PACKAGE_NAME" "$EXPECTED_FINGERPRINT" <<'NODE'
const fs = require('node:fs');

const [, , filePath, expectedPackageName, expectedFingerprint] = process.argv;
const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));

if (!Array.isArray(payload) || payload.length !== 1) {
  console.error('ERROR: assetlinks payload must contain exactly one statement');
  process.exit(1);
}

const [statement] = payload;
const relations = new Set(Array.isArray(statement.relation) ? statement.relation : []);
const target = statement.target ?? {};
const fingerprints = new Set(
  Array.isArray(target.sha256_cert_fingerprints)
    ? target.sha256_cert_fingerprints
    : []
);

for (const relation of [
  'delegate_permission/common.handle_all_urls',
  'delegate_permission/common.get_login_creds',
]) {
  if (!relations.has(relation)) {
    console.error(`ERROR: missing relation ${relation}`);
    process.exit(1);
  }
}

if (target.namespace !== 'android_app') {
  console.error(`ERROR: unexpected target namespace ${String(target.namespace)}`);
  process.exit(1);
}

if (target.package_name !== expectedPackageName) {
  console.error(`ERROR: unexpected package_name ${String(target.package_name)}`);
  process.exit(1);
}

if (!fingerprints.has(expectedFingerprint)) {
  console.error('ERROR: expected signing fingerprint missing from assetlinks payload');
  process.exit(1);
}
NODE

echo "Live assetlinks delivery smoke test passed"
