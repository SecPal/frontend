#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
set -euo pipefail
test "$(buildah --version | awk '{print $3}')" = 1.33.7
test "$(id -u)" -ne 0
test "$(podman info --format '{{.Host.Security.Rootless}}')" = true
repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"
arch=${1:?native architecture}
output=${2:?owned output directory}
governance="${GITHUB_WORKSPACE:?}/.context/publisher-governance"
tools="${RUNNER_TEMP:?}/secpal-publisher-tools"
case "$arch:$(uname -m):${RUNNER_ARCH:-}" in
  amd64:x86_64:X64|arm64:aarch64:ARM64) ;;
  *) echo 'Native build architecture rejected' >&2; exit 1 ;;
esac
for handler in /proc/sys/fs/binfmt_misc/qemu-*; do
  if [ -f "$handler" ] && grep -qx enabled "$handler"; then
    echo 'Foreign-architecture emulation is not native evidence' >&2
    exit 1
  fi
done
mkdir -p "$output"
output=$(realpath "$output")
python3 scripts/container-publisher.py source --root "$repo_root" --commit "${GITHUB_SHA:?}" --output "$output/source.json"
snapshot_parent=$(mktemp -d "${RUNNER_TEMP}/secpal-frontend-context.XXXXXX")
cleanup() {
  chmod -R u+w "$snapshot_parent"
  rm -rf -- "$snapshot_parent"
}
trap cleanup EXIT
snapshot="$snapshot_parent/source"
python3 -I "$governance/scripts/secpal-trivy-repository-scan.py" prepare-snapshot \
  --workspace "$repo_root" --commit "$GITHUB_SHA" --destination "$snapshot"
python3 scripts/container-publisher.py bases --root "$snapshot" --arch "$arch" --output "$output/bases.json"
node_base=$(jq -er '.[] | select(.stage=="build") | (.reference | split("@")[0] | split(":")[0])+"@"+.digest' "$output/bases.json")
nginx_base=$(jq -er '.[] | select(.stage=="runtime") | (.reference | split("@")[0] | split(":")[0])+"@"+.digest' "$output/bases.json")
buildah pull --arch "$arch" "$node_base"
buildah pull --arch "$arch" "$nginx_base"
epoch=$(jq -er .epoch "$output/source.json")
created=$(date -u -d "@$epoch" +%Y-%m-%dT%H:%M:%SZ)
reviewed_base=$(jq -er '.[]|select(.stage=="runtime")|.reference' "$output/bases.json")
base_digest=$(jq -er '.[]|select(.stage=="runtime")|.digest' "$output/bases.json")
image="localhost/secpal-frontend:build-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-$arch"
env -u SOURCE_DATE_EPOCH buildah build --format oci --timestamp "$epoch" --pull=never --layers --arch "$arch" \
  --http-proxy=false --iidfile "$output/image-id" \
  --build-arg "NODE_IMAGE=$node_base" --build-arg "NGINX_IMAGE=$nginx_base" \
  --build-arg "SOURCE_DATE_EPOCH=$epoch" \
  --build-arg "SECPAL_IMAGE_REVISION=$GITHUB_SHA" \
  --build-arg "SECPAL_IMAGE_VERSION=$(jq -er .version "$output/source.json")" \
  --label "org.opencontainers.image.source=https://github.com/SecPal/frontend" \
  --label "org.opencontainers.image.revision=$GITHUB_SHA" \
  --label "org.opencontainers.image.created=$created" \
  --label "org.opencontainers.image.licenses=AGPL-3.0-or-later" \
  --label "org.opencontainers.image.base.name=$reviewed_base" \
  --label "org.opencontainers.image.base.digest=$base_digest" \
  --label "org.opencontainers.image.title=SecPal Frontend" \
  --label "org.opencontainers.image.description=Unprivileged static reference server for the SecPal frontend" \
  --file "$snapshot/Containerfile" --tag "$image" "$snapshot"
buildah push --format oci "$image" "oci:$output/image:frontend"
python3 scripts/container-publisher.py record --layout "$output/image" --arch "$arch" \
  --source "$output/source.json" --bases "$output/bases.json" --output "$output/record.json"
manifest=$(jq -er .subject.manifest_digest "$output/record.json")
env -i HOME="$tools" PATH="$PATH" SYFT_CHECK_FOR_APP_UPDATE=false \
  "$tools/syft" scan --config "$tools/empty.yaml" "oci-dir:$output/image" \
  --source-name "ghcr.io/secpal/frontend@$manifest" --source-version "$GITHUB_SHA" \
  --output "spdx-json=$output/syft.spdx.json"
python3 scripts/container-publisher.py association --record "$output/record.json" \
  --spdx "$output/syft.spdx.json" --output "$output/association.json"
python3 "$governance/scripts/secpal-vulnerability-reevaluation.py" verify-syft \
  --platform-digest "$manifest" --platform "linux/$arch" --spdx "$output/syft.spdx.json" \
  --association "$output/association.json" --output "$output/syft-association.json"
SECPAL_CONTAINER_SKIP_BUILD=1 SECPAL_CONTAINER_IMAGE="$image" SECPAL_CONTAINER_PLATFORM="linux/$arch" scripts/container-smoke.sh
SECPAL_CONTAINER_SKIP_BUILD=1 SECPAL_CONTAINER_IMAGE="$image" SECPAL_CONTAINER_PLATFORM="linux/$arch" scripts/container-browser.sh
python3 scripts/container-publisher.py source --root "$repo_root" --commit "$GITHUB_SHA" --output "$output/source-after.json"
cmp "$output/source.json" "$output/source-after.json"
