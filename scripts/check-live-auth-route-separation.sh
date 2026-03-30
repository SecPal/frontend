#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 SecPal
# SPDX-License-Identifier: MIT

set -euo pipefail

APP_URL="${APP_URL:-https://app.secpal.dev}"
API_URL="${API_URL:-https://api.secpal.dev}"
APP_ME_URL="${APP_URL%/}/v1/me"
API_ME_URL="${API_URL%/}/v1/me"

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

    printf '%s\n' "$headers" | awk '/^HTTP\/[0-9.]+/ { code = $2 } END { if (code != "") print code }'
}

request_headers() {
    local method="$1"
    local url="$2"
    local tmp_headers

    tmp_headers="$(mktemp)"

    if ! curl --silent --show-error --retry 2 --retry-delay 2 \
        --request "$method" \
        --dump-header "$tmp_headers" \
        --output /dev/null \
        --header 'Accept: application/json' \
        "$url"; then
        echo "ERROR: ${method} ${url} request failed"
        rm -f "$tmp_headers"
        exit 1
    fi

    cat "$tmp_headers"
    rm -f "$tmp_headers"
}

assert_not_html_shell() {
    local status="$1"
    local content_type="$2"
    local url="$3"

    if [[ "$status" == "200" && "$content_type" == text/html* ]]; then
        echo "ERROR: ${url} still resolves to the SPA HTML shell"
        echo "  status:       ${status}"
        echo "  content-type: ${content_type}"
        exit 1
    fi
}

assert_json_api_response() {
    local status="$1"
    local content_type="$2"
    local url="$3"

    if [[ "$status" != "200" && "$status" != "401" ]]; then
        echo "ERROR: ${url} returned an unexpected status"
        echo "  expected: 200 or 401"
        echo "  actual:   ${status}"
        exit 1
    fi

    if [[ "$content_type" != application/json* ]]; then
        echo "ERROR: ${url} did not return JSON"
        echo "  expected: application/json"
        echo "  actual:   ${content_type:-<missing>}"
        exit 1
    fi
}

echo "Checking live auth route separation"
echo "  app host: ${APP_ME_URL}"
echo "  api host: ${API_ME_URL}"

app_headers="$(request_headers GET "$APP_ME_URL")"
app_status="$(get_status_code "$app_headers")"
app_content_type="$(get_header_value "$app_headers" 'Content-Type')"

assert_not_html_shell "$app_status" "$app_content_type" "$APP_ME_URL"

echo "App host no longer serves /v1/me as SPA HTML"

api_headers="$(request_headers GET "$API_ME_URL")"
api_status="$(get_status_code "$api_headers")"
api_content_type="$(get_header_value "$api_headers" 'Content-Type')"

assert_json_api_response "$api_status" "$api_content_type" "$API_ME_URL"

echo "API host serves /v1/me as JSON"
echo "Live auth route separation smoke test passed"
