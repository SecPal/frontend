#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2025 SecPal Contributors
# SPDX-License-Identifier: MIT

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
GIT_HOOKS_DIR="$ROOT_DIR/.git/hooks"
PROJECT_HOOKS_DIR="$ROOT_DIR/.githooks"

echo "Setting up pre-commit hooks..."

# Create .githooks directory if it doesn't exist
mkdir -p "$PROJECT_HOOKS_DIR"

# Create pre-push hook
cat > "$PROJECT_HOOKS_DIR/pre-push" << 'EOF'
#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2025 SecPal Contributors
# SPDX-License-Identifier: MIT

set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

# Check if current branch is spike/*
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" == spike/* ]]; then
  echo "Spike branch detected ($BRANCH) - running minimal checks (formatting + REUSE)"
  
  # Run only formatting and REUSE compliance
  FORMAT_EXIT=0
  if command -v npx >/dev/null 2>&1; then
    npx --yes prettier --check '**/*.{md,yml,yaml,json,ts,tsx,js,jsx}' || FORMAT_EXIT=1
    npx --yes markdownlint-cli2 '**/*.md' || FORMAT_EXIT=1
  fi
  if command -v reuse >/dev/null 2>&1; then
    reuse lint || FORMAT_EXIT=1
  fi
  
  if [ "$FORMAT_EXIT" -ne 0 ]; then
    echo "Formatting/compliance checks failed. Fix issues above." >&2
    exit 1
  fi
  
  echo "Spike branch checks passed."
  exit 0
fi

# For non-spike branches, run full preflight script
if [ -f "$ROOT_DIR/scripts/preflight.sh" ]; then
  "$ROOT_DIR/scripts/preflight.sh"
else
  echo "Warning: preflight.sh not found - skipping pre-push checks" >&2
fi
EOF

chmod +x "$PROJECT_HOOKS_DIR/pre-push"

# Create symlink in .git/hooks
ln -sf "$PROJECT_HOOKS_DIR/pre-push" "$GIT_HOOKS_DIR/pre-push"

echo "✅ Pre-commit hooks configured successfully"
echo "   - Pre-push hook: Runs preflight.sh before every push"
echo "   - Spike branches: Only formatting + REUSE (tests skipped)"
echo ""
echo "To bypass (NOT RECOMMENDED):"
echo "   git push --no-verify"
