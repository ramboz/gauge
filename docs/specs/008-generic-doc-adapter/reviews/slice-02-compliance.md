---
slice: 008-02 — Auto-detect + discovery emits `specLayout`
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-04T22:48:59Z
prompt_source: review.py implementation
---

Slice 008-02's four ACs are met. `specLayout: auto` resolves via a single shared `detectLayout` (defined once in `src/discover.mjs`, imported by `src/scan.mjs`) that prefers nested, falls to flat, defaults to nested — deterministic and fixture-covered (nested/flat/mixed/empty). Discovery emits `specLayout: 'flat'` only for flat roots and omits it for nested, preserving 007 identity. Detection lives in the pure module (purity assertion present); schema/config wiring for `auto` was already in place from 008-01.

Non-blocking notes (reconciliation-log items):
- AC3's end-to-end "pasted into config renders superpowers correctly" is exercised only by the machine-local real-corpus smoke (t.skip when mystique absent); the committed proj-mixed fixture covers discovery emission + read-time resolution, but no committed test asserts the config-expansion→card-render path for a flat entry independent of the local corpus. Acceptable (graceful skip + existing config wiring).
- `entriesFrom` calls `detectLayout` with default `specsDirName='specs'`; discovery only emits specs-based roots today so it cannot misfire, but a future custom-specsDir proposal would inspect the wrong folder. Out of scope.
- The `'default'` source note "flat docs/ layout" is pre-existing 007-03 wording, now slightly misleading; out of scope.

VERDICT: pass
