<!--
SPDX-FileCopyrightText: 2025 SecPal
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Git Hooks Diagnostic Tool

A diagnostic tool to troubleshoot git hook issues, particularly pre-push hook problems.

## Purpose

This tool helps identify and diagnose issues where git hooks appear to execute on commands other than their intended triggers (e.g., pre-push hook running on `git status` or `git log`).

## Usage

```bash
./scripts/diagnose-hooks.sh
```

## What It Checks

1. **Repository Information**
   - Git root directory
   - Current branch

2. **Hook Installation**
   - Verifies pre-push hook is correctly installed as a symlink
   - Checks if symlink target exists
   - Identifies broken or incorrect installations

3. **Git Configuration**
   - Displays `core.hooksPath` setting
   - Lists all hook-related git config entries

4. **Shell Environment**
   - Current shell ($SHELL)
   - Git binary location and version
   - Checks for git aliases or wrapper functions

5. **Hook Execution Test**
   - Runs `git status` to verify hooks don't trigger unnecessarily
   - Times the execution to detect performance issues

6. **Prompt/Tool Integrations**
   - Detects common tools that may trigger git commands:
     - **starship** (customizable shell prompt)
     - **direnv** (directory-based environment switching)
     - **oh-my-zsh** git plugins
   - These tools often execute git commands in the background

7. **Recent Git Operations**
   - Shows last 10 reflog entries for context

## Output

The tool provides a comprehensive report with:

- ✅ Green checkmarks for correct configuration
- ⚠️ Yellow warnings for potential issues
- ❌ Red errors for problems requiring attention
- 💡 Recommendations for fixing identified issues

## Common Issues Identified

### Symptom: Pre-push hook runs on every git command

**Cause:** Shell prompt or direnv executing git commands on every prompt render

**Fix:**

```bash
# Temporarily disable starship
mv ~/.config/starship.toml ~/.config/starship.toml.bak

# Temporarily disable direnv
mv .envrc .envrc.bak

# Test git operations
git status
```

### Symptom: Hook not found or broken symlink

**Cause:** Hook not installed or incorrectly installed

**Fix:**

```bash
./scripts/setup-pre-push.sh
```

### Symptom: Hook runs but is very slow

**Cause:** Dependency installation running unnecessarily

**Fix:**
The hook is already optimized to skip installation when `node_modules` is up-to-date. If still slow:

```bash
# Check if node_modules is outdated
ls -ld node_modules pnpm-lock.yaml

# Force update if needed
PREFLIGHT_FORCE_INSTALL=1 git push
```

## When to Use

- Pre-push hook appears to run on commands other than `git push`
- Git operations feel slow or hang
- Setting up development environment on a new machine
- After modifying shell configuration (zshrc, bashrc)
- Before reporting a git hook bug

## Reporting Issues

If you've run the diagnostic and still experience problems:

1. Run: `./scripts/diagnose-hooks.sh > diagnostic-output.txt`
2. Attach `diagnostic-output.txt` to your GitHub issue
3. Include:
   - What command you ran (e.g., `git status`)
   - What you expected (command completes quickly)
   - What happened (hook executed, causing delay)

## Related

- [CONTRIBUTING.md](../CONTRIBUTING.md) - See "Troubleshooting" section
- [GitHub Issue #392](https://github.com/SecPal/frontend/issues/392) - Pre-push hook execution bug report
