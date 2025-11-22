<!--
SPDX-FileCopyrightText: 2025 SecPal
SPDX-License-Identifier: CC0-1.0
-->

# TDD Workflow with Git Commit Verification

Test-Driven Development (TDD) is a **mandatory requirement** for all SecPal contributions. This guide shows how to practice TDD effectively and verify compliance through Git commit history.

## Why TDD?

- **Design First**: Writing tests first forces you to think about API design before implementation
- **Confidence**: Tests prove your code works as expected
- **Refactoring Safety**: Change code freely, tests catch regressions
- **Documentation**: Tests serve as living examples of how to use your code
- **Review Quality**: Reviewers can verify tests were written first

## The TDD Cycle (Red-Green-Refactor)

```text
1. 🔴 RED: Write a failing test
2. 🟢 GREEN: Write minimal code to make it pass
3. 🔵 REFACTOR: Improve code while keeping tests green
4. Repeat
```

## Git Workflow for TDD

### ✅ Correct Workflow

```bash
# 1. Create feature branch
git checkout -b feat/user-profile

# 2. Write failing test FIRST
cat > src/components/UserProfile.test.tsx << 'EOF'
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserProfile } from './UserProfile';

describe('UserProfile', () => {
  it('renders user name', () => {
    render(<UserProfile user={{ name: 'John Doe', email: 'john@example.com' }} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
});
EOF

# 3. Verify test fails (RED phase)
npm test

# 4. Commit test FIRST
git add src/components/UserProfile.test.tsx
git commit -S -m "test: Add UserProfile component tests"

# 5. Implement component to pass test (GREEN phase)
cat > src/components/UserProfile.tsx << 'EOF'
export function UserProfile({ user }: { user: { name: string; email: string } }) {
  return <div>{user.name}</div>;
}
EOF

# 6. Verify test passes
npm test

# 7. Commit implementation
git add src/components/UserProfile.tsx
git commit -S -m "feat: Implement UserProfile component"

# 8. Refactor (REFACTOR phase) - optional
# Improve code, add TypeScript types, extract logic, etc.
git commit -S -m "refactor: Extract UserProfile props interface"
```

### ❌ Wrong Workflow (Anti-pattern)

```bash
# ❌ DON'T DO THIS:
git checkout -b feat/user-profile

# Writing implementation BEFORE tests
cat > src/components/UserProfile.tsx << 'EOF'
export function UserProfile({ user }) {
  return <div>{user.name}</div>;
}
EOF

# Adding tests as an afterthought
cat > src/components/UserProfile.test.tsx << 'EOF'
// Tests added later just to satisfy coverage requirements
EOF

# Committing both together (hides TDD violation)
git add .
git commit -m "feat: Add UserProfile component with tests"
```

**Why this is wrong:**

- No proof tests were written first
- Tests may be biased towards implementation (not requirements)
- Loses TDD benefits (design thinking, minimal implementation)

## Verifying TDD Compliance

### For PR Authors

Before creating a PR, verify your commit history shows TDD:

```bash
# Show commit history for your branch
git log --oneline main..HEAD

# Example GOOD output:
# abc123 refactor: Extract UserProfile helpers
# def456 feat: Implement UserProfile component
# ghi789 test: Add UserProfile component tests  <-- Test came FIRST

# Show file changes per commit
git log --name-status main..HEAD

# Example GOOD output:
# ghi789 test: Add UserProfile component tests
#   A src/components/UserProfile.test.tsx
# def456 feat: Implement UserProfile component
#   A src/components/UserProfile.tsx
```

**Self-check:**

- [ ] Each `.test.tsx` file committed **before** corresponding `.tsx` implementation
- [ ] Commit messages clearly show test-first approach
- [ ] No combined commits mixing tests and implementation

### For PR Reviewers

#### Quick Check (Git history)

```bash
# Clone or update the repo
git fetch origin pull/123/head:pr-123
git checkout pr-123

# View commit history
git log --oneline --name-status main..pr-123

# Look for test files committed before implementation files
```

**Red flags:**

- ❌ Implementation and tests in same commit
- ❌ Tests added in last commit (after implementation)
- ❌ Test commits have `fix:` prefix (suggests tests added during debugging)

#### Detailed Check (Commit diffs)

```bash
# Show what changed in each commit
git log -p main..pr-123

# Check first commit adds only tests
git show <first-commit-sha>
# Should see: +++ b/src/components/Something.test.tsx (ONLY test file)

# Check second commit adds implementation
git show <second-commit-sha>
# Should see: +++ b/src/components/Something.tsx (implementation file)
```

## PR Template TDD Checklist

Add this to your PR description:

```markdown
## TDD Compliance

- [ ] Tests were written **before** implementation
- [ ] Git history shows `.test.tsx` commits before `.tsx` commits
- [ ] All tests pass (`npm test`)
- [ ] Coverage increased or maintained (check Codecov comment)

**How to verify:** Run `git log --oneline --name-status main..HEAD` to see commit order

**Example output:**
\`\`\`
abc123 feat: Implement feature X
M src/feature.tsx
def456 test: Add tests for feature X
A src/feature.test.tsx
\`\`\`
```

## Pre-commit Hook (Optional)

Warn if committing implementation without tests:

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

# Check for new .tsx files without corresponding .test.tsx
for FILE in $STAGED_FILES; do
  if [[ $FILE =~ \.tsx$ ]] && [[ ! $FILE =~ \.test\.tsx$ ]]; then
    TEST_FILE="${FILE%.tsx}.test.tsx"

    if ! git ls-files --error-unmatch "$TEST_FILE" >/dev/null 2>&1; then
      echo "⚠️  WARNING: Committing $FILE without $TEST_FILE"
      echo "   TDD requires tests to be written FIRST"
      echo "   Consider:"
      echo "   1. Unstage this file: git reset HEAD $FILE"
      echo "   2. Write test: $TEST_FILE"
      echo "   3. Commit test first, then implementation"
      read -p "Continue anyway? (y/N) " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
      fi
    fi
  fi
done
```

Install:

```bash
chmod +x .git/hooks/pre-commit
```

## Examples from Existing PRs

### ✅ Good Example: PR #204 (Login UI)

```bash
git log --oneline --name-status main..pr-204

# Output shows TDD:
# commit 3: feat: Implement Login component
#   A src/pages/Login.tsx
# commit 2: test: Add Login component tests
#   A src/pages/Login.test.tsx
# commit 1: feat: Add AuthContext
#   A src/contexts/AuthContext.tsx
```

**What makes this good:**

- Test file committed before implementation
- Clear commit messages
- Separate concerns (context → tests → implementation)

### ❌ Bad Example: PR #XXX (Hypothetical)

```bash
# Output violates TDD:
# commit 1: feat: Add UserProfile component
#   A src/components/UserProfile.tsx
#   A src/components/UserProfile.test.tsx
```

**Problems:**

- Tests and implementation in same commit
- No proof tests were written first
- Cannot verify TDD compliance

## FAQ

### Q: What if I need to fix failing tests?

**A:** Fixing tests is fine, but commit structure should still show test-first intent:

```bash
# Original (TDD compliant)
git commit -m "test: Add feature X tests"
git commit -m "feat: Implement feature X"

# Later: Found edge case
git commit -m "test: Add edge case test for feature X"
git commit -m "fix: Handle edge case in feature X"
```

### Q: What if I'm refactoring existing code?

**A:** Write tests for existing behavior FIRST, then refactor:

```bash
git commit -m "test: Add tests for legacy function Y"
git commit -m "refactor: Simplify function Y implementation"
```

### Q: Can I squash commits before merging?

**A:** Yes, but **after PR review**. Squash ONLY during merge, not before review:

```bash
# During review: Keep commit history to show TDD
git log --oneline

# On merge: GitHub's "Squash and merge" is fine
# Preserves original history in PR for reference
```

## Tools & Resources

- **Vitest** (frontend testing): `npm test`
- **Pest** (backend testing): `ddev exec php artisan test`
- **Coverage reports**: Check Codecov bot comment on PR
- **Git history**: `git log --oneline --name-status main..HEAD`

## References

- [Test-Driven Development by Example (Kent Beck)](https://www.amazon.com/Test-Driven-Development-Kent-Beck/dp/0321146530)
- [Growing Object-Oriented Software, Guided by Tests](http://www.growing-object-oriented-software.com/)
- [Martin Fowler: Test-Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- [SecPal Contributing Guide](../../CONTRIBUTING.md)
- [Organization-wide Copilot Instructions](../../.github/copilot-instructions.md)
