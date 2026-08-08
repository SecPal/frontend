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
CONTAINER_PREFIX="secpal-frontend-contract-$$"
CONTAINER_A="${CONTAINER_PREFIX}-a"
CONTAINER_B="${CONTAINER_PREFIX}-b"
CONTAINERS=()
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

TEMP_DIR=$(mktemp -d)

cleanup() {
  for container in "${CONTAINERS[@]}"; do
    docker rm --force "$container" >/dev/null 2>&1 || true
  done
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

fail() {
  local container

  printf 'ERROR: %s\n' "$*" >&2
  for container in "${CONTAINERS[@]}"; do
    print_container_diagnostics "$container"
  done
  exit 1
}

if [ "${SECPAL_CONTAINER_SKIP_BUILD:-0}" != "1" ]; then
  docker build "${PLATFORM_ARGS[@]}" \
    --pull \
    --build-arg SECPAL_IMAGE_REVISION="${GITHUB_SHA:-local-test}" \
    --build-arg SECPAL_IMAGE_VERSION="${SECPAL_IMAGE_VERSION:-0.0.1-local}" \
    --tag "$IMAGE_TAG" \
    "$ROOT_DIR"
fi

IMAGE_ID=$(docker image inspect --format '{{.Id}}' "$IMAGE_TAG")
[ -n "$IMAGE_ID" ] || fail "built image has no image ID"

start_container() {
  local name=$1
  local api_origin=$2
  local container_id

  if ! container_id=$(docker create "${PLATFORM_ARGS[@]}" \
    --name "$name" \
    --read-only \
    --tmpfs /tmp:rw,noexec,nosuid,nodev,size=16m \
    --cap-drop=ALL \
    --security-opt=no-new-privileges:true \
    --env "SECPAL_API_URL=$api_origin" \
    --env "SECPAL_SMOKE_SENTINEL=must-not-be-serialized" \
    --publish 127.0.0.1::8080 \
    "$IMAGE_TAG"); then
    printf 'ERROR: could not create container %s\n' "$name" >&2
    return 1
  fi

  CONTAINERS+=("$container_id")
  if ! docker start "$container_id" >/dev/null; then
    fail_with_container_diagnostics "$container_id" "could not start container"
    return 1
  fi
}

container_port() {
  wait_for_container_port "$1" 8080
}

wait_for_live() {
  wait_for_container_live "$1" "$2"
}

assert_status() {
  local port=$1
  local path=$2
  local expected=$3
  local body_file="$TEMP_DIR/body"
  local status

  status=$(curl --silent --output "$body_file" --write-out '%{http_code}' \
    "http://127.0.0.1:${port}${path}")
  [ "$status" = "$expected" ] ||
    fail "$path returned $status instead of $expected"

  if [ "$expected" = "404" ] && grep -qi '<!doctype html' "$body_file"; then
    fail "$path returned the SPA shell"
  fi
}

headers_for() {
  curl --silent --show-error --dump-header - --output /dev/null \
    "http://127.0.0.1:$1$2" | tr -d '\r'
}

assert_header() {
  local port=$1
  local path=$2
  local pattern=$3

  headers_for "$port" "$path" | grep -Eiq "$pattern" ||
    fail "$path is missing header pattern: $pattern"
}

start_container "$CONTAINER_A" "https://api.customer-a.example"
start_container "$CONTAINER_B" "https://api.customer-b.example"

PORT_A=$(container_port "$CONTAINER_A")
PORT_B=$(container_port "$CONTAINER_B")
wait_for_live "$CONTAINER_A" "$PORT_A"
wait_for_live "$CONTAINER_B" "$PORT_B"

[ "$(docker inspect --format '{{.Config.User}}' "$CONTAINER_A")" = "101:101" ] ||
  fail "image user is not 101:101"
[ "$(docker exec "$CONTAINER_A" id -u)" != "0" ] ||
  fail "running process is root"
docker exec "$CONTAINER_A" test ! -w /usr/share/nginx/html/index.html ||
  fail "static Web artifact is writable by the runtime user"
[ "$(docker exec "$CONTAINER_A" stat -c '%a' /etc/nginx/snippets)" = "555" ] ||
  fail "Nginx snippets directory mode is not 0555"
docker exec "$CONTAINER_A" \
  test -r /etc/nginx/snippets/secpal-security-headers.conf ||
  fail "Nginx security headers are not readable by the runtime user"

assert_status "$PORT_A" "/health/live" "200"
[ "$(curl --fail --silent "http://127.0.0.1:${PORT_A}/health/live")" = '{"status":"ok"}' ] ||
  fail "health response body drifted"

INDEX_A="$TEMP_DIR/index-a.html"
INDEX_B="$TEMP_DIR/index-b.html"
RUNTIME_A="$TEMP_DIR/runtime-a.js"
RUNTIME_B="$TEMP_DIR/runtime-b.js"
curl --fail --silent "http://127.0.0.1:${PORT_A}/" >"$INDEX_A"
curl --fail --silent "http://127.0.0.1:${PORT_B}/" >"$INDEX_B"
curl --fail --silent "http://127.0.0.1:${PORT_A}/runtime-config.js" >"$RUNTIME_A"
curl --fail --silent "http://127.0.0.1:${PORT_B}/runtime-config.js" >"$RUNTIME_B"

cmp "$INDEX_A" "$INDEX_B" >/dev/null || fail "same image emitted different index.html"
cmp "$RUNTIME_A" "$RUNTIME_B" >/dev/null && fail "customer runtime configurations are identical"
grep -Fq 'apiBaseUrl: "https://api.customer-a.example",' "$RUNTIME_A" ||
  fail "customer A runtime origin is missing"
grep -Fq 'apiBaseUrl: "https://api.customer-b.example",' "$RUNTIME_B" ||
  fail "customer B runtime origin is missing"
grep -Fq 'must-not-be-serialized' "$RUNTIME_A" &&
  fail "unrelated environment data leaked into runtime-config.js"

grep -Fq 'http-equiv="Content-Security-Policy"' "$INDEX_A" ||
  fail "static CSP meta is missing"
grep -Eiq 'unsafe-(inline|eval|hashes)|nonce-' "$INDEX_A" &&
  fail "static CSP was weakened"

SCRIPT_PATH=$(grep -Eo 'src="/assets/[^"]+\.js"' "$INDEX_A" | head -1 | cut -d'"' -f2)
STYLE_PATH=$(grep -Eo 'href="/assets/[^"]+\.css"' "$INDEX_A" | head -1 | cut -d'"' -f2)
[ -n "$SCRIPT_PATH" ] || fail "main JavaScript bundle was not referenced"
[ -n "$STYLE_PATH" ] || fail "stylesheet bundle was not referenced"

for port in "$PORT_A" "$PORT_B"; do
  curl --fail --silent "http://127.0.0.1:${port}${SCRIPT_PATH}" \
    >"$TEMP_DIR/script-${port}.js"
  curl --fail --silent "http://127.0.0.1:${port}${STYLE_PATH}" \
    >"$TEMP_DIR/style-${port}.css"
done
cmp "$TEMP_DIR/script-${PORT_A}.js" "$TEMP_DIR/script-${PORT_B}.js" >/dev/null ||
  fail "same image emitted different JavaScript assets"
cmp "$TEMP_DIR/style-${PORT_A}.css" "$TEMP_DIR/style-${PORT_B}.css" >/dev/null ||
  fail "same image emitted different CSS assets"

docker restart "$CONTAINER_A" >/dev/null
PORT_A=$(container_port "$CONTAINER_A")
wait_for_live "$CONTAINER_A" "$PORT_A"
curl --fail --silent "http://127.0.0.1:${PORT_A}/runtime-config.js" \
  >"$TEMP_DIR/runtime-a-restarted.js"
cmp "$RUNTIME_A" "$TEMP_DIR/runtime-a-restarted.js" >/dev/null ||
  fail "container restart changed runtime configuration"

for artifact in \
  /sw.js \
  /manifest.webmanifest \
  /dependencies.spdx.json \
  /THIRD-PARTY-DEPENDENCY-NOTICES.md \
  /THIRD-PARTY-NOTICES.md \
  /LICENSES/MIT.txt; do
  curl --fail --silent "http://127.0.0.1:${PORT_A}${artifact}" >/dev/null ||
    fail "required build artifact is missing: $artifact"
done

for reserved_path in \
  /v1 \
  /v1/test \
  /sanctum \
  /sanctum/csrf-cookie \
  /health \
  /health/ready \
  /runtime-config.js/more; do
  assert_status "$PORT_A" "$reserved_path" "404"
done
assert_status "$PORT_A" "/regular-client-route" "200"

assert_header "$PORT_A" "/health/live" '^Cache-Control: no-store$'
assert_header "$PORT_A" "/" '^Cache-Control: no-cache, no-store, must-revalidate$'
assert_header "$PORT_A" "/runtime-config.js" '^Cache-Control: no-cache, no-store, must-revalidate$'
assert_header "$PORT_A" "/sw.js" '^Cache-Control: no-cache, no-store, must-revalidate$'
assert_header "$PORT_A" "/manifest.webmanifest" '^Cache-Control: no-cache, must-revalidate$'
assert_header "$PORT_A" "$SCRIPT_PATH" '^Cache-Control: public, max-age=31536000, immutable$'
assert_header "$PORT_A" "/runtime-config.js" '^Content-Type: application/javascript'
assert_header "$PORT_A" "/manifest.webmanifest" '^Content-Type: application/manifest\+json'
assert_header "$PORT_A" "/dependencies.spdx.json" '^Content-Type: application/json'
assert_header "$PORT_A" "/THIRD-PARTY-NOTICES.md" '^Content-Type: text/markdown'
assert_header "$PORT_A" "/" '^X-Content-Type-Options: nosniff$'
assert_header "$PORT_A" "/runtime-config.js" '^X-Frame-Options: DENY$'

docker run "${PLATFORM_ARGS[@]}" --rm --entrypoint /bin/sh "$IMAGE_TAG" -c '
  ! command -v node >/dev/null 2>&1
  ! command -v npm >/dev/null 2>&1
  for path in /src /tests /node_modules /.git /package-lock.json /vite.config.ts /coverage /playwright-report; do
    [ ! -e "$path" ] || exit 1
  done
  # Production artifacts do not expose source maps.
  for path in /usr/share/nginx/html/*.map /usr/share/nginx/html/assets/*.map; do
    [ ! -e "$path" ] || exit 1
  done
' || fail "final image contains build-time tools or source paths"

valid_origins=(
  "https://api.example.com"
  "https://api.example.com:8443"
  "https://192.0.2.10"
  "https://[2001:db8::10]"
  "https://[2001:db8::10]:8443"
  "https://[::ffff:c000:20a]"
  "https://[64:ff9b::7f00:1]"
  "https://xn--bcher-kva.example"
)
for origin in "${valid_origins[@]}"; do
  docker run "${PLATFORM_ARGS[@]}" --rm \
    --env "SECPAL_API_URL=$origin" "$IMAGE_TAG" true >/dev/null 2>&1 ||
    fail "valid origin was rejected"
done

invalid_origins=(
  ""
  "https://localhost"
  "https://api.localhost"
  "https://127.0.0.1"
  "https://127.255.255.255:8443"
  "https://0.0.0.0"
  "https://2130706433"
  "https://0x7f000001"
  "https://017700000001"
  "https://0x7f.1"
  "https://127.1"
  "https://[::1]"
  "https://[::7f00:1]"
  "https://[::ffff:0:0]"
  "https://[::ffff:7f00:1]"
  "https://[::ffff:7fff:ffff]"
  "http://api.example.com"
  "https://api.example.com/"
  "https://api.example.com/v1"
  "https://user@example.com"
  "https://api.example.com?x=1"
  "https://api.example.com#fragment"
  " https://api.example.com"
  $'https://api.example.com\ninvalid'
  'https://api.example.com"'
  "https://api.example.com\\"
  'https://api.example.com<script>'
  'https://api.example.com</script>'
  "https://api.example.com\$(id)"
  'https://api.example.com;id'
  "https://api.example.com:0"
  "https://api.example.com:65536"
  "https://api.example.com:"
)

if docker run "${PLATFORM_ARGS[@]}" --rm \
  "$IMAGE_TAG" true >"$TEMP_DIR/invalid.log" 2>&1; then
  fail "container started without SECPAL_API_URL"
fi
grep -Fq 'SECPAL_API_URL must be an exact ASCII HTTPS origin' "$TEMP_DIR/invalid.log" ||
  fail "missing-value error did not describe the origin contract"

for origin in "${invalid_origins[@]}"; do
  if docker run "${PLATFORM_ARGS[@]}" --rm \
    --env "SECPAL_API_URL=$origin" "$IMAGE_TAG" true \
    >"$TEMP_DIR/invalid.log" 2>&1; then
    fail "container accepted an invalid origin"
  fi
  grep -Fq 'SECPAL_API_URL must be an exact ASCII HTTPS origin' "$TEMP_DIR/invalid.log" ||
    fail "invalid-value error did not describe the origin contract"
  grep -Fq 'api.example.com' "$TEMP_DIR/invalid.log" &&
    fail "invalid origin was reflected in logs"
done

docker stop --time 10 "$CONTAINER_B" >/dev/null
[ "$(docker inspect --format '{{.State.Running}}' "$CONTAINER_B")" = "false" ] ||
  fail "container did not stop after SIGTERM"
docker logs "$CONTAINER_B" 2>&1 | grep -Eqi 'permission denied|read-only file system|\[emerg\]' &&
  fail "container logged an unexpected runtime error"

echo "Frontend container contract passed for ${IMAGE_ID}"
