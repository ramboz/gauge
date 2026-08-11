// Milestone-centric cards (spec 011, slice 011-01): pure derivation of a
// project's active-and-next milestone from its release-plan workstreams
// (docs/releases/*.md, `kind: 'release'`, enriched by src/scan.mjs with a
// `status` field parsed from `## Status` — src/lib.mjs's parseReleaseStatus).
// No filesystem access — the caller supplies an already-scanned workstreams
// array, matching src/derive.mjs's read-layer composition convention
// (attachForecasts/attentionQueue): the pure fold lives here, the one I/O
// read (of the workstreams/execution signals, already present on the
// composed data) happens in the caller.
//
// Slice 011-02 imports progressOf from src/lib.mjs — the one deliberate
// exception to the earlier zero-import framing above. lib.mjs is itself a
// pure, zero-filesystem module (src/discover.mjs already sets the precedent
// of one pure module importing another — see its own header comment), and
// the slice's explicit requirement is to reuse the EXISTING spec-status
// "done" rule rather than invent a second one; progressOf (already ABANDONED-
// aware: it drops abandoned specs from the denominator) is that single
// source of truth for both the project-global bar (src/scan.mjs) and this
// milestone-scoped rollup.
import { progressOf } from './lib.mjs';

// Release lifecycle (docs/releases/*.md convention): candidate → committed →
// shipping → shipped → dropped. Active = shipping ?? committed (shipping,
// being closer to done, wins when both exist); shipped/dropped are terminal
// and never active or next.
const ACTIVE_STATUS_PRIORITY = ['shipping', 'committed'];
const NEXT_STATUSES = new Set(['candidate', 'committed']);

function isRelease(workstream) {
  return Boolean(workstream) && workstream.kind === 'release';
}

// Shared lexicographic-by-`path` comparator (reconciliation nit 2): the one
// tie-break/ordering rule used both to pick the winner among several
// same-status releases (firstByPath) and to order the next list — a single
// source of truth so the two can never silently diverge.
function byPath(a, b) {
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

// Deterministic, documented tie-break (AC1): when several releases share the
// winning status, the lexicographically-first `path` wins — stable regardless
// of input order (scanWorkstreams already sorts by filename, but this stays
// the single source of truth so a caller that doesn't pre-sort still resolves
// the same active milestone every time).
function firstByPath(list) {
  return list.slice().sort(byPath)[0];
}

// AC1: exactly one active milestone — the release whose status is `shipping`,
// else `committed` — or null when no release resolves either (all
// shipped/dropped, or an unparsed/absent status): the graceful
// no-active-milestone degradation (AC6), never a thrown error.
export function selectActiveMilestone(workstreams) {
  const releases = (workstreams || []).filter(isRelease);
  for (const status of ACTIVE_STATUS_PRIORITY) {
    const matching = releases.filter((w) => w.status === status);
    if (matching.length) return firstByPath(matching);
  }
  return null;
}

// AC2: every `candidate` release, plus any `committed` release not chosen as
// active, in stable path order; `shipped`/`dropped` (and any release with an
// unrecognized/absent status) are excluded. `active` is compared by `path`
// (not object identity) so a freshly-derived active milestone still excludes
// itself correctly.
export function selectNextMilestones(workstreams, active) {
  const activePath = active?.path;
  return (workstreams || [])
    .filter((w) => isRelease(w) && NEXT_STATUSES.has(w.status) && w.path !== activePath)
    .sort(byPath);
}

// Structural lookup mirroring src/derive.mjs's executionOf: finds the
// project's supported `workstreams` signal without importing observation.mjs
// (keeping this module's filesystem-free contract).
function workstreamItemsOf(entry) {
  const signal = (entry.signals || []).find((s) => s.type === 'workstreams');
  return signal?.status === 'supported' ? signal.value?.items || [] : [];
}

// Same structural-lookup pattern, for the `execution` signal's per-spec
// `items` (src/scan.mjs's scanSpecs shape: `{ id, title, status, slices }`,
// carried verbatim by src/observation.mjs into `execution.value.items`) —
// the rollup's spec-status source.
function specItemsOf(entry) {
  const signal = (entry.signals || []).find((s) => s.type === 'execution');
  return signal?.status === 'supported' ? signal.value?.items || [] : [];
}

// AC1 (slice 011-02): every `spec NNN` reference in a release doc's prose,
// case-insensitive, in first-appearance order and deduped. A trailing
// `-NN` (a slice reference, e.g. "spec 009-01") is captured but discarded —
// it collapses onto its parent number ("009") without ever producing a
// separate entry, so a release mentioning both "spec 009" and "spec 009-01"
// counts spec 009 exactly once. `\bspec` requires a preceding word boundary,
// so "respect 011" is never mistaken for a reference.
export function extractReferencedSpecNumbers(text) {
  const seen = new Set();
  const out = [];
  const re = /\bspec\s+(\d+)(?:-\d+)?\b/gi;
  let match;
  while ((match = re.exec(text || ''))) {
    const num = match[1];
    if (!seen.has(num)) {
      seen.add(num);
      out.push(num);
    }
  }
  return out;
}

// A scanned spec's leading numeric id (scanSpecs' `id` is the full directory
// name, e.g. "009-complete-local-portfolio-loop" — this is its "009").
function specNumberOf(id) {
  const match = /^(\d+)/.exec(id || '');
  return match ? match[1] : null;
}

// AC2 (slice 011-02): milestone progress = done/denom over the release doc's
// referenced PARENT specs (AC1's dedupe), resolved against this project's
// scanned specs and rolled up by the EXISTING progressOf status rule — so
// abandoned/dropped specs are excluded from the denominator exactly as they
// already are for the project-global bar, never a second rule invented here.
// A reference to a spec number this project doesn't have (e.g. another
// project's numbering, or a typo) is silently unresolved, not an error.
// AC4: no referenced numbers at all, or none of them resolvable against this
// project's specs, both yield null — explicit unknown, never a fabricated 0%.
export function milestoneSpecProgress(releaseBody, specs) {
  const numbers = extractReferencedSpecNumbers(releaseBody);
  if (!numbers.length) return null;
  const bySpecNumber = new Map();
  for (const item of specs || []) {
    const num = specNumberOf(item.id);
    if (num && !bySpecNumber.has(num)) bySpecNumber.set(num, item);
  }
  const resolved = numbers.map((num) => bySpecNumber.get(num)).filter(Boolean);
  if (!resolved.length) return null;
  return progressOf(resolved);
}

// Read-layer composition (AC1/AC2/AC3), mirroring src/derive.mjs's
// attachForecasts/attentionQueue style: attaches each project's derived
// `{active, next}` milestone onto its current-state read, with the active
// milestone additionally carrying `specProgress` (AC2/AC4's rollup over its
// own release-doc body, or null/unknown when nothing resolves). A pure fold
// — no I/O, and every entry/array below is a freshly built object, so the
// caller's input is never mutated.
export function attachMilestones(data) {
  return {
    ...data,
    projects: data.projects.map((entry) => {
      const items = workstreamItemsOf(entry);
      const active = selectActiveMilestone(items);
      const activeWithProgress = active
        ? { ...active, specProgress: milestoneSpecProgress(active.body, specItemsOf(entry)) }
        : null;
      return { ...entry, milestone: { active: activeWithProgress, next: selectNextMilestones(items, active) } };
    }),
  };
}
