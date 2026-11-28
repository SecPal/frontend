#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Synthetic release-admission regressions, not hosted scan or signature evidence."""
import copy
import importlib.util
import io
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
import zipfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    sys.modules[name] = value
    spec.loader.exec_module(value)
    return value


monitor = load("release_monitor", ROOT / "scripts/released-artifact-security.py")
fixtures = load("publisher_fixtures", ROOT / "tests/container-publisher.py")


def release():
    args = fixtures.evidence()
    document = fixtures.publisher.build_evidence(*args, expected_source=fixtures.SOURCE)
    run = dict(id=42, run_attempt=2, head_sha=fixtures.SHA, head_branch="main", event="push",
               path=monitor.WORKFLOW, status="completed", conclusion="success",
               head_repository=dict(full_name=monitor.REPOSITORY))
    return document, args[5], run


def retained_release():
    args = fixtures.evidence()
    records, index, sboms, scans, _, security, *_ = args
    source = {"repository": monitor.REPOSITORY, "commit": fixtures.SHA}
    producer = dict(repository=monitor.REPOSITORY, source_commit=fixtures.SHA,
                    run_id="31", run_attempt="1", workflow=monitor.WORKFLOW)
    security_bytes = fixtures.encoded(security)
    digest = lambda value: fixtures.digest(fixtures.encoded(value))
    rows, results, states, platforms = [], [], {}, {}
    for record, sbom in zip(records, sboms, strict=True):
        record.update(workflow_run_id="31", workflow_run_attempt="1")
        info = record["subject"]
        platform, target = info["platform"], info["manifest_digest"]
        subject = {"platform": platform, "oci_digest": target}
        platforms[platform] = target
        result = dict(subject=subject, gate_state="REVIEW_REQUIRED",
                      evidence_health={"state": "HEALTHY"}, evaluated_at=fixtures.NOW)
        old = "2026-10-18T09:01:00Z"
        own = [scan for scan in scans if scan["platform"] == platform]
        for scan in own:
            scan["policy_result"] = result["gate_state"]
        rows.append(dict(evaluation=dict(subject=subject, evaluated_at=old, syft={"spdx_digest": sbom["spdx_sha256"]}),
                         config_digest=info["config_digest"], spdx_association_sha256="sha256:" + "5" * 64,
                         raw={s["scanner"]: s["evidence_sha256"] for s in own},
                         policy_result_sha256=digest(dict(result, evaluated_at=old))))
        results.append(result)
        states[target] = result["gate_state"]
    scope = dict(index_digest=index, platforms=platforms)
    policy = SimpleNamespace(_risk_subject=lambda evidence: (scope, evidence["platforms"]), _document_digest=digest)
    evidence = dict(source=source, index_digest=index, platforms=rows,
                    evidence=dict(producer=producer, source_security_sha256=fixtures.digest(security_bytes)))
    decision = dict(scope, accept=True, repository=monitor.REPOSITORY, source_commit=fixtures.SHA,
                    evidence_sha256=digest(evidence), expires_at="2026-10-18T23:00:00Z")
    receipt = dict(admission="ADMITTED_WITH_KNOWN_FINDINGS", source=source, index_digest=index,
                   evidence_sha256=digest(evidence), expires_at=decision["expires_at"],
                   operator=dict(permission="admin"), comment=dict(id=19, created_at=fixtures.NOW,
                   url="https://github.com/SecPal/frontend/issues/2322#issuecomment-19"),
                   decision=decision, policy_results=results)
    receipt_bytes = fixtures.encoded(receipt)
    document = fixtures.publisher.build_evidence(*args, expected_source=fixtures.SOURCE,
                                                  build_origin=("31", "1"), risk_states=states)
    document["extensions"][fixtures.publisher.SOURCE].update(
        qualification_producer=producer, artifact_security_admission_sha256=fixtures.digest(receipt_bytes))
    files = {"source-security.json": security_bytes, "risk-admission.json": receipt_bytes,
             "risk-evidence.json": fixtures.encoded(evidence)}
    return document, security, dict(release()[2], event="workflow_dispatch"), files, policy


class ReleasedArtifactTests(unittest.TestCase):
    def test_actual_adoption_was_absent_from_accepted_main(self):
        self.assertTrue((ROOT / ".github/workflows/released-artifact-security.yml").is_file())

    def test_only_canonical_same_repository_immutable_evidence_references(self):
        self.assertEqual(monitor.reference_digest(monitor.BASELINE), monitor.BASELINE.split("@")[1])
        for value in ("", None, "ghcr.io/secpal/frontend:latest",
                      "ghcr.io/secpal/frontend@sha256:bad",
                      monitor.BASELINE.replace("frontend@", "other@"),
                      monitor.BASELINE.replace("ghcr.io", "registry.secpal.dev"),
                      monitor.BASELINE + "\n", monitor.BASELINE + "/../secret"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                monitor.reference_digest(value)

    def test_invalid_manual_reference_is_rejected_before_any_external_lookup(self):
        reader = monitor.ReleaseReader(".", None, ".", ".")
        reader.latest_publisher = lambda: self.fail("invalid input must not reach GitHub or registry")
        with self.assertRaises(ValueError):
            reader.select("linux/amd64", "https://untrusted.secpal.dev/token")

    def test_daily_runs_cover_both_platforms_without_runwide_artifact_collision(self):
        self.assertEqual(monitor.selected_platform("schedule", "17 3 * * *", ""), "linux/amd64")
        self.assertEqual(monitor.selected_platform("schedule", "37 3 * * *", ""), "linux/arm64")
        for platform in fixtures.publisher.PLATFORMS:
            self.assertEqual(monitor.selected_platform("workflow_dispatch", "", platform), platform)
        for values in (("pull_request", "", "linux/amd64"), ("schedule", "unknown", ""),
                       ("schedule", "17 3 * * *", "linux/arm64"),
                       ("workflow_dispatch", "", "linux/386")):
            with self.subTest(values=values), self.assertRaises(ValueError):
                monitor.selected_platform(*values)

    def test_known_consumers_do_not_follow_a_new_publication_or_override(self):
        for consumer in ("demo", "deployment"):
            reference = monitor.CONSUMERS[consumer]
            self.assertEqual(monitor.selected_reference("workflow_dispatch", "", consumer, ""),
                             (consumer, reference))
            with self.assertRaises(ValueError):
                monitor.selected_reference("workflow_dispatch", "", consumer, monitor.BASELINE)
        selected = []
        for schedule, (consumer, platform) in monitor.SCHEDULES.items():
            self.assertEqual(monitor.selected_platform("schedule", schedule, ""), platform)
            self.assertEqual(monitor.selected_reference("schedule", schedule, "", ""),
                             (consumer, monitor.CONSUMERS.get(consumer, "")))
            selected.append((consumer, platform))
        self.assertEqual(len(set(selected)), 6)
        with self.assertRaises(ValueError):
            monitor.selected_reference("schedule", "17 4 * * *", "latest", "")

    def test_only_the_exact_authenticated_demo_evidence_can_use_historical_source_schema(self):
        document, security, run = release()
        security["schema_version"] = "secpal-trivy-repository-scan-v4"
        document["extensions"][fixtures.publisher.SOURCE]["source_security_sha256"] = fixtures.publisher.digest(fixtures.publisher.canonical(security))
        with self.assertRaises(ValueError):
            monitor.admit_document(document, security, run)
        monitor.admit_document(document, security, run, monitor.CONSUMERS["demo"])
        for reference in (monitor.BASELINE, monitor.CONSUMERS["deployment"]):
            with self.subTest(reference=reference), self.assertRaises(ValueError):
                monitor.admit_document(document, security, run, reference)

    def test_complete_historically_clean_evidence_reuses_publisher_admission(self):
        document, security, run = release()
        original = copy.deepcopy((document, security, run))
        records = monitor.admit_document(document, security, run)
        self.assertEqual([r["subject"]["platform"] for r in records], list(fixtures.publisher.PLATFORMS))
        self.assertEqual((document, security, run), original)
        # This is historical publication admission, not today's vulnerability verdict.
        self.assertEqual(document["generated_at"], fixtures.NOW)

    def test_incomplete_candidate_wrong_source_and_unsuccessful_publisher_fail_closed(self):
        mutations = (
            lambda d, s, r: r.update(conclusion="failure"),
            lambda d, s, r: r.update(status="in_progress"),
            lambda d, s, r: r.update(event="pull_request"),
            lambda d, s, r: r.update(head_branch="untrusted"),
            lambda d, s, r: r.update(path=".github/workflows/other.yml"),
            lambda d, s, r: r.update(head_sha="0" * 40),
            lambda d, s, r: r["head_repository"].update(full_name="SecPal/other"),
            lambda d, s, r: d["workflow"].update(run_attempt="1"),
            lambda d, s, r: d["source"].update(repository="https://github.com/SecPal/other"),
            lambda d, s, r: d["subject"]["platforms"].pop(),
            lambda d, s, r: d["subject"]["platforms"].append(copy.deepcopy(d["subject"]["platforms"][0])),
            lambda d, s, r: d["subject"]["platforms"].__setitem__(1, copy.deepcopy(d["subject"]["platforms"][0])),
            lambda d, s, r: d["sboms"][0].update(subject_digest="sha256:" + "0" * 64),
            lambda d, s, r: d["sboms"][0].update(artifact="ghcr.io/secpal/other@sha256:" + "f" * 64),
            lambda d, s, r: d["sboms"].pop(),
            lambda d, s, r: d["scans"].pop(),
            lambda d, s, r: d["smoke_tests"][0].update(result="FAILED"),
            lambda d, s, r: s.update(gate_state="UNKNOWN_STALE"),
        )
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                values = release()
                mutate(*values)
                with self.assertRaises(ValueError):
                    monitor.admit_document(*values)

    def test_candidate_historical_nonclean_policy_cannot_assert_release_acceptance(self):
        for state in ("ACTIONABLE", "REVIEW_REQUIRED", "UNKNOWN_STALE", ""):
            values = release()
            values[0]["scans"][0]["policy_result"] = state
            with self.subTest(state=state), self.assertRaises(ValueError):
                monitor.admit_document(*values)

    def test_retained_release_preserves_review_required_and_requires_protected_dispatch(self):
        document, security, run, files, policy = retained_release()
        retained = monitor.admit_retained(document, files, policy)
        records = monitor.admit_document(document, security, run, retained=retained)
        self.assertEqual([r["workflow_run_id"] for r in records], ["31", "31"])
        self.assertEqual(set(retained[1].values()), {"REVIEW_REQUIRED"})
        for event in ("push", "pull_request"):
            with self.subTest(event=event), self.assertRaises(ValueError):
                monitor.admit_document(document, security, dict(run, event=event), retained=retained)
        with self.assertRaises(ValueError):
            monitor.admit_document(document, security, run)

    def test_retained_release_rejects_changed_receipt_scans_and_subjects(self):
        for mutation in (
            lambda doc, r: r.update(admission="CLEAN"),
            lambda doc, r: r.update(policy_results=r["policy_results"][:1]),
            lambda doc, r: r["policy_results"][0].update(gate_state="ACTIONABLE"),
            lambda doc, r: r["decision"].update(accept=False),
            lambda doc, r: r["operator"].update(permission="write"),
            lambda doc, r: doc["scans"][0].update(evidence_sha256="sha256:" + "6" * 64),
            lambda doc, r: doc["subject"].update(index_digest="sha256:" + "7" * 64),
            lambda doc, r: doc.update(generated_at=r["expires_at"]),
        ):
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                document, _, _, files, policy = retained_release()
                receipt = json.loads(files["risk-admission.json"])
                mutation(document, receipt)
                files["risk-admission.json"] = fixtures.encoded(receipt)
                document["extensions"][fixtures.publisher.SOURCE]["artifact_security_admission_sha256"] = (
                    fixtures.digest(files["risk-admission.json"]))
                monitor.admit_retained(document, files, policy)

    def test_discovery_skips_inspections_and_selects_successful_final_publication(self):
        push = dict(release()[2], id=40)
        retained = dict(push, id=41, event="workflow_dispatch")
        inspect = dict(retained, id=42)
        reader = monitor.ReleaseReader(".", None, ".", ".")
        def api(endpoint):
            if "event=push" in endpoint:
                return {"workflow_runs": [push]}
            if "event=workflow_dispatch" in endpoint:
                return {"workflow_runs": [inspect, retained]}
            run_id = int(endpoint.split("/")[2])
            job = dict(name=monitor.ACCEPT_JOB, run_id=run_id, run_attempt=2, head_sha=fixtures.SHA,
                       status="completed", conclusion="success" if run_id == 41 else "skipped")
            return {"total_count": 1, "jobs": [job]}
        reader.api = api
        self.assertEqual(reader.latest_publisher(), retained)
        reader.artifacts = lambda _: []
        with self.assertRaisesRegex(ValueError, "^release-retained-export-unavailable$"):
            reader.scheduled_reference(retained)
        self.assertEqual(reader.scheduled_reference(push), monitor.BASELINE)

    def test_retained_files_require_both_exact_extensions(self):
        reader = monitor.ReleaseReader(".", None, ".", ".")
        for extra in ({"risk-admission.json"}, {"risk-evidence.json", "substitute.json"}):
            with self.subTest(extra=extra), self.assertRaisesRegex(ValueError, "^release-artifact-files$"):
                names = monitor.EVIDENCE_FILES | extra
                reader.manifest = lambda *_: ({"layers": [
                    {"annotations": {"org.opencontainers.image.title": name}} for name in names]}, b"")
                reader.files(monitor.BASELINE, monitor.EVIDENCE_FILES, "evidence", retained=True)

    def test_attestation_run_and_subject_must_match_in_the_same_verified_statement(self):
        digest = "sha256:" + "a" * 64
        workflow = release()[0]["workflow"]
        def proof(run, subject):
            return {"verificationResult": {"statement": {
                "predicate": {"runDetails": {"metadata": {"invocationId":
                    f"https://github.com/SecPal/frontend/actions/runs/{run}/attempts/2"}}},
                "subject": [{"digest": {"sha256": subject}}]}}}
        expected = proof(42, "a" * 64)
        self.assertTrue(monitor.verified_invocation([proof(41, "a"*64), expected], digest, workflow))
        self.assertFalse(monitor.verified_invocation([proof(42, "b"*64), proof(41, "a"*64)], digest, workflow))
        self.assertFalse(monitor.verified_invocation([], digest, workflow))

    def test_hint_is_not_authority_and_failed_reruns_do_not_erase_accepted_attempts(self):
        for origin_id, created_at in ((40, "2026-10-25T13:00:00Z"),
                                      (100, "2026-10-25T13:00:00Z"),
                                      (40, "2026-10-25T12:00:00Z")):
            with self.subTest(origin_id=origin_id, created_at=created_at):
                reader = monitor.ReleaseReader(".", None, ".", ".")
                old = {"id": 41, "run_attempt": 1, "head_sha": fixtures.SHA,
                       "created_at": "2026-10-25T12:00:00Z"}
                current = {"id": 42, "run_attempt": 1, "head_sha": fixtures.SHA}
                reader.latest_publisher = lambda: old
                reader.artifacts = lambda name: [{"id": 1, "created_at": created_at,
                                                 "workflow_run": {"id": origin_id}}]
                reader.archive_member = lambda *unused: json.dumps({"artifact": monitor.BASELINE}).encode()
                reader.api = lambda endpoint: (
                    {"head_repository": {"full_name": monitor.REPOSITORY}, "head_branch": "main",
                     "event": "schedule", "path": ".github/workflows/released-artifact-security.yml", "head_sha": fixtures.SHA}
                    if endpoint.startswith("actions/") else
                    {"status": "identical", "merge_base_commit": {"sha": fixtures.SHA}})
                calls = []
                def verified_release(reference, platform, latest=None):
                    calls.append(reference)
                    reader.admitted_run = current if reference == monitor.BASELINE else old
                    return {"fixture": reference}
                reader.release = verified_release
                older_reference = monitor.BASELINE.replace("aa83f4", "bb83f4")
                reader.scheduled_reference = lambda candidate: older_reference
                selected, result, cacheable = reader.select("linux/amd64", "")
                self.assertEqual(selected, monitor.BASELINE)
                self.assertTrue(cacheable)
                self.assertEqual(len(calls), 1)
                # A deliberately selected historical incident must not replace current state.
                _, _, cacheable = reader.select("linux/amd64", older_reference)
                self.assertFalse(cacheable)

    def test_hint_created_before_latest_publisher_cannot_preempt_exact_admission(self):
        for requested in ("", monitor.BASELINE):
            for reject in (False, True):
                with self.subTest(requested=requested, reject=reject):
                    reader = monitor.ReleaseReader(".", None, ".", ".")
                    latest = {"id": 42, "run_attempt": 1, "head_sha": fixtures.SHA,
                              "created_at": "2026-10-25T12:00:00Z"}
                    reader.latest_publisher = lambda: latest
                    reader.artifacts = lambda name: [{"id": 1, "created_at": "2026-10-25T11:00:00Z",
                                                         "workflow_run": {"id": 40}}]
                    reader.api = lambda endpoint: self.fail("stale hint must not be consulted")
                    reader.archive_member = lambda *unused: self.fail("stale hint must not be read")
                    reader.scheduled_reference = lambda candidate: monitor.BASELINE
                    calls = []
                    def verified_release(reference, platform, candidate=None):
                        calls.append((reference, platform, candidate))
                        self.assertEqual(reference, monitor.BASELINE)
                        self.assertEqual(candidate, None if requested else latest)
                        if reject:
                            raise ValueError("mandatory-release-rejected")
                        reader.admitted_run = latest
                        return {"platform": platform}
                    reader.release = verified_release
                    if reject:
                        with self.assertRaisesRegex(ValueError, "^mandatory-release-rejected$"):
                            reader.select("linux/amd64", requested)
                    else:
                        selected, result, cacheable = reader.select("linux/amd64", requested)
                        self.assertEqual(selected, monitor.BASELINE)
                        self.assertEqual(result, {"platform": "linux/amd64"})
                        self.assertTrue(cacheable)
                    self.assertEqual(len(calls), 1)

    def test_unavailable_or_malformed_provider_creation_time_fails_closed(self):
        for field in ("artifact", "publisher"):
            for value in (None, "", "invalid", "2026-10-25T12:00:00"):
                with self.subTest(field=field, value=value):
                    reader = monitor.ReleaseReader(".", None, ".", ".")
                    latest = {"id": 42, "created_at": "2026-10-25T12:00:00Z"}
                    artifact = {"id": 1, "created_at": "2026-10-25T13:00:00Z"}
                    target = artifact if field == "artifact" else latest
                    if value is None:
                        target.pop("created_at")
                    else:
                        target["created_at"] = value
                    reader.latest_publisher = lambda: latest
                    reader.artifacts = lambda name: [artifact]
                    reader.api = lambda *unused: self.fail("invalid provider time must not reach hint")
                    with self.assertRaises((KeyError, ValueError, TypeError)):
                        reader.select("linux/amd64", "")

    def test_pull_request_hint_cannot_choose_the_scheduled_release(self):
        reader = monitor.ReleaseReader(".", None, ".", ".")
        latest = {"id": 42, "run_attempt": 1, "head_sha": fixtures.SHA,
                              "created_at": "2026-10-25T12:00:00Z"}
        reader.latest_publisher = lambda: latest
        reader.artifacts = lambda name: [{"id": 1, "created_at": "2026-10-25T13:00:00Z",
                                         "workflow_run": {"id": 100}}]
        reader.api = lambda endpoint: {
            "head_repository": {"full_name": monitor.REPOSITORY}, "head_branch": "untrusted",
            "event": "pull_request", "path": ".github/workflows/released-artifact-security.yml"}
        reader.archive_member = lambda *unused: self.fail("untrusted hint must not be read")
        reader.scheduled_reference = lambda candidate: monitor.BASELINE
        def verified_release(reference, platform, candidate=None):
            self.assertEqual(candidate, latest)
            reader.admitted_run = latest
            return {}
        reader.release = verified_release
        selected, _, cacheable = reader.select("linux/arm64", "")
        self.assertEqual(selected, monitor.BASELINE)
        self.assertTrue(cacheable)

    def test_latest_binding_rejects_old_hint_before_any_platform_selection(self):
        document, security, run = release()
        reader = monitor.ReleaseReader(".", None, ".", ".")
        reader.files = lambda *unused, **options: {
            "build-evidence.json": fixtures.encoded(document),
            "source-security.json": fixtures.encoded(security),
            "build-evidence.bundle.json": b"{}"}
        reader.attestation = lambda *unused: None  # Synthetic transport seam only.
        reader.api = lambda endpoint: (
            {"status": "identical", "merge_base_commit": {"sha": fixtures.SHA}}
            if endpoint.startswith("compare/") else run)
        latest = dict(run, id=43)
        with self.assertRaisesRegex(ValueError, "^release-latest-publisher$"):
            reader.release(monitor.BASELINE, "linux/amd64", latest)

    def test_existing_output_state_is_not_reused_or_overwritten(self):
        import os
        import subprocess
        import tempfile
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "evidence"
            output.mkdir()
            sentinel = output / "selection.json"
            sentinel.write_text("prior untrusted selection")
            result = subprocess.run([
                sys.executable, str(ROOT / "scripts/released-artifact-security.py"),
                "--tools", ".", "--shared-root", ".", "--output", str(output),
                "--event", "workflow_dispatch", "--platform", "linux/amd64"
            ], capture_output=True, text=True, env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(result.stderr.strip(), "RELEASE_OUTPUT_NOT_EMPTY")
            self.assertNotIn("Traceback", result.stderr)
            self.assertEqual(sentinel.read_text(), "prior untrusted selection")

    def test_corrupted_duplicate_missing_or_symlink_archive_member_is_rejected(self):
        for mode in ("missing", "duplicate", "symlink", "corrupted"):
            payload = io.BytesIO()
            with zipfile.ZipFile(payload, "w") as archive:
                if mode == "missing":
                    archive.writestr("../not-extracted", "{}")
                elif mode == "symlink":
                    info = zipfile.ZipInfo("release-reference.json")
                    info.external_attr = 0o120777 << 16
                    archive.writestr(info, "private-path")
                else:
                    archive.writestr("release-reference.json", "{}")
                    if mode == "duplicate":
                        import warnings
                        with warnings.catch_warnings():
                            warnings.simplefilter("ignore", UserWarning)
                            archive.writestr("release-reference.json", "{}")
            raw = payload.getvalue()
            reader = monitor.ReleaseReader(".", None, ".", ".")
            reader.command = lambda *unused: raw
            artifact = dict(id=1, digest=fixtures.digest(raw))
            if mode == "corrupted":
                artifact["digest"] = "sha256:" + "0" * 64
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                reader.archive_member(artifact, "release-reference.json")


if __name__ == "__main__":
    unittest.main()
