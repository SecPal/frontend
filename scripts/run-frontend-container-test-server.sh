#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: MIT

set -euo pipefail

ROOT_DIR=$(git rev-parse --show-toplevel)
IMAGE_TAG=${SECPAL_CONTAINER_IMAGE:-secpal-frontend:contract-test}
CONTAINER_NAME="secpal-frontend-browser-$$"

trap 'docker rm --force "$CONTAINER_NAME" >/dev/null 2>&1 || true' EXIT HUP INT TERM

if ! docker image inspect "$IMAGE_TAG" >/dev/null 2>&1; then
  docker build --tag "$IMAGE_TAG" "$ROOT_DIR"
fi

docker run \
  --detach \
  --name "$CONTAINER_NAME" \
  --label secpal.dev/test-role=frontend-container-browser \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=16m \
  --cap-drop=ALL \
  --security-opt=no-new-privileges:true \
  --env SECPAL_API_URL=https://api.container.example \
  --publish 127.0.0.1:4176:8080 \
  "$IMAGE_TAG" >/dev/null

for _attempt in $(seq 1 100); do
  if curl --fail --silent http://127.0.0.1:4176/health/live >/dev/null 2>&1; then
    docker wait "$CONTAINER_NAME" >/dev/null
    exit 1
  fi
  sleep 0.1
done

echo "ERROR: frontend container did not become ready" >&2
exit 1
