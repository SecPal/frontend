# Delivery Contract

Summarize the single observable behavior, interface, workflow, or governance
rule this pull request delivers.

Fixes # (one leaf issue)
Part of: # (native parent, when the leaf has one)

## Evidence

Classify the evidence used and list the exact commands or manual checks:

- Behavior/contract evidence (failing first for observable behavior changes):
- Integration/real-system evidence (for distinct seams):
- Structural/characterization evidence (for behavior-preserving work):

Explain when one scenario proves multiple acceptance criteria. Stop at the
smallest non-redundant evidence set.

## Review Findings

Record named blockers from the one bounded full review and their disposition:

- In-contract defect:
- Missing prerequisite/native graph change:
- New responsibility or non-blocking follow-up:
- Invalid finding with refuting evidence:

After blocker remediation, verify only the delta. New independent
responsibilities modify the work graph instead of expanding this pull request.

## Checklist

- [ ] This pull request closes one leaf and does not close an epic.
- [ ] GitHub-native graph state, not body relationship/status mirrors, defines
      ownership and executability.
- [ ] The contract and proportional evidence satisfy the leaf's acceptance
      criteria.
- [ ] Relevant lint, typecheck, tests, formatting, and repository preflight pass.
- [ ] Security, privacy, storage, accessibility, licensing, and domain invariants
      touched by this contract remain satisfied.
- [ ] `CHANGELOG.md` is updated when this is a real fix, feature, or breaking
      change.
