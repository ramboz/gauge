---
slice: 012-05 — team signals: human-vs-agent split + contributors
pass: craft
verdict: pass
reviewer: pr-review
reviewed_at: 2026-08-11T20:37:08Z
prompt_source: review.py pr-review .../spec.md 012-05 <deliverables> --richer-skill pr-review
substrate: non-interactive
---

Craft/PR review of 012-05. VERDICT: pass. Pure-fold + thin-I/O + combinator mirror of velocity.mjs; \x1f/\x1e delimiter parse robust; shared velocityNowMs clock; no-PII structural (author names → Set → discarded, return shape pinned by test); XSS test with active payload.
SPECIFIC ISSUES:
- [nit][impl] Co-Authored-By regex substring-matched (quoted-body / "Claudette" false positives) — FIXED: line-anchored /^co-authored-by:\s*claude\b/im; false-positive reduction confirmed + tests added.
- [nit][impl] tiny-but-nonzero split rounded to "~0%" — FIXED: teamHeadline shows "< 1%" (via new agentCoauthoredCount field), mirroring velocity's "< 0.1" / cost's "< $0.01"; true 0% and null unchanged; tests added.
- [nit] stale test comment — FIXED.
- [strength][impl] structural no-PII shape; shared-clock capture; robust delimiter parse; meaningful XSS + PII render-guard tests.
