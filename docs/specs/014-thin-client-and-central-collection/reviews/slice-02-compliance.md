---
slice: 014-02 — capture-validity hardening: honest RAG on captured history
pass: compliance
verdict: pass
reviewer: general-purpose (compliance re-review)
reviewed_at: 2026-08-19T03:34:53Z
prompt_source: review.py implementation
---

PASS (re-review after needs-changes). All three prior gaps closed, all 5 ACs covered, 560/560 green, zero new deps (ADR-0001).
- AC2a/AC2b (live-tail.test.mjs) drive stable-denom → real band and churning-denom → unknown(scope-changed) through the splice→deriveForecast fold; non-vacuous (bite when splice removed).
- AC3 (coalesce.test.mjs) composes a backfill seed + session capture into one ascending 2-record series through the real disk path.
- Clock-skew guard (state.mjs) compares collectedAt and unlinks the older record; backward-skew test asserts the 08-10 record survives an identical 08-01 arrival — provably never regresses the latest timestamp.
- server wiring test pins splice-before-attachForecasts ordering.
Non-blocking note: AC2 tests exercise the read-layer fold over constructed fixtures (AC3 covers the real disk path; runtime wiring test confirms server composition order) — acceptable. Coalescing compares only the single newest-by-filename prior (correct per AC1 "consecutive run").
