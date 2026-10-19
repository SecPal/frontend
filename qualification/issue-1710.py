#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Disposable #1710 qualification only; never a publication or merge path."""
import collections
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys

if not __debug__:
    raise SystemExit("Qualification requires enabled invariant checks")

SOURCE = "12a29c5ebffa08ad25a5ab067e67600f239c86a8"
UPSTREAM = "docker.io/nginxinc/nginx-unprivileged@sha256:fe21747ebdea229a1dd6415362bf3ad626b70ec36ccffc19a9a3eb7af54a4f9e"
NODE = "docker.io/library/node@sha256:662933cf47f013bc8e4beb31a6116448427a82057ba7c42c97e4c5ba766504c2"
REGISTRY = "docker.io/library/registry@sha256:6c5666b861f3505b116bb9aa9b25175e71210414bd010d92035ff64018f9457e"
root = Path(os.environ["GITHUB_WORKSPACE"])
source = root / "source"
shared = root / "shared"
tools = Path(os.environ["RUNNER_TEMP"]) / "secpal-publisher-tools"
output = Path(os.environ["RUNNER_TEMP"]) / "qualification-output"
evaluation = Path(os.environ["RUNNER_TEMP"]) / "qualification-evaluation"
adapter = shared / "scripts/secpal-vulnerability-reevaluation.py"


def run(*args, **kwargs):
    return subprocess.run([str(a) for a in args], check=True, **kwargs)


def capture(*args):
    return subprocess.check_output([str(a) for a in args], text=True).strip()


def read(path):
    return json.loads(path.read_bytes())


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, sort_keys=True, indent=2) + "\n")


def digest(data):
    return "sha256:" + hashlib.sha256(data).hexdigest()


def api(*args):
    run(sys.executable, adapter, *args)


def inventory(path):
    return {
        p["name"]: p["versionInfo"]
        for p in read(path)["packages"]
        if any(r.get("referenceLocator", "").startswith("pkg:apk/")
               for r in p.get("externalRefs", []))
    }


def evidence(image):
    output.mkdir(parents=True, exist_ok=True)
    run("buildah", "push", image, "oci:" + str(output / "image") + ":qualification")
    layout = output / "image"
    manifest_digest = read(layout / "index.json")["manifests"][0]["digest"]
    manifest = (layout / "blobs/sha256" / manifest_digest[7:]).read_bytes()
    assert digest(manifest) == manifest_digest
    config_digest = json.loads(manifest)["config"]["digest"]
    config = (layout / "blobs/sha256" / config_digest[7:]).read_bytes()
    assert digest(config) == config_digest
    assert json.loads(config)["architecture"] == "arm64"
    (output / "manifest.json").write_bytes(manifest)
    (output / "config.json").write_bytes(config)
    subject = {"oci_digest": manifest_digest, "platform": "linux/arm64"}
    write(output / "subject.json", subject)
    run(tools / "syft", "scan", "oci-dir:" + str(layout), "--config",
        tools / "empty.yaml", "--source-name", "localhost/qualification-1710@" + manifest_digest,
        "--source-version", SOURCE, "--output", "spdx-json=" + str(output / "syft.spdx.json"))
    write(output / "association.json", {
        "schema_version": "1.0.0", "format": "SPDX", "subject": subject,
        "spdx_digest": digest((output / "syft.spdx.json").read_bytes())})
    api("verify-syft", "--platform-digest", manifest_digest, "--platform", "linux/arm64",
        "--spdx", output / "syft.spdx.json", "--association", output / "association.json",
        "--output", output / "syft.json")
    write(output / "native.json", {
        "source": SOURCE, "source_tree": capture("git", "-C", source, "rev-parse", "HEAD^{tree}"),
        "harness": os.environ["GITHUB_SHA"], "runner_arch": os.environ["RUNNER_ARCH"],
        "machine": platform.machine(), "builder": capture("buildah", "--version"),
        "podman": capture("podman", "--version"), "subject": subject,
        "run": os.environ["GITHUB_RUN_ID"], "attempt": os.environ["GITHUB_RUN_ATTEMPT"]})


def native(stage):
    assert platform.machine() == "aarch64" and os.environ["RUNNER_ARCH"] == "ARM64"
    assert capture("buildah", "--version").startswith("buildah version 1.33.7 ")
    assert capture("podman", "info", "--format", "{{.Host.Security.Rootless}}") == "true"
    assert capture("git", "-C", source, "rev-parse", "HEAD") == SOURCE
    image = "localhost/secpal-1710-" + stage + ":arm64"
    if stage == "base":
        output.mkdir(parents=True, exist_ok=True)
        run(tools / "syft", "scan", "registry:" + UPSTREAM, "--config", tools / "empty.yaml",
            "--output", "spdx-json=" + str(output / "upstream.spdx.json"))
        recipe = output / "Containerfile.qualification"
        recipe.write_text(
            "FROM " + UPSTREAM + "\nUSER 0\n"
            "RUN apk --no-cache --repositories-file /dev/null "
            "--repository https://dl-cdn.alpinelinux.org/alpine/v3.24/main "
            "add zlib=1.3.2-r1 curl=8.22.0-r0\n"
            'LABEL org.opencontainers.image.title="Disposable SecPal issue 1710 qualification"\n'
            "USER 101:101\n")
        run("buildah", "build", "--format", "oci", "--arch", "arm64", "--http-proxy=false", "--file", recipe,
            "--tag", image, output)
        evidence(image)
        before = inventory(output / "upstream.spdx.json")
        after = inventory(output / "syft.spdx.json")
        assert len(before) == 21 and len(after) == 30
        assert before["zlib"] == "1.3.2-r0" and after["zlib"] == "1.3.2-r1"
        assert all(after.get(k) == v for k, v in before.items() if k != "zlib")
        assert set(after) - set(before) == {
            "curl", "libcurl", "brotli-libs", "c-ares", "libidn2",
            "libpsl", "libunistring", "nghttp2-libs", "zstd-libs"}
        with (output / "linkage.log").open("wb") as log:
            run("podman", "run", "--rm", "--network", "none", "--read-only",
                "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
                "--entrypoint", "/bin/sh", image, "-ec",
                "id; uname -m; nginx -v; ldd /usr/sbin/nginx; "
                "apk --no-network info --who-owns /usr/lib/libz.so.1.3.2",
                stdout=log, stderr=subprocess.STDOUT)
    else:
        incoming = root / "input"
        manifest = read(incoming / "manifest.json")
        config = manifest["config"]["digest"]
        assert digest((incoming / "config.json").read_bytes()) == config
        assert read(incoming / "config.json")["architecture"] == "arm64"
        run("buildah", "pull", "oci:" + str(incoming / "image") + ":qualification")
        run("buildah", "pull", NODE)
        run("buildah", "build", "--format", "oci", "--timestamp", "1792431288",
            "--arch", "arm64", "--pull=never", "--http-proxy=false",
            "--build-arg", "NODE_IMAGE=" + NODE,
            "--build-arg", "NGINX_IMAGE=" + config[7:],
            "--build-arg", "SOURCE_DATE_EPOCH=1792431288",
            "--build-arg", "SECPAL_IMAGE_REVISION=" + SOURCE,
            "--build-arg", "SECPAL_IMAGE_VERSION=0.0.1-qualification-1710",
            "--file", source / "Containerfile", "--tag", image, source)
        evidence(image)
        env = dict(os.environ, SECPAL_CONTAINER_SKIP_BUILD="1",
                   SECPAL_CONTAINER_IMAGE=image, SECPAL_CONTAINER_PLATFORM="linux/arm64")
        run("bash", source / "scripts/container-smoke.sh", cwd=source, env=env)
        run("npm", "ci", "--foreground-scripts", cwd=source)
        run("npm", "exec", "--", "playwright", "install", "--with-deps", "chromium", cwd=source)
        run("bash", source / "scripts/container-browser.sh", cwd=source, env=env)
        assert not capture("git", "-C", source, "status", "--porcelain", "--untracked-files=no")
        write(output / "runtime.json", {"source": SOURCE, "native_arch": "arm64",
                                      "smoke": "PASS", "chromium_pwa": "PASS"})


def scan():
    incoming = root / "input"
    evaluation.mkdir(parents=True, exist_ok=True)
    (evaluation / "raw").mkdir()
    subject = read(incoming / "subject.json")
    assert digest((incoming / "manifest.json").read_bytes()) == subject["oci_digest"]
    assert read(incoming / "config.json")["architecture"] == "arm64"
    registry = capture("podman", "run", "--detach", "--rm", "--read-only", "--cap-drop", "ALL",
                       "--security-opt", "no-new-privileges", "--user", "10001:10001",
                       "--tmpfs", "/var/lib/registry:rw,nosuid,nodev,size=1g,mode=1777",
                       "--tmpfs", "/tmp:rw,noexec,nosuid,nodev,size=16m",
                       "--publish", "127.0.0.1::5000", REGISTRY)
    try:
        port = capture("podman", "port", registry, "5000").split(":")[1]
        repo = "127.0.0.1:" + port + "/qualification"
        run("skopeo", "copy", "--dest-tls-verify=false",
            "oci:" + str(incoming / "image") + ":qualification", "docker://" + repo + ":candidate")
        remote = subprocess.check_output([str(tools / "oras"), "manifest", "fetch",
                                          "--plain-http", repo + "@" + subject["oci_digest"]])
        assert remote == (incoming / "manifest.json").read_bytes()
        cache = Path(os.environ["RUNNER_TEMP"]) / "qualification-cache"
        cache.mkdir(); (cache / "config.yaml").write_text("{}\n")
        env = dict(os.environ, GRYPE_DB_CACHE_DIR=str(cache / "grype"),
                   GRYPE_CHECK_FOR_APP_UPDATE="false")
        run(tools / "grype", "--config", cache / "config.yaml", "db", "update", env=env)
        for flag in ["--download-db-only", "--download-java-db-only"]:
            run("env", "-i", "HOME=" + str(cache), tools / "trivy", "--config",
                cache / "config.yaml", "image", flag, "--cache-dir", cache / "trivy")
        for scanner, directory in [("trivy", "db"), ("trivy-java", "java-db")]:
            api("database", "--scanner", scanner, "--database-status",
                cache / "trivy" / directory / "metadata.json", "--database-root",
                cache / "trivy" / directory, "--output", evaluation / (scanner + "-database.json"))
        api("combine-databases", "--database", evaluation / "trivy-database.json",
            "--database", evaluation / "trivy-java-database.json",
            "--output", evaluation / "combined-database.json")
        api("scan-grype", "--archive", tools / "grype.tar.gz", "--spdx", incoming / "syft.spdx.json",
            "--association", incoming / "association.json", "--subject", incoming / "subject.json",
            "--database-root", cache / "grype", "--native", evaluation / "raw/grype.json",
            "--metadata", evaluation / "grype-metadata.json", "--provenance", evaluation / "grype-input.json")
        run("env", "-i", "HOME=" + str(cache), tools / "trivy", "--config", cache / "config.yaml",
            "image", "--scanners", "vuln", "--format", "json", "--show-suppressed",
            "--skip-db-update", "--skip-java-db-update", "--skip-check-update", "--skip-version-check",
            "--cache-dir", cache / "trivy", "--platform", "linux/arm64",
            "--ignorefile", shared / "policies/trivy-repository-scan-ignore-v1.yaml",
            "--output", evaluation / "raw/trivy.json", repo + "@" + subject["oci_digest"])
        completed = capture("date", "-u", "+%Y-%m-%dT%H:%M:%SZ")
        api("metadata", "--scanner", "trivy", "--database", evaluation / "combined-database.json",
            "--subject", incoming / "subject.json", "--version", "0.74.0",
            "--immutable-id", "sha256:2ae6fe3ee734b7fdf11335663e18c75ea12dccc76062f09f164a3b0f8be4371a",
            "--completed-at", completed, "--output", evaluation / "trivy-metadata.json")
        api("adapt", "--scanner", "grype", "--native", evaluation / "raw/grype.json",
            "--metadata", evaluation / "grype-metadata.json", "--provenance", evaluation / "grype-input.json",
            "--spdx", incoming / "syft.spdx.json", "--association", incoming / "association.json",
            "--output", evaluation / "grype-adapted.json")
        api("adapt", "--scanner", "trivy", "--native", evaluation / "raw/trivy.json",
            "--metadata", evaluation / "trivy-metadata.json", "--output", evaluation / "trivy-adapted.json")
        api("assemble", "--subject", incoming / "subject.json", "--syft", incoming / "syft.json",
            "--grype", evaluation / "grype-adapted.json", "--trivy", evaluation / "trivy-adapted.json",
            "--evaluated-at", completed, "--output", evaluation / "evaluation.json")
        with (evaluation / "policy-result.json").open("wb") as stream:
            run(sys.executable, shared / "scripts/secpal-vulnerability-policy.py",
                evaluation / "evaluation.json", "--policy",
                shared / "policies/vulnerability-triage-v1.json", stdout=stream)
        result = read(evaluation / "policy-result.json")
        print(json.dumps({"gate": result["gate_state"], "health": result["evidence_health"],
                          "counts": dict(collections.Counter(f["disposition"] for f in result["findings"]))}))
        assert result["gate_state"] == "CLEAN"
    finally:
        run("podman", "rm", "--force", registry)


if __name__ == "__main__":
    assert os.environ["GITHUB_REPOSITORY"] == "SecPal/frontend"
    assert os.environ["GITHUB_REF"] == "refs/heads/vivid-wasp"
    assert os.environ["GITHUB_EVENT_NAME"] == "push"
    if sys.argv[1] in ("base", "frontend"):
        native(sys.argv[1])
    elif sys.argv[1] == "scan":
        scan()
    else:
        raise SystemExit("Unsupported qualification stage")
