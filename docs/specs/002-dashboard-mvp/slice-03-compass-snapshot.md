---
status: DONE
dependencies: [002-01]
last_verified: 2026-07-13
---

## Slice 002-03 — compass-snapshot

**Goal:** Define the one new contract — `docs/status/compass-history.jsonl`
per surveyed project, appended by compass at the end of each run — and
render its latest line as the narrative block on each card (headline, next
action, blockers, age). Ship the integration snippet so the user can add
the writer to her compass skill.

**DoR:**
- ✅ Verified: compass persists nothing today; this is the only wish-list
  item with no existing data source.
- ✅ Append-only JSONL agreed as the shape (keeps compass read-only in
  spirit: it never edits lifecycle state, only journals its own output).

**Acceptance Criteria:**

1. **ADR-0002** records the contract: path, JSON schema (versioned:
   `v`, `ts`, `headline`, `next`, `blockers[]`, optional `specs{done,total}`),
   append-only semantics, and who writes it (compass; the dashboard never
   writes it).
2. **Reader.** Scanner parses the last valid line; malformed trailing lines
   are skipped with a per-project scan warning, never a crash. Missing file
   → card shows "no compass snapshot yet" plus a pointer to the
   integration doc.
3. **Render.** Card narrative block shows headline, next action, and
   snapshot age ("this morning", "3 days ago"); a snapshot older than 7
   days is visually muted.
4. **Integration kit.** `docs/compass-integration.md` contains the exact
   paragraph to append to the compass skill and a manual fallback
   (`scripts/snapshot.mjs --project <path> --headline ... --next ...`)
   that validates against the schema and appends.
5. **Tests.** Reader (happy path, malformed line, missing file), age
   formatting, snapshot.mjs append + validation.

**DoD:**
- [x] All ACs pass; full test suite green (28 tests, no regressions).
- [x] Implementer test coverage exercises each AC with at least one fixture.
- [x] Reviewed against spec — independent reviewer subagent, 2026-07-13,
      verdict "PASS with conditions"; all conditions closed same day (see
      deviation log).
- [x] Deviation log produced under this slice heading.

**Anti-horizontal-phasing check:** after this slice the morning/evening
compass ritual leaves a visible trace: each card answers "what did compass
say last, and how stale is that" — and the history file quietly accumulates
the data the future evolution graphs will read.

### Deviation log

- `scripts/snapshot.mjs` auto-fills `specs {done, total}` from the target's
  spec tree via the scanner (not in the ACs; keeps manual snapshots honest
  without extra flags).
- Dogfooded: this repo's own `docs/status/compass-history.jsonl` has its
  first real snapshot, visible on the dashboard's own card.
- The compass-skill change itself lives outside this repo (it's the user's
  plugin); this slice ships the contract, reader, and integration kit only,
  as specced.
- Post-review fixes (all AC5 gaps closed): `ageLabel`/`ageDays` extracted
  to `src/lib.mjs` and computed server-side (payload carries `ageLabel` +
  `stale`), with "this morning / this afternoon / this evening" granularity
  per AC3; an unparseable `ts` is treated as malformed by the reader (no
  more "NaN days ago"); `validateSnapshot` enforces the full ADR-0002
  schema (`v` required, `specs {done,total}` shape); integration tests
  added for snapshot.mjs append/refusal and the missing-history-file path
  (temp-dir project, fixtures stay pristine).
