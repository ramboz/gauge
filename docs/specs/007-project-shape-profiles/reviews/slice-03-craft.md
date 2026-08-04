---
slice: 007-03 — Profile discovery and onboarding
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-04T00:47:56Z
prompt_source: review.py pr-review
---

VERDICT: pass

REASONING:
discover.mjs is a clean, well-scoped pure module matching the codebase idiom (mirrors scan.mjs isDir, snapshot.mjs parseArgs) and imports only safeProjectId to honor the AC5 purity contract. Declaration/heuristic/default/none precedence is deterministic; the mystique stray-docs case is handled and tested; the CLI defensively re-validates the proposed profile with sound exit codes. Tests cover all ACs including read-only (AC4) and edge-reusability (AC5). No blockers; only nits.

SPECIFIC ISSUES:
- scripts/onboard.mjs — [nit] `--json` advertised no-op → FIXED before recording.
- src/discover.mjs:68 — [nit] parseScopeTags handles scalar + inline-list but not YAML block-list form (graceful degradation to dir-sort order). Documented limitation of the zero-dep line scanner (ADR-0001).
- src/discover.mjs — [nit] label not deduped on basename collision (ids are); cosmetic.
- src/discover.mjs:55 — [nit] safeProjectId can throw on a pathological dir name; CLI would show a raw stack trace → FIXED (onboard.mjs now wraps discovery in try/catch → graceful fail).
- src/discover.mjs:21 — [strength] isDir / read-only touches faithfully implement AC4; isDir duplication with scan.mjs is within ADR-0002 extract-on-third-caller budget (2 callers).
- test/discover.test.mjs — [strength] mtime-snapshot (AC4) and import-string check (AC5) pin the two non-functional contracts.

RECONCILIATION NOTES:
- Scope-tag parser supports scalar/inline-list only, not block-list — known limitation.
- Duplicated parseArgs (snapshot.mjs + onboard.mjs) and isDir (scan.mjs + discover.mjs) at 2 callers each — under ADR-0002 threshold; log so the third caller triggers extraction.
