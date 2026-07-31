#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: MIT

set -euo pipefail

ROOT_DIR=$(git rev-parse --show-toplevel)
DEFAULT_IMAGE_TAG=$(node "$ROOT_DIR/scripts/container-test-image-tag.mjs" "$ROOT_DIR")
IMAGE_TAG=${SECPAL_CONTAINER_IMAGE:-$DEFAULT_IMAGE_TAG}
CONTAINER_LABEL="secpal.dev/test-role=frontend-container-browser"
RUN_ID=$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')
CONTAINER_NAME="secpal-frontend-browser-${RUN_ID}"

cleanup_container() {
  docker rm --force "$CONTAINER_NAME" >/dev/null 2>&1 || true
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
  docker build --tag "$IMAGE_TAG" "$ROOT_DIR"
elif ! docker image inspect "$IMAGE_TAG" >/dev/null 2>&1; then
  echo "ERROR: frontend container image is missing while builds are disabled" >&2
  exit 1
fi

docker run \
  --detach \
  --name "$CONTAINER_NAME" \
  --label "$CONTAINER_LABEL" \
  --label "secpal.dev/test-run=$RUN_ID" \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=16m \
  --cap-drop=ALL \
  --security-opt=no-new-privileges:true \
  --env SECPAL_API_URL=https://api.container.example \
  --publish 127.0.0.1::8080 \
  "$IMAGE_TAG" >/dev/null

CONTAINER_PORT=$(
  docker inspect \
    --format '{{(index (index .NetworkSettings.Ports "8080/tcp") 0).HostPort}}' \
    "$CONTAINER_NAME"
)

if ! [[ "$CONTAINER_PORT" =~ ^[0-9]+$ ]]; then
  echo "ERROR: frontend container did not receive a host port" >&2
  exit 1
fi

SECPAL_CONTAINER_BASE_URL="http://127.0.0.1:${CONTAINER_PORT}"
export SECPAL_CONTAINER_BASE_URL

container_ready=0
for _attempt in $(seq 1 100); do
  if curl --fail --silent \
    "${SECPAL_CONTAINER_BASE_URL}/health/live" >/dev/null 2>&1; then
    container_ready=1
    break
  fi
  sleep 0.1
done

if [ "$container_ready" != "1" ]; then
  docker logs "$CONTAINER_NAME" >&2 || true
  echo "ERROR: frontend container did not become ready" >&2
  exit 1
fi

npm exec -- playwright test --config=playwright.container.config.ts
