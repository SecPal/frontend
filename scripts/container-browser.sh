#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: MIT

set -euo pipefail

CONTAINER_LABEL="secpal.dev/test-role=frontend-container-browser"

cleanup_containers() {
  local -a container_ids=()

  mapfile -t container_ids < <(
    docker ps --all --quiet --filter "label=${CONTAINER_LABEL}"
  )

  if ((${#container_ids[@]} > 0)); then
    docker rm --force "${container_ids[@]}" >/dev/null
  fi
}

handle_signal() {
  local exit_code="$1"

  exit "$exit_code"
}

cleanup_containers
trap cleanup_containers EXIT
trap 'handle_signal 129' HUP
trap 'handle_signal 130' INT
trap 'handle_signal 143' TERM

npm exec -- playwright test --config=playwright.container.config.ts
