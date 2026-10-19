#!/bin/sh
# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: MIT
set -eu
response="$(curl --disable --fail --silent --show-error --noproxy '*' \
    --connect-timeout 2 --max-time 3 --write-out ':%{http_code}' \
    http://127.0.0.1:8080/health/live)"
test "$response" = '{"status":"ok"}:200'
