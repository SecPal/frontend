<!--
SPDX-FileCopyrightText: 2026 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Frontend Container

The SecPal frontend image is an unprivileged static reference server for the
existing production Web/PWA artifact. It does not contain Node.js and does not
rewrite HTML, JavaScript, CSS, the service worker, or any other build output at
startup.

The same immutable image is consumed by deployment owners. The runtime selects
its API origin only when the container starts.

## Build

Build the local image from the repository root:

```bash
buildah build --format oci -f Containerfile -t secpal-frontend:local .
```

The build stage uses the repository's complete `npm run build:web` pipeline,
including TypeScript, Vite's PWA `injectManifest` build, dependency SBOM, third-
party notices, and license artifacts. It does not introduce a second
container-specific application build.

## Qualified Runtime Packages

The Node 26 Bookworm build stage is unchanged. The runtime starts from
`docker.io/nginxinc/nginx-unprivileged:1.30.6-alpine3.24-slim@sha256:5d8bb9437d74a600ec5dbf90c035451c724dc33eac8d3a71078f6f8612c345f6`.
That official upstream input alone contains vulnerable zlib; the SecPal image
adds a signature-verified Alpine v3.24 main package layer with exactly
`zlib=1.3.2-r1` and `curl=8.22.0-r0`. It is a patched derivative, not
byte-identical to the vendor image. Base attribution retains the original
upstream index and platform identities.

The [native qualification report](https://github.com/SecPal/frontend/issues/1710#issuecomment-6276204246)
records the complete 30-package inventory on both architectures. Curl adds nine
packages: curl, libcurl, brotli-libs, c-ares, libunistring, libidn2,
nghttp2-libs, libpsl and zstd-libs. Zlib is the only updated original package;
Nginx and all other inherited versions remain unchanged. This measured package
cost preserves the existing bounded curl healthcheck, including status, body,
deadline and proxy isolation, without introducing another HTTP parser.

The Containerfile is the authoritative package admission point. Its inventory
checksum covers sorted, newline-terminated `name=version` records derived from
the installed APK database's `P:` and `V:` fields. The build fails if either
direct pin is unavailable, signature verification fails, or the complete
installed inventory changes. No edge/testing repository, extra key, untrusted
installation or unrestricted upgrade is permitted.

Alpine v3.24 stable package and upstream Nginx security updates require a focused
review: authenticate exact available signed packages, assess the complete
transitive inventory, update pins and its checksum together, and repeat native
runtime/browser and unchanged full-image artifact-policy admission on both
architectures. Package availability or fresh findings may block publication.
The historical qualification's CLEAN result is not a release verdict for a new
image; both final production subjects must independently pass the publisher.

## Published Image Identity

The only official image is:

```text
ghcr.io/secpal/frontend
```

The only canonical trust, deployment, update, and rollback identity is the OCI
index digest:

```text
ghcr.io/secpal/frontend@sha256:<oci-index-digest>
```

Each successful publisher run creates exactly one discovery tag:

```text
build-<40-character-source-sha>-<run-id>-<run-attempt>
```

The discovery tag locates the output of one workflow attempt. It is not a
deployment contract, rollback contract, or trust anchor. It is also not
technically immutable against another registry writer with sufficient
permissions. Consumers must record and use the verified OCI index digest.

The publisher runs only after a push to `main`, always rebuilds the selected
source commit, and publishes exactly `linux/amd64` and `linux/arm64`. The build
uses the commit timestamp for `org.opencontainers.image.created` and combines
the package version with the full source commit as
`<package-version>+git.<full-source-sha>`.

Native Buildah 1.33.7 jobs on AMD64 and ARM64 build exact committed source
without foreign-architecture emulation. Pinned Syft 1.54.1 produces each
authoritative SPDX inventory. The controller independently hashes OCI manifests,
configs and index bytes, checks source/base/platform labels and verifies each
SPDX association. It publishes candidates by digest before any discovery tag.

Five GitHub OCI attestations bind the index, both platform manifests and both
SPDX artifacts to the repository, source commit, workflow and hosted signer.
Both native platforms run the complete runtime and Chromium contracts.
Grype 0.118.0 consumes only the verified Syft SPDX through the accepted shared
input-provenance contract; Trivy 0.74.0 independently scans each immutable
platform artifact. Fresh central policy acceptance must be CLEAN for both.

Only after those gates does the publisher attest a builder-independent evidence
document, retain and attest its immutable OCI artifact, independently verify all
subjects and create the unique run-scoped discovery tag. Failed runs may leave
immutable candidates; they are not accepted releases. No registry deletion or
moving promotion tag is used. Source acceptance alone does not establish a
successful protected-main publisher run.

This image contains only the browser Web/PWA artifact. It does not publish
Android or iOS artifacts. Its Nginx runtime remains an unprivileged `101:101`
static reference server without Node.js; deployments supply `SECPAL_API_URL`
only when the container starts. TLS termination and public-edge controls remain
deployment responsibilities.

Historical publication evidence from the previous publisher remains scoped to
its original source. Post-merge publisher run
`31247196734` (attempt `1`) built source commit
`b755ca0d0ee5a85eca5ad5688d457241f070b1b4` and verified this canonical
artifact:

```text
ghcr.io/secpal/frontend@sha256:cdccded2eade53d9300aafff3a2663a779d3d158cfa74f1e9c182e5786285077
```

The run verified the exact OCI index bytes and registry digest header, both
runtime platforms, per-platform SBOM and provenance, both container and
Chromium contracts, GitHub Artifact Attestation `39567451`, and the final
discovery snapshot. The GHCR package is linked to `SecPal/frontend`, is public,
and accepted a digest-only pull with an empty anonymous Docker configuration.
An independent final attestation check with the pinned GitHub CLI `2.97.0`
verified the same subject, digest, repository, workflow, source and signer
commit, `refs/heads/main`, and GitHub-hosted runner binding.

`SecPal/deployment#6` consumed the verified digest at merge commit
`4fc2796409b7c37a541f515ccf29236f143fc132`, closing `SecPal/deployment#3`.
Phase C is complete.

## Local Container Verification

`SECPAL_API_URL` is required and must be one exact ASCII HTTPS origin. Paths,
trailing slashes, user information, queries, fragments, whitespace, control
characters, quotes, backslashes, shell syntax, port `0`, and ports above
`65535` are rejected. Internationalized hostnames must be provided as ASCII
Punycode.

```bash
podman run --rm \
  --health-cmd /usr/local/bin/secpal-health-live \
  --health-interval 30s --health-timeout 5s --health-start-period 10s --health-retries 3 \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=16m \
  --cap-drop=ALL \
  --security-opt=no-new-privileges:true \
  -e SECPAL_API_URL=https://api.example.com \
  -p 8080:8080 \
  secpal-frontend:local
```

The Containerfile retains its declarative HEALTHCHECK recommendation. Buildah
does not serialize that Docker metadata into OCI image configuration. The
image contains the same bounded health probe at
`/usr/local/bin/secpal-health-live`; operators configure it explicitly as above.
The tests inspect that configuration and execute `podman healthcheck run`.
The image runs as fixed user and group `101:101`, listens over HTTP on port
`8080`, and writes only beneath `/tmp`. The `/tmp` mount does not need execute
permission. A missing, loopback, or otherwise invalid API origin fails startup
before Nginx runs, without reflecting the supplied value in logs.

The entrypoint validates the origin, creates private runtime and Nginx
directories, atomically writes `/tmp/secpal-runtime/runtime-config.js`, checks
the static Nginx configuration, and then replaces itself with Nginx. The file
has this deterministic shape:

```javascript
window.__SECPAL_RUNTIME_CONFIG__ = Object.freeze({
  apiBaseUrl: "https://api.example.com",
});
```

The neutral artifact contains the same external file with `apiBaseUrl: null`.
The application resolves API configuration in this order:

1. validated native runtime override;
2. validated Web runtime configuration;
3. explicit build, preview, or development configuration;
4. known SecPal live and Polyscope preview mappings;
5. fail closed for an unknown production host.

Changing the API origin requires a container restart, not an image rebuild.

## Endpoints and Routing

- `GET /health/live` returns HTTP 200 and `{"status":"ok"}` without checking
  the API.
- `GET /runtime-config.js` serves only the startup-generated file from `/tmp`.
- `/v1`, `/sanctum`, and every `/health` path except `/health/live` return 404.
- Existing static files are served directly.
- Other application routes fall back to `index.html` for React Router.

The container has no API proxy, TLS, ACME, tenant routing, rate limiting, WAF,
or public-edge behavior. Frontend container traffic is expected to be
terminated and protected by the deployment edge. The container deliberately
does not emit a Content Security Policy header: the immutable `index.html`
retains the shared static strict CSP for Web, PWA, and Capacitor. A public edge
may add a stricter policy without changing the artifact.

## Cache Contract

| Resource                                   | Cache-Control                         |
| ------------------------------------------ | ------------------------------------- |
| `/`, `/index.html`                         | `no-cache, no-store, must-revalidate` |
| `/runtime-config.js`                       | `no-cache, no-store, must-revalidate` |
| `/sw.js`                                   | `no-cache, no-store, must-revalidate` |
| `/document-language.js`, `/theme-color.js` | `no-cache, no-store, must-revalidate` |
| `/manifest.webmanifest`                    | `no-cache, must-revalidate`           |
| `/source-offer.json`                       | `no-cache, must-revalidate`           |
| hashed `/assets/**`                        | `public, max-age=31536000, immutable` |
| `/health/live`                             | `no-store`                            |

`runtime-config.js` is excluded from both the Workbox precache manifest and
generic script runtime caching. It is fetched from the network on every app
load so an old customer configuration cannot be served offline.

## Deployment Boundary

This repository owns the image and its workload contract only: UID/GID
`101:101`, a read-only root filesystem, every Linux capability dropped, and
privilege escalation prohibited. It also requires a non-executable writable
`/tmp`, HTTP port `8080`, `/health/live`, and the non-secret
`SECPAL_API_URL` runtime setting. Runtime composition and all public-edge
behavior are owned by
[SecPal/deployment#248](https://github.com/SecPal/deployment/issues/248).

## Base Image Updates

The Containerfile pins both a complete version tag and its multi-architecture
manifest digest. To update a pin:

1. select an exact supported Debian Node patch release and a separately
   qualified official `nginxinc/nginx-unprivileged` runtime release;
2. inspect the registry manifest with
   `skopeo inspect --raw docker://<image>:<tag>`;
3. confirm that amd64 and arm64 are present and record the top-level index
   digest, not an architecture-specific child manifest;
4. update the tag and digest together;
5. run `npm run test:container` and `npm run test:e2e:container`.

Pull-request CI continues to build and validate the image locally without
registry credentials or write effects. Registry publication occurs only in the
push-triggered publisher after merge to `main`.

## Dependency update proposals

Dependabot configuration registers Containerfile through its `docker` ecosystem
and remote hook revisions through `pre-commit`, daily at 04:00 Europe/Berlin.
These are manual-review proposals; their explicit labels omit `dependencies`
so the existing patch auto-merge rule cannot enable their automatic merge.

Structural coverage does not establish image extraction: the current Containerfile
defines both image references through `ARG` defaults and uses `FROM ${…}`.
[GitHub documents that Dependabot does not update ARG-specified images](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/configure-private-registries#limitations-and-workarounds).
Complete base-image updater coverage remains blocked until that input contract
is made compatible through a separately qualified source correction or upstream
support. Do not introduce a duplicate Dockerfile or a second image-pin authority.

Every base-image version or digest change requires full native runtime/browser
and artifact-security qualification. The qualified SecPal Alpine derivative also
pins signed zlib/curl packages and checks the complete transitive package inventory;
a proposed vendor-base update does not qualify that layer or supersede its pins.
Keep immutable base digests and the accepted Buildah/Podman runtime contract.
The shared manifest/cadence guard establishes structural configuration coverage,
not proof that a future Dependabot updater run or update PR has already occurred.

## Recurring released-artifact security

The separate `Released Frontend Artifact Security` workflow observes the latest
successful protected-main publisher. Daily UTC schedules evaluate AMD64 at 03:17
and ARM64 at 03:37. Each platform has its own workflow run because the accepted
shared workflow uses run-scoped artifact names. Manual dispatch selects one
platform; run it once per platform for a complete two-platform incident assessment.

Release admission verifies the signed immutable build-evidence OCI artifact and
document, fixed publisher repository/workflow, exact successful main run/attempt,
main ancestry, both platform/config identities, both authoritative Syft
associations, and the final discovery read-back. Candidate attestations alone do
not establish release acceptance. Publisher fields cannot be supplied by dispatch.

The initial accepted release is bootstrapped by its immutable build-evidence
reference. Later successful publications are discovered through the publisher's
normal retained evidence. A tiny `frontend-monitored-release` artifact retains
only a lookup hint, refreshed by ordinary daily runs. Only artifacts from the
protected-main monitoring workflow are considered; pull-request hints are rejected.
After publisher-artifact expiry it can locate the same immutable evidence; its signatures and latest-run
binding are always checked again. The hint cannot authorize a release or silently
select an older publisher. Missing/expired lookup evidence fails closed. This
uses existing bounded Actions evidence, without a release database, registry
crawl or policy edit for each publication.

An optional manual `evidence-artifact` reference can select another genuinely
accepted release after the same verification. Historical incidents do not replace
the current monitored release. Verifying the current or a later accepted run can
refresh its lookup hint, including recovery after ordinary artifact expiry.
A failed later rerun cannot erase a previously accepted attempt.
The shared workflow consumes the verified Syft SPDX with pinned Grype and scans
the immutable platform independently with Trivy using fresh databases and
unchanged central policy. The caller preserves raw/normalized evidence for
14 days and fails its current CLEAN verdict on ACTIONABLE, REVIEW_REQUIRED,
UNKNOWN_STALE or missing evidence. Historical publication signatures are not
rewritten. Historical evidence retains the three BusyBox-family observations;
fresh admitted intelligence determines the current disposition independently.

Observation jobs use repository/package/attestation reads, plus Actions reads
for release lookup. Only the accepted shared workflow's isolated,
independently validated technical-issue triage job receives `issues: write`.
This records findings without production action authority. Rebuild, registry
publication, OIDC signing, deployment, exceptions and remediation remain with
their separately authorized owners.
