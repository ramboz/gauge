# Lightweight Decisions

> Status: Draft (wizard-generated)

Small shipped decisions that fall outside spec slices but carry durable rationale:
brand/icon swaps, cosmetic CSS polish, UI string or translation choices, scoped
visual decisions, and "future sessions should/should not override this" notes.

## Routing rubric — where does this decision land?

Triage each settled decision to exactly **one** home:

| Route | Criterion |
|---|---|
| **ADR** | A load-bearing design choice with rejected alternatives — one a future agent would need to know about to avoid undoing it — warrants an ADR even when it changes no module boundary or public contract. Also: any change to a module boundary, public contract, or cross-cutting policy. |
| **Lightweight record (here)** | Settled, local, bounded (one screen / component / string / asset), with no real rejected alternatives — and a future agent would need to know it to avoid undoing it. |
| **`refinement-todo.md`** | Still *open* — has a resolution trigger; not shipped yet. |
| **Drop (write nothing)** | Ephemeral / trivial / already obvious from the code or a commit message. |

The **ADR** row's trigger sentence is single-sourced — the *same* wording appears
in both reconcile checklists and the memory-sync session-end prompt, so the "when
is an ADR required?" policy can't drift across surfaces.

Record a lightweight entry with the helper (idempotent append):

```bash
python3 "${CLAUDE_PROJECT_DIR}/.claude/skills/jig-memory-sync/decisions.py" add-lightweight \
  --title "<short title>" --decision "<what>" --context "<why>" --scope "<where>"
```

## Template

```markdown
### [Date] — [Short title]

**Decision:** _what was decided_

**Context:** _why — constraint, user feedback, design call_

**Scope:** _which screen / component / string / asset — not product-wide_

**Commit:** _optional — git SHA or PR; may be added retroactively_
```

This matches what `decisions.py add-lightweight` emits (one blank line between
fields), so the documented shape and the helper output agree.

---

## Entries

### 2026-08-05 — Attention-queue deadline-unknown copy → 'needs a deadline set'

**Decision:** The tier-3 reason string for a deadline-unknown forecast is 'needs a deadline set' (was 'needs a goal set').

**Context:** Found running gauge against the real corpus: a project with an authored goal but no deadline reads deadline-unknown, yet the queue said 'needs a goal set' — wrong, since this reason is about the missing deadline (forecast Gate 1), not the goal. Goal and deadline are independent fields; the copy must name the deadline. Regression test added (test/attention-queue.test.mjs).

**Scope:** src/derive.mjs tierReason (attention queue, spec 009-03)

### 2026-08-19 — Forecast Gate 4 scope-stability tolerance re-tuned 0 → ±1

**Decision:** `DENOM_TOLERANCE` in `src/derive.mjs` is raised from `0` (exact-equality scope stability) to `1`. The trailing stable-scope window now absorbs a single-spec (±1) `denom` drift; a genuine scope shift (≥2) still routes to `unknown('scope-changed')`.

**Context:** Dogfood finding — Gauge run against its own 13-observation git-backfilled history read `unknown('insufficient-history')` forever despite a real deadline (2026-08-28), because an actively-authored project's `denom` creeps by one nearly every observation as specs land, so exact-equality collapsed the trailing window to a single point and no ≥1-day stable-scope span ever formed. This is a parameter tune *within* ADR-0012's fixed gate shape, not a new decision: ADR-0012 already gates on scope stable "beyond a small tolerance", and the derive.mjs threshold comment explicitly designates these constants as re-tunable against a real corpus. With the tune live, Gauge computes an honest `at_risk('pace-behind-required')` instead of unknown. Red→green witness + a ±2 boundary guard added (test/derive.test.mjs); the backfill AC4 churn fixture updated to a ≥2 jump so it still asserts scope-changed (test/backfill.test.mjs). Full suite 595/595 green.

**Scope:** src/derive.mjs `DENOM_TOLERANCE` (forecast Gate 4, ADR-0012 tier 1 / ADR-0018 tiers 2–3)

**Commit:** _pending_
