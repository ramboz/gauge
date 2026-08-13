---
slice: 013-03 — curated soft appetite-window (green/amber)
pass: craft
verdict: pass
reviewer: general-purpose (independent, pr-review rubric)
reviewed_at: 2026-08-13T23:48:27Z
prompt_source: review.py pr-review --richer-skill pr-review
substrate: non-interactive
---

## Craft (pr-review) pass — PASS (no blockers)

Threads appetiteWindow across schema→config→profile→observation→derive→UI by genuine reuse
($refs $defs/deadline; reuses DEADLINE_PROVENANCE/PATTERN/deadlineMs — no parallel
validators). Precedence made structurally true by a single guard (appetiteAt = deadlineAt
===null ? … : null), not just asserted. Tier-2 carve-out reason-based, ordered before
at_risk→1, tied to the ADR-0018 kill criterion. Strengths at forecast/RAG/card/queue layers.

Nits → reconciliation-log:
1. ~6-line pace arithmetic duplicated between tier-2 and tier-1 blocks (date source + reason
   strings differ) — accepted under ADR-0002 (legibility + tier-1-unchanged).
2. deriveForecast grew a 3rd positional arg — fine now; invites an options-object refactor if
   a 4th target lands.
3. over-appetite entries have no appetite-window secondary sort within tier 2 (sort key is
   hard-deadline proximity only) — deliberate, in-scope limitation.
