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
        reader = monitor.ReleaseReader(".", None, ".", ".")
        old = {"id": 41, "run_attempt": 1, "head_sha": fixtures.SHA}
        current = {"id": 42, "run_attempt": 1, "head_sha": fixtures.SHA}
        reader.latest_publisher = lambda: old
        reader.artifacts = lambda name: [{"id": 1, "workflow_run": {"id": 100}}]
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
        selected, result, cacheable = reader.select("linux/amd64", "")
        self.assertEqual(selected, monitor.BASELINE)
        self.assertTrue(cacheable)
        self.assertEqual(len(calls), 1)
        # A deliberately selected historical incident must not replace current state.
        older_reference = monitor.BASELINE.replace("aa83f4", "bb83f4")
        _, _, cacheable = reader.select("linux/amd64", older_reference)
        self.assertFalse(cacheable)

    def test_pull_request_hint_cannot_choose_the_scheduled_release(self):
        reader = monitor.ReleaseReader(".", None, ".", ".")
        latest = {"id": 42, "run_attempt": 1, "head_sha": fixtures.SHA}
        reader.latest_publisher = lambda: latest
        reader.artifacts = lambda name: [{"id": 1, "workflow_run": {"id": 100}}]
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
        reader.files = lambda *unused: {
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
