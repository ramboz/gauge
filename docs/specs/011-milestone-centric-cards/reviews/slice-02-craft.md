---
slice: 011-02 — milestone progress from referenced parent specs
pass: craft
verdict: pass
reviewer: pr-review
reviewed_at: 2026-08-11T17:23:30Z
prompt_source: review.py pr-review .../spec.md 011-02 <deliverables> --richer-skill pr-review
substrate: non-interactive
---

Craft/PR review of 011-02. VERDICT: pass. Well-scoped; reuses progressOf (single source of truth); AC4 defended at two layers with non-vacuous tests; runtime body-passthrough verified through observation.mjs.
SPECIFIC ISSUES (all non-blocking → deviation log):
- [nit][impl] extractReferencedSpecNumbers uses literal digit equality; an unpadded "spec 11" would not resolve to id 011-… (safe today — all release docs + ids are 3-digit zero-padded). Latent; strip-leading-zeros would remove the footgun.
- [nit][impl] unifying the bar template shifted the project-global count text "3/4 specs done" → "3 / 4 specs done" (mockup-aligned; no test pinned old spacing).
- [nit][impl] the AC4 "no resolvable refs → global 50%" test is a weak sentinel (passes even if the feature were removed); real guards are the AC3 doesNotMatch-10% and denom-0 tests.
- [strength] progressOf reuse; AC4 double-layer guard; derive.mjs-mirroring structural lookups.
