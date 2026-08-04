---
slice: 008-01 — Flat layout + honest completion (jig preset unchanged)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-04T22:24:12Z
prompt_source: review.py implementation
---

All five acceptance criteria for slice 008-01 are met and meaningfully tested. `specLayout` is added additively to the schema and runtime validator (enum-gated at profile and entry level, default `nested`), config threads it with entry→profile→default fallback, the flat reader discovers `<specsDir>/<name>.md` with shared title derivation, completion is vocabulary-gated at root granularity (`hasDeliveryStatus` → honest `unknown` with a document count, never a fabricated 0%), and the card gate is layout-aware. Byte-identical behavior holds: every status token used across this repo's own specs (DRAFT/DONE/ABANDONED/DEFERRED/IN_PROGRESS) is in `DELIVERY_VOCABULARY`, so existing cards keep the pre-008 denominator path, corroborated by the `withExplicit === withDefault` / proj-jig 67% regression tests. No correctness or security defects found; zero-dependency and read-only, consistent with ADR-0001/ADR-0003.

Non-blocking notes (reconciliation-log items):
- `src/observation.mjs` — the document count is carried in the freshness/resolution reason string (`no-recognized-delivery-status-2-documents`) rather than a structured field. Deliberate and comment-justified (non-supported signals drop `value`), but a stringly-typed contract for any downstream renderer. Record in deviation log.
- `specLayout: auto` validates and is accepted end-to-end but behaves as `nested` until 008-02 (intended; schema description says so).
- DoD items 3–5 remain unchecked pre-reconciliation, as expected.
