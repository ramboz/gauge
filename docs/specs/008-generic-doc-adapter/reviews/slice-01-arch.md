---
slice: 008-01 — Flat layout + honest completion (jig preset unchanged)
pass: arch
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-04T22:24:12Z
prompt_source: review.py arch-review
---

The change preserves documented module boundaries (adapter reads stay read-only in `scan.mjs`, parsing stays pure in `lib.mjs`, the observation contract in `schemas/observation-v1.schema.json` is untouched) and generalizes the layout axis additively through profile-v1 exactly as ADR-0010 sub-decisions 1–4 and ADR-0009 prescribe. The byte-identical jig path, the honest unknown floor, and the schema-sourced `specLayout` enum validation are all sound. No blockers.

The one deliberately-flagged design choice — carrying the document count in the freshness/resolution reason string — is a defensible, contract-preserving interim, but it is the weakest seam and its render-layer consumer is not built. `normalizeContribution` legitimately strips `value` from non-supported signals, so a structured `value` is genuinely unavailable without a contract change; the reason string is a reasonable interim.

Nits (reconciliation-log items, non-blocking):
- [nit] src/observation.mjs — status-absent count reaches the observation only via `resolution.reason`/`freshness.reason`; no structured carrier. Cited `gitFreshness` precedent is weaker than claimed (git age is also structurally available). Defer a typed carrier decision to refinement-todo BEFORE the delivery layer renders "N documents".
- [nit] public/index.html — the unknown execution card renders "Execution signal unknown." and does not consume the count, so the "N documents · completion unknown" card is not delivered end-to-end in this change (only the unsupported→unknown flip + count-in-reason). AC/DoD adjudication deferred to compliance pass (which passed).
- [nit] src/lib.mjs — `DELIVERY_VOCABULARY` is a module global rather than a preset property; consistent with ADR-0010's deferred preset-registry open question, but the seam to generalize for the next preset / declarable vocabulary.

Strengths: schema/runtime enum lockstep for `specLayout`; layout-aware tier-2 card gate; additive default-nested with entry→profile→default fallback preserving 007 identity (byte-identical regression proven).
