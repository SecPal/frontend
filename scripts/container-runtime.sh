#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: MIT

print_container_diagnostics() {
  local container=$1

  printf 'Container diagnostics for %s:\n' "$container" >&2

  docker inspect \
    --format \
    'status={{.State.Status}} running={{.State.Running}} exit={{.State.ExitCode}} error={{json .State.Error}} ports={{json .NetworkSettings.Ports}}' \
    "$container" >&2 ||
    printf 'docker inspect failed for %s\n' "$container" >&2

  docker logs "$container" >&2 ||
    printf 'docker logs failed for %s\n' "$container" >&2
}

fail_with_container_diagnostics() {
  local container=$1
  local message=$2

  printf 'ERROR: %s\n' "$message" >&2
  print_container_diagnostics "$container"
  return 1
}

container_allows_startup_wait() {
  local container=$1
  local wait_context=$2
  local state

  if ! state=$(docker inspect --format '{{.State.Status}}' "$container" 2>/dev/null); then
    fail_with_container_diagnostics \
      "$container" \
      "could not inspect container state"
    return 1
  fi

  case "$state" in
    created | running | restarting)
      return 0
      ;;
    exited | dead)
      fail_with_container_diagnostics \
        "$container" \
        "container exited before ${wait_context}"
      return 1
      ;;
    *)
      fail_with_container_diagnostics \
        "$container" \
        "container entered unexpected state: ${state}"
      return 1
      ;;
  esac
}

wait_for_container_port() {
  local container=$1
  local container_port=$2
  local attempts=${3:-100}
  local interval=${4:-0.1}
  local attempt
  local mapping

  if ! [[ "$attempts" =~ ^[1-9][0-9]*$ ]]; then
    fail_with_container_diagnostics \
      "$container" \
      "invalid container port wait attempt count: ${attempts}"
    return 1
  fi

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    mapping=$(docker port "$container" "${container_port}/tcp" 2>/dev/null || true)

    if [[ "$mapping" =~ ^127\.0\.0\.1:([0-9]+)$ ]]; then
      printf '%s\n' "${BASH_REMATCH[1]}"
      return 0
    fi

    if [ -n "$mapping" ]; then
      fail_with_container_diagnostics \
        "$container" \
        "container published an unexpected ${container_port}/tcp mapping"
      return 1
    fi

    if ! container_allows_startup_wait \
      "$container" \
      "publishing ${container_port}/tcp"; then
      return 1
    fi

    if [ "$attempt" -lt "$attempts" ]; then
      sleep "$interval"
    fi
  done

  fail_with_container_diagnostics \
    "$container" \
    "container did not publish ${container_port}/tcp before timeout"
}

wait_for_container_live() {
  local container=$1
  local host_port=$2
  local attempts=${3:-100}
  local interval=${4:-0.1}
  local attempt

  if ! [[ "$attempts" =~ ^[1-9][0-9]*$ ]]; then
    fail_with_container_diagnostics \
      "$container" \
      "invalid container readiness attempt count: ${attempts}"
    return 1
  fi

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if curl --fail --silent --show-error \
      "http://127.0.0.1:${host_port}/health/live" >/dev/null 2>&1; then
      return 0
    fi

    if ! container_allows_startup_wait \
      "$container" \
      "exposing /health/live"; then
      return 1
    fi

    if [ "$attempt" -lt "$attempts" ]; then
      sleep "$interval"
    fi
  done

  fail_with_container_diagnostics \
    "$container" \
    "container did not expose /health/live before timeout"
}
