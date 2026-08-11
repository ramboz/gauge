---
status: DONE
dependencies: [011-01, 011-04]
last_verified: 2026-08-11
frame_review: true
---

## Slice 011-05 — map worktrees/PRs to their milestone

**Goal:** Each worktree/PR is attributed to a **specific milestone** rather than
sitting card-level: an open PR shows as a badge on its milestone, cleanup-worthy
worktrees fold into the ⚠ tooltip, and anything that can't be mapped lands in an
honest "unassociated" bucket — with no file paths anywhere.

**DoR:**
- ✅ 011-01 (milestones exist) and 011-04 (⚠ tooltip is the cleanup home) landed.
- ✅ `scanWorktreeOnlyDocs` already yields per-worktree lifecycle state + `pr`
  (ADR-0015/0016).

**Acceptance Criteria:**

1. **Mapping is a two-hop chain, and BOTH hops can miss.** A worktree maps to a
   milestone via worktree-branch/resolved-PR → the **spec id(s)** it encodes (hop 1)
   → the **milestone(s)** whose release references that spec, reusing 011-02's
   release→spec parse (hop 2). The spec→milestone join is **set-valued**: one spec
   id can be referenced by several releases (e.g. spec 004 → both
   `local-portfolio-loop` and `terminal-analytics-loop`), so the worktree badges on
   **each** — never one picked arbitrarily (that would be the mis-attribution AC4
   forbids). **Either hop failing yields "unassociated"** (see AC4): hop-1 miss
   = the branch encodes no spec id; hop-2 miss = it encodes a valid spec id that
   **no release plan references** (the common case — most projects have no release,
   and released ones reference only a handful of specs, so e.g. a `slice-007-03`
   worktree is unassociated even though its spec id is valid). The extraction rule
   (which branch/PR shapes yield a spec id) is documented in the deviation log.
2. **Multi-spec branches map to all referenced milestones, never truncated.** A
   branch encoding several spec ids (e.g. `spec-018-019-…`) extracts **all** of
   them; each maps independently. If they resolve to different milestones the
   worktree badges on each; a spec id with no owning release simply doesn't
   contribute a badge. Silently dropping a second id is a mis-attribution and is
   forbidden (AC4).
3. **Open PR on its milestone(s).** An in-review worktree with a resolved open PR
   (ADR-0016) renders as a compact PR badge on the milestone(s) it maps to (active
   or "next"), not at card level — on each when the set-valued join resolves to
   more than one. **Because hop 2 is release-gated, expect
   this to fire only when the encoded spec is release-referenced** — otherwise the
   PR shows in the unassociated affordance, still surfaced, never dropped.
4. **Cleanup folds into ⚠.** Stale/forgotten (cleanup-worthy) worktrees appear
   only in the ⚠ tooltip (011-04), attributed to their milestone **when both hops
   resolve**, otherwise noted as unassociated in the tooltip.
5. **Unassociated bucket is first-class and informative.** A worktree that maps to
   no milestone — codename/bug/issue/fix branch (hop-1 miss) OR a valid but
   non-release-referenced spec id (hop-2 miss) — is surfaced in a clearly-labelled
   "unassociated" affordance, never silently dropped, never mis-attributed. When
   the branch DID encode a spec id (hop-2 miss), the bucket **shows that spec id**
   (e.g. "worktree `slice-007-03` — spec 007, not in any milestone") so the
   affordance stays informative rather than a blind pile.
6. **No paths.** No worktree file paths appear anywhere on the card; the worktree
   is identified by its name, its encoded spec id (when any), and its milestone
   (when mapped).

**DoD:**
- [x] All ACs pass; full suite green. — 320/320.
- [x] Tests cover: hop-1+hop-2 happy path (spec-encoding branch whose spec IS
      release-referenced → milestone badge), **hop-2 miss** (valid spec id, no
      release references it → unassociated showing the spec id), **multi-spec
      branch** (`spec-018-019` → both ids extracted, no truncation), PR-based
      mapping, hop-1 miss (codename/bug/issue branch → unassociated), cleanup-worthy
      → ⚠ tooltip, and a fallback (no-release-plan) project where everything is
      unassociated. Plus set-valued (one spec → multiple milestones), false-3-digit
      guard, and unpadded-join normalization.
- [x] Each new test shown to fail when the feature is removed. — red confirmed per
      implementer TDD log (incl. red-on-revert for the join-normalization test).
- [x] `frame_review` set per `workflow.py frame-review-needed` (true) — ran the
      frame-critique pass; it returned needs-changes on two-hop blindness +
      multi-spec truncation; the framing (ACs + Assumptions) was revised to address
      both before implementation. Evidence: `reviews/slice-05-frame-critique.md`.
- [x] Reviewed (compliance + craft). Deviation log + reconciliation sweep. — both
      PASS (`reviews/slice-05-compliance.md`, `reviews/slice-05-craft.md`);
      reconciliation review below.

### Deviation log (after reconciliation)

Original ACs unchanged; this records implementation choices, the extraction rule,
and review nits.

- **Branch→spec extraction rule (AC1, documented as required).** HOP 1:
  `extractBranchSpecIds(name)` matches `\bspec[-\s]?(\d{3})((?:[-\s]\d{3})*)\b`
  (chains additional 3-digit runs so `spec-018-019` → `['018','019']`, never
  truncated) plus `\bslice[-\s]?(\d{3})(?:[-\s]\d{2}\b)?` (normalized to the parent
  id, slice suffix discarded). Both **anchor on the literal `spec`/`slice` token**
  (`\b`), so a bare 3-digit run in a codename (`mystifying-poincare-604`) never
  false-matches and `respec-042` doesn't fire mid-word. Case-insensitive, deduped,
  first-appearance order. HOP 2 reuses `extractReferencedSpecNumbers`
  (server-attached as `milestone.*.referencedSpecs`) — no client-side reparse.
- **Realization deviation: hop 1 reads the worktree DIRECTORY NAME, not the
  branch/PR head ref (accepted, both reviewers).** `scanWorktreeOnlyDocs` exposes
  only `worktree` (the `.claude/worktrees/<dir>` basename) + optional `pr`; no
  `headRefName` survives into the doc shape. The dir basename encodes the spec id
  in practice (`slice-007-03-jig-4c8845`). **Failure mode is safe:** a
  spec-encoding *branch* behind a codename-named *directory* is a **false hop-1
  miss** → lands unassociated, never mis-attributed (AC4 preserved). This case does
  not occur in the current live corpus. Plumbing the branch through `scan.mjs` is a
  future enhancement, deliberately out of scope for this slice.
- **Set-valued join (AC1/AC2/AC3).** `worktreeMilestoneMap(p)` joins each extracted
  spec id against every candidate milestone's `referencedSpecs` (active + all next);
  one spec id referenced by several releases badges on each. Returns
  `{mapped, unassociated}`; a worktree with zero matches lands only in
  `unassociated`, carrying its (possibly empty) `specIds` for the AC5 note.
- **Reconciliation fixes (from the review passes).**
  1. *Digit-normalization asymmetry (latent join bug)* — hop 1 emitted `\d{3}`,
     hop 2 `\d+`, joined by exact equality, so an unpadded release ref (`spec 7`)
     would silently drop a `spec-007` badge. Added `canonicalSpecId` (strip leading
     zeros) applied at the comparison site only (display text keeps natural form);
     added an unpadded-join test (red-on-revert confirmed). `extractReferencedSpecNumbers`
     / `specNumberOf` in `milestone.mjs` were left untouched (shared with
     `milestoneSpecProgress`'s id-keyed join — avoided an unrelated regression).
  2. *Test-fixture fidelity* — `claude/`-prefixed slash-bearing branch strings were
     re-based onto real slashless dir basenames (`slice-007-03-jig-4c8845`, …), with
     a comment that `d.worktree` never contains `/`.
  3. *Redundant `Array.from`* — removed where the value only feeds `.length`; kept
     where a cross-realm `assert.deepEqual` genuinely needs the main-realm copy.
- **Set-valued cleanup tooltip density (accepted).** A cleanup-worthy worktree
  matching N milestones emits N ⚠ tooltip lines (one per milestone) — consistent
  with "badge on each"; logged as a conscious density choice.
- **Byproduct:** the 011-04 deferred nit (duplicated worktree-grouping between
  `worktreeInfo` and `warningItems`) is resolved — both now share the single
  `worktreeMilestoneMap` join.

### Reconciliation sweep

- **`docs/architecture.md`** → **updated**: the `/api/data` Contract-surfaces
  milestone-join line now names the new `referencedSpecs` read-layer member (the
  parsed parent spec ids each release references, added by 011-05 so worktrees/PRs
  can be joined to their milestone(s)). It is a read-layer join field, not an
  observation-v1 record member. (Correction: `referencedSpecs` is new to this
  slice — the earlier 011-02 line documented `specProgress`, a different field.)
- **`docs/specs/README.md` status board** → **updated** (regenerated on DONE;
  spec 011 rolls up to DONE with this slice).
- **`CLAUDE.md` hot cache** → **updated (spec-close primer hygiene, spec 025 rule)**:
  spec 011 is now fully DONE (all five slices landed), so the Hot Cache "active
  build" line moves 011 from in-flight to landed; the milestone-card model + the
  `src/milestone.mjs` read-layer join are recorded as shipped.
- **`schemas/observation-v1.schema.json`** → **no-op**: mapping is a read-layer
  derivation, no observation field.
- **`docs/memory/glossary.md`** → **no-op**: "unassociated bucket" / "worktree→
  milestone mapping" are described in this spec; no cross-cutting new term needing
  the glossary.
- **`docs/decisions/lightweight-decisions.md`** → **no-op**: no new UI-copy decision
  beyond the affordance labels already covered.
- **`docs/inbox.md`** → **no-op**: the branch-through-scan.mjs enhancement is
  recorded here in the deviation log (out of scope), not as a fresh inbox item.

### Open question

- The branch→spec extraction rule is deliberately unspecified here beyond "encode
  a spec id"; real branch names vary (`spec-096-…`, `claude/spec-018-019-…`,
  `github-issue-124-…`, codenames). Slice authoring should enumerate the observed
  shapes in the live portfolio and pick the smallest rule that maps the majority,
  leaving the rest unassociated rather than guessing.

## Assumptions

<!-- Grounding (ADR-0020 §1): branch shapes enumerated across the live corpus
     (jig · gauge · servo · shaper worktrees) on 2026-08-11. -->

- **Observed worktree-branch shapes (enumerated, `git worktree list`):**
  spec-encoding — `claude/spec-096-jig-ceremony-…`, `slice-007-03-jig-…`;
  non-spec — `claude/bug-028-…`, `claude/issue-111-…`, `codex/issue-95-…`,
  `fix/scaffold-py39-…`; codenames — `claude/sad-jepsen-…`,
  `claude/mystifying-poincare-…`, `claude/ui-feedback-clarifications-…`.
- **Load-bearing assumption:** only the `spec-NNN` and `slice-NNN(-NN)` shapes
  reliably encode a spec id. **The majority of real branches encode no spec** —
  so the honest outcome is that **most worktrees land in the "unassociated"
  bucket**, which is therefore first-class and required, not an edge case.
- **The mapping is TWO hops and the second is release-gated (frame-critique
  finding, 2026-08-11).** branch → spec id (hop 1) → milestone-whose-release-
  references-that-spec (hop 2, reusing 011-02's parse). **Hop 2 is where mapping
  usually dies, even for valid spec ids:** most projects have no release plan, and
  released ones reference only a handful of specs. Live evidence — the one clean
  spec-encoding worktree in this repo, `claude/slice-007-03-jig`, encodes spec 007,
  which **no release plan references** (`local-portfolio-loop`→003/004/009;
  `manager-dashboard-local-data`→011/012/108). So specific-milestone attribution
  (AC3/AC4) is **expected to be rare, gated on release coverage** — the frame does
  not over-promise milestone badges, and the unassociated bucket must show the
  encoded spec id (AC5) so a hop-2 miss is legible, not a blind pile.
- **Smallest rule:** extract **all** spec ids from a branch (or its resolved PR
  head ref) via a repeated `spec[-\s]?NNN` / `slice[-\s]?NNN(-NN)?` match (so a
  multi-spec branch like `spec-018-019` is never truncated — AC2); normalize each
  to its parent id and reuse 011-02's release→spec parse to find owning
  milestone(s). Everything else is unassociated — never guessed, never
  mis-attributed.
- **Risk:** a codename branch that happens to contain a 3-digit run could
  false-match; the rule must anchor on the `spec`/`slice` token, not bare digits.
