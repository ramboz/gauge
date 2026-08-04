---
slice: 008-02 — Auto-detect + discovery emits `specLayout`
pass: reconciliation
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-04T22:53:02Z
prompt_source: review.py reconciliation
---

All three logged deviations are faithful to the code. (1) `detectLayout` is defined once in `src/discover.mjs` and imported one-directionally by `src/scan.mjs`; `discover.mjs` still imports only node builtins + `safeProjectId` from `config.mjs`, so the purity/no-cycle claim holds. (2) `test/fixtures/proj-mixed/` exists with one nested `docs/opportunities/cwv` and one flat `docs/superpowers`, and `proj-multiroot`'s `docs/superpowers` is nested — exactly as the rationale for not editing it states. (3) The mystique smoke uses a targeted before/after `readdirSync` on the two touched dirs with a clean skip when absent, not `snapshot()`. Sweep dispositions are honest (`resolveLayout` calls `detectLayout` only when `specLayout === 'auto'`; both `scanSpecs` and `hasJigEvidence` route through the same `resolveLayout`), and "no deferred decisions" is correct.

Two minor reviewer suggestions were both applied during reconciliation: (a) an explicit `no-op` contract-surface sweep line for `schemas/project-profile-v1.schema.json` (the `auto` enum was pre-provisioned in 008-01); (b) refreshed the schema `specLayout` description to drop the now-stale "reserved for detection (slice 008-02)" wording.

VERDICT: pass
