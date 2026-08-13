---
slice: 013-03 — curated soft appetite-window (green/amber)
pass: arch
verdict: pass
reviewer: general-purpose (independent)
reviewed_at: 2026-08-13T23:48:27Z
prompt_source: review.py arch-review
substrate: non-interactive
---

## Arch pass — PASS (no blockers)

appetiteWindow added consistently + additively across schema (×2), validation (×2), config
resolve + entry fallback, observation join, derive join — mirroring deadline exactly.
deriveForecast stays a pure import-free fold; soft target is caller-joined; precedence clean.
ADR-0011 boundary held two ways (zero-import structural guard + AC6 behavioural guard).
$ref-to-$defs/deadline is single-sourcing (ADR-0018 "mechanically identical"), not accidental
coupling. Over-appetite→tier-2 carve-out extends ADR-0013's reason-based taxonomy soundly.

Notes (non-blocking):
- Extensibility: parallel deadline-shaped plumbing now runs twice through ~7 sites; a THIRD
  curated target should trigger a descriptor-list refactor (name + $def + tier + reason-pair),
  not a third parallel thread. Refactor trigger, logged to inbox.
- ADR-0018 open question "Soft-target schema + onboarding UX" is now resolved: a distinct
  `appetiteWindow` field (not a flag on deadline).
- Tier-1/tier-2 pace duplication + appetite-proximity intra-tier-sort gap: follow-up craft/
  design items, non-blocking.
