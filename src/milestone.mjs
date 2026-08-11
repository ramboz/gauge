// Milestone-centric cards (spec 011, slice 011-01): pure derivation of a
// project's active-and-next milestone from its release-plan workstreams
// (docs/releases/*.md, `kind: 'release'`, enriched by src/scan.mjs with a
// `status` field parsed from `## Status` — src/lib.mjs's parseReleaseStatus).
// Zero imports, no filesystem access — the caller supplies an
// already-scanned workstreams array, matching src/derive.mjs's read-layer
// composition convention (attachForecasts/attentionQueue): the pure fold
// lives here, the one I/O read (of the workstreams signal, already present
// on the composed data) happens in the caller.
//
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
// (keeping this module's zero-import contract).
function workstreamItemsOf(entry) {
  const signal = (entry.signals || []).find((s) => s.type === 'workstreams');
  return signal?.status === 'supported' ? signal.value?.items || [] : [];
}

// Read-layer composition (AC1/AC2), mirroring src/derive.mjs's
// attachForecasts/attentionQueue style: attaches each project's derived
// `{active, next}` milestone onto its current-state read. A pure fold — no
// I/O, and every entry/array below is a freshly built object, so the
// caller's input is never mutated.
export function attachMilestones(data) {
  return {
    ...data,
    projects: data.projects.map((entry) => {
      const items = workstreamItemsOf(entry);
      const active = selectActiveMilestone(items);
      return { ...entry, milestone: { active, next: selectNextMilestones(items, active) } };
    }),
  };
}
