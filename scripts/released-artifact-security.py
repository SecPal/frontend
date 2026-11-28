#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Read-only released-subject selection; scanners and policy stay in SecPal/.github."""
import argparse
from datetime import datetime
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import zipfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = "SecPal/frontend"
WORKFLOW = ".github/workflows/publish-container.yml"
BASELINE = "ghcr.io/secpal/frontend@sha256:aa83f4bc3d18a4bfae25bfc7b0ccfdb538f547eabd4cbca3d21115f83ea5555e"
HINT = "frontend-monitored-release"
EVIDENCE_FILES = {"build-evidence.json", "source-security.json", "build-evidence.bundle.json"}
RISK_FILES = {"risk-admission.json", "risk-evidence.json"}
ACCEPT_JOB = "Accept verified Frontend publication"
# Exact signed publisher evidence for independently supported consumers.
# Demo observed by the operator on 2026-11-10; deployment is a source contract,
# not an assertion that the newest image has been activated on that host.
CONSUMERS = {
    "demo": "ghcr.io/secpal/frontend@sha256:2852385add73f5f075ac8aea319970722f1a6454b0aa273fcb78e66cd0466410",
    "deployment": "ghcr.io/secpal/frontend@sha256:27cc637c5fc799d237ea640da0fdf27aa86021025ad648aeed3399b911bb1e34",
}
SCHEDULES = {
    "17 3 * * *": ("latest", "linux/amd64"),
    "37 3 * * *": ("latest", "linux/arm64"),
    "17 4 * * *": ("demo", "linux/amd64"),
    "37 4 * * *": ("demo", "linux/arm64"),
    "17 6 * * *": ("deployment", "linux/amd64"),
    "37 6 * * *": ("deployment", "linux/arm64"),
}


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    sys.modules[name] = value
    spec.loader.exec_module(value)
    return value


publisher = module("frontend_publisher", ROOT / "scripts/container-publisher.py")


def reference_digest(reference):
    if type(reference) is not str or not reference.startswith(publisher.REPOSITORY + "@"):
        raise ValueError("release-reference")
    digest = reference.removeprefix(publisher.REPOSITORY + "@")
    publisher.attestation_filename(digest)
    return digest


def selected_platform(event, schedule, requested):
    if event == "schedule":
        if schedule in SCHEDULES and not requested:
            return SCHEDULES[schedule][1]
    elif event == "workflow_dispatch" and requested in publisher.PLATFORMS and not schedule:
        return requested
    raise ValueError("release-platform-selection")


def selected_reference(event, schedule, consumer, reference):
    if event == "schedule":
        if schedule not in SCHEDULES or consumer or reference:
            raise ValueError("release-consumer-selection")
        consumer = SCHEDULES[schedule][0]
    elif event != "workflow_dispatch" or schedule:
        raise ValueError("release-consumer-selection")
    consumer = consumer or "latest"
    if consumer == "latest":
        return consumer, reference
    if consumer not in CONSUMERS or reference:
        raise ValueError("release-consumer-selection")
    return consumer, CONSUMERS[consumer]


def admit_retained(document, files, policy):
    """Check historical publication evidence using the writer's signed receipt."""
    receipt = json.loads(files["risk-admission.json"])
    evidence = json.loads(files["risk-evidence.json"])
    scope, rows = policy._risk_subject(evidence)
    source = {"repository": REPOSITORY, "commit": document["source"]["commit"]}
    extension = document["extensions"][publisher.SOURCE]
    producer = evidence["evidence"]["producer"]
    subjects = document["subject"]["platforms"]
    decision = receipt["decision"]
    if (extension != {
            **{key: extension[key] for key in ("source_security_sha256", "reproducibility")},
            "qualification_producer": producer,
            "artifact_security_admission_sha256": publisher.digest(files["risk-admission.json"]),
        }
            or receipt["admission"] != "ADMITTED_WITH_KNOWN_FINDINGS"
            or receipt["source"] != evidence["source"] or evidence["source"] != source
            or producer["repository"] != REPOSITORY or producer["workflow"] != WORKFLOW
            or producer["source_commit"] != source["commit"]
            or producer["run_id"] == document["workflow"]["run_id"]
            or not all(re.fullmatch(r"[1-9][0-9]{0,19}", producer[key]) for key in ("run_id", "run_attempt"))
            or receipt["operator"]["permission"] != "admin"
            or receipt["comment"]["url"] != (
                f"https://github.com/{REPOSITORY}/issues/2322#issuecomment-{int(receipt['comment']['id'])}")
            or receipt["evidence_sha256"] != policy._document_digest(evidence)
            or evidence["evidence"]["source_security_sha256"] != publisher.digest(files["source-security.json"])
            or receipt["index_digest"] != scope["index_digest"]
            or scope != {"index_digest": document["subject"]["index_digest"],
                         "platforms": {s["platform"]: s["manifest_digest"] for s in subjects}}
            or any(decision[key] != value for key, value in {
                **scope, "repository": REPOSITORY, "source_commit": source["commit"],
                "evidence_sha256": receipt["evidence_sha256"], "expires_at": receipt["expires_at"],
            }.items())
            or decision["accept"] is not True):
        raise ValueError("release-retained-admission")
    approved = publisher.evidence_time(receipt["comment"]["created_at"])
    complete = publisher.evidence_time(document["generated_at"])
    expires = publisher.evidence_time(receipt["expires_at"])
    states, associations = {}, {}
    for row, result in zip(rows, receipt["policy_results"], strict=True):
        platform, target = (row["evaluation"]["subject"][key] for key in ("platform", "oci_digest"))
        subject, = [s for s in subjects if s["platform"] == platform]
        sbom, = [s for s in document["sboms"] if s["platform"] == platform]
        scans = {scan["scanner"]: scan["evidence_sha256"] for scan in document["scans"] if scan["platform"] == platform}
        state = result["gate_state"]
        if (row["config_digest"] != subject["config_digest"]
                or row["evaluation"]["syft"]["spdx_digest"] != sbom["spdx_sha256"]
                or row["raw"] != scans
                or result["subject"] != row["evaluation"]["subject"]
                or state not in {"CLEAN", "ACTIONABLE", "REVIEW_REQUIRED"}
                or result["evidence_health"]["state"] != "HEALTHY"
                or not approved <= publisher.evidence_time(result["evaluated_at"]) <= complete < expires
                or row["policy_result_sha256"] != policy._document_digest(
                    dict(result, evaluated_at=row["evaluation"]["evaluated_at"]))):
            raise ValueError("release-retained-findings")
        states[target] = state
        associations[platform] = row["spdx_association_sha256"]
    return producer, states, associations


def admit_document(document, security, run, reference=None, retained=None):
    source, workflow = document["source"], document["workflow"]
    if (source["repository"] != publisher.SOURCE
            or not re.fullmatch(r"[0-9a-f]{40}", source["commit"])
            or run["head_repository"]["full_name"] != REPOSITORY
            or run["head_sha"] != source["commit"]
            or run["event"] != ("workflow_dispatch" if retained else "push")
            or run["head_branch"] != "main" or run["path"] not in (WORKFLOW, WORKFLOW + "@main")
            or run["status"] != "completed" or run["conclusion"] != "success"
            or workflow != dict(repository=REPOSITORY, path=WORKFLOW, commit=source["commit"],
                                run_id=str(run["id"]), run_attempt=str(run["run_attempt"]))):
        raise ValueError("release-publisher-identity")
    producer, states = retained[:2] if retained else (workflow, None)
    records = [
        dict(source=source, subject=subject, builder=document["builder"],
             bases=[base for base in document["bases"] if base["platform"] == subject["platform"]],
             runner_architecture=subject["platform"].split("/")[1],
             workflow_run_id=producer["run_id"], workflow_run_attempt=producer["run_attempt"])
        for subject in document["subject"]["platforms"]
    ]
    # The source is trusted only after both signed evidence forms and the
    # protected-main publisher execution have been independently verified.
    rebuilt = publisher.build_evidence(
        records, document["subject"]["index_digest"], document["sboms"], document["scans"],
        document["smoke_tests"], security, workflow["run_id"], workflow["run_attempt"],
        document["generated_at"], expected_source=source,
        build_origin=(producer["run_id"], producer["run_attempt"]), risk_states=states,
        # This exact, already signed October publication used the v4 producer.
        # New publishers and every other release still require the v5 contract.
        source_security_schema=("secpal-trivy-repository-scan-v4"
                                if reference == CONSUMERS["demo"]
                                else "secpal-trivy-repository-scan-v5"))
    if retained:
        rebuilt["extensions"][publisher.SOURCE].update(
            qualification_producer=producer,
            artifact_security_admission_sha256=document["extensions"][publisher.SOURCE]["artifact_security_admission_sha256"],
        )
    if document != rebuilt:
        raise ValueError("release-build-evidence")
    return records


def verified_invocation(results, digest, workflow):
    invocation = (f"https://github.com/{REPOSITORY}/actions/runs/"
                  f"{workflow['run_id']}/attempts/{workflow['run_attempt']}")
    return any(
        result["verificationResult"]["statement"]["predicate"]["runDetails"]["metadata"]["invocationId"] == invocation
        and any(subject["digest"].get("sha256") == digest.removeprefix("sha256:")
                for subject in result["verificationResult"]["statement"]["subject"])
        for result in results)


class ReleaseReader:
    """The fixed frontend transport, not a registry or credential broker."""

    def __init__(self, tools, shared, output, registry_config):
        self.tools, self.shared, self.output = Path(tools), shared, Path(output)
        self.registry_config = registry_config

    def command(self, name, *arguments):
        return publisher.run([str(self.tools / name), *arguments])

    def api(self, endpoint):
        return json.loads(self.command("gh", "api", f"repos/{REPOSITORY}/" + endpoint))

    def artifacts(self, name):
        # Names are internal constants or validated numeric run identities.
        return [a for a in self.api(f"actions/artifacts?name={name}&per_page=10")["artifacts"]
                if a["name"] == name and not a["expired"]]

    def archive_member(self, artifact, name):
        raw = self.command("gh", "api", f"repos/{REPOSITORY}/actions/artifacts/{int(artifact['id'])}/zip")
        if publisher.digest(raw) != artifact["digest"]:
            raise ValueError("release-artifact-digest")
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            if archive.namelist().count(name) != 1:
                raise ValueError("release-artifact-member")
            info = archive.getinfo(name)
            if info.file_size > 1024 * 1024 or stat.S_ISLNK(info.external_attr >> 16):
                raise ValueError("release-artifact-member")
            # Never extract archive paths, including other untrusted members.
            return archive.read(info)

    def latest_publisher(self):
        runs = self.api("actions/workflows/publish-container.yml/runs?branch=main&event=push&status=success&per_page=1")["workflow_runs"]
        previous = runs[0] if runs else None
        query = "actions/workflows/publish-container.yml/runs?branch=main&event=workflow_dispatch&status=success&per_page=30"
        for page in range(1, 35):
            dispatched = self.api(f"{query}&page={page}")["workflow_runs"]
            for run in dispatched:
                if previous and self.publication_order(run) <= self.publication_order(previous):
                    return previous
                if self.accepted_dispatch(run):
                    return run
            if len(dispatched) < 30:
                if previous:
                    return previous
                break
        raise ValueError("release-publisher-unavailable")

    def accepted_dispatch(self, run):
        if (run["event"] != "workflow_dispatch" or run["head_repository"]["full_name"] != REPOSITORY
                or run["head_branch"] != "main" or run["path"] not in (WORKFLOW, WORKFLOW + "@main")
                or run["status"] != "completed" or run["conclusion"] != "success"):
            raise ValueError("release-dispatched-publisher")
        page = self.api(f"actions/runs/{int(run['id'])}/attempts/{int(run['run_attempt'])}/jobs?per_page=100")
        matches = [job for job in page["jobs"] if job["name"] == ACCEPT_JOB]
        if (page["total_count"] != len(page["jobs"]) or len(matches) != 1):
            raise ValueError("release-final-job")
        job = matches[0]
        if (job["run_id"], job["run_attempt"], job["head_sha"], job["status"]) != (
                run["id"], run["run_attempt"], run["head_sha"], "completed"):
            raise ValueError("release-final-job-binding")
        if job["conclusion"] not in {"success", "skipped"}:
            raise ValueError("release-final-job-outcome")
        return job["conclusion"] == "success"

    def scheduled_reference(self, latest):
        name = f"frontend-accepted-{int(latest['id'])}-{int(latest['run_attempt'])}"
        artifacts = self.artifacts(name)
        if len(artifacts) > 1:
            raise ValueError("release-artifact-ambiguous")
        if artifacts:
            if artifacts[0]["workflow_run"]["id"] != latest["id"]:
                raise ValueError("release-artifact-run")
            # Hash the actual exported bytes, not a reserialized representation.
            digest = publisher.digest(self.archive_member(artifacts[0], "build-evidence-manifest.json"))
            return publisher.REPOSITORY + "@" + digest
        if latest["event"] == "workflow_dispatch":
            raise ValueError("release-retained-export-unavailable")
        return BASELINE

    @staticmethod
    def publication_order(run):
        return int(run["id"]), int(run["run_attempt"])

    def select(self, platform, requested):
        if requested:
            reference_digest(requested)
        latest = self.latest_publisher()
        hints = []
        for artifact in self.artifacts(HINT):
            # Artifact creation bounds observation even when an older monitor is rerun.
            if (datetime.strptime(artifact["created_at"], "%Y-%m-%dT%H:%M:%SZ")
                    < datetime.strptime(latest["created_at"], "%Y-%m-%dT%H:%M:%SZ")):
                continue
            origin = self.api(f"actions/runs/{int(artifact['workflow_run']['id'])}")
            if (origin["head_repository"]["full_name"] == REPOSITORY
                    and origin["head_branch"] == "main"
                    and origin["event"] in ("schedule", "workflow_dispatch")
                    and origin["path"] == ".github/workflows/released-artifact-security.yml"):
                ancestry = self.api(f"compare/{origin['head_sha']}...main")
                if (ancestry["status"] in ("ahead", "identical")
                        and ancestry["merge_base_commit"]["sha"] == origin["head_sha"]):
                    hints.append(artifact)
                    break
        saved_reference, saved_result, saved_order = None, None, (0, 0)
        if hints:
            hint = json.loads(self.archive_member(hints[0], "release-reference.json"))
            if set(hint) != {"artifact"}:
                raise ValueError("release-hint")
            saved_reference = hint["artifact"]
            # A hint has no authority until its complete signed publication
            # has passed the same admission as a newly discovered release.
            saved_result = self.release(saved_reference, platform)
            saved_order = self.publication_order(self.admitted_run)
        if requested:
            result = saved_result if requested == saved_reference else self.release(requested, platform)
            cacheable = self.publication_order(self.admitted_run) >= max(
                saved_order, self.publication_order(latest))
            return requested, result, cacheable
        if saved_result and saved_order >= self.publication_order(latest):
            # A later failed rerun cannot erase an accepted earlier attempt.
            return saved_reference, saved_result, True
        reference = self.scheduled_reference(latest)
        return reference, self.release(reference, platform, latest), True

    def manifest(self, reference, label):
        digest = reference_digest(reference)
        raw = self.command("oras", "manifest", "fetch", "--registry-config", self.registry_config, reference)
        value = self.shared.verify_oci_manifest_bytes(raw, digest, label)
        (self.output / (label + ".json")).write_bytes(raw)
        return value, raw

    def blob(self, digest, name):
        publisher.attestation_filename(digest)
        path = self.output / name
        self.command("oras", "blob", "fetch", "--registry-config", self.registry_config,
                     "--output", str(path), publisher.REPOSITORY + "@" + digest)
        raw = path.read_bytes()
        if len(raw) > 32 * 1024 * 1024 or publisher.digest(raw) != digest:
            raise ValueError("release-blob")
        return raw

    def files(self, reference, names, label, *, retained=False):
        manifest, _ = self.manifest(reference, label)
        layers = manifest["layers"]
        observed = {layer.get("annotations", {}).get("org.opencontainers.image.title") for layer in layers}
        if retained and observed == set(names) | RISK_FILES:
            names = observed
        if (len(layers) != len(names)
                or observed != set(names)):
            raise ValueError("release-artifact-files")
        result = {}
        for layer in layers:
            name = layer["annotations"]["org.opencontainers.image.title"]
            if type(layer["size"]) is not int or not 0 <= layer["size"] <= 32 * 1024 * 1024:
                raise ValueError("release-blob-size")
            raw = self.blob(layer["digest"], label + "-" + name)
            if len(raw) != layer["size"]:
                raise ValueError("release-blob-size")
            result[name] = raw
        return result

    def attestation(self, subject, digest, workflow, label, bundle=None):
        arguments = (["--bundle", str(bundle)] if bundle else ["--bundle-from-oci"])
        raw = self.command("gh", "attestation", "verify", subject, *arguments,
                           "--repo", REPOSITORY, "--signer-workflow", publisher.WORKFLOW,
                           "--signer-digest", workflow["commit"], "--source-ref", "refs/heads/main",
                           "--source-digest", workflow["commit"], "--deny-self-hosted-runners", "--format", "json")
        value = json.loads(raw)
        self.shared.verify_attestation_output(value, digest)
        if not verified_invocation(value, digest, workflow):
            raise ValueError("release-attestation-invocation")
        (self.output / (label + ".json")).write_bytes(raw)

    def release(self, reference, platform, latest=None):
        digest = reference_digest(reference)
        files = self.files(reference, EVIDENCE_FILES, "evidence", retained=True)
        document = json.loads(files["build-evidence.json"])
        security = json.loads(files["source-security.json"])
        workflow = document["workflow"]
        if (not re.fullmatch(r"[0-9a-f]{40}", workflow["commit"])
                or not all(re.fullmatch(r"[1-9][0-9]{0,19}", workflow[k]) for k in ("run_id", "run_attempt"))):
            raise ValueError("release-workflow-identity")
        self.attestation("oci://" + reference, digest, workflow, "evidence-attestation")
        self.attestation(str(self.output / "evidence-build-evidence.json"),
                         publisher.digest(files["build-evidence.json"]), workflow, "document-attestation",
                         self.output / "evidence-build-evidence.bundle.json")
        run = self.api(f"actions/runs/{workflow['run_id']}/attempts/{workflow['run_attempt']}")
        retained = None
        if RISK_FILES <= files.keys():
            if not self.accepted_dispatch(run):
                raise ValueError("release-final-job-skipped")
            policy = module("release_risk_policy", self.shared.ROOT / "scripts/secpal-vulnerability-policy.py")
            retained = admit_retained(document, files, policy)
        records = admit_document(document, security, run, reference, retained)
        ancestry = self.api(f"compare/{workflow['commit']}...main")
        if ancestry["status"] not in ("ahead", "identical") or ancestry["merge_base_commit"]["sha"] != workflow["commit"]:
            raise ValueError("release-main-ancestry")
        if latest and (run["id"], run["run_attempt"], run["head_sha"]) != (latest["id"], latest["run_attempt"], latest["head_sha"]):
            raise ValueError("release-latest-publisher")
        index_digest = document["subject"]["index_digest"]
        index, raw_index = self.manifest(publisher.REPOSITORY + "@" + index_digest, "index")
        sizes = []
        for record in records:
            subject = record["subject"]
            arch = record["runner_architecture"]
            _, raw = self.manifest(publisher.REPOSITORY + "@" + subject["manifest_digest"], "platform-" + arch)
            descriptor = self.shared.verify_index_document(
                raw_index, index_digest, raw, {"oci_digest": subject["manifest_digest"], "platform": subject["platform"]})
            config = self.blob(subject["config_digest"], "config-" + arch + ".json")
            if publisher.admit_platform(raw, config, descriptor, arch, document["source"], record["bases"]) != subject:
                raise ValueError("release-platform")
            sizes.append(len(raw))
            sbom = next(s for s in document["sboms"] if s["platform"] == subject["platform"])
            spdx = self.files(sbom["artifact"], ("syft.spdx.json", "association.json"), "sbom-" + arch)
            self.shared.verify_syft_association(json.loads(spdx["association.json"]), spdx["syft.spdx.json"],
                                                {"oci_digest": subject["manifest_digest"], "platform": subject["platform"]})
            if publisher.digest(spdx["syft.spdx.json"]) != sbom["spdx_sha256"]:
                raise ValueError("release-spdx-digest")
            if retained and publisher.digest(spdx["association.json"]) != retained[2][subject["platform"]]:
                raise ValueError("release-retained-spdx-association")
        if index != publisher.assemble_index([r["subject"] for r in records], sizes):
            raise ValueError("release-complete-platform-set")
        tag = f"build-{workflow['commit']}-{workflow['run_id']}-{workflow['run_attempt']}"
        discovery = self.command("oras", "manifest", "fetch", "--registry-config", self.registry_config,
                                 publisher.REPOSITORY + ":" + tag)
        if discovery != raw_index:
            raise ValueError("release-discovery")
        (self.output / "discovery-index.json").write_bytes(discovery)
        self.admitted_run = run
        selected = next(r["subject"] for r in records if r["subject"]["platform"] == platform)
        sbom = next(s for s in document["sboms"] if s["platform"] == platform)
        return {"index-digest": index_digest, "platform": platform,
                "platform-digest": selected["manifest_digest"], "syft-spdx-artifact": sbom["artifact"],
                "publisher-workflow-sha": workflow["commit"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tools", required=True)
    parser.add_argument("--shared-root", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--event", required=True)
    parser.add_argument("--schedule", default="")
    parser.add_argument("--platform", default="")
    parser.add_argument("--reference", default="")
    parser.add_argument("--consumer", default="")
    args = parser.parse_args()
    output = Path(args.output)
    if output.exists() or output.is_symlink():
        raise SystemExit("RELEASE_OUTPUT_NOT_EMPTY")
    output.mkdir(parents=True, mode=0o700)
    try:
        if (os.environ.get("GITHUB_REPOSITORY", REPOSITORY) != REPOSITORY
                or os.environ.get("GITHUB_REF", "refs/heads/main") != "refs/heads/main"):
            raise ValueError("release-caller-context")
        platform = selected_platform(args.event, args.schedule, args.platform)
        consumer, requested = selected_reference(args.event, args.schedule, args.consumer, args.reference)
        shared = module("shared_reevaluation", Path(args.shared_root) / "scripts/secpal-vulnerability-reevaluation.py")
        with tempfile.TemporaryDirectory(prefix="frontend-security-read-") as directory:
            config = Path(directory) / "empty-registry.json"
            config.write_text('{"auths":{}}\n')
            config.chmod(0o600)
            reader = ReleaseReader(args.tools, shared, output, str(config))
            if consumer == "latest":
                reference, result, cacheable = reader.select(platform, requested)
            else:
                reference, result, cacheable = requested, reader.release(requested, platform), False
        publisher.write(output / "release-reference.json", {"artifact": reference})
        publisher.write(output / "selection.json", result)
        if os.environ.get("GITHUB_OUTPUT"):
            with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as stream:
                for key, value in result.items():
                    stream.write(f"{key}={value}\n")
                stream.write("cacheable=" + str(cacheable).lower() + "\n")
        print("RELEASE_ADMISSION_SUCCEEDED")
    except (ValueError, KeyError, TypeError, AttributeError, IndexError, StopIteration,
            OSError, zipfile.BadZipFile, subprocess.SubprocessError):
        publisher.write(output / "failure.json", {"state": "UNKNOWN_STALE", "phase": "RELEASE_ADMISSION"})
        raise SystemExit("RELEASE_ADMISSION_FAILED") from None


if __name__ == "__main__":
    main()
