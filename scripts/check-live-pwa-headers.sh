#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 SecPal
# SPDX-License-Identifier: MIT

set -euo pipefail

APP_URL="${APP_URL:-https://app.secpal.dev}"
APP_ROOT_URL="${APP_URL%/}/"
SERVICE_WORKER_URL="${APP_URL%/}/sw.js"
MANIFEST_URL="${APP_URL%/}/manifest.webmanifest"

# Extract headers from the last HTTP response block in a dump-header file.
# When curl --location follows redirects, the file contains one block per
# response; only the final block carries the headers we want to assert.
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

request_headers() {
    local url="$1"
    local tmp_headers

    tmp_headers="$(mktemp)"

    if ! curl --silent --show-error --location --retry 2 --retry-delay 2 \
        --dump-header "$tmp_headers" \
        --output /dev/null \
        "$url"; then
        echo "ERROR: request failed for ${url}"
        rm -f "$tmp_headers"
        exit 1
    fi

    cat "$tmp_headers"
    rm -f "$tmp_headers"
}

assert_header_contains() {
    local headers="$1"
    local header_name="$2"
    local expected_value="$3"
    local actual_value

    actual_value="$(get_header_value "$headers" "$header_name")"

    if [[ -z "$actual_value" ]]; then
        echo "ERROR: missing header ${header_name}"
        exit 1
    fi

    if [[ "$actual_value" != *"$expected_value"* ]]; then
        echo "ERROR: unexpected ${header_name} header"
        echo "  expected to contain: ${expected_value}"
        echo "  actual:              ${actual_value}"
        exit 1
    fi
}

assert_status_ok() {
    local headers="$1"
    local url="$2"
    local status

    status="$(get_status_code "$headers")"

    if [[ "$status" != "200" ]]; then
        echo "ERROR: expected HTTP 200 for ${url}"
        echo "  actual status: ${status}"
        exit 1
    fi
}

assert_common_hardening() {
    local headers="$1"
    local label="$2"

    echo "Checking hardening headers on ${label}"

    assert_header_contains "$headers" "Content-Security-Policy" "default-src 'self'"
    assert_header_contains "$headers" "Permissions-Policy" "camera=()"
    assert_header_contains "$headers" "Strict-Transport-Security" "max-age=63072000"
    assert_header_contains "$headers" "Referrer-Policy" "strict-origin-when-cross-origin"
    assert_header_contains "$headers" "X-Frame-Options" "DENY"
    assert_header_contains "$headers" "X-Content-Type-Options" "nosniff"
}

echo "Checking live PWA hardening on ${APP_URL}"

app_raw="$(request_headers "$APP_ROOT_URL")"
app_headers="$(last_response_headers "$app_raw")"
assert_status_ok "$app_raw" "$APP_ROOT_URL"
assert_common_hardening "$app_headers" "$APP_ROOT_URL"
assert_header_contains "$app_headers" "Cache-Control" "no-cache"
assert_header_contains "$app_headers" "Cache-Control" "no-store"
assert_header_contains "$app_headers" "Cache-Control" "must-revalidate"

sw_raw="$(request_headers "$SERVICE_WORKER_URL")"
sw_headers="$(last_response_headers "$sw_raw")"
assert_status_ok "$sw_raw" "$SERVICE_WORKER_URL"
assert_common_hardening "$sw_headers" "$SERVICE_WORKER_URL"
assert_header_contains "$sw_headers" "Cache-Control" "no-cache"
assert_header_contains "$sw_headers" "Cache-Control" "no-store"
assert_header_contains "$sw_headers" "Cache-Control" "must-revalidate"
assert_header_contains "$sw_headers" "Service-Worker-Allowed" "/"

manifest_raw="$(request_headers "$MANIFEST_URL")"
manifest_headers="$(last_response_headers "$manifest_raw")"
assert_status_ok "$manifest_raw" "$MANIFEST_URL"
assert_common_hardening "$manifest_headers" "$MANIFEST_URL"
assert_header_contains "$manifest_headers" "Content-Type" "application/manifest+json"
assert_header_contains "$manifest_headers" "Cache-Control" "no-cache"
assert_header_contains "$manifest_headers" "Cache-Control" "must-revalidate"

echo "Live PWA hardening smoke test passed"
