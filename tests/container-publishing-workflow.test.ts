// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

function stepBlock(job: string, stepName: string): string {
  const lines = job.split("\n");
  const start = lines.findIndex((line) => line === `      - name: ${stepName}`);

  expect(start, `missing ${stepName} step`).toBeGreaterThanOrEqual(0);

  const nextStep = lines.findIndex(
    (line, index) => index > start && /^ {6}- name: /u.test(line)
  );

  return lines.slice(start, nextStep === -1 ? undefined : nextStep).join("\n");
}

function shellScript(step: string): string {
  const lines = step.split("\n");
  const run = lines.findIndex((line) => line === "        run: |");

  expect(run, "missing shell run block").toBeGreaterThanOrEqual(0);

  return lines
    .slice(run + 1)
    .map((line) => (line.startsWith("          ") ? line.slice(10) : line))
    .join("\n");
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

function removeRequiredStep(
  workflow: string,
  jobName: string,
  stepName: string
): string {
  return replaceRequired(
    workflow,
    stepBlock(jobBlock(workflow, jobName), stepName),
    ""
  );
}

function moveRequiredStepBefore(
  workflow: string,
  jobName: string,
  movedStepName: string,
  beforeStepName: string
): string {
  const job = jobBlock(workflow, jobName);
  const movedStep = stepBlock(job, movedStepName);
  const beforeStep = stepBlock(job, beforeStepName);
  const withoutMovedStep = replaceRequired(workflow, movedStep, "");

  return replaceRequired(
    withoutMovedStep,
    beforeStep,
    `${movedStep}${beforeStep}`
  );
}

function mutateRequiredStep(
  workflow: string,
  jobName: string,
  stepName: string,
  searchValue: string,
  replacement: string
): string {
  const currentStep = stepBlock(jobBlock(workflow, jobName), stepName);
  const mutatedStep = replaceRequired(currentStep, searchValue, replacement);

  return replaceRequired(workflow, currentStep, mutatedStep);
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
  resolvedDependencies: unknown[],
  jqExecutable = "jq"
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

  const result = spawnSync(
    jqExecutable,
    ["-e", "--arg", "source", source, "--arg", "revision", revision, policy],
    {
      encoding: "utf8",
      input: JSON.stringify(provenance),
    }
  );

  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("jq is required to evaluate the provenance policy", {
        cause: result.error,
      });
    }

    throw result.error;
  }

  return result;
}

function assertPlatformRuntimeVerificationPolicy(workflow: string): void {
  const verify = jobBlock(workflow, "verify");
  const verifyImage = stepBlock(
    verify,
    "Verify workflow-built digest and BuildKit attestations"
  );
  const runtime = stepBlock(
    verify,
    "Exercise both published runtime platforms"
  );
  const runtimeScript = shellScript(runtime).trimEnd();
  const attest = jobBlock(workflow, "attest");
  const generateAttestation = stepBlock(
    attest,
    "Generate GitHub artifact attestation"
  );
  const summary = stepBlock(attest, "Record published image identity");

  expect(verifyImage).toMatch(
    /select\(\(\.annotations\["vnd\.docker\.reference\.type"\] \/\/ ""\)\s*!= "attestation-manifest"\)/u
  );
  expect(verifyImage).toContain('select(.platform.os == "linux"');
  expect(verifyImage).toContain("and .platform.architecture == $architecture)");
  expect(verifyImage).toContain("| if length == 1 then .[0] else empty end");
  expect(verifyImage).toContain("amd64_digest=$(runtime_digest amd64)");
  expect(verifyImage).toContain("arm64_digest=$(runtime_digest arm64)");
  expect(verifyImage).toContain(
    "printf 'amd64_digest=%s\\n' \"$amd64_digest\""
  );
  expect(verifyImage).toContain(
    "printf 'arm64_digest=%s\\n' \"$arm64_digest\""
  );

  expect(runtime).toMatch(
    /^ {6}- name: Exercise both published runtime platforms\n {8}env:\n {10}RUNTIME_AMD64_DIGEST: \$\{\{ steps\.verify_image\.outputs\.amd64_digest \}\}\n {10}RUNTIME_ARM64_DIGEST: \$\{\{ steps\.verify_image\.outputs\.arm64_digest \}\}\n {8}run: \|$/mu
  );
  expect(countMatches(runtime, /^ {10}RUNTIME_AMD64_DIGEST:/gmu)).toBe(1);
  expect(countMatches(runtime, /^ {10}RUNTIME_ARM64_DIGEST:/gmu)).toBe(1);
  expect(runtimeScript).toBe(
    [
      "set -euo pipefail",
      "",
      `printf '%s\\n' "$RUNTIME_AMD64_DIGEST" |`,
      "  grep -Eq '^sha256:[0-9a-f]{64}$'",
      `printf '%s\\n' "$RUNTIME_ARM64_DIGEST" |`,
      "  grep -Eq '^sha256:[0-9a-f]{64}$'",
      "",
      "runtime_contracts=(",
      '  "linux/amd64|$RUNTIME_AMD64_DIGEST"',
      '  "linux/arm64|$RUNTIME_ARM64_DIGEST"',
      ")",
      "",
      'for contract in "${runtime_contracts[@]}"; do',
      "  platform=${contract%%|*}",
      "  runtime_digest=${contract#*|}",
      '  runtime_ref="${CANONICAL_IMAGE}@${runtime_digest}"',
      "",
      '  docker pull --platform "$platform" "$runtime_ref"',
      "",
      '  SECPAL_CONTAINER_PLATFORM="$platform" \\',
      "    SECPAL_CONTAINER_SKIP_BUILD=1 \\",
      '    SECPAL_CONTAINER_IMAGE="$runtime_ref" \\',
      "    npm run test:container",
      "",
      '  SECPAL_CONTAINER_PLATFORM="$platform" \\',
      "    SECPAL_CONTAINER_SKIP_BUILD=1 \\",
      '    SECPAL_CONTAINER_IMAGE="$runtime_ref" \\',
      "    npm run test:e2e:container",
      "done",
    ].join("\n")
  );
  expect(runtime).not.toContain("IMAGE_DIGEST");
  expect(runtime).not.toContain("PUBLISHED_TAG");
  expect(runtime).not.toMatch(
    /docker\s+(?:rmi|image rm)|continue-on-error:|\|\|\s*true/u
  );

  expect(generateAttestation).toContain(
    "subject-digest: ${{ needs.publish.outputs.image_digest }}"
  );
  expect(countMatches(generateAttestation, /^ {10}subject-digest:/gmu)).toBe(1);
  expect(generateAttestation).not.toMatch(/subject-digest:.*runtime_/iu);
  expect(summary).toContain(
    'printf -- "- Canonical digest: \\`%s@%s\\`\\n" "$CANONICAL_IMAGE" "$IMAGE_DIGEST"'
  );
  expect(countMatches(summary, /Canonical digest:/gu)).toBe(1);
  expect(summary).toContain(
    "linux/amd64 runtime manifest digest (evidence only)"
  );
  expect(summary).toContain(
    "linux/arm64 runtime manifest digest (evidence only)"
  );
  expect(summary).not.toMatch(/Canonical digest[^\n]*RUNTIME_/u);
}

function assertPinnedGitHubCliPolicy(workflow: string): void {
  const attest = jobBlock(workflow, "attest");
  const install = stepBlock(attest, "Install pinned GitHub CLI");
  const selectedVerification = stepBlock(
    attest,
    "Verify selected GitHub artifact attestation"
  );
  const finalVerification = stepBlock(
    attest,
    "Verify final discovery snapshot and artifact attestation"
  );
  const installCommands = shellScript(install);
  const officialArchiveUrl =
    "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_amd64.tar.gz";

  expect(install).toMatch(/^ {10}GH_VERSION: "2\.97\.0"$/mu);
  expect(install).toMatch(
    /^ {10}GH_LINUX_AMD64_SHA256: "a2c9b8497e1f85b1ad0dfcb78b5a622e098801b8e461e459e88e1ee12f018112"$/mu
  );
  expect(countMatches(attest, /^ {10}GH_VERSION:/gmu)).toBe(1);
  expect(countMatches(attest, /^ {10}GH_LINUX_AMD64_SHA256:/gmu)).toBe(1);
  expect(installCommands).toMatch(
    /^archive="\$RUNNER_TEMP\/gh_\$\{GH_VERSION\}_linux_amd64\.tar\.gz"$/mu
  );
  expect(installCommands).toMatch(
    /^extracted="\$RUNNER_TEMP\/gh_\$\{GH_VERSION\}_linux_amd64"$/mu
  );
  expect(installCommands).toMatch(/^install_dir="\$RUNNER_TEMP\/gh-bin"$/mu);
  expect(installCommands).toContain(
    [
      "curl --proto '=https' \\",
      "  --tlsv1.2 \\",
      "  --fail \\",
      "  --location \\",
      "  --silent \\",
      "  --show-error \\",
      `  "${officialArchiveUrl}" \\`,
      '  --output "$archive"',
    ].join("\n")
  );
  expect(
    countMatches(
      installCommands,
      /https:\/\/github\.com\/cli\/cli\/releases\/download\//gu
    )
  ).toBe(1);
  expect(installCommands).not.toMatch(/http:\/\//u);
  expect(installCommands).toMatch(
    /^printf '%s {2}%s\\n' "\$GH_LINUX_AMD64_SHA256" "\$archive" \|$/mu
  );
  expect(installCommands).toMatch(/^ {2}sha256sum --check --strict$/mu);
  expect(countMatches(installCommands, /sha256sum --check --strict/gu)).toBe(1);
  expect(installCommands).toMatch(/^ {2}--file "\$archive" \\$/mu);
  expect(installCommands).toMatch(/^ {2}--directory "\$RUNNER_TEMP" \\$/mu);
  expect(installCommands).toMatch(/^ {2}--no-same-owner$/mu);
  expect(installCommands).toMatch(/^install -d -m 0700 "\$install_dir"$/mu);
  expect(installCommands).toMatch(
    /^install -m 0755 "\$extracted\/bin\/gh" "\$install_dir\/gh"$/mu
  );
  expect(installCommands).toMatch(/^PINNED_GH="\$install_dir\/gh"$/mu);
  expect(installCommands).toMatch(
    /^printf '%s\\n' "\$install_dir" >> "\$GITHUB_PATH"$/mu
  );
  expect(installCommands).toMatch(
    /^printf 'PINNED_GH=%s\\n' "\$PINNED_GH" >> "\$GITHUB_ENV"$/mu
  );
  expect(installCommands).toMatch(
    /^actual_version=\$\("\$PINNED_GH" version \| head -n 1\)$/mu
  );
  expect(installCommands).toMatch(
    /^expected_version="gh version \$\{GH_VERSION\}"$/mu
  );
  expect(installCommands).toMatch(
    /^printf 'GitHub CLI version: %s\\n' "\$actual_version"$/mu
  );
  expect(installCommands).toMatch(/^case "\$actual_version" in$/mu);
  expect(installCommands).toMatch(
    /^ {2}"\$expected_version" \| "\$expected_version "\*\) ;;$/mu
  );
  expect(installCommands).toMatch(/^ {4}exit 1$/mu);
  expect(installCommands).toMatch(
    /^"\$PINNED_GH" attestation verify --help >\/dev\/null$/mu
  );

  for (const verification of [selectedVerification, finalVerification]) {
    expect(shellScript(verification)).toMatch(
      /^"\$PINNED_GH" attestation verify "oci:\/\/\$\{DIGEST_REF\}" \\$/mu
    );
  }

  expect(
    countMatches(
      attest,
      /"\$PINNED_GH" attestation verify "oci:\/\/\$\{DIGEST_REF\}"/gu
    )
  ).toBe(2);
  expect(countMatches(attest, /"\$PINNED_GH" attestation verify/gu)).toBe(3);
  expect(countMatches(attest, /attestation verify/gu)).toBe(3);
  expect(attest).not.toMatch(
    /command -v gh|\/usr\/bin\/gh|gh\s+\|\||\|\|\s*"\$PINNED_GH"|releases\/latest|apt.*install.*gh|brew.*install.*gh|snap.*install.*gh/iu
  );

  const installIndex = attest.indexOf(install);
  expect(installIndex).toBeGreaterThan(
    attest.indexOf("Checkout publishing commit")
  );
  expect(attest.indexOf(selectedVerification)).toBeGreaterThan(installIndex);
  expect(attest.indexOf(finalVerification)).toBeGreaterThan(installIndex);
}

function assertSecurityCriticalPolicy(workflow: string): void {
  assertPinnedGitHubCliPolicy(workflow);
  const buildStep = stepBlock(
    jobBlock(workflow, "publish"),
    "Build and push run-scoped image"
  );

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
  expect(countMatches(workflow, /^ {10}sbom:/gmu)).toBe(1);
  expect(buildStep).toMatch(
    /^ {10}sbom: >-\n {12}generator=docker\.io\/docker\/buildkit-syft-scanner:[^@\s]+@sha256:[0-9a-f]{64}$/mu
  );
  expect(countMatches(workflow, /^ {10}provenance:/gmu)).toBe(1);
  expect(buildStep).toMatch(/^ {10}provenance: mode=max,version=v1$/mu);
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

  it("installs and exclusively uses the reviewed GitHub CLI release", () => {
    assertPinnedGitHubCliPolicy(workflow);
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

  it("reports a clear error when jq is unavailable", () => {
    const temporaryDirectory = mkdtempSync(
      path.join(tmpdir(), "secpal-missing-jq-")
    );

    try {
      expect(() =>
        evaluateProvenancePolicy(
          "true",
          [],
          path.join(temporaryDirectory, "jq")
        )
      ).toThrowError("jq is required to evaluate the provenance policy");
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("binds both mandatory runtime and Chromium contracts to each verified platform manifest digest", () => {
    assertPlatformRuntimeVerificationPolicy(workflow);

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
      expect(parsedSbom.documentNamespace).toMatch(/-[0-9a-f]{64}$/u);
    } finally {
      rmSync(firstOutput, { recursive: true, force: true });
      rmSync(secondOutput, { recursive: true, force: true });
    }
  });

  it("treats an empty SOURCE_DATE_EPOCH build argument as unset", () => {
    const outputDirectory = mkdtempSync(
      path.join(tmpdir(), "secpal-sbom-empty-epoch-")
    );
    const earliestCreationTime = Date.now();

    try {
      execFileSync(
        process.execPath,
        ["scripts/generate-dependency-sbom.mjs", outputDirectory],
        {
          cwd: repoRoot,
          env: { ...process.env, SOURCE_DATE_EPOCH: "" },
          stdio: "pipe",
        }
      );

      const parsedSbom = JSON.parse(
        readFileSync(
          path.join(outputDirectory, "dependencies.spdx.json"),
          "utf8"
        )
      ) as { creationInfo: { created: string } };
      const latestCreationTime = Date.now();
      const creationTime = Date.parse(parsedSbom.creationInfo.created);

      expect(creationTime).toBeGreaterThanOrEqual(earliestCreationTime);
      expect(creationTime).toBeLessThanOrEqual(latestCreationTime);
    } finally {
      rmSync(outputDirectory, { recursive: true, force: true });
    }
  });

  it("uses different SPDX namespaces for different documents with the same creation time", () => {
    const firstProject = mkdtempSync(
      path.join(tmpdir(), "secpal-sbom-namespace-first-")
    );
    const secondProject = mkdtempSync(
      path.join(tmpdir(), "secpal-sbom-namespace-second-")
    );
    const sourceDateEpoch = "1700000000";
    const env = { ...process.env, SOURCE_DATE_EPOCH: sourceDateEpoch };
    const generator = path.join(
      repoRoot,
      "scripts",
      "generate-dependency-sbom.mjs"
    );
    const firstPackageLock = JSON.parse(readRepoFile("package-lock.json")) as {
      packages: Record<string, { version?: string }>;
    };
    const secondPackageLock = structuredClone(firstPackageLock);

    secondPackageLock.packages[""].version = "0.0.0-namespace-collision-test";

    try {
      for (const [project, packageLock] of [
        [firstProject, firstPackageLock],
        [secondProject, secondPackageLock],
      ] as const) {
        writeFileSync(
          path.join(project, "package-lock.json"),
          `${JSON.stringify(packageLock)}\n`
        );
        execFileSync(process.execPath, [generator], {
          cwd: project,
          env,
          stdio: "pipe",
        });
      }

      const firstSbom = JSON.parse(
        readFileSync(
          path.join(firstProject, "dist", "dependencies.spdx.json"),
          "utf8"
        )
      ) as { documentNamespace: string };
      const secondSbom = JSON.parse(
        readFileSync(
          path.join(secondProject, "dist", "dependencies.spdx.json"),
          "utf8"
        )
      ) as { documentNamespace: string };

      expect(firstSbom.documentNamespace).not.toBe(
        secondSbom.documentNamespace
      );
    } finally {
      rmSync(firstProject, { recursive: true, force: true });
      rmSync(secondProject, { recursive: true, force: true });
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
    expect(
      countMatches(
        attest,
        /"\$PINNED_GH" attestation verify "oci:\/\/\$\{DIGEST_REF\}"/gu
      )
    ).toBe(2);
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

  it("documents verified digest-only publication and completed Phase C rollout", () => {
    const documentation = `${readme}\n${containerGuide}\n${changelog}`;

    expect(documentation).toContain("ghcr.io/secpal/frontend");
    expect(documentation).toContain(
      "ghcr.io/secpal/frontend@sha256:<oci-index-digest>"
    );
    for (const document of [readme, containerGuide]) {
      expect(document).toContain(
        "build-<40-character-source-sha>-<run-id>-<run-attempt>"
      );
      expect(document).not.toContain(
        "build-<source-sha>-<run-id>-<run-attempt>"
      );
    }
    expect(documentation).toContain(
      "Frontend image publication is operationally verified."
    );
    expect(documentation).not.toContain(
      "Frontend image publication is implemented but not yet operationally verified."
    );
    for (const evidence of [
      "31247196734",
      "b755ca0d0ee5a85eca5ad5688d457241f070b1b4",
      "ghcr.io/secpal/frontend@sha256:cdccded2eade53d9300aafff3a2663a779d3d158cfa74f1e9c182e5786285077",
      "anonymous digest pull",
      "independent final",
      "SecPal/deployment#3",
      "SecPal/deployment#6",
    ]) {
      expect(documentation).toContain(evidence);
    }
    expect(documentation).toContain("Phase C is complete");
    expect(documentation).not.toContain("Digest consumption remains pending");
    expect(documentation).not.toContain("Phase C remains in progress");
    expect(containerGuide).toMatch(
      /Platform child manifest digests are runtime\s+verification evidence only/u
    );
    expect(containerGuide).not.toMatch(/\bruntime-\s+verification\b/u);
    expect(documentation).not.toMatch(
      /The frontend is deployed|SecPal is production-ready|Phase D is complete/u
    );
  });

  const platformRuntimeMutations: Array<[string, (value: string) => string]> = [
    [
      "amd64 using the OCI index digest",
      (value) =>
        mutateRequiredStep(
          value,
          "verify",
          "Exercise both published runtime platforms",
          '"linux/amd64|$RUNTIME_AMD64_DIGEST"',
          '"linux/amd64|$IMAGE_DIGEST"'
        ),
    ],
    [
      "arm64 using the OCI index digest",
      (value) =>
        mutateRequiredStep(
          value,
          "verify",
          "Exercise both published runtime platforms",
          '"linux/arm64|$RUNTIME_ARM64_DIGEST"',
          '"linux/arm64|$IMAGE_DIGEST"'
        ),
    ],
    [
      "both platforms using the amd64 digest",
      (value) =>
        mutateRequiredStep(
          value,
          "verify",
          "Exercise both published runtime platforms",
          '"linux/arm64|$RUNTIME_ARM64_DIGEST"',
          '"linux/arm64|$RUNTIME_AMD64_DIGEST"'
        ),
    ],
    [
      "both platforms using the arm64 digest",
      (value) =>
        mutateRequiredStep(
          value,
          "verify",
          "Exercise both published runtime platforms",
          '"linux/amd64|$RUNTIME_AMD64_DIGEST"',
          '"linux/amd64|$RUNTIME_ARM64_DIGEST"'
        ),
    ],
    [
      "swapped amd64 and arm64 digest mappings",
      (value) =>
        mutateRequiredStep(
          value,
          "verify",
          "Exercise both published runtime platforms",
          [
            '"linux/amd64|$RUNTIME_AMD64_DIGEST"',
            '            "linux/arm64|$RUNTIME_ARM64_DIGEST"',
          ].join("\n"),
          [
            '"linux/amd64|$RUNTIME_ARM64_DIGEST"',
            '            "linux/arm64|$RUNTIME_AMD64_DIGEST"',
          ].join("\n")
        ),
    ],
    [
      "arm64 container verification removed",
      (value) =>
        mutateRequiredStep(
          value,
          "verify",
          "Exercise both published runtime platforms",
          "    npm run test:container",
          [
            '    if [ "$platform" != "linux/arm64" ]; then',
            "      npm run test:container",
            "    fi",
          ].join("\n")
        ),
    ],
    [
      "arm64 Chromium verification removed",
      (value) =>
        mutateRequiredStep(
          value,
          "verify",
          "Exercise both published runtime platforms",
          "    npm run test:e2e:container",
          [
            '    if [ "$platform" != "linux/arm64" ]; then',
            "      npm run test:e2e:container",
            "    fi",
          ].join("\n")
        ),
    ],
    [
      "child-digest format validation removed",
      (value) =>
        mutateRequiredStep(
          value,
          "verify",
          "Exercise both published runtime platforms",
          [
            `          printf '%s\\n' "$RUNTIME_ARM64_DIGEST" |`,
            "            grep -Eq '^sha256:[0-9a-f]{64}$'",
          ].join("\n"),
          "          true # arm64 digest validation removed"
        ),
    ],
    [
      "runtime reference falling back to a tag",
      (value) =>
        mutateRequiredStep(
          value,
          "verify",
          "Exercise both published runtime platforms",
          'runtime_ref="${CANONICAL_IMAGE}@${runtime_digest}"',
          'runtime_ref="${CANONICAL_IMAGE}:${PUBLISHED_TAG}"'
        ),
    ],
    [
      "index digest replaced by a child digest in the attestation subject",
      (value) =>
        mutateRequiredStep(
          value,
          "attest",
          "Generate GitHub artifact attestation",
          "subject-digest: ${{ needs.publish.outputs.image_digest }}",
          "subject-digest: ${{ needs.verify.outputs.runtime_amd64_digest }}"
        ),
    ],
    [
      "index digest replaced by a child digest in the canonical summary",
      (value) =>
        mutateRequiredStep(
          value,
          "attest",
          "Record published image identity",
          '"$CANONICAL_IMAGE" "$IMAGE_DIGEST"',
          '"$CANONICAL_IMAGE" "$RUNTIME_ARM64_DIGEST"'
        ),
    ],
    [
      "Docker image removal introduced as an overwrite workaround",
      (value) =>
        mutateRequiredStep(
          value,
          "verify",
          "Exercise both published runtime platforms",
          "set -euo pipefail",
          'set -euo pipefail\ndocker image rm "${CANONICAL_IMAGE}@${IMAGE_DIGEST}"'
        ),
    ],
    [
      "pull failure ignored with || true",
      (value) =>
        mutateRequiredStep(
          value,
          "verify",
          "Exercise both published runtime platforms",
          'docker pull --platform "$platform" "$runtime_ref"',
          'docker pull --platform "$platform" "$runtime_ref" || true'
        ),
    ],
    [
      "runtime step made non-blocking",
      (value) =>
        mutateRequiredStep(
          value,
          "verify",
          "Exercise both published runtime platforms",
          "      - name: Exercise both published runtime platforms",
          [
            "      - name: Exercise both published runtime platforms",
            "        continue-on-error: true",
          ].join("\n")
        ),
    ],
  ];

  it.each(platformRuntimeMutations)(
    "rejects the %s mutation",
    (_name, mutateWorkflow) => {
      const mutatedWorkflow = mutateWorkflow(workflow);
      expect(() =>
        assertPlatformRuntimeVerificationPolicy(mutatedWorkflow)
      ).toThrow();
    }
  );

  it("rejects loading both platform selections under the same OCI index digest reference", () => {
    // A classic Docker image store cannot reliably load two platform selections under
    // the same OCI index digest reference in one job.
    const runtime = stepBlock(
      jobBlock(workflow, "verify"),
      "Exercise both published runtime platforms"
    );
    const historicalRuntimeStep = [
      "      - name: Exercise both published runtime platforms",
      "        env:",
      "          RUNTIME_AMD64_DIGEST: ${{ steps.verify_image.outputs.amd64_digest }}",
      "          RUNTIME_ARM64_DIGEST: ${{ steps.verify_image.outputs.arm64_digest }}",
      "        run: |",
      "          set -euo pipefail",
      "          for platform in linux/amd64 linux/arm64; do",
      '            docker pull --platform "$platform" \\',
      '              "${CANONICAL_IMAGE}@${IMAGE_DIGEST}"',
      '            SECPAL_CONTAINER_PLATFORM="$platform" \\',
      "              SECPAL_CONTAINER_SKIP_BUILD=1 \\",
      '              SECPAL_CONTAINER_IMAGE="${CANONICAL_IMAGE}@${IMAGE_DIGEST}" \\',
      "              npm run test:container",
      '            SECPAL_CONTAINER_PLATFORM="$platform" \\',
      "              SECPAL_CONTAINER_SKIP_BUILD=1 \\",
      '              SECPAL_CONTAINER_IMAGE="${CANONICAL_IMAGE}@${IMAGE_DIGEST}" \\',
      "              npm run test:e2e:container",
      "          done",
    ].join("\n");
    const mutatedWorkflow = replaceRequired(
      workflow,
      runtime,
      historicalRuntimeStep
    );

    expect(() =>
      assertPlatformRuntimeVerificationPolicy(mutatedWorkflow)
    ).toThrow();
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
    [
      "weak provenance",
      "provenance: mode=max,version=v1",
      "provenance: mode=min,version=v1",
    ],
    [
      "legacy provenance schema",
      "provenance: mode=max,version=v1",
      "provenance: mode=max,version=v0.2",
    ],
    [
      "duplicate overriding provenance",
      "provenance: mode=max,version=v1",
      [
        "provenance: mode=max,version=v1",
        "          provenance: mode=min,version=v0.2",
      ].join("\n"),
    ],
    [
      "duplicate overriding SBOM",
      "provenance: mode=max,version=v1",
      ["sbom: false", "          provenance: mode=max,version=v1"].join("\n"),
    ],
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

  const githubCliMutations: Array<[string, (value: string) => string]> = [
    [
      "missing GitHub CLI installation",
      (value) =>
        removeRequiredStep(value, "attest", "Install pinned GitHub CLI"),
    ],
    [
      "wrong GitHub CLI version",
      (value) =>
        replaceRequired(value, 'GH_VERSION: "2.97.0"', 'GH_VERSION: "2.96.0"'),
    ],
    [
      "wrong GitHub CLI checksum",
      (value) =>
        replaceRequired(
          value,
          "a2c9b8497e1f85b1ad0dfcb78b5a622e098801b8e461e459e88e1ee12f018112",
          "b".repeat(64)
        ),
    ],
    [
      "missing checksum verification",
      (value) =>
        replaceRequired(value, "sha256sum --check --strict", "cat >/dev/null"),
    ],
    [
      "non-strict checksum verification",
      (value) =>
        replaceRequired(
          value,
          "sha256sum --check --strict",
          "sha256sum --check"
        ),
    ],
    [
      "non-official GitHub CLI host",
      (value) =>
        replaceRequired(
          value,
          "https://github.com/cli/cli/releases/download/",
          "https://downloads.secpal.dev/cli/cli/releases/download/"
        ),
    ],
    [
      "insecure GitHub CLI download",
      (value) =>
        replaceRequired(
          value,
          "https://github.com/cli/cli/releases/download/",
          "http://github.com/cli/cli/releases/download/"
        ),
    ],
    [
      "divergent archive version",
      (value) =>
        replaceRequired(
          value,
          'gh_${GH_VERSION}_linux_amd64.tar.gz" \\',
          'gh_2.96.0_linux_amd64.tar.gz" \\'
        ),
    ],
    [
      "missing GITHUB_PATH update",
      (value) =>
        replaceRequired(
          value,
          'printf \'%s\\n\' "$install_dir" >> "$GITHUB_PATH"',
          "true # GITHUB_PATH update removed"
        ),
    ],
    [
      "missing version enforcement",
      (value) =>
        replaceRequired(
          value,
          'case "$actual_version" in',
          'case "$expected_version" in'
        ),
    ],
    [
      "runner GitHub CLI fallback",
      (value) =>
        replaceRequired(
          value,
          '"$PINNED_GH" attestation verify "oci://${DIGEST_REF}"',
          'gh attestation verify "oci://${DIGEST_REF}"'
        ),
    ],
    [
      "additional runner GitHub CLI verification",
      (value) =>
        replaceRequired(
          value,
          "      - name: Verify selected GitHub artifact attestation",
          [
            "      - name: Verify with runner GitHub CLI",
            '        run: gh attestation verify "oci://${CANONICAL_IMAGE}@${IMAGE_DIGEST}"',
            "",
            "      - name: Verify selected GitHub artifact attestation",
          ].join("\n")
        ),
    ],
    [
      "attestation verification before CLI installation",
      (value) =>
        moveRequiredStepBefore(
          value,
          "attest",
          "Verify selected GitHub artifact attestation",
          "Install pinned GitHub CLI"
        ),
    ],
  ];

  it.each(githubCliMutations)(
    "rejects the %s mutation",
    (_name, mutateWorkflow) => {
      const mutatedWorkflow = mutateWorkflow(workflow);
      expect(() => assertPinnedGitHubCliPolicy(mutatedWorkflow)).toThrow();
    }
  );
});
