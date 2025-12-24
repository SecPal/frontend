#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2025 SecPal Contributors
# SPDX-License-Identifier: MIT

# Diagnostic script to help troubleshoot pre-push hook issues
# Usage: ./scripts/diagnose-hooks.sh

set -euo pipefail

echo "🔍 Git Hooks Diagnostic Tool"
echo "================================"
echo ""

# 1. Repository info
echo "📁 Repository Information:"
echo "  Root: $(git rev-parse --show-toplevel 2>/dev/null || echo 'NOT A GIT REPO')"
echo "  Branch: $(git symbolic-ref --short HEAD 2>/dev/null || echo 'DETACHED HEAD')"
echo ""

# 2. Hook installation
echo "🔗 Hook Installation:"
if [ -L .git/hooks/pre-push ]; then
  TARGET=$(readlink .git/hooks/pre-push)
  echo "  ✅ pre-push is a symlink"
  echo "  Target: $TARGET"
  if [ -f .git/hooks/pre-push ]; then
    echo "  ✅ Target file exists"
  else
    echo "  ❌ Target file NOT found (broken symlink)"
  fi
elif [ -f .git/hooks/pre-push ]; then
  echo "  ⚠️  pre-push is a regular file (should be symlink)"
  echo "  First 5 lines:"
  head -5 .git/hooks/pre-push | sed 's/^/    /'
elif [ -e .git/hooks/pre-push ]; then
  echo "  ❌ pre-push exists but is neither file nor symlink"
else
  echo "  ⚠️  pre-push hook NOT installed"
fi
echo ""

# 3. Git configuration
echo "⚙️  Git Configuration:"
echo "  Hooks path: $(git config --get core.hooksPath 2>/dev/null || echo 'default (.git/hooks)')"
echo "  Hook-related configs:"
git config --list | grep -i hook | sed 's/^/    /' || echo "    (none found)"
echo ""

# 4. Shell environment
echo "🐚 Shell Environment:"
echo "  SHELL: ${SHELL:-<not set>}"
echo "  Git binary: $(command -v git || echo 'NOT FOUND')"
echo "  Git version: $(git --version 2>/dev/null || echo 'ERROR')"
echo ""

# 5. Check for git aliases/wrappers
echo "🔧 Git Aliases/Wrappers:"
if type git 2>&1 | grep -q 'alias'; then
  echo "  ⚠️  'git' is aliased:"
  type git | sed 's/^/    /'
elif type git 2>&1 | grep -q 'function'; then
  echo "  ⚠️  'git' is a shell function:"
  type git | sed 's/^/    /'
else
  echo "  ✅ 'git' is not aliased or wrapped"
fi
echo ""

# 6. Test hook execution
echo "🧪 Hook Execution Test:"
echo "  Testing: Running 'git status' (should NOT trigger pre-push hook)"
echo "  ---"
timeout 3 git status >/dev/null 2>&1 && echo "  ✅ git status completed without delay" || echo "  ❌ git status failed or hung"
echo "  ---"
echo ""

# 7. Check for prompt integrations
echo "🎨 Prompt/Tool Integrations:"
INTEGRATIONS=()
command -v starship >/dev/null 2>&1 && INTEGRATIONS+=("starship")
command -v direnv >/dev/null 2>&1 && INTEGRATIONS+=("direnv")
[ -f .envrc ] && INTEGRATIONS+=(".envrc file")
[ -n "${STARSHIP_SHELL:-}" ] && INTEGRATIONS+=("starship active")

if [ ${#INTEGRATIONS[@]} -gt 0 ]; then
  echo "  Found: ${INTEGRATIONS[*]}"
  echo "  ⚠️  These tools may trigger git commands in the background"
else
  echo "  ✅ No known integrations detected"
fi
echo ""

# 8. Recent git operations
echo "📜 Recent Git Operations (last 10 from reflog):"
git reflog --format='  %gd: %gs (%cr)' -10 2>/dev/null | head -10 || echo "  (reflog unavailable)"
echo ""

# 9. Recommendations
echo "💡 Recommendations:"
echo ""

if [ -L .git/hooks/pre-push ] && [ -f .git/hooks/pre-push ]; then
  echo "  ✅ Hook installation looks correct"
  echo ""
  echo "  If you're experiencing issues with hooks running on non-push commands:"
  echo ""
  echo "  1. Check your shell configuration (~/.zshrc, ~/.bashrc, ~/.config/starship.toml)"
  echo "     Look for git-related hooks, prompts, or directory change scripts"
  echo ""
  echo "  2. Try running in a clean shell:"
  echo "     env -i HOME=\"\$HOME\" TERM=\"\$TERM\" bash --norc --noprofile"
  echo ""
  echo "  3. Check if tools like direnv or starship are executing git commands:"
  echo "     GIT_TRACE=1 git status 2>&1 | grep -i hook"
  echo ""
  echo "  4. Disable integrations temporarily:"
  echo "     mv ~/.config/starship.toml ~/.config/starship.toml.bak"
  echo "     mv .envrc .envrc.bak"
  echo ""
  echo "  5. Reinstall hooks cleanly:"
  echo "     rm .git/hooks/pre-push && ./scripts/setup-pre-push.sh"
else
  echo "  ⚠️  Hook installation issue detected!"
  echo ""
  echo "  Run: ./scripts/setup-pre-push.sh"
fi

echo ""
echo "================================"
echo "Diagnostic complete!"
echo ""
echo "If issues persist, share this output when reporting bugs."
