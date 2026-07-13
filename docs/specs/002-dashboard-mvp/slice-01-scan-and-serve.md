---
status: DONE
dependencies: []
last_verified: 2026-07-13
---

## Slice 002-01 — scan-and-serve

**Goal:** The smallest usable dashboard: `node src/server.mjs`, open
`http://localhost:5111`, and see one card per configured project with
spec/slice progress, bug/refinement/inbox counts, and git start/last-commit
dates — recomputed from disk on every refresh.

**DoR:**
- ✅ Real target formats verified on disk (spec brief, 2026-07-13):
  spec/slice YAML frontmatter, nine-state status vocabulary.
- ✅ Runtime decision recorded: Node ≥ 18, ESM, zero runtime deps.
- ✅ Config shape agreed: `dashboard.config.json` at repo root listing
  project roots.

**Acceptance Criteria:**

1. **Scanner CLI.** `node src/scan.mjs` prints one JSON document covering
   every project in `dashboard.config.json`. For each: per-spec `status`,
   per-slice `status`/`dependencies`/`last_verified`, and counts by status.
2. **Honest progress.** Progress = `DONE / (total − ABANDONED)` at spec
   level; DEFERRED surfaces separately, never as "not done". Fixture: a
   project-b-shaped tree with 27 DONE / 1 IN_PROGRESS / 2 ABANDONED of 30
   yields 27/28.
3. **Non-jig projects degrade gracefully.** A configured path without
   `docs/specs/` renders as "not jig-managed" — no error, no 0% bar.
4. **Counts.** Open bugs (`docs/bugs/*.md`, README excluded), refinement
   entries, inbox items, ADR count; absent files → 0, not an error.
5. **Git dates.** First-commit date, last-commit date, commit count; a
   non-git project shows "—".
6. **Serve.** `GET /` returns the page; `GET /api/data` rescans and returns
   fresh JSON (no cache). The page renders one card per project with a
   progress bar, status counts, and per-spec detail on expand.
7. **Tests.** `node --test` green: frontmatter parser, progress formula
   (incl. ABANDONED and DEFERRED), non-jig fallback, fixture tree scan.

**DoD:**
- [x] All ACs pass; full test suite green (28 tests, no regressions).
- [x] Implementer test coverage exercises each AC with at least one fixture.
- [x] Reviewed against spec — independent reviewer subagent, 2026-07-13,
      verdict "PASS with conditions"; all conditions closed same day (see
      deviation log).
- [x] Deviation log produced under this slice heading.

**Anti-horizontal-phasing check:** after this slice alone the user opens one
URL and sees live, honest progress for all her projects — the core daily
value, before workstreams or narrative exist.

### Deviation log

- Implemented in one pass with slices 02/03 (shared `src/lib.mjs`); the
  slice boundaries hold in the code and tests, but the commits are not
  slice-sequential.
- `npm test` script is `node --test` (bare) — Node 24 rejects a trailing
  `test/` directory argument.
- Live verification against real repos corrected a design-session estimate:
  project-b has **64** specs (47 DONE / 6 IN_PROGRESS / 9 DRAFT /
  2 ABANDONED → 76%), not ~30 — the earlier manual listing was truncated.
  No code change needed; noted because the spec brief's fixture numbers
  cite the smaller count.
- AC2's "project-b-shaped tree" is realized as a unit-level 27/28
  `progressOf` test plus a 4-spec fixture tree (equivalent coverage;
  flagged by independent review, logged rather than rebuilt).
- Post-review fixes: non-git projects now render `git: —` (AC5 literal);
  `fileURLToPath` replaces `new URL().pathname` (paths with spaces);
  `/api/data` sends `Cache-Control: no-store`.
- Addition beyond ACs: the page auto-reloads every 120 s alongside
  rescan-on-refresh.

### Amendments

- **2026-07-13 — Gauge reframe:** POC behavior remains historical evidence;
  generic projects, adapter boundaries, and central instance state are owned by
  [spec 004](../004-retrofit-dashboard-runtime-onto-gauge-portfolio-product/spec.md).
