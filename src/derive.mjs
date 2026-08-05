// History-derived layer (ADR-0006): forecast/risk. A pure fold — zero
// imports, no filesystem access, writes nothing. Its inputs are exactly what
// the caller passes in: the project's already-read observation history (the
// array `readObservationHistory(stateDir, projectId).observations` returns,
// sorted ascending by collectedAt — src/state.mjs) and the project's
// caller-joined deadline (the profile field, joined by the caller —
// src/observation.mjs's joinProjectProfileFields — never read here). This
// keeps the import boundary trivially closed: derive.mjs imports no adapter,
// not src/scan.mjs, and not config.mjs/profile.mjs (it imports nothing at
// all), per ADR-0006 and slice 009-02 AC1.
//
// Implements ADR-0012's four-gate minimum-evidence rule verbatim: a project
// resolves to a colour (on_track/at_risk) only when every gate passes;
// otherwise unknown with a named reason. The pace window is the trailing
// stable-scope window (the slice DoR's resolution of ADR-0012's open
// question): starting from the latest supported-execution observation, walk
// backward through consecutive supported observations while `denom` stays
// within tolerance of the latest.

const DAY_MS = 24 * 60 * 60 * 1000;

// ADR-0012 leaves the exact thresholds tunable within a fixed gate shape.
// These start conservative (exact-equality scope stability, the documented
// ≥2 observations / ≥1 day span) and are re-tuned later against a real
// corpus — a parameter change within the shape, not a new decision.
const MIN_SUPPORTED_OBSERVATIONS = 2;
const MIN_SPAN_DAYS = 1;
const DENOM_TOLERANCE = 0;

function unknown(reason) {
  return { state: 'unknown', reason };
}

// Real calendar validity, not just the `YYYY-MM-DD` shape the profile schema
// already enforces syntactically (007-01/009-01): `Date.UTC` silently rolls
// an out-of-range day into the next month (e.g. 2026-02-30 → 2026-03-02) and
// only rejects a genuinely out-of-range month, so a naive `new Date(...)`
// check would accept the carried-forward 2026-13-40 case. Round-tripping the
// constructed UTC date back through its getters catches both.
function isValidCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Gate 1. Returns the deadline's UTC midnight in epoch ms, or null when the
// deadline is absent, the literal "unknown", or calendar-invalid.
function deadlineMs(deadline) {
  if (typeof deadline !== 'string' || deadline === 'unknown' || !isValidCalendarDate(deadline)) return null;
  const [year, month, day] = deadline.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function executionOf(observation) {
  return (observation?.signals || []).find((entry) => entry.type === 'execution');
}

// ADR-0012 sanctions "done/denom or pct/100"; done/denom is preferred when
// available because pct is a rounded integer percentage (progressOf) and
// quantizing each endpoint to a whole point can flip a colour that sits
// close to the on_track/at_risk boundary. pct/100 is only a fallback for a
// progress object that carries no denom. A denom of 0 (nothing measurable
// left — see the Gate 4.5 check in deriveForecast) never reaches here.
function fractionOf(progress) {
  if (typeof progress?.denom === 'number' && progress.denom > 0) return progress.done / progress.denom;
  if (typeof progress?.pct === 'number') return progress.pct / 100;
  return 1;
}

// ADR-0012's four-gate minimum-evidence rule. `observations` is the
// project's history (ascending by collectedAt); `deadline` is the caller-
// supplied profile deadline value (an ISO date string, the literal
// "unknown", or absent).
export function deriveForecast(observations, deadline) {
  const history = observations || [];

  // Gate 1 — known concrete deadline.
  const deadlineAt = deadlineMs(deadline);
  if (deadlineAt === null) return unknown('deadline-unknown');

  // Gate 2 — fresh, supported latest execution reading.
  if (!history.length) return unknown('execution-unknown');
  const latest = history[history.length - 1];
  const latestExecution = executionOf(latest);
  if (!latestExecution || latestExecution.status !== 'supported') return unknown('execution-unknown');
  if (latestExecution.freshness?.state !== 'fresh') return unknown('stale-evidence');

  // Gate 3 — sufficient spaced history (≥2 supported observations).
  const supported = history
    .map((observation) => ({ observation, execution: executionOf(observation) }))
    .filter((entry) => entry.execution?.status === 'supported');
  if (supported.length < MIN_SUPPORTED_OBSERVATIONS) return unknown('insufficient-history');

  // Gate 4 — trailing stable-scope window (DoR resolution of ADR-0012's open
  // question): walk backward from the latest supported observation while
  // denom stays within tolerance of the latest's denom.
  const latestDenom = supported[supported.length - 1].execution.value.progress.denom;
  let start = supported.length - 1;
  while (
    start > 0 &&
    Math.abs(supported[start - 1].execution.value.progress.denom - latestDenom) <= DENOM_TOLERANCE
  ) {
    start -= 1;
  }
  const window = supported.slice(start);

  // Edge precedence (DoR): ≥2 supported observations but denom moved at the
  // latest step collapses the trailing run to a single point → scope-changed,
  // not insufficient-history (that reason is reserved for genuinely <2
  // supported observations, already excluded above).
  if (window.length < MIN_SUPPORTED_OBSERVATIONS) return unknown('scope-changed');

  const earliest = window[0];
  const spanDays = (Date.parse(latest.collectedAt) - Date.parse(earliest.observation.collectedAt)) / DAY_MS;
  if (spanDays < MIN_SPAN_DAYS) return unknown('insufficient-history');

  // No measurable deliverable scope (BLOCKER fix): denom = total - abandoned
  // can be 0 while execution status still reads 'supported', because
  // ABANDONED is a recognized delivery status (progressOf/hasDeliveryStatus)
  // — e.g. every item in scope was abandoned. With nothing measurable left,
  // a fraction cannot be computed at all; reusing fractionOf's denom-0
  // fallback here would coerce a false already-complete/on_track, exactly
  // the "unknown, not zero/healthy" violation the product forbids. Treated
  // as an evidence gate, not a colour case: no dedicated ADR-0012 reason
  // names this (denom===0 wasn't anticipated there), so `execution-unknown`
  // — the closest existing reason ("no usable execution evidence") — is
  // reused; a dedicated `no-measurable-scope` reason is a candidate future
  // ADR-0012 refinement.
  if (latestDenom === 0) return unknown('execution-unknown');

  // All four gates passed: deterministic colour computation (ADR-0012),
  // over the trailing stable-scope window just established.
  const latestFraction = fractionOf(latestExecution.value.progress);
  const remaining = 1 - latestFraction;
  if (remaining <= 0) return { state: 'on_track', reason: 'already-complete' };

  const earliestFraction = fractionOf(earliest.execution.value.progress);
  const observedPace = (latestFraction - earliestFraction) / spanDays;
  const daysToDeadline = (deadlineAt - Date.parse(latest.collectedAt)) / DAY_MS;

  if (daysToDeadline <= 0) return { state: 'at_risk', reason: 'deadline-passed' };
  if (observedPace <= 0) return { state: 'at_risk', reason: 'no-forward-progress' };

  const requiredPace = remaining / daysToDeadline;
  return observedPace >= requiredPace
    ? { state: 'on_track', reason: 'pace-meets-required' }
    : { state: 'at_risk', reason: 'pace-behind-required' };
}

// Read-layer composition (AC5): attaches each project's {state, reason}
// forecast onto its current-state read. Still a pure fold — the caller
// (src/server.mjs) does the actual I/O, calling readObservationHistory()
// per project id and passing the resulting histories in as a plain map;
// this function itself performs no I/O and stays in the history-derived
// module. `historiesByProjectId` maps a project id to its observation-
// history array; a project with no entry derives from an empty history
// (an honest `unknown`, not a thrown error).
export function attachForecasts(data, historiesByProjectId) {
  return {
    ...data,
    projects: data.projects.map((entry) => ({
      ...entry,
      forecast: deriveForecast(
        historiesByProjectId?.[entry.project.id] || [],
        entry.project.deadline?.value,
      ),
    })),
  };
}
