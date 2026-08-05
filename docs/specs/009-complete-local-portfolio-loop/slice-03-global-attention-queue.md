---
status: DONE
dependencies: [009-02, adr-0006, adr-0013]
last_verified: 2026-08-05
frame_review: true
arch_review: true
---

<!-- jig self-defining vocabulary (soft, forward-only). -->
<!-- jig grounding (spec 064-02 / ADR-0020). -->

## Slice 009-03 — Global attention queue

**Goal:** The dashboard presents a single **explained, deterministic
cross-project attention queue** — an ordering that says *which project deserves
attention next and why* — derived downstream of forecast/risk in `src/derive.mjs`
([ADR-0006](../../decisions/adr-0006-two-layer-derivation.md)), which surfaces
portfolio intent without ever rewriting any project's own local priorities
(product-vision authority model).

**DoR:**
- ✅ 009-02 DONE (forecast/risk is the upstream input the queue consumes).
- ✅ ADR-0006 accepted (the attention queue belongs in the history-derived layer,
  downstream of forecast/risk; it takes the project-id set from the registry via
  its caller, not by reading the registry directly).
- ✅ **Attention-overlay policy resolved by
  [ADR-0013](../../decisions/adr-0013-attention-overlay-policy.md).** The queue is a
  deterministic **tiered lexicographic ordering** keyed on the derived forecast
  state + ADR-0012 reason (never owner-assigned importance), within-tier by deadline
  proximity, ties by `project.id`. Five tiers that partition every ADR-0012 output:
  (1) at_risk; (2) stale-evidence or explicit blocker — "verify"; (3) needs owner
  input (`deadline-unknown`/`scope-changed`); (4) awaiting evidence
  (`insufficient-history`/`execution-unknown`); (5) on_track. Most-urgent-tier-wins
  (first-match top-down). This is the contract this slice implements verbatim.

**Acceptance Criteria:**

1. **Deterministic, explained ordering.** Given each project's **derived
   forecast/risk read (state + ADR-0012 reason)** from 009-02, its deadline, and
   (when present) its `narrative` blocker text, `src/derive.mjs` produces a total
   ordering; the same inputs always yield the same order, and each ranked entry
   carries a short reason for its position (tier label + within-tier key). The queue
   **does not re-derive from raw progress/freshness** — it keys on the derived read
   (ADR-0006); the blocker is the one raw field ADR-0013 explicitly admits as a
   tier-2 trigger, used when present, never fabricated. A project whose `deadline`
   field is entirely absent (never authored — `joinProjectProfileFields` omits it)
   is treated exactly like `deadline: unknown` (sorts last within its tier).
2. **ADR-0013 tiers applied verbatim.** The ranking implements the five-tier
   partition exactly (at_risk → stale/blocked → needs-owner-input → awaiting-
   evidence → on_track), each ADR-0012 reason mapped to its tier per ADR-0013;
   most-urgent-tier-wins (first-match top-down); within-tier by deadline proximity
   (soonest concrete date first; `unknown` deadline last in its tier); ties by
   `project.id`. The slice cites ADR-0013.
3. **Never a rewrite of project-local priority.** The queue expresses only
   cross-project attention order; it does not reorder, mutate, or write any
   project's own local priorities or source repo (authority model). `unknown`
   forecast/risk and `unknown` deadlines are ordered by an explicit, explained
   rule — not silently sunk or floated.
4. **Registry-set in, no adapter reach.** The cross-project ranking receives the
   project-id set from its caller (registry-derived); `src/derive.mjs` still
   imports no adapter and not `src/scan.mjs`, and writes nothing (ADR-0006).
5. **The dashboard shows the queue.** The dashboard renders the ranked attention
   queue with each entry's reason, distinct from the per-project cards — a user
   can read "what to pick up next across the portfolio" at a glance.

**DoD:**
- [x] All ACs pass; full test suite green (224/224).
- [x] Coverage exercises: deterministic ordering (fixed fixtures → fixed order);
      each of the five tiers populated; every ADR-0012 reason mapped to its correct
      tier (incl. `execution-unknown`→4, `stale-evidence`→2); most-urgent-tier-wins
      when a project matches multiple tiers (e.g. at_risk + blocker); within-tier
      deadline-proximity ordering with `unknown` deadline sorting last; `project.id`
      tie-break; the no-local-priority-rewrite invariant; the import-boundary
      invariant; the malformed-forecast → tier-2 honesty fallback; and the dashboard
      render.
- [x] Each new test shown to fail when its feature is removed (mutation-kill sweep).
- [x] Reviewed by `reviewer` subagent (compliance). Craft pass run. Both pass.
- [x] **Architecture review passed** (`arch_review: true`; derive.mjs zero-import
      boundary confirmed).
- [x] Implementation review passed.
- [x] Deviation log + reconciliation sweep produced under this slice heading.
- [x] Reconciliation review passed.
- [x] ADR-0013 (attention-overlay policy) is Accepted and linked (done);
      `docs/refinement-todo.md` "Cross-project attention overlay" already resolved;
      status board regenerated at DONE.
- [x] **Primer hygiene (closes spec 009):** compress-on-close-out applied to
      `CLAUDE.md` (spec 009 completes the local pull loop); the release plan's
      Include items are all landed (status bump `committed`→`shipped` left to
      `shaper:release-check` / owner).

**Anti-horizontal-phasing check:** after this slice a user opens the dashboard and
sees an explained ranked list of which project to attend to next across the whole
portfolio — the cross-project decision layer is visible end to end.

### Assumptions

- The queue keys on the **derived forecast read (state + reason)** plus deadline
  plus optional blocker — not raw per-signal freshness (ADR-0013: consuming the
  derived read keeps the "stale = source-repo-quiet, not collection-lapse"
  grounding honest). No richer per-project comparability (e.g. comparing spec
  counts across projects) is assumed — the product-vision warns against pretending
  work units are comparable.
- The `narrative` blocker field (tier-2's optional trigger) is present only for
  legacy-Compass sources (`narrative` is emitted only when a Compass file is
  scanned — verified `src/observation.mjs`), and Compass is retired, so for modern
  jig projects tier 2 rests on the `stale-evidence` forecast reason alone. The
  blocker path is therefore near-vestigial on the live corpus; it is exercised by
  fixtures, and the "each of the five tiers populated" DoD coverage is fixture-driven,
  not a claim about live data. Never a fabricated blocker (ADR-0013). Field is
  `narrative.value.blockers`.
- **Known inherited edge (not fixed here):** `execution-unknown` is overloaded in
  `deriveForecast` across three cases — no history, no recognized delivery status,
  and the denom===0 all-abandoned case — all of which map to tier 4 ("awaiting
  evidence"). The all-abandoned case is arguably tier-2-worthy ("verify"), but it
  mis-tiers into tier 4 because it shares the `execution-unknown` reason. This is
  the exact motivation for the deferred `no-measurable-scope` forecast reason
  (`docs/refinement-todo.md`); when that lands, ADR-0013's tier map gains a row and
  the case moves. 009-03 implements the current reason set as-is.

### Deviation log (after reconciliation)

Original ACs preserved above. Implementation notes:

1. **`attentionQueue(data)` added to `src/derive.mjs`** (still zero-import): a pure
   fold over the `attachForecasts` output producing a total ordering. Wired into
   `/api/data` (`src/server.mjs`) as a top-level `attention` array; the dashboard
   (`public/index.html`) renders a distinct `.queue-section` above the per-project
   cards, XSS-escaped and fault-isolated (`queueRow`/`safeQueueRow`).
2. **Reason wording** is implementation detail (ADR-0013 leaves it open): tiers 1/5
   spell out deadline proximity; tiers 2–4 give the specific ADR-0012 trigger
   ("stale — verify", "needs a goal set", etc.) — not an AC1 gap (ADR-0013 itself
   uses "needs a goal set" as a sanctioned tier-3 reason).
3. **Post-review nit fixes applied** (all three gating passes were `pass`; these are
   improvements on top):
   - *Shared `forecast` reference (craft + arch nit):* each queue entry now carries
     a **shallow copy** of the forecast, closing a latent mutation-escape where a
     consumer writing `entry.forecast.state` could reach back into source data.
   - *`tierOf` malformed-forecast default (arch nit — honesty):* an unrecognized
     forecast now falls to **tier 2 ("verify")**, not tier 5 (on_track) — never
     coerce an unknown into "healthy" (product-vision). Unreachable in the composed
     pipeline (attachForecasts always yields a well-formed forecast); this defends
     the standalone export. New test covers it.
   - *Untested reason strings (craft nit):* added assertions for the tier-2/3/4
     user-facing dashboard copy.
   - Suite: 224/224 (was 221 + 3).
4. **TDD-ordering process deviation:** for this slice the `attentionQueue`
   implementation was written before its dedicated `test/attention-queue.test.mjs`.
   Compensated by a full **mutation-kill sweep** (every acceptance-relevant test
   shown to go red when its feature is broken, then restored) — the compliance pass
   independently verified the suite is non-vacuous. Recorded here per the DoD.
5. **Known inherited edge (not fixed here):** the denom===0 all-abandoned case rides
   `execution-unknown` → tier 4, though it is arguably tier-2-worthy; deferred to the
   `no-measurable-scope` forecast reason (`docs/refinement-todo.md`, from 009-02).

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `README.md` | `no-op` | Front door unaffected. |
| `docs/specs/README.md` | `deferred` | The board regen + the 009-03 DRAFT→DONE / spec-009 rollup fire on the DONE transition, which runs *after* this reconciliation review; the board is stale (still shows 009-03) until then. |
| `docs/product-vision.md` | `no-op` | The attention queue was already in the committed-MVP list; no scope change. |
| `docs/architecture.md` | `updated` | Attention queue landed in the derive layer (forward-looking phrasing flipped to landed-tense); `/api/data` `attention` array added to the Local-HTTP contract surface; MVP-loop-complete note. |
| `docs/releases/local-portfolio-loop.md` | `no-op` | All Include items now landed; the cutline was reconciled in 009-01. Moving the plan `committed`→`shipping`/`shipped` is a `shaper:release-check` / owner call, not done here. |
| Primer surfaces: `CLAUDE.md` / `AGENTS.md` / scaffold templates | `updated` | Spec-025 compress-on-close-out: `CLAUDE.md` hot cache + "Landed runtime" rewritten — spec 009 completes the local pull loop; per-slice detail dropped in favor of the spec dir + status board. (No `AGENTS.md` / scaffold templates in this repo.) |
| `docs/inbox.md` | `no-op` | No items resolved by this slice. |
| `docs/refinement-todo.md` | `no-op` | "Cross-project attention overlay" already resolved by ADR-0013; the `no-measurable-scope` follow-up was added under 009-02. |
| `docs/memory/**` | `no-op` | New derived vocabulary (forecast states, attention tiers) is defined in ADR-0012/0013 + the glossary already carries "Attention queue"/"Unknown"; a session-end `/jig:memory-sync` can cross-link if desired. |
| `docs/decisions/README.md` / ADR index | `no-op` | ADR-0013 accepted + indexed earlier this session; no new ADR here. |
