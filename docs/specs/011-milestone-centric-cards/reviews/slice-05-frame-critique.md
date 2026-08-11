---
slice: 011-05 — map worktrees/PRs to their milestone
pass: frame-critique
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-11T18:12:01Z
prompt_source: review.py frame-critique .../spec.md 011-05 slice-05-worktree-milestone-mapping.md
---

Frame-critique of 011-05 (frame_review=true). Loop: needs-changes → revised → pass.
Round 1 (needs-changes) found two real framing defects: (1) two-hop blindness — mapping is branch→spec-id→release-referenced-milestone, and hop 2 (release-gated) is where mapping usually dies even for valid spec ids (live: slice-007-03 encodes spec 007, referenced by no release), so "most unassociated" was mis-attributed to the wrong cause and AC2/AC3 would silently no-op; (2) multi-spec branches (spec-018-019) truncated to one id, violating AC4 "never mis-attributed".
Revised framing: AC1 makes the two-hop chain explicit (both hops can miss) + set-valued spec→milestone join (spec 004 → two releases); AC2 extract-all-ids-no-truncation; AC5 informative unassociated bucket showing the encoded spec id; ## Assumptions grounded in live branch-shape + release→spec enumeration.
Round 2 (pass): both findings resolved, grounding live-verified; one residual (singular→plural on single-spec→multiple-release) then tightened to "milestone(s)" in AC1/AC3.
