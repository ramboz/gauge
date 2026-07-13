---
status: DONE
tier: standard
severity:
claimed_by: main
regression_test: test/scan.test.mjs::worktree-only docs
main_repro_checked_at: 2026-07-13
main_repro_ref: origin/main@a82e60543076223d516cb2fe80be9007e2e89960
main_repro_result: reproduces
red_confirmed_at: 2026-07-13
green_confirmed_at: 2026-07-13
fix_class: structural_fix
security_surface: false
escalated_to:
---

# Bug 001: missing-worktree-fixture

## Symptom

`npm test` reports 28 passing tests and one failure. The
`worktree-only docs flagged by path comparison` test expects one fixture result
but receives none.

## Repro

Run:

```sh
node --test --test-name-pattern="worktree-only docs" test/scan.test.mjs
```

The assertion at `test/scan.test.mjs:83` fails with `0 !== 1`.

## Evidence

- The test expects
  `test/fixtures/proj-jig/.claude/worktrees/wt-lost/docs/notes/lost-doc.md`.
- `find test/fixtures/proj-jig -type f` shows no such fixture.
- `git check-ignore -v` attributes the missing path to `.gitignore:6` and the
  repository-wide `.claude/` rule.
- `git ls-tree -r origin/main -- test/fixtures/proj-jig` confirms the fixture
  was never tracked on the fresh baseline.
- `scanWorktreeOnlyDocs` reads exactly `<project>/.claude/worktrees/*/docs` and
  compares those paths with the project main tree, matching the acceptance
  criterion and test expectation.

## Hypotheses

<!-- Anti-anchoring: >=2 candidates, mark the leading one. Any Markdown
     list works (-, *, +, or 1.); the gate counts top-level items only
     (indented sub-bullets are notes, not hypotheses). -->
- [ ] H1: `scanWorktreeOnlyDocs` looks in the wrong directory or compares the
  wrong relative path; falsified by reading the implementation, which scans the
  exact `.claude/worktrees/<name>/docs` fixture shape asserted by the test.
- [x] H2 (leading): the intended worktree fixture existed only in an author's
  ignored local tree and was never committed; confirmed by the ignore trace,
  absent working-tree path, and absent `origin/main` tree entry.

## Root cause

The fixture process conflicts with the production ignore policy. The broad
`.claude/` rule correctly protects machine-local Claude state everywhere, but
it also silently excludes the synthetic `.claude` subtree that the committed
test needs. The test and scanner contract are sound; the repository is missing
its input because no narrow test-fixture exception exists.

## Fix class

`structural_fix` — make the intentional synthetic fixture trackable while
preserving the production `.claude/` ignore.

## Fix

Add a narrow `.gitignore` exception for the fixture subtree and commit the
single synthetic worktree-only Markdown document expected by the regression
test.

## Already tried

- 2026-07-13 - green check failed for `node --test --test-name-pattern="worktree-only docs" test/scan.test.mjs` (tdd.py exit 1)
- The initial lifecycle selector incorrectly stored a shell command. Jig's TDD
  helper expects `<test-path>::<test-name>`; corrected to
  `test/scan.test.mjs::worktree-only docs` before repeating the witnessed
  red/green cycle.

## Regression test

The existing focused test is the regression witness:

```sh
node --test --test-name-pattern="worktree-only docs" test/scan.test.mjs
```

## Proof

- Focused regression: 1 passed, 0 failed.
- Full suite: 29 passed, 0 failed.
- `git check-ignore -v` identifies the narrow test-fixture negation rather than
  the production `.claude/` exclusion for the synthetic document.

## Learning

Repository-wide ignores can silently remove fixtures that intentionally model
ignored runtime state. Keep the production ignore broad, add the narrowest
possible test-path exception, and verify fixture presence with both
`git check-ignore` and `git ls-tree` when a test passes only in an author's
working copy.

## Main recheck

- 2026-07-13 - `origin/main@a82e60543076223d516cb2fe80be9007e2e89960` -> reproduces: node --test --test-name-pattern=worktree-only\ docs test/scan.test.mjs fails at test/scan.test.mjs:83 with 0 !== 1
