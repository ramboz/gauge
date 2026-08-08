---
status: Accepted
dependencies: []
last_verified: 2026-08-07
frame_review: true
---

# ADR-0017: Reframe onto the manager/portfolio lens: analytics scope and reconstructable/captured history

## Status

Accepted (2026-08-07)

## Context

ADR-0003 reframed the inherited project-dashboard POC onto the **Gauge portfolio
product** — a private, read-only, cross-project delivery view. That frame holds.
A design session has since **sharpened the positioning and defined the data
model** enough that the corpus's prose (vision, architecture, README, primer)
now under-describes what Gauge is. Three premises moved:

1. **Audience & boundary made explicit.** Gauge is the **manager / portfolio
   lens** — zoom out, breadth, decision, trend. It is deliberately
   **complementary** to a separate **engineer daily-driver** (a local
   thin-client dashboard: slice/session, right-now, in-the-code), which Gauge
   does **not** rebuild. Gauge works at **milestone** granularity (never slices —
   a jig/SPIDR internal), owns a **shallow** project detail tier that stops
   before slices/sessions/tasks, and stays **project-centric** for v1 (a people
   dimension is a deferred extension).

2. **Analytics scope defined.** Manager metrics: active/next milestone (from
   shaper release-plan `Status`), milestone-scoped progress (from referenced
   parent specs), **RAG health**, a countable **attention row** — PRs-awaiting-
   merge · specs-in-flight · blockers — (which replaces an earlier
   "who-acts-next" four-state model, dropped as too interpretive for
   derive-never-ask), git **velocity**, human-vs-agent split, contributors, and
   one deliberate depth exception: **token-cost analytics** by model / activity /
   skill, sourced from Claude Code transcripts.

3. **History is reconstructable/captured, not only accrued.** The forecast/RAG
   "history gate" (≥2 spaced observations) is a **code** limitation, not a data
   one: git already holds the full `progress(t)` series. So history can be
   **reconstructed from git** (backfill = the past), and going forward is
   **captured event-driven** by the thin client's session-stop hook (the future);
   Gauge remains a **read-only observer/deriver**. This refines ADR-0006.

## Decision Options Considered

### Option A: Leave the corpus as-is (prose lags the sharpened frame)
- **Pros:** No work.
- **Cons:** The consistency machinery carries the vaguer "generic portfolio
  dashboard" premise forward; new work reads under-specified authority and drifts
  (the exact reframe failure mode).

### Option B: Full supersede-reframe (retire ADR-0003 / ADR-0006)
- **Pros:** Clean slate.
- **Cons:** Dishonest — the prior decisions are **not wrong**, only sharpened/
  refined. Superseding valid records erases their audit value.

### Option C: Sharpening reframe — keystone ADR + rewrite prose, reaffirm/amend records
- **Pros:** Records the moved premises under one accepted authority; re-baselines
  the *prose* (which genuinely lagged) while **reaffirming** the still-valid
  decisions and **amending** the one it refines. Honest and proportionate.
- **Cons:** Requires disciplined dispositioning so nothing is silently missed.

## Recommended Decision

Adopt **Option C.** As of **2026-08-07**, the manager/portfolio-lens framing,
the analytics scope, and the reconstructable/captured-history model (Context
1–3) are the authoritative frame for Gauge. This ADR is the keystone; it does
**not** supersede ADR-0003 (its portfolio-product premise survives and is
sharpened here) and it **refines**, not retires, ADR-0006 (two-layer derivation
now reads reconstructed + captured history, not only forward-accumulated
snapshots). The prose that encoded the vaguer premise is rewritten to cite this
ADR; the still-valid decisions are reaffirmed. Detail lives in the artifacts
this session already filed (spec 011, spec 012, the two dated release plans).

## Consequences

**Becomes easier:**
- New work reads a precise frame: manager lens, milestone granularity, the
  engineer-tool boundary, the analytics scope, and the collection model — no
  re-deriving intent from vague prose.
- RAG/forecast is understood as a local-data capability (git-reconstructable),
  decoupling it from "wait for collection to accrue."

**Becomes harder:**
- Two artifacts (Gauge + the engineer thin-client) must stay coherent at their
  seam (the shared sample world + the session-stop capture contract).
- The scope line must be actively held — the shallow-detail-tier temptation to
  creep into slices/sessions/tasks is real.

## Assumptions

- git holds a reconstructable `progress(t)` series — **probed**: specs-done-over-
  time was reconstructed from commit history across a real project's ~3-month
  span, yielding many spaced observations.
- Claude Code transcripts carry per-message token/model usage locally — probed
  this session. Token counting must dedup at per-request grain (naive summing
  overcounts materially; developer-view finding).
- The thin client can capture on session end — Claude Code exposes `Stop`/
  `SessionEnd` hooks (a `SessionStart` hook is active in this very session),
  so event-driven capture is a supported mechanism.
- Public-repo hygiene: real per-project portfolio figures stay out of this repo;
  all examples are illustrative.

## Re-baselining manifest

No `retire-draft` (no dead-premise future drafts exist — the specs/releases were
authored under the new frame) and no `supersede`/`retrofit` (no decision is
wrong; no shipped behaviour is invalidated — the forecast is *extended*, not
corrected). Dispositions:

| Artifact | Disposition | Note |
|---|---|---|
| `docs/product-vision.md` | **rewrite** | Manager lens + engineer-tool boundary; analytics vision; collection model; cite this ADR. |
| `docs/architecture.md` | **rewrite** | Read-only observer; git-backfill + session-stop capture; thin-client seam; analytics derivation. |
| `README.md` | **rewrite** | One-line identity → manager/portfolio lens. |
| `CLAUDE.md` (hot cache) | **rewrite** | Identity + framing + new specs/releases pointers. |
| `docs/refinement-todo.md` | **rewrite** | Re-baseline two items that encode the *accrual* premise: **"Daily collection"** (scheduled runner → event-driven session-stop capture) and **"First-run board is all-`unknown`"** (cold-start is addressable by git-backfill, not only "collect daily and wait"). Cite this ADR. |
| ADR-0003 (portfolio reframe) | **reaffirm** | Premise survives; sharpened here, not retired. |
| ADR-0006 (two-layer derivation) | **amend** | `## Amendments` pointer: history is reconstructed/captured, not only accrued — and its parked refinement-todo "daily-collection scheduling" open item is reframed to event-driven capture (see refinement-todo rewrite). |
| ADR-0007 (edge push, team tier) | **reaffirm** | Session-stop capture is a concrete edge-push form; consistent. |
| specs 011, 012 | **reaffirm** | Authored under the new frame; they *are* it. |
| release plans (local-data, thin-client/central) | **reaffirm** | Carry the dated scope of the new frame. |
| ADRs 0004/0005/0008–0016 | **reaffirm** | Contracts/policies unaffected by the sharpening. |

## Emergent work (net-new, already filed)

- **spec 012** — portfolio-manager analytics: the git-backfill history deriver,
  token analytics (deduped, by model/activity/skill), RAG + attention counts.
- **spec 011** — milestone-centric cards (the manager card model).
- **release plans** — local-data (2026-08-14), thin-client + central collection
  (2026-08-28); the latter carries the session-stop capture mechanism.
- **jig#195** (upstream) — first-class blockers, to sharpen the approximate
  blocker count.

No new specs are minted by this reframe — the forward work was already filed
under the new frame this session.

## Coverage floor

**Method:** model-judgment read (Read) over the accepted corpus against the moved
premises; no automated corpus-walker.

**Level 1 — whole corpus, class-level:**
- `docs/decisions/` (16 ADRs) — **scanned**.
- `docs/specs/` (12 specs) — **scanned**.
- `docs/releases/` (6 plans) — **scanned**.
- live-prose docs — **scanned**: `product-vision.md`, `architecture.md`,
  `README.md`, `CLAUDE.md`, **`refinement-todo.md`** (dispositioned `rewrite` —
  its "Daily collection" and "First-run all-`unknown`" items encode the accrual
  premise this reframe moves; the frame-critique caught this, correcting an
  earlier wrong `excused`). **Excused**: `workflow.md`, `conventions.md`,
  `adoption-readiness.md`, `compass-integration.md`, `inbox.md` (jig-lifecycle /
  legacy / transient — do not encode Gauge's product premise).
- `docs/memory/` (glossary, learnings, tooling) — **scanned** (glossary terms
  reviewed; no premise-encoding entry needs re-baselining now).
- `skills/*/SKILL.md` — **excused (none)**: Gauge ships no skills tree.
- root primers — `CLAUDE.md` **scanned**; no `AGENTS.md`.

**Level 2 — within touched classes:** the reference touches **live-prose**
(vision/architecture/README/primer — all rewritten; and `refinement-todo.md`,
whose "Daily collection" + "First-run all-`unknown`" items are re-baselined) and,
in `docs/decisions/`, the records encoding the pre-sharpening framing (ADR-0003
positioning, ADR-0006 derivation model — the latter's parked daily-collection
open item also reframed), identified by reading each ADR's premise for "generic
portfolio dashboard" or "forward-accumulated-only / scheduled-daily history"; the
rest are contracts/policies orthogonal to the sharpening (reaffirmed). specs
011/012 and the release plans were authored under the new frame (they are the
frame).

**Residual uncertainty (owned):** a prose doc marked *excused* could carry a
stale premise line; an ADR judged *orthogonal* could encode the old frame in a
clause not caught by the read. Backstop: a later session finding a surviving
old-premise statement inside a `scanned`/`reaffirmed` artifact should say so.
The floor reduces and surfaces the enumeration risk; it does not eliminate it.

## Kill criteria

- If the engineer/manager boundary proves unworkable (users want one tool), the
  scope line — not this framing — is what to revisit.
- If git-reconstruction of history proves too costly or unreliable at scale,
  fall back to forward-captured-only history (session-stop) and accept the
  cold-start delay.

## Open questions

None blocking. (Finish-first ordering and WIP-as-attention-debt refinements are
tracked as open in spec 012.)
