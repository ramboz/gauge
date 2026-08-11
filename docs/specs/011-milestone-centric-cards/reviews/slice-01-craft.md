---
slice: 011-01 — active-and-next milestone from release Status
pass: craft
verdict: pass
reviewer: pr-review
reviewed_at: 2026-08-11T16:57:45Z
prompt_source: review.py pr-review docs/specs/011-milestone-centric-cards/spec.md 011-01 <deliverables> --richer-skill pr-review
substrate: non-interactive
---

Independent craft/PR review of slice 011-01 — active-and-next milestone from release Status.

VERDICT: pass. Clean pure-module implementation mirroring derive.mjs read-layer composition; 266 tests green; every AC exercised with real (non-vacuous) assertions; output escaped; no correctness/security/robustness blockers.

SPECIFIC ISSUES:
- [nit][impl] public/index.html:113 + lib.mjs parseReleaseAppetite — on real release plans the appetite text begins "Deadline: …", so the card's "Timebox: ${appetite}" prefix renders double-labeled "Timebox: Deadline: 2026-08-14."; strip the label or drop the prefix. Not caught because fixtures use short/relative appetites.
- [nit][impl] milestone.mjs:28,54 — path-sort comparator duplicated in firstByPath and selectNextMilestones; extract shared byPath helper; line 53 .slice() redundant after .filter().
- [strength][impl] milestone.mjs:49-55 — active excluded by path not identity, robust across object copies; documented + tested.
- [strength][impl] lib.mjs:210-218 — parseReleaseStatus returns null (never fabricated state) honoring unknown discipline.

Both nits non-blocking → deviation log; the double-label wart is worth fixing before it shows on real dashboard cards.
