// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
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
    env?: Record<string, string>;
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
const sourceOnlyPaths = [
  ".github/workflows/released-artifact-security.yml",
  ".github/workflows/daily-repository-security.yml",
  "tests/released-artifact-security-workflow.test.ts",
  "tests/daily-repository-security-workflow.test.ts",
];
const admissionPolicy = "scripts/frontend-publisher-admission.sh";
const legalMenuTest = "src/components/nav-legal.test.tsx";

function publicationAdmission(
  paths: readonly string[],
  options: {
    bootstrap?: boolean;
    before?: string;
    existingTest?: boolean;
    executableTest?: boolean;
    previousIgnore?: string;
  } = {}
) {
  const checkout = mkdtempSync(path.join(tmpdir(), "frontend-publication-"));
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", checkout, ...args], { encoding: "utf8" }).trim();
  try {
    git("init", "--quiet");
    git("config", "user.name", "Workflow Fixture");
    git("config", "user.email", "fixture@secpal.dev");
    if (!options.bootstrap) {
      mkdirSync(path.join(checkout, "scripts"));
      writeFileSync(
        path.join(checkout, admissionPolicy),
        readRepoFile(admissionPolicy)
      );
      git("add", "--", admissionPolicy);
    }
    if (options.existingTest) {
      mkdirSync(path.join(checkout, "src", "components"), { recursive: true });
      writeFileSync(path.join(checkout, legalMenuTest), "original\n");
      git("add", "--", legalMenuTest);
    }
    if (options.previousIgnore !== undefined) {
      writeFileSync(
        path.join(checkout, ".containerignore"),
        options.previousIgnore
      );
      git("add", "--", ".containerignore");
    }
    git("-c", "commit.gpgsign=false", "commit", "--allow-empty", "-qm", "base");
    const base = git("rev-parse", "HEAD");
    for (const name of paths) {
      const file = path.join(checkout, name);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, name === admissionPolicy ? "exit 0\n" : "changed\n");
      if (name === legalMenuTest && options.executableTest)
        chmodSync(file, 0o755);
      git("add", "--", name);
    }
    git("-c", "commit.gpgsign=false", "commit", "--allow-empty", "-qm", "push");
    const step = workflow().jobs.admit.steps!.find((s) => s.run)!;
    const result = spawnSync("bash", ["-eo", "pipefail", "-c", step.run!], {
      cwd: checkout,
      encoding: "utf8",
      env: {
        ...process.env,
        ...step.env,
        BEFORE: options.before ?? base,
        GITHUB_REPOSITORY: "SecPal/frontend",
        GITHUB_REF: "refs/heads/main",
        GITHUB_REF_PROTECTED: "true",
        GITHUB_SHA: git("rev-parse", "HEAD"),
        RUNNER_TEMP: checkout,
      },
    });
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    rmSync(checkout, { force: true, recursive: true });
  }
}

function requireAcceptance(w: Workflow) {
  expect(w.on).toEqual({
    push: { branches: ["main"], "paths-ignore": sourceOnlyPaths },
  });
  expect(w.permissions).toEqual({});
  expect(w.jobs.admit.permissions).toEqual({ contents: "read" });
  expect(w.jobs.admit.if).toBeUndefined();
  expect(w.jobs.admit.steps?.[0].with).toEqual({
    ref: "${{ github.sha }}",
    "fetch-depth": 0,
    "persist-credentials": false,
  });
  expect(w.jobs.validate.needs).toBe("admit");
  expect(w.jobs.build.needs).toEqual(["validate", "repository-security"]);
  expect(w.jobs["pre-registry"].needs).toEqual([
    "build",
    "repository-security",
  ]);
  expect(w.jobs["pre-registry"].permissions?.packages).toBeUndefined();
  expect(w.jobs.prepare.needs).toEqual([
    "build",
    "repository-security",
    "pre-registry",
  ]);
  const gate = w.jobs["pre-registry"];
  expect(gate.permissions).toEqual({
    contents: "read",
    attestations: "write",
    "id-token": "write",
  });
  const scan = gate.steps!.findIndex(
    (step) => step.run === "scripts/publish-container.sh qualify"
  );
  expect(scan).toBeGreaterThan(-1);
  expect(gate.steps![scan].if).toBeUndefined();
  expect(gate.steps![scan].env).toBeUndefined();
  const sign = gate.steps!.findIndex((step) =>
    step.uses?.startsWith("actions/attest@")
  );
  expect(sign).toBeGreaterThan(scan);
  expect(gate.steps![sign].if).toBeUndefined();
  expect(gate.steps![sign].with?.["push-to-registry"]).toBe(false);
  expect(gate.steps![sign].with?.["create-storage-record"]).toBe(false);
  expect(gate.steps![sign].with?.["subject-path"]).toBe(
    ".context/publisher/pre-registry.json"
  );
  const binding = gate.steps!.find(
    (step) => step.name === "Retain the signed qualification binding"
  );
  expect(binding?.if).toBeUndefined();
  expect(binding?.run).toContain('test -s "$BUNDLE"');
  expect(binding?.run).toContain(
    'cp -- "$BUNDLE" .context/publisher/pre-registry.bundle.json'
  );
  const writer = readRepoFile("scripts/publish-container.sh");
  expect(writer).toContain('cmp -- "$prepared/pre-registry.json" "$receipt"');
  expect(writer).toContain(
    '"$tools/gh" attestation verify "$receipt" --bundle "$bundle"'
  );
  expect(writer).toContain(
    '--signer-digest "$GITHUB_SHA" --source-ref refs/heads/main --source-digest "$GITHUB_SHA"'
  );
  expect(writer.indexOf('attestation verify "$receipt"')).toBeLessThan(
    writer.indexOf('"$native/image@$manifest" "$repository@$manifest"')
  );
  expect(
    w.jobs.prepare.steps!.find(
      (step) => step.run === "scripts/publish-container.sh prepare"
    )?.env?.PRE_REGISTRY_BINDING
  ).toBe("${{ needs.pre-registry.outputs.binding }}");
  const writerJobs = Object.entries(w.jobs)
    .filter(([, job]) => job.permissions?.packages === "write")
    .map(([name]) => name);
  expect(writerJobs).toEqual(["prepare", "attest", "accept"]);
  expect(w.jobs.verify.needs).toEqual(["prepare", "attest"]);
  expect(w.jobs.scan.needs).toEqual(["prepare", "attest"]);
  expect(w.jobs.accept.needs).toEqual([
    "prepare",
    "attest",
    "verify",
    "scan",
    "repository-security",
    "pre-registry",
  ]);
  for (const key of [
    "build",
    "pre-registry",
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
  it.each([
    ...sourceOnlyPaths.map((file) => [file, [file]] as const),
    ["both workflow and test paths", sourceOnlyPaths] as const,
  ])(
    "declines a source-only push for %s if GitHub starts the workflow",
    (_, files) => {
      expect(publicationAdmission(files)).toMatchObject({
        status: 1,
        output: expect.stringContaining("Source-only push"),
      });
    }
  );

  it.each([
    "src/App.tsx",
    "package-lock.json",
    "Containerfile",
    "tests/repository-security-workflow.test.ts",
    "unknown-path",
  ])("retains publication qualification for %s", (file) => {
    expect(publicationAdmission([file])).toMatchObject({ status: 0 });
    expect(publicationAdmission([sourceOnlyPaths[0], file])).toMatchObject({
      status: 0,
    });
  });

  it("declines release only for the exact already-excluded legal-menu test edit", () => {
    const exclusion = readRepoFile(".containerignore");
    expect(exclusion.trimEnd().split("\n").at(-1)).toBe(legalMenuTest);
    expect(
      publicationAdmission([legalMenuTest], {
        existingTest: true,
        previousIgnore: exclusion,
      })
    ).toMatchObject({
      status: 1,
      output: expect.stringContaining("Source-only legal-menu test change"),
    });
  });

  it.each([
    "src/App.tsx",
    "package-lock.json",
    ".containerignore",
    sourceOnlyPaths[0],
  ])(
    "uses full release qualification when the legal-menu test also changes with %s",
    (other) => {
      expect(
        publicationAdmission([legalMenuTest, other], {
          existingTest: true,
          previousIgnore: legalMenuTest + "\n",
        })
      ).toMatchObject({ status: 0 });
    }
  );

  it("requires an existing regular test and the exact effective protected-base exclusion", () => {
    for (const options of [
      { existingTest: true },
      { existingTest: true, previousIgnore: "src/components/*.test.tsx\n" },
      { existingTest: true, previousIgnore: legalMenuTest + "\n!src/**\n" },
      { existingTest: false, previousIgnore: legalMenuTest + "\n" },
      {
        existingTest: true,
        executableTest: true,
        previousIgnore: legalMenuTest + "\n",
      },
    ]) {
      expect(publicationAdmission([legalMenuTest], options)).toMatchObject({
        status: 0,
      });
    }
  });

  it("blocks first installation when the protected predecessor lacks admission authority", () => {
    expect(
      publicationAdmission([admissionPolicy], { bootstrap: true })
    ).toMatchObject({
      status: 1,
      output: expect.stringContaining("Protected predecessor lacks"),
    });
  });

  it.each([
    admissionPolicy,
    ".github/workflows/publish-container.yml",
    ".github/workflows/frontend-container.yml",
    ".github/workflows/reusable-repository-security.yml",
    "scripts/publish-container.sh",
    "scripts/scan-container-artifact.sh",
  ])(
    "rejects candidate-controlled authority changes in %s before release",
    (file) => {
      expect(publicationAdmission([file, "package-lock.json"])).toMatchObject({
        status: 1,
        output: expect.stringContaining("Publisher authority changed"),
      });
    }
  );

  it.each(["", "main", "0".repeat(40), "1".repeat(40)])(
    "fails closed for unavailable push predecessor %j",
    (before) => {
      expect(
        publicationAdmission(["package-lock.json"], { before })
      ).toMatchObject({
        status: 1,
        output: expect.stringContaining("Cannot authenticate"),
      });
    }
  );

  it("fails closed when the authenticated push has no changed paths", () => {
    expect(publicationAdmission([])).toMatchObject({
      status: 1,
      output: expect.stringContaining("No changed paths"),
    });
  });
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
  it.each(["build", "pre-registry", "prepare", "verify", "scan", "accept"])(
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
    const sourceSecurity = load(
      readRepoFile(".github/workflows/reusable-repository-security.yml")
    ) as Workflow;
    const scanAction = sourceSecurity.jobs["repository-security"].steps!.find(
      (step) =>
        step.uses?.startsWith(
          "SecPal/.github/.github/actions/trivy-repository-scan@"
        )
    );
    expect(scanAction?.uses?.split("@")[1]).toMatch(/^[0-9a-f]{40}$/u);
    const scanner = readRepoFile("scripts/scan-container-artifact.sh");
    expect(scanner).toContain(`--trusted-commit ${policyRef}`);
    expect(scanner).toContain("scan-grype");
    expect(scanner).toContain('--spdx "$output/sbom/syft.spdx.json"');
    expect(scanner).toContain(
      '"$tools/trivy" --config "$cache/config.yaml" image'
    );
    expect(scanner).toContain('python3 - "$output" "$arch" "$mode"');
    expect(scanner).toContain("if sys.argv[3] == '--unpublished' else ('CLEAN',)");
    expect(scanner).toContain("policy['gate_state'] not in allowed");
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
