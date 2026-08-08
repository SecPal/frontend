#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: MIT

set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
fixture="$(mktemp -d "${TMPDIR:-/tmp}/frontend-pr-size-advisory.XXXXXX")"
trap 'rm -rf -- "$fixture"' EXIT
remote="$fixture/remote.git"
system_git="$(command -v git)"
system_timeout="$(command -v timeout || true)"

mkdir -p "$fixture/scripts" "$fixture/bin"
cp "$repo_root/scripts/preflight.sh" "$fixture/scripts/preflight.sh"
for command in npx npm reuse; do
  printf '#!/usr/bin/env bash\nexit 0\n' >"$fixture/bin/$command"
  chmod +x "$fixture/bin/$command"
done
# shellcheck disable=SC2016 # Generated wrapper must expand these variables when executed.
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'if [ "${1:-}" = "ls-remote" ]; then' \
  '  printf "GIT_TERMINAL_PROMPT=%s\\n" "${GIT_TERMINAL_PROMPT:-}" >>"$GIT_PROBE_LOG"' \
  'fi' \
  'exec "$SYSTEM_GIT" "$@"' >"$fixture/bin/git"
chmod +x "$fixture/bin/git"

if [ -n "$system_timeout" ]; then
  # shellcheck disable=SC2016 # Generated wrapper must expand these variables when executed.
  printf '%s\n' \
    '#!/usr/bin/env bash' \
    'printf "timeout %s\\n" "$1" >>"$GIT_PROBE_LOG"' \
    'exec "$SYSTEM_TIMEOUT" "$@"' >"$fixture/bin/timeout"
  chmod +x "$fixture/bin/timeout"
fi

(
  git init --bare --quiet "$remote"
  cd "$fixture"
  git init --quiet --initial-branch=main
  git config user.name "SecPal Test"
  git config user.email "test@secpal.dev"
  git config commit.gpgSign false
  : >seed.txt
  git add .
  git commit --quiet -m "test: seed fixture"
  git remote add origin "$remote"
  git push --quiet -u origin main
  git checkout --quiet -b stale-topic
  awk 'BEGIN { for (line = 1; line <= 30; line++) print "stale " line }' >stale.txt
  git add stale.txt
  git commit --quiet -m "test: add stale topic changes"
  git push --quiet -u origin stale-topic
  git checkout --quiet main
  awk 'BEGIN { for (line = 1; line <= 30; line++) print "main " line }' >main.txt
  git add main.txt
  git commit --quiet -m "test: advance main beyond stale topic"
  git push --quiet origin main
  git update-ref refs/remotes/origin/main main
  git update-ref refs/remotes/origin/stale-topic stale-topic
  git -C "$remote" symbolic-ref HEAD refs/heads/main
  git symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/stale-topic
  git checkout --quiet -b test-branch
  awk 'BEGIN { for (line = 1; line <= 601; line++) print "line " line }' >large.txt
  git add large.txt
  git commit --quiet -m "test: exceed advisory threshold"
)

set +e
(cd "$fixture" && SYSTEM_GIT="$system_git" SYSTEM_TIMEOUT="$system_timeout" GIT_PROBE_LOG="$fixture/git-probe.log" PATH="$fixture/bin:/usr/bin:/bin" bash scripts/preflight.sh) \
  >"$fixture/stdout" 2>"$fixture/stderr"
status=$?
set -e

test "$status" -eq 0
grep -Fq "GIT_TERMINAL_PROMPT=0" "$fixture/git-probe.log"
if [ -n "$system_timeout" ]; then
  grep -Fq "timeout 5" "$fixture/git-probe.log"
fi
grep -Fq "Using base branch: main" "$fixture/stdout"
grep -Fq "PR size: 601 changed lines (601 insertions, 0 deletions; advisory threshold: 600)" \
  "$fixture/stderr"
grep -Fq "WARNING: PR size advisory threshold exceeded." "$fixture/stderr"

(
  cd "$fixture"
  git remote set-url origin "$fixture/missing-remote.git"
)
set +e
(cd "$fixture" && SYSTEM_GIT="$system_git" SYSTEM_TIMEOUT="$system_timeout" GIT_PROBE_LOG="$fixture/git-probe.log" PATH="$fixture/bin:/usr/bin:/bin" bash scripts/preflight.sh) \
  >"$fixture/offline-stdout" 2>"$fixture/offline-stderr"
offline_status=$?
set -e
test "$offline_status" -eq 0
grep -Fq "Using base branch: main" "$fixture/offline-stdout"

printf '[\n' >"$fixture/.preflight-exclude"
(
  cd "$fixture"
  git add .preflight-exclude
  git commit --quiet -m "test: add invalid exclusion"
)
set +e
(cd "$fixture" && SYSTEM_GIT="$system_git" SYSTEM_TIMEOUT="$system_timeout" GIT_PROBE_LOG="$fixture/git-probe.log" PATH="$fixture/bin:/usr/bin:/bin" bash scripts/preflight.sh) \
  >"$fixture/invalid-stdout" 2>"$fixture/invalid-stderr"
invalid_status=$?
set -e
test "$invalid_status" -eq 0
grep -Fq "contains invalid regex pattern(s)" "$fixture/invalid-stderr"
grep -Fq "WARNING: PR size advisory threshold exceeded." "$fixture/invalid-stderr"

policy_files=(
  "$repo_root/README.md"
  "$repo_root/CONTRIBUTING.md"
  "$repo_root/.preflight-exclude"
  "$repo_root/scripts/preflight.sh"
)
for policy_file in "${policy_files[@]}"; do
  for obsolete_policy in \
    ".preflight-allow-large-pr" \
    "large-pr-approved" \
    "Excluded from PR size calculation" \
    "PR size validation (≤600 lines)" \
    "PRs must be ≤600 lines" \
    "600-line PR size check" \
    "Maximum allowed: 600" \
    "PR TOO LARGE"; do
    if grep -Fq "$obsolete_policy" "$policy_file"; then
      echo "Obsolete hard-size policy remains in ${policy_file#"$repo_root/"}: $obsolete_policy" >&2
      exit 1
    fi
  done
done

if grep -Eni \
  'PR Size Limit|Maximum allowed: 600|600-line (limit|PR size check)|PRs must be[[:space:]]*≤?[[:space:]]*600 lines|PR size validation \(≤[[:space:]]*600 lines\)' \
  "${policy_files[@]}" >/dev/null; then
  echo "Policy documentation must not describe 600 lines as a hard maximum" >&2
  exit 1
fi

grep -Fiq "advisory PR-size reporting" "$repo_root/README.md"
grep -Fiq "advisory PR-size reporting" "$repo_root/.preflight-exclude"
grep -Eq '^# SPDX-FileCopyrightText: .*2026' "$repo_root/.preflight-exclude"
grep -Eq \
  'uses: SecPal/\.github/\.github/workflows/reusable-pr-size\.yml@[0-9a-f]{40}$' \
  "$repo_root/.github/workflows/pr-size.yml"
if grep -Fq "@7f5d24a599c03cdc59998c22578c345c518b755d" \
  "$repo_root/.github/workflows/pr-size.yml"; then
  echo "Hosted PR-size workflow remains pinned before SecPal/.github#596" >&2
  exit 1
fi

node - "$repo_root/package.json" <<'NODE'
const { readFileSync } = require("node:fs");

const packageJson = JSON.parse(readFileSync(process.argv[2], "utf8"));
const scripts = packageJson.scripts ?? {};
if (scripts["test:pr-size-advisory"] !== "bash tests/pr-size-advisory.sh") {
  throw new Error("package.json must expose the focused PR-size regression");
}

const directVitestScripts = Object.entries(scripts)
  .filter(([testScript, command]) =>
    testScript.startsWith("test") && /^vitest(?:\s|$)/.test(command),
  )
  .map(([testScript]) => testScript);
if (directVitestScripts.length === 0) {
  throw new Error("package.json must expose at least one direct Vitest script");
}

for (const testScript of directVitestScripts) {
  const lifecycleScript = testScript === "test" ? "pretest" : `pre${testScript}`;
  if (scripts[lifecycleScript] !== "npm run test:pr-size-advisory") {
    throw new Error(`${lifecycleScript} must run the focused PR-size regression`);
  }
}
NODE

echo "tests/pr-size-advisory.sh: advisory PR-size reporting verified."
