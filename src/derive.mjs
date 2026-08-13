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

// ADR-0012's four-gate minimum-evidence rule, extended by ADR-0018 (tier 3,
// slice 013-02) to a dateless project: `observations` is the project's
// history (ascending by collectedAt); `deadline` is the caller-supplied
// profile deadline value (an ISO date string, the literal "unknown", or
// absent). Whether or not a deadline is present, Gates 2-4.5 below run
// unconditionally and observedPace is computed over the same trailing
// stable-scope window — ADR-0018's "every tier reuses the existing evidence
// gates" rule. `deadlineAt` is only consulted once every gate has passed, to
// choose between ADR-0012's hard colour (tier 1) and ADR-0018's neutral
// motion read (tier 3); a project with no deadline that fails an evidence
// gate gets that gate's own reason, never a `deadline-unknown` placeholder —
// "below any gate the forecast is unchanged unknown with its existing
// reason" (ADR-0018).
export function deriveForecast(observations, deadline) {
  const history = observations || [];

  // Deadline lookup — a tier discriminator now, not an early gate: consulted
  // only after every evidence gate below has passed (see comment above).
  const deadlineAt = deadlineMs(deadline);

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

  // All gates passed: deterministic pace/remaining computation over the
  // trailing stable-scope window, shared by every tier below (ADR-0012 tier
  // 1 and ADR-0018 tier 3 alike).
  const latestFraction = fractionOf(latestExecution.value.progress);
  const remaining = 1 - latestFraction;
  if (remaining <= 0) return { state: 'on_track', reason: 'already-complete' };

  const earliestFraction = fractionOf(earliest.execution.value.progress);
  const observedPace = (latestFraction - earliestFraction) / spanDays;

  // ADR-0018 tier 3 — no committed target of any kind: a neutral motion
  // read only. Never a hard colour (on_track/at_risk) and never a reason
  // that implies a target exists; `remaining <= 0` was already handled
  // above, identically for both tiers.
  if (deadlineAt === null) {
    return observedPace > 0
      ? { state: 'advancing', reason: 'progressing-no-deadline' }
      : { state: 'stalled', reason: 'stalled-no-deadline' };
  }

  // ADR-0012 tier 1 (unchanged): committed hard deadline.
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

// ADR-0013: the global attention queue. A pure, deterministic tiered
// lexicographic ordering over each project's already-derived forecast/risk
// read (ADR-0006) — never a rewrite of any project's own local priority, and
// never a re-derivation from raw progress/freshness. Takes the full
// attachForecasts() output (so it can use `generatedAt` as the "now"
// reference for the deadline-proximity phrase); performs no I/O, imports
// nothing (this file has zero imports, per AC1/AC4), and never mutates its
// input — every entry below is a freshly built object/array.
//
// `narrative.value.blockers` (present only for legacy-Compass sources —
// src/observation.mjs) is the one raw field ADR-0013 admits as a tier-2
// trigger, used when present, never fabricated.
function narrativeBlockerPresent(entry) {
  const narrative = (entry.signals || []).find((signal) => signal.type === 'narrative');
  const blockers = narrative?.value?.blockers;
  return Array.isArray(blockers) && blockers.length > 0;
}

// The five-tier partition (ADR-0013), most-urgent-tier-wins via first-match
// top-down: every ADR-0012 reason maps to exactly one tier, and the optional
// blocker only ever raises a project into tier 2 — it never leaves one
// unplaced. Order of checks IS the precedence rule.
function tierOf(entry) {
  const forecast = entry.forecast || {};
  if (forecast.state === 'at_risk') return 1;
  if (forecast.reason === 'stale-evidence' || narrativeBlockerPresent(entry)) return 2;
  // ADR-0018 tier 3: a dateless project's neutral motion read (`advancing`/
  // `stalled`) sits in the SAME tier as `deadline-unknown` — never re-tiered
  // above it by `stalled`, never below it by `advancing` (the round-3
  // urgency-laundering option ADR-0018 rejected).
  // NOTE: since 013-02, `deriveForecast` no longer emits `deadline-unknown`
  // (the evidence gates run before the deadline branch, so a dateless project
  // resolves to advancing/stalled or a gate-specific unknown). The
  // `deadline-unknown` case here is retained only for standalone `attentionQueue`
  // callers/fixtures that hand-build a forecast; the composed
  // `attachForecasts → attentionQueue` pipeline never reaches it.
  if (
    forecast.reason === 'deadline-unknown' ||
    forecast.reason === 'scope-changed' ||
    forecast.state === 'advancing' ||
    forecast.state === 'stalled'
  ) return 3;
  if (forecast.reason === 'insufficient-history' || forecast.reason === 'execution-unknown') return 4;
  if (forecast.state === 'on_track') return 5;
  // Defensive: a malformed/unrecognized forecast must NOT be coerced to the
  // healthiest tier (product-vision: never sink an unknown into "healthy"). In
  // the composed pipeline attachForecasts always yields a well-formed ADR-0012
  // forecast, so this is unreachable there; as a standalone export it surfaces
  // the anomaly for attention (tier 2, "verify") rather than hiding it in tier 5.
  return 2;
}

// Within-tier key: soonest concrete deadline first. Reuses Gate 1's
// deadlineMs, which already returns null for an absent field, the literal
// "unknown", or a calendar-invalid date — exactly the "sorts last" set AC1
// requires, whether the field was authored-unknown or never authored at all.
function deadlinePhrase(deadlineAt, nowMs) {
  if (deadlineAt === null) return 'deadline unknown';
  if (!Number.isFinite(nowMs)) return 'deadline set';
  const days = Math.round((deadlineAt - nowMs) / DAY_MS);
  if (days > 0) return `deadline in ${days} day${days === 1 ? '' : 's'}`;
  if (days === 0) return 'deadline today';
  const overdue = Math.abs(days);
  return `deadline overdue by ${overdue} day${overdue === 1 ? '' : 's'}`;
}

// Short, explained reason: tier label + within-tier key (ADR-0013 / AC1).
// For tiers 1 and 5 the within-tier key IS deadline proximity, so it is
// spelled out in the reason. For tiers 2-4 (all `unknown`) the legible detail
// is the specific ADR-0012 trigger; deadline proximity still governs the
// sort position but is not repeated in the text for these tiers.
function tierReason(entry, tier, deadlineAt, nowMs) {
  const forecast = entry.forecast || {};
  switch (tier) {
    case 1:
      return `at risk · ${deadlinePhrase(deadlineAt, nowMs)}`;
    case 2:
      return narrativeBlockerPresent(entry) ? 'blocked — verify' : 'stale — verify';
    case 3:
      // `deadline-unknown` means no committed deadline (forecast Gate 1) — the
      // owner input needed is a DEADLINE, independent of whether a goal is set.
      // (Earlier copy said "needs a goal set", which mis-read for a project that
      // had authored a goal but no deadline — found running the real corpus.)
      // ADR-0018 tier 3: `advancing`/`stalled` are a dateless project's own
      // neutral motion read — informational, not a call to action like the
      // other tier-3 reasons, and never phrased as an alarm.
      if (forecast.state === 'advancing') return 'advancing — no deadline set';
      if (forecast.state === 'stalled') return 'stalled — no deadline set';
      return forecast.reason === 'deadline-unknown' ? 'needs a deadline set' : 'scope changed — needs review';
    case 4:
      return forecast.reason === 'insufficient-history' ? 'awaiting more history' : 'no delivery status yet';
    default:
      return `on track · ${deadlinePhrase(deadlineAt, nowMs)}`;
  }
}

function compareIds(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

// Total ordering (AC1/AC2): tier ascending, then deadline proximity
// (soonest first, absent/unknown last within its tier), then `project.id`
// as a stable tie-break. Returns a brand-new array of brand-new entries —
// `data` and everything under `data.projects` is read, never written to
// (AC3), and the project-id set is exactly whatever the caller's
// attachForecasts()-shaped `data` already carries (AC4: no registry/adapter
// reach from this module).
export function attentionQueue(data) {
  const projects = data?.projects || [];
  const nowMs = Date.parse(data?.generatedAt);
  const ranked = projects.map((entry) => {
    const tier = tierOf(entry);
    const deadlineValue = entry.project?.deadline?.value;
    const deadlineAt = deadlineMs(deadlineValue);
    return {
      id: entry.project?.id,
      label: entry.project?.label,
      tier,
      reason: tierReason(entry, tier, deadlineAt, nowMs),
      deadline: deadlineValue ?? null,
      // Shallow-copy the forecast so a consumer mutating a queue entry cannot
      // write back through a shared reference into the caller's source data
      // (forecast is a flat {state, reason}, so a spread fully isolates it).
      forecast: { ...entry.forecast },
      deadlineAt,
    };
  });
  ranked.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.deadlineAt === null && b.deadlineAt !== null) return 1;
    if (a.deadlineAt !== null && b.deadlineAt === null) return -1;
    if (a.deadlineAt !== null && b.deadlineAt !== null && a.deadlineAt !== b.deadlineAt) {
      return a.deadlineAt - b.deadlineAt;
    }
    return compareIds(a.id, b.id);
  });
  return ranked.map(({ deadlineAt, ...rest }) => rest);
}
