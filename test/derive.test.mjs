import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveForecast, attachForecasts, attentionQueue } from '../src/derive.mjs';
import { normalizeConfig } from '../src/config.mjs';
import { joinProjectProfileFields } from '../src/observation.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'src', 'derive.mjs');

const ADR0012_REASONS = new Set([
  'deadline-unknown', 'execution-unknown', 'stale-evidence', 'insufficient-history',
  'scope-changed', 'pace-behind-required', 'pace-meets-required', 'deadline-passed',
  'no-forward-progress', 'already-complete',
  // ADR-0018 tier 3 (013-02): the neutral date-free pace reasons.
  'progressing-no-deadline', 'stalled-no-deadline',
]);

// --- fixture builders --------------------------------------------------

function progress(done, denom, extra = {}) {
  return {
    done, total: denom, abandoned: 0, deferred: 0, denom,
    pct: denom > 0 ? Math.round((done / denom) * 100) : null,
    ...extra,
  };
}

function obsUnsupported(collectedAt, status = 'unknown', freshness = { state: 'unknown', reason: 'no-data' }) {
  return { collectedAt, collection: { status: 'ok' }, signals: [{ type: 'execution', status, freshness }] };
}

function obsSupported(collectedAt, { done, denom, freshness = { state: 'fresh' }, collectionStatus = 'ok' } = {}) {
  return {
    collectedAt,
    collection: { status: collectionStatus },
    signals: [{
      type: 'execution', status: 'supported', freshness,
      value: { progress: progress(done, denom) },
    }],
  };
}

// A steady, evidence-sufficient two-point series: day 0 at 20% of 10, day 4
// at 60% of 10 (stable denom) — pace = 0.4/4 = 0.1/day.
function steadyHistory() {
  return [
    obsSupported('2026-08-01T00:00:00Z', { done: 2, denom: 10 }),
    obsSupported('2026-08-05T00:00:00Z', { done: 6, denom: 10 }),
  ];
}

// --- AC1: dedicated module, closed import set, deadline as a parameter ---

test('derive.mjs is a zero-import pure fold — no adapter/scan/config/profile, no fs (AC1)', () => {
  const src = fs.readFileSync(SRC, 'utf8');
  const specifiers = [...src.matchAll(/^import\s+.*?from\s+['"]([^'"]+)['"];?\s*$/gm)].map((m) => m[1]);
  assert.deepEqual(specifiers, [], 'derive.mjs must import nothing — a pure fold over caller-supplied inputs');
  assert.doesNotMatch(src, /writeFileSync|fs\.write|readdirSync/, 'derive.mjs must write nothing and perform no I/O');
});

test('deriveForecast takes the deadline as an explicit parameter, not a hidden config read (AC1)', () => {
  const history = steadyHistory();
  const withDeadline = deriveForecast(history, '2026-09-01');
  const withoutDeadline = deriveForecast(history, undefined);
  // 013-02 (ADR-0018 tier 3): a project WITH evidence-sufficient history but
  // no deadline no longer collapses to `unknown` — it gets a neutral motion
  // read instead. The two calls must still visibly diverge (the deadline
  // parameter is not ignored): one hits ADR-0012's hard-colour tier 1, the
  // other ADR-0018's tier-3 neutral read.
  assert.equal(withDeadline.state, 'on_track');
  assert.equal(withoutDeadline.state, 'advancing');
  assert.notEqual(withDeadline.state, withoutDeadline.state);
});

// --- AC2/AC2a: evidence-gated three-state output, every unknown trigger ---

// 013-02 (ADR-0018 tier 3): a dateless project with evidence clearing every
// gate no longer reads `unknown('deadline-unknown')` — that reason is
// retired for deriveForecast's own output (it survives only as a hand-built
// attention-queue fixture — see attention-queue.test.mjs). A literal
// "unknown" deadline and a calendar-invalid one are still treated exactly
// like an absent deadline for gating purposes, so all three now converge on
// the SAME tier-3 `advancing` read (steadyHistory's pace is positive).
test('advancing (ADR-0018 tier 3): deadline absent, with evidence-sufficient history (013-02 AC1)', () => {
  assert.deepEqual(deriveForecast(steadyHistory(), undefined), { state: 'advancing', reason: 'progressing-no-deadline' });
});

test('advancing (ADR-0018 tier 3): deadline literal "unknown" is treated identically to absent (013-02 AC1)', () => {
  assert.deepEqual(deriveForecast(steadyHistory(), 'unknown'), { state: 'advancing', reason: 'progressing-no-deadline' });
});

test('advancing (ADR-0018 tier 3): a calendar-invalid deadline is rejected by real date arithmetic and treated as absent, not regex alone (013-02 AC1, DoR)', () => {
  // Syntactically matches YYYY-MM-DD but month 13 / day 40 do not exist.
  assert.deepEqual(deriveForecast(steadyHistory(), '2026-13-40'), { state: 'advancing', reason: 'progressing-no-deadline' });
  // February 30th does not exist either (naive Date arithmetic rolls it to March 2nd).
  assert.deepEqual(deriveForecast(steadyHistory(), '2026-02-30'), { state: 'advancing', reason: 'progressing-no-deadline' });
});

test('unknown execution-unknown: latest execution signal is not supported (AC2)', () => {
  const history = [
    obsSupported('2026-08-01T00:00:00Z', { done: 2, denom: 10 }),
    obsUnsupported('2026-08-05T00:00:00Z'),
  ];
  assert.deepEqual(deriveForecast(history, '2026-09-01'), { state: 'unknown', reason: 'execution-unknown' });
});

test('unknown execution-unknown: empty history (AC2)', () => {
  assert.deepEqual(deriveForecast([], '2026-09-01'), { state: 'unknown', reason: 'execution-unknown' });
});

test('unknown stale-evidence: latest execution supported but freshness is not fresh (AC2)', () => {
  const history = [
    obsSupported('2026-08-01T00:00:00Z', { done: 2, denom: 10 }),
    obsSupported('2026-08-05T00:00:00Z', { done: 6, denom: 10, freshness: { state: 'stale', reason: 'source-last-committed-30d-ago' } }),
  ];
  assert.deepEqual(deriveForecast(history, '2026-09-01'), { state: 'unknown', reason: 'stale-evidence' });
});

test('unknown insufficient-history: fewer than 2 supported observations (AC2)', () => {
  const history = [obsSupported('2026-08-05T00:00:00Z', { done: 6, denom: 10 })];
  assert.deepEqual(deriveForecast(history, '2026-09-01'), { state: 'unknown', reason: 'insufficient-history' });
});

test('unknown insufficient-history: 2 supported observations spanning less than a day (AC2)', () => {
  const history = [
    obsSupported('2026-08-05T00:00:00Z', { done: 2, denom: 10 }),
    obsSupported('2026-08-05T06:00:00Z', { done: 3, denom: 10 }),
  ];
  assert.deepEqual(deriveForecast(history, '2026-09-01'), { state: 'unknown', reason: 'insufficient-history' });
});

test('unknown scope-changed: denom moved at the latest step, trailing run collapses to one point (AC2, DoR edge precedence)', () => {
  const history = [
    obsSupported('2026-08-01T00:00:00Z', { done: 2, denom: 10 }),
    obsSupported('2026-08-05T00:00:00Z', { done: 3, denom: 10 }),
    // A spec was shaped/deferred at the latest step: denom moved 10 → 12.
    obsSupported('2026-08-06T00:00:00Z', { done: 3, denom: 12 }),
  ];
  assert.deepEqual(deriveForecast(history, '2026-09-01'), { state: 'unknown', reason: 'scope-changed' });
});

test('a ±1 denom drift within the trailing window is tolerated and reaches a colour (DENOM_TOLERANCE re-tune, dogfood corpus)', () => {
  // Real Gauge dogfood finding: an actively-authored project's denom creeps
  // by one nearly every observation as specs land (…11 → 12 → 13…), so under
  // exact-equality scope stability the trailing window never spans ≥1 day and
  // the card is pinned at unknown forever. ADR-0012 always allowed a "small
  // tolerance"; the re-tune to ±1 absorbs single-spec drift so slow steady
  // growth reaches a colour instead of reading unknown.
  const history = [
    obsSupported('2026-08-01T00:00:00Z', { done: 8, denom: 12 }),
    obsSupported('2026-08-04T00:00:00Z', { done: 9, denom: 12 }),
    // One spec shaped at the latest step: denom drifts 12 → 13 (a ±1 step).
    obsSupported('2026-08-06T00:00:00Z', { done: 10, denom: 13 }),
  ];
  const result = deriveForecast(history, '2026-09-01');
  assert.notEqual(result.state, 'unknown', `expected a colour, got unknown/${result.reason}`);
});

test('trailing stable-scope window reaches a colour despite earlier scope churn (DoR pace-window resolution)', () => {
  const history = [
    // Earlier scope churn (denom 8 → 10) should not poison a colour once the
    // *recent* run (the last three points, all denom 10) is stable and spans
    // ≥1 day — this is what makes the window "trailing", not full-series.
    obsSupported('2026-07-20T00:00:00Z', { done: 1, denom: 8 }),
    obsSupported('2026-07-25T00:00:00Z', { done: 2, denom: 10 }),
    obsSupported('2026-08-01T00:00:00Z', { done: 2, denom: 10 }),
    obsSupported('2026-08-05T00:00:00Z', { done: 6, denom: 10 }),
  ];
  const result = deriveForecast(history, '2026-09-01');
  assert.notEqual(result.state, 'unknown', `expected a colour, got unknown/${result.reason}`);
});

// --- AC2a: deterministic colour computation branches --------------------

test('unknown execution-unknown: all-abandoned scope (denom 0) is not a coerced on_track (BLOCKER fix)', () => {
  // total=N, abandoned=N → denom = total - abandoned = 0, done=0, pct=null.
  // Execution status is still 'supported' because ABANDONED is a recognized
  // delivery status (progressOf/hasDeliveryStatus) — but there is no
  // measurable deliverable scope left to derive a fraction from. This must
  // read unknown, never a coerced already-complete/on_track (product-vision:
  // unknown, not zero/healthy).
  const history = [
    obsSupported('2026-08-01T00:00:00Z', { done: 0, denom: 0 }),
    obsSupported('2026-08-05T00:00:00Z', { done: 0, denom: 0 }),
  ];
  const result = deriveForecast(history, '2026-09-01');
  assert.deepEqual(result, { state: 'unknown', reason: 'execution-unknown' });
  assert.notEqual(result.state, 'on_track');
});

test('on_track already-complete: remaining <= 0 (AC2a)', () => {
  const history = [
    obsSupported('2026-08-01T00:00:00Z', { done: 8, denom: 10 }),
    obsSupported('2026-08-05T00:00:00Z', { done: 10, denom: 10 }),
  ];
  assert.deepEqual(deriveForecast(history, '2026-09-01'), { state: 'on_track', reason: 'already-complete' });
});

test('at_risk deadline-passed: deadline at/before the latest observation with work remaining (AC2a)', () => {
  const history = steadyHistory(); // latest is 2026-08-05, 60% done
  assert.deepEqual(deriveForecast(history, '2026-08-05'), { state: 'at_risk', reason: 'deadline-passed' });
  assert.deepEqual(deriveForecast(history, '2026-08-01'), { state: 'at_risk', reason: 'deadline-passed' });
});

test('at_risk no-forward-progress: observed pace is exactly zero with work remaining (AC2a)', () => {
  const history = [
    obsSupported('2026-08-01T00:00:00Z', { done: 6, denom: 10 }),
    obsSupported('2026-08-05T00:00:00Z', { done: 6, denom: 10 }),
  ];
  assert.deepEqual(deriveForecast(history, '2026-09-01'), { state: 'at_risk', reason: 'no-forward-progress' });
});

test('at_risk no-forward-progress: strictly negative observed pace (a regression, not just flat) (AC2a, nit fix)', () => {
  const history = [
    obsSupported('2026-08-01T00:00:00Z', { done: 6, denom: 10 }),
    obsSupported('2026-08-05T00:00:00Z', { done: 5, denom: 10 }),
  ];
  assert.deepEqual(deriveForecast(history, '2026-09-01'), { state: 'at_risk', reason: 'no-forward-progress' });
});

test('pace uses exact done/denom, not the rounded integer pct, so quantization cannot flip the colour near the boundary (nit fix)', () => {
  // done 0→5 of denom 8: exact fractions are 0/8=0 and 5/8=0.625, but
  // progressOf's rounded pct is 0 and 63 (62.5% rounds up). If the fold
  // preferred pct/100 the pace/remaining would be quantized (0.63 vs the
  // true 0.625), which — at these specific timestamps — flips the read from
  // at_risk (the correct, exact answer) to a falsely-comfortable on_track.
  const history = [
    obsSupported('2026-08-04T09:50:24.000Z', { done: 0, denom: 8 }),
    obsSupported('2026-08-05T09:50:24.000Z', { done: 5, denom: 8 }),
  ];
  assert.deepEqual(deriveForecast(history, '2026-08-06'), { state: 'at_risk', reason: 'pace-behind-required' });
});

test('on_track pace-meets-required at the exact boundary: observedPace === requiredPace resolves on_track, not at_risk (AC2a)', () => {
  // 25% → 75% over 4 days (both exact binary fractions, so the equality
  // below is bit-exact, not a floating-point coincidence): observedPace =
  // 0.5/4 = 0.125/day. A deadline 2 days after the latest observation
  // requires remaining(0.25)/2 = 0.125/day — the same value. The ADR's rule
  // is observedPace >= requiredPace, so an exact match must read on_track.
  const history = [
    obsSupported('2026-08-01T00:00:00Z', { done: 1, denom: 4 }),
    obsSupported('2026-08-05T00:00:00Z', { done: 3, denom: 4 }),
  ];
  assert.deepEqual(deriveForecast(history, '2026-08-07'), { state: 'on_track', reason: 'pace-meets-required' });
});

test('at_risk pace-behind-required: observed pace below what the deadline requires (AC2a)', () => {
  // steadyHistory: pace 0.1/day, remaining 0.4 at latest (2026-08-05).
  // A deadline just 2 days out requires 0.2/day — faster than observed.
  assert.deepEqual(deriveForecast(steadyHistory(), '2026-08-07'), { state: 'at_risk', reason: 'pace-behind-required' });
});

test('on_track pace-meets-required: observed pace meets or exceeds what the deadline requires (AC2a)', () => {
  // steadyHistory: pace 0.1/day, remaining 0.4 at latest. A deadline far
  // enough out (40 days) requires only 0.01/day — comfortably met.
  assert.deepEqual(deriveForecast(steadyHistory(), '2026-09-14'), { state: 'on_track', reason: 'pace-meets-required' });
});

// --- 013-02 (ADR-0018 tier 3): neutral date-free pace ----------------------
// deriveForecast(observations, deadline) with `deadline` absent/invalid: the
// SAME Gates 2/3/4/4.5 as the deadline path run first; only once every gate
// passes does the dateless branch resolve to a neutral motion read instead
// of ADR-0012's hard colour. Below any gate, the result is unchanged
// `unknown` with that gate's own reason — never `deadline-unknown`, and
// never a motion state coerced without a real within-window pace (AC5).

test('stalled (013-02 AC1): deadline absent, evidence-sufficient history with exactly zero pace', () => {
  const history = [
    obsSupported('2026-08-01T00:00:00Z', { done: 6, denom: 10 }),
    obsSupported('2026-08-05T00:00:00Z', { done: 6, denom: 10 }),
  ];
  assert.deepEqual(deriveForecast(history, undefined), { state: 'stalled', reason: 'stalled-no-deadline' });
});

test('stalled (013-02 AC1): a real regression (negative pace), not just flat, without a deadline', () => {
  const history = [
    obsSupported('2026-08-01T00:00:00Z', { done: 6, denom: 10 }),
    obsSupported('2026-08-05T00:00:00Z', { done: 5, denom: 10 }),
  ];
  assert.deepEqual(deriveForecast(history, undefined), { state: 'stalled', reason: 'stalled-no-deadline' });
});

test('already-complete (013-02 AC1): remaining <= 0 stays on_track/already-complete even with no deadline — never a motion state', () => {
  const history = [
    obsSupported('2026-08-01T00:00:00Z', { done: 8, denom: 10 }),
    obsSupported('2026-08-05T00:00:00Z', { done: 10, denom: 10 }),
  ];
  assert.deepEqual(deriveForecast(history, undefined), { state: 'on_track', reason: 'already-complete' });
});

test('gated to unknown (013-02 AC5): a dateless project below the execution/history/staleness gates keeps that gate\'s own reason, never deadline-unknown', () => {
  assert.deepEqual(deriveForecast([], undefined), { state: 'unknown', reason: 'execution-unknown' });
  assert.deepEqual(
    deriveForecast([obsSupported('2026-08-05T00:00:00Z', { done: 6, denom: 10 })], undefined),
    { state: 'unknown', reason: 'insufficient-history' },
  );
  const staleHistory = [
    obsSupported('2026-08-01T00:00:00Z', { done: 2, denom: 10 }),
    obsSupported('2026-08-05T00:00:00Z', {
      done: 6, denom: 10, freshness: { state: 'stale', reason: 'source-last-committed-30d-ago' },
    }),
  ];
  assert.deepEqual(deriveForecast(staleHistory, undefined), { state: 'unknown', reason: 'stale-evidence' });
});

test('gated to unknown scope-changed (013-02 AC5): denom moved at the latest step for a dateless project — Gate 4 is not relaxed, no coerced motion state', () => {
  const history = [
    obsSupported('2026-08-01T00:00:00Z', { done: 2, denom: 10 }),
    obsSupported('2026-08-05T00:00:00Z', { done: 3, denom: 10 }),
    // A spec was shaped/deferred at the latest step: denom moved 10 → 12.
    obsSupported('2026-08-06T00:00:00Z', { done: 3, denom: 12 }),
  ];
  assert.deepEqual(deriveForecast(history, undefined), { state: 'unknown', reason: 'scope-changed' });
});

// --- 013-03 (ADR-0018 tier 2): curated soft appetite-window ----------------
// deriveForecast(observations, deadline, appetiteWindow): with NO hard
// deadline and a committed appetiteWindow, the SAME evidence gates/pace
// machinery runs against the authored appetite date, but the reasons are the
// two soft ones the slice names — `within-appetite` (on pace, green) and
// `over-appetite` (behind or window passed, amber — never red).

test('on_track within-appetite: pace meets what the appetite window requires, no hard deadline set (AC3)', () => {
  // steadyHistory: pace 0.1/day, remaining 0.4 at latest (2026-08-05). An
  // appetite window far enough out (2026-09-14, 40 days) requires only
  // 0.01/day — comfortably met.
  const result = deriveForecast(steadyHistory(), undefined, '2026-09-14');
  assert.deepEqual(result, { state: 'on_track', reason: 'within-appetite' });
});

test('at_risk over-appetite: observed pace behind what the appetite window requires — amber, not red (AC3/AC4)', () => {
  // steadyHistory: pace 0.1/day, remaining 0.4 at latest. An appetite window
  // just 2 days out requires 0.2/day — faster than observed.
  const result = deriveForecast(steadyHistory(), undefined, '2026-08-07');
  assert.deepEqual(result, { state: 'at_risk', reason: 'over-appetite' });
});

test('at_risk over-appetite: the appetite window has already passed with work remaining — still amber, never the hard deadline-passed reason (AC3/AC4)', () => {
  const result = deriveForecast(steadyHistory(), undefined, '2026-08-05');
  assert.deepEqual(result, { state: 'at_risk', reason: 'over-appetite' });
  assert.notEqual(result.reason, 'deadline-passed');
});

test('at_risk over-appetite: zero/negative observed pace against a committed appetite window — still amber, never the hard no-forward-progress reason (AC3/AC4)', () => {
  const history = [
    obsSupported('2026-08-01T00:00:00Z', { done: 6, denom: 10 }),
    obsSupported('2026-08-05T00:00:00Z', { done: 6, denom: 10 }),
  ];
  const result = deriveForecast(history, undefined, '2026-09-01');
  assert.deepEqual(result, { state: 'at_risk', reason: 'over-appetite' });
  assert.notEqual(result.reason, 'no-forward-progress');
});

test('appetiteWindow "unknown" or absent behaves exactly like an absent deadline — falls through to tier 3 neutral (AC1)', () => {
  assert.deepEqual(deriveForecast(steadyHistory(), undefined, undefined), { state: 'advancing', reason: 'progressing-no-deadline' });
  assert.deepEqual(deriveForecast(steadyHistory(), undefined, 'unknown'), { state: 'advancing', reason: 'progressing-no-deadline' });
  assert.deepEqual(deriveForecast(steadyHistory(), undefined, '2026-13-40'), { state: 'advancing', reason: 'progressing-no-deadline' });
});

test('already-complete stays on_track/already-complete with a committed appetite window and no remaining work — never within-appetite (AC3)', () => {
  const history = [
    obsSupported('2026-08-01T00:00:00Z', { done: 8, denom: 10 }),
    obsSupported('2026-08-05T00:00:00Z', { done: 10, denom: 10 }),
  ];
  assert.deepEqual(deriveForecast(history, undefined, '2026-09-01'), { state: 'on_track', reason: 'already-complete' });
});

test('a committed appetite window below any evidence gate keeps that gate\'s own reason, never a soft colour (AC3, gates-first)', () => {
  assert.deepEqual(deriveForecast([], undefined, '2026-09-01'), { state: 'unknown', reason: 'execution-unknown' });
  assert.deepEqual(
    deriveForecast([obsSupported('2026-08-05T00:00:00Z', { done: 6, denom: 10 })], undefined, '2026-09-01'),
    { state: 'unknown', reason: 'insufficient-history' },
  );
});

// --- AC5: precedence — hard deadline > soft appetite-window > neutral ------

test('precedence: a committed hard deadline still wins over a committed appetite window — hard on_track/at_risk unchanged (AC5)', () => {
  // The deadline (2026-08-07) requires 0.2/day — faster than the observed
  // 0.1/day pace, so the hard tier reads at_risk/pace-behind-required, even
  // though a generous appetite window (2026-09-14) is ALSO committed and
  // would, on its own, read on_track/within-appetite.
  const result = deriveForecast(steadyHistory(), '2026-08-07', '2026-09-14');
  assert.deepEqual(result, { state: 'at_risk', reason: 'pace-behind-required' });
  assert.notEqual(result.reason, 'within-appetite');
  assert.notEqual(result.reason, 'over-appetite');
});

test('precedence: a committed hard deadline that is itself on pace wins over a tight appetite window that would otherwise read over-appetite (AC5)', () => {
  // Deadline 2026-09-14 (40 days out) is comfortably met by the observed
  // pace; the appetite window 2026-08-07 (tight, would read over-appetite on
  // its own) must have zero effect once a hard deadline is present.
  const result = deriveForecast(steadyHistory(), '2026-09-14', '2026-08-07');
  assert.deepEqual(result, { state: 'on_track', reason: 'pace-meets-required' });
});

test('precedence: neither deadline nor appetite window committed falls to tier-3 neutral (013-02, unchanged) (AC5)', () => {
  assert.deepEqual(deriveForecast(steadyHistory(), undefined, undefined), { state: 'advancing', reason: 'progressing-no-deadline' });
});

// --- AC6: no runtime prose parse guard --------------------------------------
// deriveForecast/attachForecasts take the appetite-window value as an
// explicit parameter, exactly like deadline (AC1's existing test above) —
// never a hidden read of docs/releases/*.md or any other source prose. The
// zero-import assertion at the top of this file already makes that
// structurally impossible (derive.mjs cannot open any file); this test adds
// a behavioural check over the real read/join layers: a project with a REAL,
// human-legible appetite hint sitting in its docs/releases/*.md on disk
// still reads tier-3 neutral (never a soft colour) until the owner commits
// `profile.appetiteWindow` — proving nothing downstream inferred a value
// from that file.
test('no committed appetiteWindow field means no soft colour, even when a real appetite-shaped release doc sits on disk (AC6 guard)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-appetite-guard-'));
  try {
    fs.mkdirSync(path.join(dir, 'docs', 'releases'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'docs', 'releases', 'plan.md'),
      '# Plan\n\nAppetite: two weeks, fixed effort. Target: ship by end of month.\n',
    );
    const config = normalizeConfig({
      version: 1,
      projects: [{ id: 'alpha', path: dir, adapters: [] }], // no profile.appetiteWindow committed
    }, path.join(dir, 'gauge.config.json'));
    const data = { generatedAt: '2026-08-05T00:00:00Z', projects: [{ project: { id: 'alpha', label: 'Alpha' }, collection: { status: 'ok' } }] };
    const joined = joinProjectProfileFields(data, config);
    assert.equal(joined.projects[0].project.appetiteWindow, undefined, 'no appetiteWindow value must be joined from the uncommitted profile');
    const withForecasts = attachForecasts(joined, { alpha: steadyHistory() });
    assert.deepEqual(withForecasts.projects[0].forecast, { state: 'advancing', reason: 'progressing-no-deadline' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- AC3: explained, deterministic read ----------------------------------

test('every result — colour or unknown — carries a reason from the ADR-0012 set (AC3)', () => {
  const cases = [
    deriveForecast(steadyHistory(), undefined),
    deriveForecast(steadyHistory(), 'unknown'),
    deriveForecast(steadyHistory(), '2026-13-40'),
    deriveForecast([], '2026-09-01'),
    deriveForecast(steadyHistory(), '2026-09-14'),
    deriveForecast(steadyHistory(), '2026-08-07'),
    deriveForecast(steadyHistory(), '2026-08-01'),
  ];
  for (const result of cases) {
    assert.ok(ADR0012_REASONS.has(result.reason), `unexpected reason: ${result.reason}`);
    // 013-02: the dateless cases above now resolve to ADR-0018's tier-3
    // `advancing` state instead of `unknown` — still a well-formed,
    // explained state, just not one of the original three.
    assert.ok(['on_track', 'at_risk', 'unknown', 'advancing', 'stalled'].includes(result.state));
  }
});

test('deriveForecast is deterministic — identical inputs yield an identical result (AC3)', () => {
  const history = steadyHistory();
  const first = deriveForecast(history, '2026-09-14');
  const second = deriveForecast(JSON.parse(JSON.stringify(history)), '2026-09-14');
  assert.deepEqual(first, second);
});

// --- AC4: envelope status is not evidence --------------------------------

test('collection.status never influences the forecast/risk result (AC4)', () => {
  const ok = steadyHistory();
  const partial = ok.map((observation) => ({ ...observation, collection: { status: 'partial' } }));
  const error = ok.map((observation) => ({ ...observation, collection: { status: 'error' } }));
  const deadline = '2026-09-14';
  assert.deepEqual(deriveForecast(ok, deadline), deriveForecast(partial, deadline));
  assert.deepEqual(deriveForecast(ok, deadline), deriveForecast(error, deadline));
});

// --- AC5: read-layer composition -----------------------------------------

test('attachForecasts attaches {state, reason} per project from its own history and joined deadline (AC5)', () => {
  const data = {
    generatedAt: '2026-08-05T00:00:00Z',
    projects: [
      { project: { id: 'alpha', label: 'Alpha', deadline: { value: '2026-09-14', provenance: 'user' } }, collection: { status: 'ok' } },
      { project: { id: 'beta', label: 'Beta' }, collection: { status: 'ok' } },
    ],
  };
  const historiesByProjectId = { alpha: steadyHistory() };
  const attached = attachForecasts(data, historiesByProjectId);
  assert.deepEqual(attached.projects[0].forecast, { state: 'on_track', reason: 'pace-meets-required' });
  // Beta has no history entry at all (empty history), so Gate 2 (fresh
  // supported latest execution) fails BEFORE the deadline is ever consulted
  // — 013-02 (ADR-0018): the evidence gates run unconditionally, so an
  // evidence-gate failure reads as that gate's own reason, never a
  // `deadline-unknown` placeholder, even for a dateless project.
  assert.deepEqual(attached.projects[1].forecast, { state: 'unknown', reason: 'execution-unknown' });
  // Untouched fields survive the attach.
  assert.equal(attached.projects[0].project.label, 'Alpha');
  assert.equal(attached.generatedAt, data.generatedAt);
});

test('attachForecasts derives from an empty history when a project id has no entry — honest unknown, not a throw (AC5)', () => {
  const data = { projects: [{ project: { id: 'gamma', deadline: { value: '2026-09-14', provenance: 'user' } }, collection: { status: 'ok' } }] };
  assert.doesNotThrow(() => attachForecasts(data, {}));
  assert.deepEqual(attachForecasts(data, {}).projects[0].forecast, { state: 'unknown', reason: 'execution-unknown' });
});

test('attachForecasts joins a project\'s appetiteWindow (no deadline) into a soft forecast (013-03 AC3/AC5)', () => {
  const data = {
    generatedAt: '2026-08-05T00:00:00Z',
    projects: [
      { project: { id: 'alpha', label: 'Alpha', appetiteWindow: { value: '2026-09-14', provenance: 'user' } }, collection: { status: 'ok' } },
    ],
  };
  const attached = attachForecasts(data, { alpha: steadyHistory() });
  assert.deepEqual(attached.projects[0].forecast, { state: 'on_track', reason: 'within-appetite' });
});

// --- 010-01 AC4: entry-declared goal/deadline reaches the read layer and
// drives derivation — through the real join → forecast → attention chain,
// with no read/derive-layer change. Uses a fixed far-future deadline
// (2099-12-31) so the test is not time-fragile. ---

test('a multi-entry project\'s entry-level deadline reaches joinProjectProfileFields → attachForecasts → attentionQueue and lifts it off tier 3, while an undated sibling with the same evidence stays tier 3 as a neutral motion read (AC4; updated 013-02 for ADR-0018 tier 3)', () => {
  const config = normalizeConfig({
    version: 1,
    projects: [{
      id: 'umbrella', path: '/tmp/umbrella', adapters: ['jig'],
      profile: {
        entries: [
          {
            id: 'dated', label: 'Dated track', artifactRoot: 'tracks/dated',
            goal: { value: 'Ship the dated track', provenance: 'product-vision' },
            deadline: { value: '2099-12-31', provenance: 'release' },
          },
          { id: 'sibling', label: 'Sibling track', artifactRoot: 'tracks/sibling' },
        ],
      },
    }],
  }, '/tmp/gauge.config.json');
  const [dated, sibling] = config.projects;
  assert.equal(dated.id, 'umbrella-dated');
  assert.equal(sibling.id, 'umbrella-sibling');

  // A stand-in for observeAll()'s output shape (test/observation.test.mjs
  // exercises the real adapter path; here the read/join/derive composition
  // itself is under test, so the observation record is a minimal fixture).
  const data = {
    generatedAt: '2026-08-05T00:00:00Z',
    projects: [
      { project: { id: dated.id, label: dated.label }, collection: { status: 'ok' } },
      { project: { id: sibling.id, label: sibling.label }, collection: { status: 'ok' } },
    ],
  };
  const joined = joinProjectProfileFields(data, config);
  // The join attaches the entry's own deadline (not the parent's — there is
  // none here) onto the matching normalized project.
  assert.deepEqual(joined.projects[0].project.deadline, { value: '2099-12-31', provenance: 'release' });
  assert.equal(joined.projects[1].project.deadline, undefined);

  // 013-02: both siblings get the SAME evidence-sufficient history, so the
  // undated sibling clears every ADR-0012 evidence gate and reaches
  // ADR-0018's tier-3 neutral read (`advancing`), not a bare
  // `deadline-unknown` (that reason is retired for deriveForecast's own
  // output once evidence is sufficient — see derive.test.mjs's dedicated
  // 013-02 tests above).
  const historiesByProjectId = { [dated.id]: steadyHistory(), [sibling.id]: steadyHistory() };
  const withForecasts = attachForecasts(joined, historiesByProjectId);
  assert.notEqual(withForecasts.projects[0].forecast.reason, 'deadline-unknown');
  assert.deepEqual(withForecasts.projects[1].forecast, { state: 'advancing', reason: 'progressing-no-deadline' });

  const attention = attentionQueue(withForecasts);
  const datedEntry = attention.find((entry) => entry.id === dated.id);
  const siblingEntry = attention.find((entry) => entry.id === sibling.id);
  assert.notEqual(datedEntry.tier, 3);
  // The dateless sibling's neutral `advancing` read sits in the SAME tier a
  // `deadline-unknown` project would have (AC3) — no re-tiering.
  assert.equal(siblingEntry.tier, 3);
  assert.equal(siblingEntry.forecast.reason, 'progressing-no-deadline');
});
