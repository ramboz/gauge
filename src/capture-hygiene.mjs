// Capture-time storage hygiene (spec 014, slice 014-02, AC1). 014-01 captures
// UNCONDITIONALLY on every session end (owner decision — no content-dedup,
// because pace is endpoint-based/density-invariant and a flat-progress-near-
// deadline `at_risk` is honest). That bloats storage with byte-identical
// consecutive records. This module supplies the pure predicate used to
// coalesce a RUN of identical-state captures down to ONE record whose
// `collectedAt` is the NEWEST of the run (see collectObservation's `coalesce`
// option in src/state.mjs).
//
// CRITICAL: coalescing keeps the NEWEST record (advancing the timestamp), never
// the oldest — freezing the timestamp is exactly what would MASK a stall. The
// coalescing is forecast-neutral precisely because pace reads only two window
// endpoints; collapsing a flat run to its newest endpoint leaves the pace fold
// unchanged while the retained latest timestamp still advances.

// Two observations share the same capture STATE when their git HEAD
// (`provenance.sourceRevision`) and their execution progress `{done, denom}`
// are identical. HEAD is the primary key — a commit is a genuine change point
// that must be kept even if the coarse `{done, denom}` is unchanged (active
// development that hasn't yet flipped a spec's delivery status still advances
// HEAD, and that honestly moves the latest timestamp forward).
function executionProgress(observation) {
  const exec = (observation?.signals || []).find((entry) => entry.type === 'execution');
  if (!exec || exec.status !== 'supported') return null;
  const progress = exec.value?.progress;
  if (!progress) return null;
  return { done: progress.done, denom: progress.denom };
}

export function sameCaptureState(a, b) {
  if (!a || !b) return false;
  const revA = a.provenance?.sourceRevision ?? null;
  const revB = b.provenance?.sourceRevision ?? null;
  if (revA !== revB) return false;
  const progA = executionProgress(a);
  const progB = executionProgress(b);
  if (progA === null && progB === null) return true; // same HEAD, both unsupported execution
  if (progA === null || progB === null) return false;
  return progA.done === progB.done && progA.denom === progB.denom;
}
