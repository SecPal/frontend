#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: MIT

set -euo pipefail

ROOT_DIR=$(git rev-parse --show-toplevel)
# shellcheck source=scripts/container-runtime.sh
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/container-runtime.sh"
DEFAULT_IMAGE_TAG=$(node "$ROOT_DIR/scripts/container-test-image-tag.mjs" "$ROOT_DIR")
IMAGE_TAG=${SECPAL_CONTAINER_IMAGE:-$DEFAULT_IMAGE_TAG}
CONTAINER_LABEL="secpal.dev/test-role=frontend-container-browser"
RUN_ID=$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')
CONTAINER_NAME="secpal-frontend-browser-${RUN_ID}"
CONTAINER_ID=
PLATFORM_ARGS=()

case ${SECPAL_CONTAINER_PLATFORM:-} in
  "") ;;
  linux/amd64 | linux/arm64)
    PLATFORM_ARGS+=(--platform "$SECPAL_CONTAINER_PLATFORM")
    ;;
  *)
    printf 'ERROR: unsupported container platform: %s\n' \
      "$SECPAL_CONTAINER_PLATFORM" >&2
    exit 1
    ;;
esac

cleanup_container() {
  if [ -n "$CONTAINER_ID" ]; then
    docker rm --force "$CONTAINER_ID" >/dev/null 2>&1 || true
  fi
}

handle_signal() {
  local exit_code="$1"

  exit "$exit_code"
}

trap cleanup_container EXIT
trap 'handle_signal 129' HUP
trap 'handle_signal 130' INT
trap 'handle_signal 143' TERM

if [ "${SECPAL_CONTAINER_SKIP_BUILD:-0}" != "1" ]; then
  docker build "${PLATFORM_ARGS[@]}" --tag "$IMAGE_TAG" "$ROOT_DIR"
elif ! docker image inspect "$IMAGE_TAG" >/dev/null 2>&1; then
  echo "ERROR: frontend container image is missing while builds are disabled" >&2
  exit 1
fi

if ! CONTAINER_ID=$(docker create "${PLATFORM_ARGS[@]}" \
  --name "$CONTAINER_NAME" \
  --label "$CONTAINER_LABEL" \
  --label "secpal.dev/test-run=$RUN_ID" \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=16m \
  --cap-drop=ALL \
  --security-opt=no-new-privileges:true \
  --env SECPAL_API_URL=https://api.secpal.dev \
  --publish 127.0.0.1::8080 \
  "$IMAGE_TAG"); then
  printf 'ERROR: could not create frontend browser container %s\n' \
    "$CONTAINER_NAME" >&2
  exit 1
fi

if ! docker start "$CONTAINER_ID" >/dev/null; then
  fail_with_container_diagnostics \
    "$CONTAINER_ID" \
    "could not start frontend browser container"
  exit 1
fi

CONTAINER_PORT=$(wait_for_container_port "$CONTAINER_ID" 8080)

SECPAL_CONTAINER_BASE_URL="http://127.0.0.1:${CONTAINER_PORT}"
export SECPAL_CONTAINER_BASE_URL

wait_for_container_live "$CONTAINER_ID" "$CONTAINER_PORT"

if ! npm exec -- playwright test --config=playwright.container.config.ts; then
  fail_with_container_diagnostics \
    "$CONTAINER_ID" \
    "frontend container browser contract failed"
  exit 1
fi
