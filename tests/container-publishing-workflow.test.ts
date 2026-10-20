// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { load } from "js-yaml";

const repoRoot = process.cwd();
const readRepoFile = (name: string) =>
  readFileSync(path.join(repoRoot, name), "utf8");
// Workflow fixtures intentionally model structure; native CI supplies execution evidence.
type Job = {
  needs?: string | string[];
  permissions?: Record<string, string>;
  "runs-on"?: string;
  if?: string;
  strategy?: { matrix: { include: { arch: string; runner?: string }[] } };
  steps?: {
    name: string;
    run?: string;
    uses?: string;
    with?: Record<string, unknown>;
    if?: string;
  }[];
};
type Workflow = {
  on: unknown;
  permissions: Record<string, string>;
  jobs: Record<string, Job>;
};
const workflow = () =>
  load(readRepoFile(".github/workflows/publish-container.yml")) as Workflow;
const native = () =>
  load(readRepoFile(".github/workflows/frontend-container.yml")) as Workflow;

function requireAcceptance(w: Workflow) {
  expect(w.on).toEqual({ push: { branches: ["main"] } });
  expect(w.permissions).toEqual({});
  expect(w.jobs.build.needs).toEqual(["validate", "repository-security"]);
  expect(w.jobs.prepare.needs).toEqual(["build", "repository-security"]);
  expect(w.jobs.verify.needs).toEqual(["prepare", "attest"]);
  expect(w.jobs.scan.needs).toEqual(["prepare", "attest"]);
  expect(w.jobs.accept.needs).toEqual([
    "prepare",
    "attest",
    "verify",
    "scan",
    "repository-security",
  ]);
  for (const key of [
    "build",
    "prepare",
    "attest",
    "verify",
    "scan",
    "accept",
  ]) {
    expect(w.jobs[key].if).toBeUndefined();
    expect(w.jobs[key]).not.toHaveProperty("continue-on-error");
  }
  for (const key of ["attest", "accept"]) {
    expect(w.jobs[key].permissions).toEqual({
      contents: "read",
      packages: "write",
      attestations: "write",
      "id-token": "write",
    });
    const steps = w.jobs[key].steps!;
    expect(
      steps.find(
        (s) => s.name === "Admit exact job credential to pinned reader"
      )?.run
    ).toBe("python3 scripts/container-attestation-auth.py install");
    expect(
      steps.filter(
        (s) =>
          s.if === "always()" &&
          s.run?.includes("container-attestation-auth.py cleanup")
      )
    ).toHaveLength(1);
  }
  for (const key of ["scan", "verify"]) {
    expect(w.jobs[key].permissions?.packages).toBe("read");
    expect(w.jobs[key].permissions).not.toHaveProperty("id-token");
  }
}

describe("frontend native OCI publisher", () => {
  it("takes a pristine source snapshot before installing browser dependencies", () => {
    const steps = native().jobs["build-and-test"].steps!;
    const build = steps.findIndex(
      (s) => s.name === "Build exact source and execute native runtime smoke"
    );
    const dependencies = steps.findIndex(
      (s) => s.name === "Install dependencies"
    );
    const browser = steps.findIndex(
      (s) => s.name === "Exercise exact native image in Chromium"
    );
    const retain = steps.findIndex(
      (s) => s.name === "Retain exact native OCI and SBOM evidence"
    );
    expect(build).toBeGreaterThan(-1);
    expect(dependencies).toBeGreaterThan(build);
    expect(browser).toBeGreaterThan(dependencies);
    expect(retain).toBeGreaterThan(browser);
    expect(steps[browser].run).toContain("SECPAL_CONTAINER_IMAGE");
  });

  it("attempts each platform security evaluation independently without weakening acceptance", () => {
    expect(workflow().jobs.scan.strategy?.matrix.include).toEqual([
      { arch: "amd64" },
      { arch: "arm64" },
    ]);
    expect(readRepoFile(".github/workflows/publish-container.yml")).toContain(
      "fail-fast: false"
    );
  });
  it("builds with Buildah and binds pinned base inputs to the source snapshot", () => {
    const build = readRepoFile("scripts/build-container.sh");
    expect(build).toContain("buildah build --format oci");
    expect(build).toContain('--timestamp "$epoch"');
    expect(build).toContain('buildah pull --arch "$arch" "$reference"');
    expect(build).toContain('buildah inspect --type image "$reference"');
    expect(build).toContain("jq -er .FromImageDigest");
    expect(build).toContain('= "$expected"');
    expect(build).toContain("--pull=never");
    expect(build).toContain('--build-arg "SOURCE_DATE_EPOCH=$epoch"');
    expect(build).toContain("prepare-snapshot");
    expect(readRepoFile(".github/workflows/frontend-container.yml")).toContain(
      'cmp "$output/source.json" "$output/source-after.json"'
    );
  });

  it("gates publication and discovery on all independent accepted evidence", () =>
    requireAcceptance(workflow()));
  it.each(["build", "prepare", "verify", "scan", "accept"])(
    "rejects missing admission dependencies for %s",
    (job) => {
      const w = workflow();
      w.jobs[job].needs = [];
      expect(() => requireAcceptance(w)).toThrow();
    }
  );

  it("requires native AMD64/ARM64 builds and browser/runtime verification without PR publication authority", () => {
    const w = native();
    expect(w.permissions).toEqual({ contents: "read" });
    expect(w.jobs["build-and-test"].strategy?.matrix.include).toEqual([
      { arch: "amd64", runner: "ubuntu-24.04" },
      { arch: "arm64", runner: "ubuntu-24.04-arm" },
    ]);
    expect(w.jobs["container-contract"].needs).toEqual([
      "validate",
      "build-and-test",
    ]);
    expect(w.jobs["container-contract"].steps?.[0].run).toContain(
      'test "$NATIVE" = success'
    );
    const run = readRepoFile("scripts/publish-container.sh");
    for (const command of [
      "scripts/container-smoke.sh",
      "scripts/container-browser.sh",
    ]) {
      expect(run).toContain(command);
      expect(
        readRepoFile("scripts/build-container.sh") +
          readRepoFile(".github/workflows/frontend-container.yml")
      ).toContain(command);
    }
    expect(run).toContain('SECPAL_CONTAINER_IMAGE="$repository@$manifest"');
    expect(run).toContain('case "$arch:$(uname -m):${RUNNER_ARCH:-}"');
    expect(readRepoFile("scripts/build-container.sh")).toContain(
      "/proc/sys/fs/binfmt_misc/qemu-"
    );
    const matrix = workflow().jobs.verify.strategy?.matrix.include;
    expect(matrix).toEqual(w.jobs["build-and-test"].strategy?.matrix.include);
    for (const job of Object.values(w.jobs)) {
      expect(job.permissions?.packages).not.toBe("write");
      expect(job.permissions ?? {}).not.toHaveProperty("id-token");
    }
  });

  it("pins actions and reuses only accepted shared policy", () => {
    const policyRefs = new Set<string>();
    for (const file of [
      ".github/workflows/frontend-container.yml",
      ".github/workflows/publish-container.yml",
    ]) {
      const body = readRepoFile(file);
      for (const [, value] of body.matchAll(/uses:\s*([^\s]+)/gu)) {
        expect(value.startsWith("./") || /@[0-9a-f]{40}$/u.test(value)).toBe(
          true
        );
      }
      const { jobs } = load(body) as Workflow;
      const policySteps = Object.values(jobs)
        .flatMap((job) => job.steps ?? [])
        .filter((step) => step.with?.repository === "SecPal/.github");
      expect(policySteps.length).toBeGreaterThan(0);
      for (const step of policySteps) {
        const ref = String(step.with?.ref);
        expect(ref).toMatch(/^[0-9a-f]{40}$/u);
        policyRefs.add(ref);
      }
    }
    expect(policyRefs.size).toBe(1);
    const [policyRef] = policyRefs;
    const scanner = readRepoFile("scripts/scan-container-artifact.sh");
    expect(scanner).toContain(`--trusted-commit ${policyRef}`);
    expect(scanner).toContain("scan-grype");
    expect(scanner).toContain('--spdx "$output/sbom/syft.spdx.json"');
    expect(scanner).toContain(
      '"$tools/trivy" --config "$cache/config.yaml" image'
    );
    expect(scanner).toContain("policy['gate_state']!='CLEAN'");
  });

  it("uses the qualified attestation implementation for every published subject", () => {
    const checkouts = Object.values(native().jobs)
      .flatMap((job) => job.steps ?? [])
      .filter((step) => step.with?.repository === "actions/attest");
    expect(checkouts).toHaveLength(1);
    const ref = String(checkouts[0].with?.ref);
    expect(ref).toMatch(/^[0-9a-f]{40}$/u);

    const attestations = Object.values(workflow().jobs)
      .flatMap((job) => job.steps ?? [])
      .filter((step) => step.uses?.startsWith("actions/attest@"));
    expect(attestations.length).toBeGreaterThan(0);
    for (const step of attestations) {
      expect(step.uses).toBe(`actions/attest@${ref}`);
    }
  });

  it("publishes five exact attestations and keeps document attestation credential-free", () => {
    const w = workflow();
    const steps = w.jobs.attest.steps!;
    const attestations = steps.filter((s) =>
      s.uses?.startsWith("actions/attest@")
    );
    expect(attestations).toHaveLength(5);
    expect(attestations.map((s) => s.with?.["subject-digest"])).toEqual([
      "${{ needs.prepare.outputs.index_digest }}",
      "${{ needs.prepare.outputs.amd64_digest }}",
      "${{ needs.prepare.outputs.arm64_digest }}",
      "${{ needs.prepare.outputs.amd64_sbom_digest }}",
      "${{ needs.prepare.outputs.arm64_sbom_digest }}",
    ]);
    for (const s of attestations) {
      expect(s.with?.["subject-name"]).toBe("ghcr.io/secpal/frontend");
      expect(s.with?.["push-to-registry"]).toBe(true);
    }
    const final = w.jobs.accept.steps!;
    expect(
      final.findIndex(
        (s) => s.name === "Attest immutable build evidence document"
      )
    ).toBeLessThan(
      final.findIndex(
        (s) => s.name === "Authenticate exact package for evidence attestation"
      )
    );
    const script = readRepoFile("scripts/publish-container.sh");
    for (const binding of [
      "--bundle-from-oci",
      "--source-digest",
      "--signer-digest",
      "--deny-self-hosted-runners",
    ]) {
      expect(script).toContain(binding);
    }
    expect(script.match(/"\$tools\/oras" tag /gu)).toHaveLength(1);
    expect(script).toContain(
      'published_tag="build-$GITHUB_SHA-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"'
    );
    expect(script).toContain(
      'cmp "$prepared/index.json" "$prepared/discovery-index.json"'
    );
    expect(
      script.indexOf('verify_attestation "$evidence_digest"')
    ).toBeLessThan(script.indexOf('"$tools/oras" tag'));
    expect(script).not.toMatch(
      /oras.*(?:delete|cleanup)|:latest|continue-on-error/u
    );
  });

  it("keeps the hardened runtime and one explicit OCI-compatible health probe", () => {
    const smoke = readRepoFile("scripts/container-smoke.sh");
    expect(smoke).toContain("--health-cmd /usr/local/bin/secpal-health-live");
    expect(smoke).toContain('podman healthcheck run "$CONTAINER_A"');
    expect(smoke).toContain("--read-only");
    expect(smoke).toContain("--cap-drop=ALL");
    expect(smoke).toContain("command -v node");
    expect(smoke).toContain("command -v npm");
    expect(smoke).toContain(
      "permission denied|read-only file system|\\[emerg\\]"
    );
    expect(readRepoFile("Containerfile")).toContain(
      "COPY --chmod=0555 docker/health-live.sh"
    );
  });
});
describe("deterministic frontend build inventory", () => {
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

    secondPackageLock.packages[""].version += "-namespace-collision-test";

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
});
