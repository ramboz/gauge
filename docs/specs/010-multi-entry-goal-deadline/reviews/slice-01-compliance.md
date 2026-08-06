---
slice: 010-01 — entry-level goal/deadline
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-06T16:57:47Z
prompt_source: review.py implementation
---

VERDICT: pass

All five ACs met. Schema single-sources goal/deadline via $defs and $refs from both top-level and entries[] (AC1); sibling `description` alongside $ref is valid in draft 2020-12. Runtime validator threads entry-level object validation with `profile.entries[i].goal/.deadline`-named errors (AC2). Config expansion implements entry-wins → parent-fallback → no-own-property identity (AC3/AC5). AC4 derive test drives the real joinProjectProfileFields → attachForecasts → attentionQueue chain with a fixed far-future date (2099-12-31), so it is not time-fragile. observation.mjs/derive.mjs/server.mjs carry no 010-01 changes. Tests are non-vacuous (each flips red when the feature is removed). Zero-runtime-dep, unknown-not-coerced, no-source-write principles preserved.

No implementation deviations. Reconciliation reviewer should confirm the schema (updated) and architecture.md dispositions get real rationales.
