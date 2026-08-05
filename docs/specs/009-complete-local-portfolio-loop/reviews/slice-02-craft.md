---
slice: 009-02 — Forecast/risk derivation
pass: craft
verdict: pass
reviewer: general-purpose (pr-review)
reviewed_at: 2026-08-05T18:54:23Z
prompt_source: review.py pr-review docs/specs/009-complete-local-portfolio-loop/spec.md 009-02 <deliverables>
---

VERDICT: pass (no blockers; all findings [nit]/[strength])
Zero-import pure fold; gates in ADR order with named/annotated constants; tests bite (deepEqual on
{state,reason}, bit-exact pace-boundary fixture). Nits folded in this round: fractionOf now prefers
exact done/denom over rounded pct (precision test added); strictly-negative-pace test added;
attachForecasts param renamed. Log: DENOM_TOLERANCE=0 keeps colours largely reachable only on
stable-denom windows (tunable within ADR-0012's fixed shape) -> record with the pace-window decision.
