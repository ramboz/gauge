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

**Commit:** 0fe9d8e

### 2026-08-19 — Playwright scoped to `.servo/design-eval/`, not a product dependency

**Decision:** The servo design-fidelity eval (spec 015's gate) requires Playwright + Chromium. Install it in `.servo/design-eval/package.json` with its own gitignored `node_modules`, so Gauge's product `package.json` stays `{}` (zero dependencies of any kind).

**Context:** ADR-0001 forbids **runtime** dependencies; Playwright is dev/eval-only tooling that never ships, so it does not violate ADR-0001's letter — but Gauge has zero deps of *any* kind as a point of identity, and this would have been its first. Scoping the dep to the eval tooling keeps the product manifest pristine while still enabling the servo `design-eval` machine-gate the owner chose. Chromium installs to the global `~/Library/Caches/ms-playwright` cache, not the repo. Judge transport is `cli` (`claude -p`, subscription auth) since no `ANTHROPIC_API_KEY` is set. Known follow-up: the live judge is blocked until the `claude` CLI OAuth session is refreshed (or an API key is provided) — servo returns an honest `env_error`, never a silent pass.

**Scope:** `.servo/design-eval/` tooling (spec 015 design-fidelity gate)

**Commit:** 82845c3

### 2026-08-20 — Manager-card metrics as a 2×2 grid; spec 015 landed directly

**Decision:** The per-card metrics render as a tight **2×2 grid** — the two "big number" tiles (token cost · agent-coauthored LLM ratio) on the top row, the two graph tiles (velocity · cost trend) side by side below — rather than the mockup's single stat row. The separate velocity-trend row is retired (redundant with the velocity sparkline). Spec 015 (all 4 slices) was **landed directly to `main` with the formal independent-review passes waived** by owner decision.

**Context:** Owner design direction during the 015 polish pass: the 2×2 reads tighter and more consistent than a single row. It intentionally diverges from the frozen spec-012 mockup — yet the servo design-fidelity score *rose* 0.35 → 0.55, because removing the extra trend rows tightened the whole card. **Consequence:** the servo `design-eval` still scores against the single-row mockup, so it now measures fidelity to a superseded layout. Follow-up (deferred): update `manager-dashboard-mockup.html` to the 2×2 and re-freeze the eval so the gate tracks the real target. Slices carry honest per-slice deviation logs noting the review waiver; the board reflects DONE via `JIG_REVIEW_EVIDENCE_GATE=0`.

**Scope:** `public/index.html` stat grid (spec 015); servo eval reference (rebaseline pending)

**Commit:** 1c26686

### 2026-08-20 — Dashboard feedback round: queue removed, cost pricing fixed, 2×2 column order

**Decision:** Five owner-requested refinements to the manager card: (1) **removed the attention-queue UI** (the server still computes `attention` on `/api/data` — src/derive.mjs — but the dashboard no longer renders it); (2) the warn-icon ⚠ shares one line with the "last commit" heading; (3) the 2×2 metric grid's top row is reordered to **[LLM ratio] [token cost]** so both cost tiles occupy the right column; (4) **token-cost pricing gained a family-tier fallback** (`resolvePrice` in `src/cost.mjs`) so current models (opus-4-8/4-7/5, sonnet-5/4-6, fable-5) are priced instead of dropping to `$0`; (5) the LLM/human tile shows its commit basis (`· N commits`).

**Context:** #4 root cause — the pricing table only listed `-4-5`/`-3-5`-era ids, so every current-model token (opus-4-8 alone was 33k+ records in the corpus) fell to the unknown-model bucket and cost read `$0.00+`. The family fallback (default-table-only; custom tables honored verbatim) makes cost work across model refreshes. Result: Jig $0.25→$644, Servo $0→$95, CWV/Superpowers $0→$946 (illustrative opus/sonnet pricing). **Known follow-ups (not fixed here):** several projects still read cost `null`/`$0` (Gauge, Shaper) or share an identical figure (CWV/Superpowers $946.82) — a **transcript path→project mapping** issue for nested/self projects, separate from pricing; and the LLM-vs-human split stays a windowed (8-week) `Co-Authored-By` proxy — a truer signal would need session-transcript attribution (deferred).

**Scope:** `public/index.html` (card render), `src/cost.mjs` (pricing fallback)

**Commit:** 38c034d

### 2026-08-20 — Cost: attribute worktree sessions + partition monorepo tracks

**Decision:** Two corrections to token-cost attribution in `src/cost.mjs`: (1) **`sessionFilesForProject` now includes worktree transcript dirs** (`<encoded-path>--claude-worktrees-*`), not just the exact repo dir — via a new `projectTranscriptDirs` helper; (2) **multi-track (monorepo) projects partition the repo's cost by worktree evidence** — `trackTranscriptDirs` (heuristic v1) gives each track its slug-matched worktrees, routes the repo-root + unmatched worktrees to the **primary** (most-matched) track, and gives a never-touched track **0**. The server derives per-track slugs via `trackOptionsForProjects` (projects sharing a `path` → slugs from the shared id-prefix).

**Context:** The owner observed cost looked "low-balled" vs a maxed $4K license. Root cause #1: work runs in git worktrees (a slice/PR/ceremony per worktree), each a separate transcript dir that the exact-match reader **silently dropped** — a **~4× undercount** (Jig $645→$2610, Gauge $0→$2018, Servo $95→$1363). Root cause #2: decomposed tracks (`mystique-cwv`, `mystique-superpowers`) share one repo `path`, so every track inherited the full repo total (CWV≡Superpowers $946) — now CWV **$3300**, Superpowers **0** (owner never touched it), Offer-Management primary for its repo, RTB/Contextual 0. Grand total across all transcripts is ~$16K API-equivalent, consistent with a $4K subscription (~4× value). **Caveats:** pricing stays illustrative (not real rates); the multi-track split is a **worktree-name heuristic** — a track worked on only from the shared repo root, with no slug-named worktree, would be mis-attributed to the primary. The robust fix is **per-track working-dir declaration in config** (deferred; relates to the personalization `repos.yaml` scope-tags note in inbox). +3 regression tests.

**Scope:** `src/cost.mjs` (transcript mapping + track partition), `src/server.mjs` (per-track wiring)

**Commit:** a55a88a

### 2026-08-20 — Per-track `costPaths`: explicit multi-track cost attribution

**Decision:** Add an optional `costPaths` field to a profile **entry** (a monorepo track) — an array of repo working-directory paths (absolute or config-relative) whose Claude Code transcripts, worktrees included, count toward THAT track's token cost. It is the durable replacement for the worktree-name heuristic: declaring it **overrides** the heuristic; an empty list `[]` reads **$0** (a track never worked on); and a track spanning multiple external repos can aggregate them. Additive `project-profile-v1` field (ADR-0009 territory) — a profile with no `costPaths` validates and behaves exactly as before (heuristic when multi-track, whole-repo when single).

**Context:** Follows the worktree/multi-track cost fixes above; the owner asked for the robust fix so a never-touched track (Superpowers) reads 0 predictably rather than by worktree-name luck. Attribution precedence is now: explicit `costPaths` → multi-track worktree heuristic → single-repo whole. Implemented across the schema (`schemas/project-profile-v1.schema.json`), the runtime validator (`src/profile.mjs`), decomposition (`src/config.mjs` `expandEntries` resolves each entry's paths absolute), and attribution (`src/cost.mjs` `sessionFilesForProject` honors a `costPaths` scope; `src/server.mjs` prefers it). The gitignored `gauge.config.json` now declares `cwv.costPaths = ["…/mystique"]` and `superpowers.costPaths = []`, giving CWV **$3301** and Superpowers an **explicit $0** (verified). +3 regression tests (validator / decomposition / attribution); full suite 599/599 green.

**Scope:** `project-profile-v1` schema + `src/{profile,config,cost,server}.mjs` (config contract lives in the repo; the owner's actual `costPaths` values live in the gitignored config)

**Applied (methodology, values in the gitignored config):** All configured multi-track projects now declare `costPaths` explicitly rather than relying on the heuristic. Mapping rule used: a track's `costPaths` = the working-directory paths where its Claude sessions actually run — cross-checked against the source's own scope manifest when present (the personalization workspace ships a `repos.yaml` tagging each code repo with its owning track). **Key finding:** for that workspace, *all* sessions ran in the umbrella workspace repo (+ worktrees); the individual code repos had **zero** transcripts. So the umbrella's real cost is attributed to the track with observable worktree evidence (offer-management), each track additionally lists its own scoped code repos (forward-looking — currently $0, but future sessions there will count), and tracks with neither evidence nor sessions declare `[]` (explicit $0). Consequence to revisit: work done for several tracks from ONE shared umbrella CWD still can't be split per-track by transcripts alone — the umbrella-→-primary-track attribution is a judgment, not ground truth.

**Commit:** a75ad44 (feature); config values are gitignored (private paths, sensitive-data constraint)
