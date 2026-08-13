---
adr: 0018
pass: frame-critique
verdict: pass
reviewer: jig:reviewer subagent (independent, 5-round)
reviewed_at: 2026-08-13T20:48:37Z
prompt_source: review.py frame-critique docs/decisions/adr-0018-date-independent-forecast.md
---

## Frame-critique verdict: PASS

Independent `jig:reviewer` subagent, seeing the ADR fresh (no access to the
authoring conversation). Reached PASS after the ADR was hardened across five
adversarial rounds — each earlier round caught a genuine, distinct load-bearing
flaw, which is the gate working, not thrashing:

1. **Asymmetry** — draft painted a dateless stall red while denying dateless
   green; "at risk of missing what?" is undefined without a target. → no dateless
   red/green.
2. **Gate 4 omission** — appetite work is the highest scope-churn population; a
   pace over a moving `denom` is a lie. Confirmed on real data (gauge naive −0.60
   vs in-window +3.73 pct/day). → date-free path enforces Gate 4.
3. **Urgency laundering** — ranking `stalled` above `advancing` re-imported the
   same false alarm via queue position. → no dateless attention re-tiering.
4. **ADR-0011 violation** — an interim "runtime-derived appetite window" parsed
   appetite prose at collection time, which ADR-0011 forbids ("the runtime never
   parses source prose"). → tier 2 reframed as a **user-curated soft target**,
   authored at onboarding inside ADR-0011's explicit author-time carve-out.

### Final PASS reasoning (verbatim from the reviewer)

The reframing of tier 2 as a user-curated soft target authored at onboarding
resolves the ADR-0011 conflict rather than smuggling the prohibited mechanism back
in. ADR-0011 (lines 58-59, 106-107, 125-130) forbids only *runtime* prose parsing
while explicitly blessing author-time comprehension — specifically about appetite
prose. Tier 2 is a near-exact instance of that carve-out: identical to the accepted
deadline path, differing only by a `soft` tag and an amber-not-red consequence
(presentation/policy, not a prohibited mechanism). Code claims verified:
`deriveForecast` gates as described (derive.mjs:83, 137-142); `forecastToRag`
(index.html:386-390) renders any new state gray by default, so tier-3 neutral states
need no change and `over-appetite` needs only a `RAG_YELLOW_REASONS` entry. Honesty
line coherent and symmetric; precedence (hard > soft > neutral > unknown) correct;
kill criteria guard the regressions (runtime prose-parse, hard-alarm smuggle,
deadline losing sole hard-red/green ownership).

### Carried residuals (notes, not blocks)

- The soft target is pinned to an **absolute** committed date (post-review edit),
  so the runtime neither parses prose nor anchors a relative window — zero runtime
  target computation.
- The quantitative backbone (31–71% pace-eligible; the gauge pace inversion) rests
  on an uncommitted throwaway reconstruction that the git-backfill-seed slice must
  reproduce under test. A real dependency to carry into release sequencing, not a
  frame defect.
