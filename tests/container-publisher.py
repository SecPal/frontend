#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
"""Frontend publisher admission fixtures, not native build or registry evidence."""
import copy
import hashlib
import importlib.util
import json
import os
import shlex
from pathlib import Path
import unittest
from unittest.mock import patch
import subprocess
import tempfile
import sys
sys.dont_write_bytecode = True

spec=importlib.util.spec_from_file_location('publisher',Path(__file__).resolve().parents[1]/'scripts/container-publisher.py')
publisher=importlib.util.module_from_spec(spec);spec.loader.exec_module(publisher)
SHA='a'*40
SOURCE=dict(repository='https://github.com/SecPal/frontend',commit=SHA,epoch=1700000000,version='0.0.1+git.'+SHA,context=dict(path='.'),
            containerfile=dict(path='Containerfile',sha256='sha256:'+'b'*64),
            containerignore=dict(path='.containerignore',sha256='sha256:'+'c'*64))
NOW='2026-10-18T07:00:00Z'


def encoded(value):
    return json.dumps(value,sort_keys=True,separators=(',',':')).encode()


def digest(value):
    return 'sha256:'+hashlib.sha256(value).hexdigest()


def platform(arch):
    base=[dict(stage=s,platform='linux/'+arch,reference='docker.io/'+name+':1@sha256:'+'d'*64,
               digest='sha256:'+'e'*64) for s,name in [('build','library/node'),('runtime','nginxinc/nginx-unprivileged')]]
    labels={
        'org.opencontainers.image.source':'https://github.com/SecPal/frontend',
        'org.opencontainers.image.revision':SHA,
        'org.opencontainers.image.created':'2023-11-14T22:13:20Z',
        'org.opencontainers.image.licenses':'AGPL-3.0-or-later',
        'org.opencontainers.image.version':SOURCE['version'],
        'org.opencontainers.image.base.name':base[1]['reference'],
        'org.opencontainers.image.base.digest':base[1]['digest'],
        'org.opencontainers.image.title':'SecPal Frontend',
        'org.opencontainers.image.description':'Unprivileged static reference server for the SecPal frontend',
    }
    config=encoded(dict(created='2023-11-14T22:13:20Z',os='linux',architecture=arch,config=dict(User='101:101',Labels=labels)))
    manifest=encoded(dict(schemaVersion=2,mediaType='application/vnd.oci.image.manifest.v1+json',
                         config=dict(mediaType='application/vnd.oci.image.config.v1+json',
                                     digest=digest(config),size=len(config)),layers=[]))
    descriptor=dict(mediaType='application/vnd.oci.image.manifest.v1+json',digest=digest(manifest),size=len(manifest))
    subject=publisher.admit_platform(manifest,config,descriptor,arch,SOURCE,base)
    return base,config,manifest,descriptor,subject


class BaseSourceTests(unittest.TestCase):
    def test_literal_from_pins_bind_both_platforms_to_the_reviewed_index(self):
        root = Path(__file__).resolve().parents[1]
        text = (root/'Containerfile').read_text()
        self.assertNotIn('ARG NODE_IMAGE=', text)
        self.assertNotIn('ARG NGINX_IMAGE=', text)
        for arch in ('amd64', 'arm64'):
            manifest = encoded(dict(schemaVersion=2, config=dict(digest='sha256:'+'a'*64)))
            index = encoded(dict(manifests=[dict(digest=digest(manifest),
                           platform=dict(os='linux',architecture=arch))]))
            refs = [('docker.io/library/node', 'build'),
                    ('docker.io/nginxinc/nginx-unprivileged', 'runtime')]
            fixture = '\n'.join('FROM '+repo+':1@'+digest(index)+' AS '+stage for repo,stage in refs)
            with tempfile.TemporaryDirectory() as tmp:
                (Path(tmp)/'Containerfile').write_text(fixture)
                with patch.object(publisher, 'run', side_effect=[index,manifest,index,manifest]):
                    result = publisher.bases(tmp, arch)
                self.assertEqual([b['stage'] for b in result], ['build','runtime'])
                self.assertTrue(all(b['platform']=='linux/'+arch and b['digest']==digest(manifest) for b in result))
                for bad in (fixture.replace('FROM ', 'FROM $', 1),
                            fixture+'\nFROM other:latest AS extra',
                            fixture.replace('AS build','AS runtime'),
                            fixture.replace(digest(index), 'sha256:bad')):
                    (Path(tmp)/'Containerfile').write_text(bad)
                    with patch.object(publisher, 'run', side_effect=[index,manifest,index,manifest]), self.assertRaises(ValueError):
                        publisher.bases(tmp, arch)

    def test_changed_remote_index_or_platform_is_rejected(self):
        root = Path(__file__).resolve().parents[1]
        with patch.object(publisher, 'run', return_value=b'{}'), self.assertRaisesRegex(ValueError,'publisher-base-index-digest'):
            publisher.bases(root, 'amd64')


class AttestationEvidenceFilenameTests(unittest.TestCase):
    def test_exact_digest_maps_to_portable_unique_filename(self):
        first = "sha256:" + "a" * 64
        second = "sha256:" + "b" * 64
        self.assertEqual(publisher.attestation_filename(first),
                         "attestation-sha256-" + "a" * 64 + ".json")
        self.assertNotEqual(publisher.attestation_filename(first),
                            publisher.attestation_filename(second))
        self.assertEqual(Path(publisher.attestation_filename(first)).name,
                         publisher.attestation_filename(first))
        self.assertNotRegex(publisher.attestation_filename(first), r'[":<>|*?\\/]')

    def test_scan_verifies_the_same_portable_file_with_original_digest(self):
        root = Path(__file__).resolve().parents[1]
        scan = (root / "scripts/scan-container-artifact.sh").read_text()
        self.assertIn('attestation-filename --digest "${subject##*@}"', scan)
        self.assertEqual(scan.count('$output/raw/${attestation_file}'), 2)
        self.assertIn('--digest "${subject##*@}"', scan)
        self.assertNotIn('attestation-${subject##*@}.json', scan)
        workflow = (root / ".github/workflows/publish-container.yml").read_text()
        # Existing always-path retention remains independent of scan acceptance.
        self.assertIn("if: always()", workflow)
        self.assertIn("retention-days:", workflow)

    def test_invalid_security_identity_never_becomes_a_path(self):
        for value in ("", "sha256:abc", "sha256:" + "A"*64, "sha512:" + "a"*64,
                      "../sha256:" + "a"*64, "sha256:" + "a"*64 + "/secret",
                      "sha256:" + "a"*64 + "\n"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                publisher.attestation_filename(value)


def evidence():
    records=[];sboms=[];scans=[];smokes=[]
    for arch in ['amd64','arm64']:
        base,config,manifest,descriptor,subject=platform(arch)
        records.append(dict(source=copy.deepcopy(SOURCE),subject=subject,bases=base,
                            builder=dict(name='buildah',version='1.33.7'),runner_architecture=arch,
                            workflow_run_id='42',workflow_run_attempt='2'))
        sboms.append(dict(platform='linux/'+arch,subject_digest=subject['manifest_digest'],
                          artifact='ghcr.io/secpal/frontend@sha256:'+'f'*64,
                          spdx_sha256='sha256:'+'1'*64,syft_version='1.54.1'))
        for scanner,version in [('grype','0.118.0'),('trivy','0.74.0')]:
            scans.append(dict(platform='linux/'+arch,scanner=scanner,scanner_version=version,
                              database=dict(identity='native-db:sha256:'+'2'*64,generated_at=NOW),
                              subject_digest=sboms[-1]['spdx_sha256'] if scanner=='grype' else subject['manifest_digest'],
                              completed_at=NOW,status='SUCCEEDED',policy_result='CLEAN',evidence_sha256='sha256:'+'3'*64))
        smokes.append(dict(platform='linux/'+arch,digest=subject['manifest_digest'],runner_architecture=arch,
                           test='scripts/container-smoke.sh+scripts/container-browser.sh',result='SUCCEEDED',completed_at=NOW,
                           workflow_run_id='42',workflow_run_attempt='2'))
    security=dict(schema_version='secpal-trivy-repository-scan-v2',subject=dict(repository='SecPal/frontend',commit=SHA),
                  gate_state='CLEAN',operation=dict(name='TRIVY_REPOSITORY_SCAN',status='SUCCEEDED'),
                  database=dict(status='FRESH',updated_at='2026-10-18T00:00:00Z',next_update='2026-10-19T00:00:00Z'))
    return [records,'sha256:'+'4'*64,sboms,scans,smokes,security,'42','2',NOW]


class EvidenceTimeTests(unittest.TestCase):
    @staticmethod
    def grype_evidence():
        args=evidence()
        args[8]='2026-10-19T21:40:51Z'
        args[5]['database'].update(updated_at='2026-10-19T00:00:00Z',
                                   next_update='2026-10-20T00:00:00Z')
        completed={
            'linux/amd64':('2026-10-19T21:40:29.598833+00:00','2026-10-19T21:40:31Z'),
            'linux/arm64':('2026-10-19T21:39:59.004353+00:00','2026-10-19T21:39:59Z'),
        }
        for scan in args[3]:
            scan['completed_at']=completed[scan['platform']][scan['scanner']=='trivy']
        for smoke in args[4]:
            smoke['completed_at']='2026-10-19T21:39:28Z'
        return args

    def test_actual_grype_utc_forms_assemble_without_rewriting_evidence(self):
        args=self.grype_evidence()
        original=copy.deepcopy(args)
        result=publisher.build_evidence(*args,expected_source=SOURCE)
        self.assertEqual(args,original)
        self.assertEqual(result['scans'],original[3])
        self.assertEqual(result['generated_at'],original[8])
        sboms={s['platform']:s for s in original[2]}
        subjects={r['subject']['platform']:r['subject'] for r in original[0]}
        for scan in result['scans']:
            expected=(sboms[scan['platform']]['spdx_sha256'] if scan['scanner']=='grype'
                      else subjects[scan['platform']]['manifest_digest'])
            self.assertEqual(scan['subject_digest'],expected)
            self.assertEqual(publisher.evidence_time(scan['completed_at'])[0].utcoffset().total_seconds(),0)

    def test_equivalent_explicit_utc_instants_keep_completion_ordering(self):
        for value in ('2026-10-19T21:40:29.598833Z',
                      '2026-10-19T21:39:59.004353Z','2026-10-19T21:40:51Z'):
            self.assertEqual(publisher.evidence_time(value),
                             publisher.evidence_time(value[:-1]+'+00:00'))
        args=self.grype_evidence()
        args[8]='2026-10-19T21:40:51.000000+00:00'
        for record in args[3]+args[4]:
            record['completed_at']='2026-10-19T21:40:51Z'
        result=publisher.build_evidence(*args,expected_source=SOURCE)
        self.assertEqual(result['generated_at'],args[8])

    def test_invalid_timestamp_representations_fail_full_assembly(self):
        invalid=(None,1,True,[],{},'','2026-10-19T21:40:29',
                 '2026-10-19T21:40:29+01:00','2026-10-19T21:40:29-00:00',
                 '2026-02-30T21:40:29Z','2026-10-19T25:40:29Z',
                 '2026-10-19T21:40:29.Z','2026-10-19T21:40:29,5Z',
                 '2026-10-19T21:40:29.1234567890Z','2026-10-19T21:40:29UTC',
                 '2026-10-19T21:40:29+00:00Z','2026-10-19T21:40:29ZZ',
                 '2026-10-19T21:40:29Z trailing','2026-10-19T21:40:29Z\n',
                 '2026-10-19 21:40:29Z','20261019T214029Z',
                 '2026-10-19T21:40Z','2026-10-19T21:40:29+0000')
        # Each independently consumed time boundary retains the same closed error.
        for value in invalid:
            for boundary in ('scan','smoke','generated'):
                with self.subTest(value=value,boundary=boundary):
                    args=self.grype_evidence()
                    # Use Z controls so the rejected predicate is the selected input.
                    for scan in args[3]:
                        scan['completed_at']=scan['completed_at'].replace('+00:00','Z')
                    if boundary=='generated':
                        args[8]=value
                    else:
                        args[3 if boundary=='scan' else 4][0]['completed_at']=value
                    with self.assertRaisesRegex(ValueError,'^publisher-evidence-time$'):
                        publisher.build_evidence(*args,expected_source=SOURCE)

    def test_future_scan_and_smoke_remain_rejected_on_both_architectures(self):
        for collection,error in ((3,'publisher-scan-acceptance'),(4,'publisher-smoke-time')):
            for index in range(len(self.grype_evidence()[collection])):
                for suffix in ('Z','+00:00'):
                    with self.subTest(collection=collection,index=index,suffix=suffix):
                        args=self.grype_evidence()
                        for fraction in ('.000001','.000000001'):
                            args[collection][index]['completed_at']='2026-10-19T21:40:51'+fraction+suffix
                            with self.assertRaisesRegex(ValueError,'^'+error+'$'):
                                publisher.build_evidence(*args,expected_source=SOURCE)

    def test_actual_source_database_nanoseconds_remain_admissible_and_exact(self):
        args=self.grype_evidence()
        args[8]='2026-10-20T07:30:00Z'
        args[5]['database'].update(updated_at='2026-10-20T00:59:02.286523053Z',
                                  next_update='2026-10-21T01:16:59.036595078Z')
        publisher.build_evidence(*args,expected_source=SOURCE)
        for suffix in ('Z','+00:00'):
            args[8]='2026-10-20T07:30:00.123456789'+suffix
            for scan in args[3]:
                scan['completed_at']=args[8]
            args[5]['database'].update(updated_at=args[8],
                                      next_update='2026-10-20T07:30:00.123456790'+suffix)
            publisher.build_evidence(*args,expected_source=SOURCE)
            # Neither endpoint may move through loss of sub-microsecond precision.
            for observed in ('2026-10-20T07:30:00.123456788'+suffix,
                             '2026-10-20T07:30:00.123456790'+suffix):
                args[8]=observed
                with self.assertRaisesRegex(ValueError,'^publisher-source-security-deadline$'):
                    publisher.build_evidence(*args,expected_source=SOURCE)
        self.assertEqual(publisher.evidence_time('2026-10-20T07:30:00.1Z'),
                         publisher.evidence_time('2026-10-20T07:30:00.100000000+00:00'))

    def test_source_database_interval_remains_half_open(self):
        for suffix in ('Z','+00:00'):
            args=self.grype_evidence()
            args[5]['database'].update(updated_at='2026-10-19T21:40:51'+suffix,
                                      next_update='2026-10-19T21:40:52'+suffix)
            publisher.build_evidence(*args,expected_source=SOURCE)
            for observed in ('2026-10-19T21:40:50.999999'+suffix,
                             '2026-10-19T21:40:52'+suffix,
                             '2026-10-19T21:40:52.000001'+suffix):
                args[8]=observed
                with self.assertRaisesRegex(ValueError,'^publisher-source-security-deadline$'):
                    publisher.build_evidence(*args,expected_source=SOURCE)


class Publisher(unittest.TestCase):
    def test_native_architecture_is_not_a_requested_platform_string(self):
        self.assertEqual(publisher.native_architecture('amd64','x86_64','X64'),'amd64')
        self.assertEqual(publisher.native_architecture('arm64','aarch64','ARM64'),'arm64')
        for args in [('amd64','aarch64','X64'),('arm64','x86_64','ARM64'),('amd64','x86_64','ARM64')]:
            with self.assertRaises(ValueError):publisher.native_architecture(*args)

    def test_actual_oci_bytes_config_labels_and_nonroot_identity(self):
        base,config,manifest,descriptor,subject=platform('amd64')
        for key,value in [('architecture','arm64'),('os','windows')]:
            candidate=json.loads(config);candidate[key]=value
            with self.assertRaises(ValueError):publisher.admit_platform(manifest,encoded(candidate),descriptor,'amd64',SOURCE,base)
        for key,value in [('User','root'),('Labels',{})]:
            candidate=json.loads(config);candidate['config'][key]=value
            cfg=encoded(candidate);image=json.loads(manifest);image['config'].update(digest=digest(cfg),size=len(cfg))
            raw=encoded(image);desc=dict(descriptor,digest=digest(raw),size=len(raw))
            with self.assertRaises(ValueError):publisher.admit_platform(raw,cfg,desc,'amd64',SOURCE,base)
        with self.assertRaises(ValueError):publisher.admit_platform(manifest+b' ',config,descriptor,'amd64',SOURCE,base)
        with self.assertRaises(ValueError):publisher.admit_platform(manifest,config,dict(descriptor,size=1),'amd64',SOURCE,base)
        self.assertEqual(subject['config_digest'],digest(config))

    def test_exact_complete_index_and_no_duplicate_architecture(self):
        a,b=platform('amd64'),platform('arm64')
        index=publisher.assemble_index([a[4],b[4]],[len(a[2]),len(b[2])])
        self.assertEqual(index['mediaType'],'application/vnd.oci.image.index.v1+json')
        self.assertEqual([p['platform']['architecture'] for p in index['manifests']],['amd64','arm64'])
        for records in ([a[4]],[a[4],a[4]],[b[4],a[4]]):
            with self.assertRaises(ValueError):publisher.assemble_index(records,[1]*len(records))

    def test_exact_source_security_is_required(self):
        args=evidence()
        self.assertEqual(publisher.admit_source_security(args[5],SHA,NOW)['gate_state'],'CLEAN')
        for state in ['UNKNOWN_STALE','DATABASE_FAILURE','REVIEW_REQUIRED','ACTIONABLE',None]:
            with self.assertRaises(ValueError):
                publisher.admit_source_security(dict(args[5],gate_state=state),SHA,NOW)
        with self.assertRaises(ValueError):publisher.admit_source_security(args[5],'0'*40,NOW)

    def test_actual_creation_time_and_source_scan_deadline(self):
        base,config,manifest,descriptor,subject=platform('amd64')
        candidate=json.loads(config);candidate['created']='2020-01-01T00:00:00Z'
        cfg=encoded(candidate);image=json.loads(manifest);image['config'].update(digest=digest(cfg),size=len(cfg))
        raw=encoded(image);desc=dict(descriptor,digest=digest(raw),size=len(raw))
        with self.assertRaises(ValueError):publisher.admit_platform(raw,cfg,desc,'amd64',SOURCE,base)
        security=evidence()[5]
        with self.assertRaises(ValueError):publisher.admit_source_security(security,SHA,'2026-10-20T00:00:00Z')
        with self.assertRaises(ValueError):publisher.admit_source_security(security,SHA,'2026-10-17T00:00:00Z')

    def test_build_evidence_binds_source_attempt_sbom_scanners_and_native_smoke(self):
        args=evidence()
        valid=publisher.build_evidence(*args,expected_source=SOURCE)
        self.assertEqual(valid['schema_version'],'1.0.0')
        self.assertEqual(len(valid['scans']),4)
        self.assertEqual(valid['workflow']['run_attempt'],'2')
        mutations=[
            lambda a:a[0][0].update(runner_architecture='arm64'),
            lambda a:a[0][0]['builder'].update(version='moving'),
            lambda a:a[0][0].update(workflow_run_attempt='1'),
            lambda a:a[2][0].update(artifact='ghcr.io/other/api@sha256:'+'f'*64),
            lambda a:a[3][0].update(subject_digest='sha256:'+'f'*64),
            lambda a:a[3][0].update(policy_result='UNKNOWN_STALE'),
            lambda a:a[4][0].update(result='FAILED'),
            lambda a:a[4][0].update(test='unrelated-probe'),
            lambda a:a[4][0].update(workflow_run_id='1'),
            lambda a:a[4].pop(),
        ]
        for mutate in mutations:
            candidate=copy.deepcopy(args);mutate(candidate)
            with self.assertRaises(ValueError):publisher.build_evidence(*candidate,expected_source=SOURCE)
        with self.assertRaises(ValueError):
            publisher.build_evidence(*args,expected_source=dict(SOURCE,commit='0'*40))

    def test_canonical_source_schema_rejects_malformed_clean_without_echoing_payload(self):
        root=Path(__file__).resolve().parents[1]
        script=(root/'scripts/publish-container.sh').read_text()
        start=script.index('import json,sys\nfrom jsonschema')
        block=script[start:script.index('\nPY\n',start)]
        schema=root/'.context/publisher-governance/docs/schemas/secpal-trivy-repository-scan-v2.schema.json'
        self.assertTrue(schema.is_file(), 'accepted shared schema checkout is required')
        marker='SECPAL_SYNTHETIC_UNTRUSTED_FIELD'
        with tempfile.TemporaryDirectory() as directory:
            candidate=Path(directory)/'result.json'
            candidate.write_text(json.dumps(dict(gate_state='CLEAN',unexpected=marker)))
            result=subprocess.run([sys.executable,'-c',block,str(schema),str(candidate)],
                                  capture_output=True,text=True,check=False)
        self.assertNotEqual(result.returncode,0)
        self.assertEqual(result.stderr.strip(),'FAIL: malformed source-security evidence')
        self.assertNotIn(marker,result.stdout+result.stderr)

    def test_registry_copy_arguments_execute_with_pinned_oras(self):
        root=Path(__file__).resolve().parents[1]
        oras=Path(os.environ['SECPAL_TEST_ORAS']).resolve()
        script=(root/'scripts/publish-container.sh').read_text()
        commands=[shlex.split(line.strip().rstrip(chr(92)).strip())[2:]
                  for line in script.splitlines() if '"$tools/oras" cp ' in line]
        self.assertTrue(commands)
        with tempfile.TemporaryDirectory() as directory:
            work=Path(directory)
            (work/'payload.txt').write_text('non-secret local CLI conformance probe\n')
            auth=work/'auth.json';auth.write_text('{"auths":{}}\n');auth.chmod(0o600)
            source=work/'source'
            subprocess.run([str(oras),'push','--oci-layout','--artifact-type',
                            'application/vnd.secpal.cli-probe.v1',str(source)+':probe',
                            'payload.txt:text/plain'],cwd=work,capture_output=True,text=True,check=True)
            original=json.loads((source/'index.json').read_text())['manifests'][0]['digest']
            for index,arguments in enumerate(commands):
                destination=work/('copy-'+str(index))
                actual=[str(auth) if value=='$REGISTRY_AUTH_FILE' else value for value in arguments]
                result=subprocess.run([str(oras),'cp',*actual,'--to-oci-layout',
                                       str(source)+':probe',str(destination)+':probe'],
                                      cwd=work,capture_output=True,text=True,check=False)
                self.assertEqual(result.returncode,0,result.stderr)
                observed=json.loads((destination/'index.json').read_text())['manifests'][0]['digest']
                self.assertEqual(observed,original)

    def test_missing_or_malformed_required_evidence_does_not_become_success(self):
        for collection,key,value in [(2,'spdx_sha256','not-a-digest'),(2,'syft_version','moving'),
                                      (3,'evidence_sha256','missing'),(3,'scanner_version','unknown'),
                                      (4,'completed_at','bad-time')]:
            args=evidence();args[collection][0][key]=value
            with self.assertRaises(ValueError):publisher.build_evidence(*args,expected_source=SOURCE)


if __name__=='__main__':
    unittest.main()
