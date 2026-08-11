---
slice: 011-03 — fallback card: global progress + discovered workstreams
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-11T17:42:12Z
prompt_source: review.py implementation .../spec.md 011-03 public/index.html test/runtime.test.mjs
---

Compliance review of 011-03 — fallback card. VERDICT: pass; suite green.
AC1 fallback gated strictly on !active (has-active-milestone card byte-identical to pre-slice, verified via git diff). AC2 labelled global bar ("No release plan — overall spec progress."). AC3 summarizeDiscovered/discoveredRow render title+step count, "done" chip only when total>0 && done===total. AC4 no <details> spec list, path suppressed when title present. Neither-releases-nor-discovered degrades cleanly (doesNotThrow, no workstreams header).
No blockers. Reconciliation note: fallback note copy is imprecise for the all-shipped/dropped sub-case (spec-mandated AC2 string; code comment acknowledges) → log as accepted tradeoff.
