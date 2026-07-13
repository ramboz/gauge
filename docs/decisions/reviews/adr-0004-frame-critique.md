---
adr: 0004
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-07-13T22:10:55Z
prompt_source: review.py frame-critique docs/decisions/adr-0004-central-observation-history-contract.md
---

VERDICT: pass

REASONING:
The load-bearing residual assumption is that a filesystem which accepts file
fsync, no-replace linking, and directory fsync will honor those persistence
semantics across a crash. ADR-0004 surfaces this as A1, refuses environments
that fail the probe, avoids an unsafe fallback, bounds its guarantee, and
defines a concrete kill criterion.

SPECIFIC ISSUES:
- A lying or crash-unsafe filesystem can still lose a record after commit;
  source projects remain untouched and read-only scans remain usable.
