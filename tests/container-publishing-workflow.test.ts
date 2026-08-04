// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function countMatches(value: string, pattern: RegExp): number {
  return [...value.matchAll(pattern)].length;
}

function jobBlock(workflow: string, jobName: string): string {
  const lines = workflow.split("\n");
  const start = lines.findIndex((line) => line === `  ${jobName}:`);

  expect(start, `missing ${jobName} job`).toBeGreaterThanOrEqual(0);

  const nextJob = lines.findIndex(
    (line, index) => index > start && /^ {2}[a-z][a-z0-9_-]*:$/u.test(line)
  );

  return lines.slice(start, nextJob === -1 ? undefined : nextJob).join("\n");
}

function actionReferences(workflow: string): string[] {
  return [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s*#.*)?$/gmu)].map(
    ([, reference]) => reference
  );
}

function replaceRequired(
  value: string,
  searchValue: string,
  replacement: string
): string {
  expect(value).toContain(searchValue);
  return value.replace(searchValue, replacement);
}

function provenanceVerificationPolicy(workflow: string): string {
  const match = workflow.match(
    /--arg revision "\$GITHUB_SHA" '\n(?<policy>[^]*?)\n {14}'\n {10}done/u
  );

  expect(match?.groups?.policy).toBeDefined();
  return match!.groups!.policy!;
}

function evaluateProvenancePolicy(
  policy: string,
  resolvedDependencies: unknown[]
): ReturnType<typeof spawnSync> {
  const revision = "0123456789012345678901234567890123456789";
  const source = `https://github.com/SecPal/frontend.git#${revision}`;
  const provenance = {
    buildDefinition: {
      buildType:
        "https://github.com/moby/buildkit/blob/master/docs/attestations/slsa-definitions.md",
      resolvedDependencies,
    },
    runDetails: {
      metadata: {
        buildkit_completeness: {
          request: true,
          resolvedDependencies: true,
        },
      },
    },
  };

  return spawnSync(
    "jq",
    ["-e", "--arg", "source", source, "--arg", "revision", revision, policy],
    {
      encoding: "utf8",
      input: JSON.stringify(provenance),
    }
  );
}

function assertSecurityCriticalPolicy(workflow: string): void {
  expect(workflow).toMatch(/on:\n {2}push:\n {4}branches: \[main\](?:\n|$)/u);
  expect(workflow).not.toMatch(/pull_request:|workflow_dispatch:|schedule:/u);
  expect(workflow).toContain("permissions: {}");
  expect(workflow).toContain("CANONICAL_IMAGE: ghcr.io/secpal/frontend");
  expect(workflow).not.toMatch(
    /(?:inputs|vars)\.[A-Z0-9_]*(?:REGISTRY|IMAGE|REPOSITORY)|GHCR_HOST:|GHCR_REPOSITORY_PATH:/u
  );
  expect(workflow).not.toMatch(
    /docker\.io\/secpal\/frontend|CANONICAL_IMAGE:\s*secpal\/frontend|ghcr\.io\/secpal\/(?:web|pwa)/u
  );
  expect(
    countMatches(
      workflow,
      /build-\$\{GITHUB_SHA\}-\$\{GITHUB_RUN_ID\}-\$\{GITHUB_RUN_ATTEMPT\}/gu
    )
  ).toBe(2);
  expect(workflow).toContain("printf 'tag=build-%s-%s-%s\\n'");
  expect(workflow).toContain(
    'grep -Eq "^build-${GITHUB_SHA}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}$"'
  );
  expect(workflow).not.toMatch(
    /(?:^|[-_:/])latest(?:$|[-_:/])|refs\/heads\/\$\{\{|refs\/tags\/\$\{\{|sha-\$\{\{\s*github\.sha/u
  );
  expect(countMatches(workflow, /uses:\s+docker\/build-push-action@/gu)).toBe(
    1
  );
  expect(countMatches(workflow, /^\s*push:\s*true\s*$/gmu)).toBe(1);
  expect(countMatches(workflow, /^\s*tags:/gmu)).toBe(1);
  expect(workflow).toMatch(
    /^\s*tags: \$\{\{ env\.CANONICAL_IMAGE \}\}:\$\{\{ steps\.published_tag\.outputs\.tag \}\}\s*$/mu
  );
  expect(workflow).toContain("platforms: linux/amd64,linux/arm64");
  expect(workflow).toContain(
    "context: https://github.com/SecPal/frontend.git#${{ github.sha }}"
  );
  expect(workflow).toContain("SECPAL_IMAGE_REVISION=${{ github.sha }}");
  expect(workflow).toContain("SECPAL_IMAGE_VERSION=${{");
  expect(workflow).toContain("SOURCE_DATE_EPOCH=${{");
  expect(workflow).toContain(
    'source_epoch=$(git show -s --format=%ct "$GITHUB_SHA")'
  );
  expect(workflow).toMatch(
    /image_version=.*\$\{package_version\}\+git\.\$\{GITHUB_SHA\}/u
  );
  expect(workflow).toMatch(/sbom:\s*>-[^]*buildkit-syft-scanner[^@]*@sha256:/u);
  expect(workflow).toContain("provenance: mode=max");
  expect(workflow).toContain("pull: true");
  expect(workflow).toContain("no-cache: true");
  expect(workflow).not.toMatch(
    /cache-from:|imagetools\s+create|restore-cache/iu
  );
  expect(workflow).toContain(
    'byte_digest="sha256:$(sha256sum "$manifest_file" | awk \'{print $1}\')"'
  );
  expect(workflow).toContain("docker-content-digest:");
  expect(
    countMatches(workflow, /test "\$byte_digest" = "\$IMAGE_DIGEST"/gu)
  ).toBe(2);
  expect(workflow).toContain('test "$registry_digest" = "$IMAGE_DIGEST"');
  expect(workflow).toContain(
    '.mediaType == "application/vnd.oci.image.index.v1+json"'
  );
  expect(workflow).toContain('== ["linux/amd64", "linux/arm64"]');
  expect(workflow).toMatch(/attestation-manifest[^]*length\) == 2/u);
  expect(workflow).toContain("for platform in linux/amd64 linux/arm64; do");
  expect(workflow).toContain(
    '--arg source "https://github.com/SecPal/frontend.git#${GITHUB_SHA}"'
  );
  expect(workflow).toContain('.SPDXID == "SPDXRef-DOCUMENT"');
  expect(workflow).toContain("(.packages | length) > 0");
  expect(workflow).toContain("buildkit_completeness.request == true");
  expect(workflow).toContain(
    "buildkit_completeness.resolvedDependencies == true"
  );
  expect(workflow).toContain("subject-name: ${{ env.CANONICAL_IMAGE }}");
  expect(workflow).toContain(
    "subject-digest: ${{ needs.publish.outputs.image_digest }}"
  );
  expect(workflow).toContain(
    "--signer-workflow SecPal/frontend/.github/workflows/publish-container.yml"
  );
  expect(workflow).toContain('--signer-digest "$GITHUB_SHA"');
  expect(workflow).toContain("--source-ref refs/heads/main");
  expect(workflow).toContain('--source-digest "$GITHUB_SHA"');
  expect(countMatches(workflow, /--deny-self-hosted-runners/gu)).toBe(2);
  expect(workflow).not.toMatch(
    /curl[^\n]*(?:--request|-X)\s+(?:PUT|DELETE)|docker\s+manifest\s+push|docker\s+buildx\s+imagetools\s+create|promotion|promote|package\s+delete|manifest\s+delete/iu
  );
  expect(workflow).not.toMatch(
    /docker\s+(?:push|buildx\s+build)|podman\s+push|oras\s+push|crane\s+push|skopeo\s+copy|regctl\s+(?:image\s+copy|manifest\s+put)/iu
  );
}

describe("frontend container publishing workflow", () => {
  const workflow = readRepoFile(".github/workflows/publish-container.yml");
  const pullRequestWorkflow = readRepoFile(
    ".github/workflows/frontend-container.yml"
  );
  const dockerfile = readRepoFile("Dockerfile");
  const packageJson = readRepoFile("package.json");
  const smokeScript = readRepoFile("scripts/container-smoke.sh");
  const browserScript = readRepoFile("scripts/container-browser.sh");
  const readme = readRepoFile("README.md");
  const containerGuide = readRepoFile("docs/deployment/frontend-container.md");
  const changelog = readRepoFile("CHANGELOG.md");

  it("publishes only fresh run-scoped multi-architecture images from main", () => {
    assertSecurityCriticalPolicy(workflow);

    expect(workflow).toContain("name: Publish Container");
    expect(workflow).toContain(
      "group: publish-container-${{ github.repository }}-${{ github.sha }}"
    );
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain("runs-on: ubuntu-latest");
    expect(workflow).not.toMatch(
      /restore-cache|cache-from:|imagetools create/iu
    );

    const buildStep = workflow.match(
      /- name: Build and push run-scoped image[^]*?(?=\n\s{6}- name:|\n {2}[a-z])/u
    )?.[0];
    expect(buildStep).toBeDefined();
    expect(buildStep).toContain("push: true");
    expect(buildStep).toContain("pull: true");
    expect(buildStep).toContain("no-cache: true");
    expect(buildStep).toContain(
      "tags: ${{ env.CANONICAL_IMAGE }}:${{ steps.published_tag.outputs.tag }}"
    );
    expect(buildStep).not.toMatch(/cache-from:|load:\s*true/u);
  });

  it("uses empty top-level permissions and explicit least-privilege jobs", () => {
    expect(workflow).toMatch(/^permissions: \{\}$/mu);

    const validate = jobBlock(workflow, "validate");
    const publish = jobBlock(workflow, "publish");
    const verify = jobBlock(workflow, "verify");
    const attest = jobBlock(workflow, "attest");

    expect(validate).toMatch(/permissions:\n {6}contents: read/u);
    expect(validate).not.toMatch(/packages:|id-token:|attestations:/u);
    expect(publish).toMatch(
      /permissions:\n {6}contents: read\n {6}packages: write/u
    );
    expect(publish).not.toMatch(/id-token:|attestations:/u);
    expect(verify).toMatch(
      /permissions:\n {6}contents: read\n {6}packages: read/u
    );
    expect(verify).not.toMatch(/packages: write|id-token:|attestations:/u);
    expect(attest).toMatch(/contents: read/u);
    expect(attest).toMatch(/packages: write/u);
    expect(attest).toMatch(/id-token: write/u);
    expect(attest).toMatch(/attestations: write/u);

    for (const job of [validate, publish, verify, attest]) {
      expect(job).toMatch(/timeout-minutes: [1-9][0-9]*/u);
    }
  });

  it("validates before publishing, verifies before attesting, and exports canonical metadata", () => {
    expect(jobBlock(workflow, "publish")).toContain("needs: validate");
    expect(jobBlock(workflow, "verify")).toContain("needs: publish");
    expect(jobBlock(workflow, "attest")).toContain("needs: [publish, verify]");
    expect(workflow).toContain("name: Validate Frontend Image");
    expect(workflow).toContain("name: Publish Frontend Image");
    expect(workflow).toContain("name: Verify Published Frontend Image");
    expect(workflow).toContain("name: Attest Verified Frontend Image");

    for (const output of [
      "image_digest",
      "image_created",
      "image_version",
      "published_tag",
    ]) {
      expect(jobBlock(workflow, "publish")).toMatch(
        new RegExp(`^      ${output}:`, "mu")
      );
    }
  });

  it("checks out and validates the exact publishing commit without registry credentials", () => {
    const validate = jobBlock(workflow, "validate");

    expect(validate).toContain("ref: ${{ github.sha }}");
    expect(validate).toContain("persist-credentials: false");
    expect(validate).toContain('node-version: "22.22.2"');
    expect(validate).toContain("npm ci --foreground-scripts");
    expect(validate).toContain("tests/container-publishing-workflow.test.ts");
    expect(validate).toContain("tests/container-contract.test.ts");
    expect(validate).toMatch(/hadolint\/hadolint:[^@\s]+@sha256:/u);
    expect(validate).toMatch(/koalaman\/shellcheck:[^@\s]+@sha256:/u);
    expect(validate).not.toMatch(
      /docker\/login-action|GITHUB_TOKEN|packages:|services:/u
    );
  });

  it("pins every action and supply-chain tool to an immutable identity", () => {
    for (const reference of actionReferences(workflow)) {
      expect(reference).toMatch(/@[0-9a-f]{40}$/u);
    }

    expect(workflow).toContain("version: v0.36.0");
    expect(workflow).toMatch(/moby\/buildkit:[^@\s]+@sha256:[0-9a-f]{64}/u);
    expect(workflow).toMatch(/tonistiigi\/binfmt:[^@\s]+@sha256:[0-9a-f]{64}/u);
    expect(workflow).toMatch(
      /docker\/buildkit-syft-scanner:[^@\s]+@sha256:[0-9a-f]{64}/u
    );
  });

  it("verifies exact index bytes, platform metadata, SBOM, and provenance", () => {
    const verify = jobBlock(workflow, "verify");

    expect(verify).toContain("Accept: application/vnd.oci.image.index.v1+json");
    expect(verify).toContain("%{http_code}");
    expect(verify).toContain('test "$status" = 200');
    expect(
      countMatches(verify, /\.config\.Labels\["org\.opencontainers\.image\./gu)
    ).toBe(7);
    expect(verify).toContain('org.opencontainers.image.created"] == $created');
    expect(verify).toContain('org.opencontainers.image.version"] == $version');
    expect(verify).toContain(".digest.sha1 == $revision");
    expect(verify).not.toMatch(/\|\|\s*true|continue-on-error:\s*true/u);
  });

  it("rejects provenance containing any additional source revision", () => {
    const revision = "0123456789012345678901234567890123456789";
    const policy = provenanceVerificationPolicy(workflow);
    const expectedSource = {
      digest: { sha1: revision },
      uri: `https://github.com/SecPal/frontend.git#${revision}`,
    };
    const unrelatedBaseImage = {
      digest: { sha256: "a".repeat(64) },
      uri: "pkg:docker/nginxinc/nginx-unprivileged@1.30.4",
    };
    const unexpectedSource = {
      digest: { sha1: "f".repeat(40) },
      uri: `https://github.com/SecPal/frontend.git#${"f".repeat(40)}`,
    };

    const valid = evaluateProvenancePolicy(policy, [
      expectedSource,
      unrelatedBaseImage,
    ]);
    const additionalRevision = evaluateProvenancePolicy(policy, [
      expectedSource,
      unexpectedSource,
    ]);
    const wrongRevisionOnly = evaluateProvenancePolicy(policy, [
      unexpectedSource,
      unrelatedBaseImage,
    ]);

    expect(valid.error).toBeUndefined();
    expect(valid.status).toBe(0);
    expect(additionalRevision.status).not.toBe(0);
    expect(wrongRevisionOnly.status).not.toBe(0);
  });

  it("runs both runtime and Chromium contracts against the digest on exactly two platforms", () => {
    const verify = jobBlock(workflow, "verify");

    expect(verify).toContain('DIGEST_REF="${CANONICAL_IMAGE}@${IMAGE_DIGEST}"');
    expect(verify).toContain(
      'docker pull --platform "$platform" "$DIGEST_REF"'
    );
    expect(verify).toContain('SECPAL_CONTAINER_PLATFORM="$platform"');
    expect(verify).toContain("SECPAL_CONTAINER_SKIP_BUILD=1");
    expect(verify).toContain('SECPAL_CONTAINER_IMAGE="$DIGEST_REF"');
    expect(verify).toContain("npm run test:container");
    expect(verify).toContain("npm run test:e2e:container");

    for (const script of [smokeScript, browserScript]) {
      expect(script).toContain("SECPAL_CONTAINER_PLATFORM");
      expect(script).toContain(
        'PLATFORM_ARGS+=(--platform "$SECPAL_CONTAINER_PLATFORM")'
      );
      expect(script).not.toMatch(/docker\s+(?:rmi|image rm)/u);
    }
  });

  it("preserves the hardened static Web/PWA runtime contract", () => {
    expect(dockerfile).toContain("RUN npm run build:web");
    expect(dockerfile).toContain("USER 101:101");
    expect(dockerfile).toContain("ARG SECPAL_IMAGE_REVISION");
    expect(dockerfile).toContain("ARG SECPAL_IMAGE_VERSION");
    expect(dockerfile).toContain("ARG SOURCE_DATE_EPOCH");
    expect(countMatches(dockerfile, /^FROM node/gmu)).toBe(1);
    expect(dockerfile).toMatch(
      /^FROM nginxinc\/nginx-unprivileged:[^\n]+ AS runtime$/mu
    );
    expect(packageJson).toContain('"test:container"');
    expect(packageJson).toContain('"test:e2e:container"');
    expect(smokeScript).toContain("--read-only");
    expect(smokeScript).toContain("--cap-drop=ALL");
    expect(smokeScript).toContain("SECPAL_API_URL");
    expect(smokeScript).toContain("/health/live");
    expect(smokeScript).toContain("source maps");
    expect(smokeScript).toContain("command -v node");
    expect(smokeScript).toContain("command -v npm");
    expect(smokeScript).toContain("docker stop --time 10");
  });

  it("makes the embedded dependency SBOM reproducible from SOURCE_DATE_EPOCH", () => {
    const firstOutput = mkdtempSync(path.join(tmpdir(), "secpal-sbom-first-"));
    const secondOutput = mkdtempSync(
      path.join(tmpdir(), "secpal-sbom-second-")
    );
    const sourceDateEpoch = "1700000000";
    const env = { ...process.env, SOURCE_DATE_EPOCH: sourceDateEpoch };

    try {
      for (const outputDirectory of [firstOutput, secondOutput]) {
        execFileSync(
          process.execPath,
          ["scripts/generate-dependency-sbom.mjs", outputDirectory],
          { cwd: repoRoot, env, stdio: "pipe" }
        );
      }

      const firstSbom = readFileSync(
        path.join(firstOutput, "dependencies.spdx.json"),
        "utf8"
      );
      const secondSbom = readFileSync(
        path.join(secondOutput, "dependencies.spdx.json"),
        "utf8"
      );
      const parsedSbom = JSON.parse(firstSbom) as {
        creationInfo: { created: string };
        documentNamespace: string;
      };

      expect(firstSbom).toBe(secondSbom);
      expect(parsedSbom.creationInfo.created).toBe("2023-11-14T22:13:20.000Z");
      expect(parsedSbom.documentNamespace).toMatch(/-1700000000000$/u);
    } finally {
      rmSync(firstOutput, { recursive: true, force: true });
      rmSync(secondOutput, { recursive: true, force: true });
    }
  });

  it("rejects an invalid SOURCE_DATE_EPOCH instead of emitting misleading metadata", () => {
    const outputDirectory = mkdtempSync(
      path.join(tmpdir(), "secpal-sbom-invalid-")
    );

    try {
      expect(() =>
        execFileSync(
          process.execPath,
          ["scripts/generate-dependency-sbom.mjs", outputDirectory],
          {
            cwd: repoRoot,
            env: { ...process.env, SOURCE_DATE_EPOCH: "not-an-epoch" },
            stdio: "pipe",
          }
        )
      ).toThrow();
    } finally {
      rmSync(outputDirectory, { recursive: true, force: true });
    }
  });

  it("attests the exact digest with the required source and hosted-runner binding, then rechecks it", () => {
    const attest = jobBlock(workflow, "attest");
    const generateIndex = attest.indexOf(
      "Generate GitHub artifact attestation"
    );
    const initialVerificationIndex = attest.indexOf(
      "Verify selected GitHub artifact attestation"
    );
    const finalSnapshotIndex = attest.indexOf(
      "Verify final discovery snapshot and artifact attestation"
    );
    const summaryIndex = attest.indexOf("Record published image identity");

    expect(generateIndex).toBeGreaterThanOrEqual(0);
    expect(initialVerificationIndex).toBeGreaterThan(generateIndex);
    expect(finalSnapshotIndex).toBeGreaterThan(initialVerificationIndex);
    expect(summaryIndex).toBeGreaterThan(finalSnapshotIndex);
    expect(countMatches(attest, /gh attestation verify/gu)).toBe(2);
    expect(attest).toContain('test "$byte_digest" = "$IMAGE_DIGEST"');
    expect(attest).toContain('test "$registry_digest" = "$IMAGE_DIGEST"');
  });

  it("records both runtime manifest digests as non-canonical evidence", () => {
    const verify = jobBlock(workflow, "verify");
    const attest = jobBlock(workflow, "attest");

    expect(verify).toContain(
      "runtime_amd64_digest: ${{ steps.verify_image.outputs.amd64_digest }}"
    );
    expect(verify).toContain(
      "runtime_arm64_digest: ${{ steps.verify_image.outputs.arm64_digest }}"
    );
    expect(attest).toContain(
      "RUNTIME_AMD64_DIGEST: ${{ needs.verify.outputs.runtime_amd64_digest }}"
    );
    expect(attest).toContain(
      "RUNTIME_ARM64_DIGEST: ${{ needs.verify.outputs.runtime_arm64_digest }}"
    );
    expect(attest).toContain(
      "linux/amd64 runtime manifest digest (evidence only)"
    );
    expect(attest).toContain(
      "linux/arm64 runtime manifest digest (evidence only)"
    );
  });

  it("keeps registry writes structurally limited", () => {
    expect(countMatches(workflow, /^\s*push:\s*true\s*$/gmu)).toBe(1);
    expect(countMatches(workflow, /^\s*push-to-registry:\s*true\s*$/gmu)).toBe(
      1
    );
    expect(workflow).not.toMatch(
      /curl[^\n]*(?:--request|-X)\s+(?:PUT|DELETE)|docker\s+manifest\s+push|docker\s+buildx\s+imagetools\s+create|promotion|promote|delete-package-version/iu
    );
  });

  it("keeps pull-request container CI read-only and pins every changed action", () => {
    expect(pullRequestWorkflow).toMatch(
      /permissions:\n {2}contents: read(?:\n|$)/u
    );
    expect(pullRequestWorkflow).not.toMatch(
      /packages:\s*write|id-token:\s*write|attestations:\s*write|docker\/login-action|docker\s+push|registry.*secret/iu
    );
    for (const reference of actionReferences(pullRequestWorkflow)) {
      expect(reference).toMatch(/@[0-9a-f]{40}$/u);
    }
    expect(pullRequestWorkflow).toContain("npm run test:container");
    expect(pullRequestWorkflow).toContain("npm run test:e2e:container");
  });

  it("documents digest-only trust without claiming Phase C completion", () => {
    const documentation = `${readme}\n${containerGuide}\n${changelog}`;

    expect(documentation).toContain("ghcr.io/secpal/frontend");
    expect(documentation).toContain(
      "ghcr.io/secpal/frontend@sha256:<oci-index-digest>"
    );
    expect(documentation).toContain(
      "build-<source-sha>-<run-id>-<run-attempt>"
    );
    expect(documentation).toContain(
      "Frontend image publication is implemented but not yet operationally verified."
    );
    expect(documentation).toContain("Phase C remains in progress");
    expect(documentation).not.toMatch(
      /Phase C is complete|The frontend is deployed|SecPal is production-ready|Phase D is complete/u
    );
  });

  it.each([
    ["pull-request publishing", "on:\n  push:\n", "on:\n  pull_request:\n"],
    [
      "moving image tag",
      "build-${GITHUB_SHA}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}",
      "latest",
    ],
    ["wrong image identity", "ghcr.io/secpal/frontend", "ghcr.io/secpal/web"],
    [
      "registry host variable",
      "CANONICAL_IMAGE:",
      "GHCR_HOST: ghcr.io\n  CANONICAL_IMAGE:",
    ],
    [
      "registry reuse",
      "pull: true",
      "cache-from: type=registry\n          pull: true",
    ],
    ["build cache enabled", "no-cache: true", "no-cache: false"],
    [
      "single architecture",
      "platforms: linux/amd64,linux/arm64",
      "platforms: linux/amd64",
    ],
    [
      "unbound context",
      "https://github.com/SecPal/frontend.git#${{ github.sha }}",
      ".",
    ],
    ["disabled SBOM", "sbom: >-", "sbom: false #"],
    ["weak provenance", "provenance: mode=max", "provenance: mode=min"],
    [
      "missing index byte check",
      'test "$byte_digest" = "$IMAGE_DIGEST"',
      "true",
    ],
    [
      "wrong attestation subject",
      "subject-name: ${{ env.CANONICAL_IMAGE }}",
      "subject-name: secpal/frontend",
    ],
    [
      "self-hosted signer allowed",
      "--deny-self-hosted-runners",
      "--format json",
    ],
    [
      "raw manifest write",
      "set -euo pipefail",
      "curl -X PUT manifest\n          set -euo pipefail",
    ],
    [
      "additional branch tag",
      "tags: ${{ env.CANONICAL_IMAGE }}:${{ steps.published_tag.outputs.tag }}",
      "tags: ${{ env.CANONICAL_IMAGE }}:${{ steps.published_tag.outputs.tag }},${{ env.CANONICAL_IMAGE }}:main",
    ],
    [
      "additional release tag",
      "tags: ${{ env.CANONICAL_IMAGE }}:${{ steps.published_tag.outputs.tag }}",
      "tags: ${{ env.CANONICAL_IMAGE }}:${{ steps.published_tag.outputs.tag }},${{ env.CANONICAL_IMAGE }}:v0.0.1",
    ],
    [
      "additional stable source SHA tag",
      "tags: ${{ env.CANONICAL_IMAGE }}:${{ steps.published_tag.outputs.tag }}",
      "tags: ${{ env.CANONICAL_IMAGE }}:${{ steps.published_tag.outputs.tag }},${{ env.CANONICAL_IMAGE }}:${{ github.sha }}",
    ],
    [
      "shell docker push",
      "set -euo pipefail",
      'docker push "${CANONICAL_IMAGE}:${PUBLISHED_TAG}"\n          set -euo pipefail',
    ],
    [
      "ORAS registry push",
      "set -euo pipefail",
      'oras push "${CANONICAL_IMAGE}:${PUBLISHED_TAG}" artifact\n          set -euo pipefail',
    ],
    [
      "Skopeo registry copy",
      "set -euo pipefail",
      'skopeo copy source "docker://${CANONICAL_IMAGE}:${PUBLISHED_TAG}"\n          set -euo pipefail',
    ],
    [
      "custom Buildx push",
      "set -euo pipefail",
      "docker buildx build --push .\n          set -euo pipefail",
    ],
  ])("rejects the %s mutation", (_name, searchValue, replacement) => {
    const mutatedWorkflow = replaceRequired(workflow, searchValue, replacement);
    expect(() => assertSecurityCriticalPolicy(mutatedWorkflow)).toThrow();
  });
});
