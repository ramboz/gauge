import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveForecast, attachForecasts } from '../src/derive.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'src', 'derive.mjs');

const ADR0012_REASONS = new Set([
  'deadline-unknown', 'execution-unknown', 'stale-evidence', 'insufficient-history',
  'scope-changed', 'pace-behind-required', 'pace-meets-required', 'deadline-passed',
  'no-forward-progress', 'already-complete',
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
  assert.notEqual(withDeadline.state, 'unknown');
  assert.equal(withoutDeadline.state, 'unknown');
  assert.equal(withoutDeadline.reason, 'deadline-unknown');
});

// --- AC2/AC2a: evidence-gated three-state output, every unknown trigger ---

test('unknown deadline-unknown: deadline absent (AC2)', () => {
  assert.deepEqual(deriveForecast(steadyHistory(), undefined), { state: 'unknown', reason: 'deadline-unknown' });
});

test('unknown deadline-unknown: deadline literal "unknown" (AC2)', () => {
  assert.deepEqual(deriveForecast(steadyHistory(), 'unknown'), { state: 'unknown', reason: 'deadline-unknown' });
});

test('unknown deadline-unknown: calendar-invalid deadline is rejected by real date arithmetic, not regex alone (AC2, DoR)', () => {
  // Syntactically matches YYYY-MM-DD but month 13 / day 40 do not exist.
  assert.deepEqual(deriveForecast(steadyHistory(), '2026-13-40'), { state: 'unknown', reason: 'deadline-unknown' });
  // February 30th does not exist either (naive Date arithmetic rolls it to March 2nd).
  assert.deepEqual(deriveForecast(steadyHistory(), '2026-02-30'), { state: 'unknown', reason: 'deadline-unknown' });
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
    assert.ok(['on_track', 'at_risk', 'unknown'].includes(result.state));
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
  assert.deepEqual(attached.projects[1].forecast, { state: 'unknown', reason: 'deadline-unknown' });
  // Untouched fields survive the attach.
  assert.equal(attached.projects[0].project.label, 'Alpha');
  assert.equal(attached.generatedAt, data.generatedAt);
});

test('attachForecasts derives from an empty history when a project id has no entry — honest unknown, not a throw (AC5)', () => {
  const data = { projects: [{ project: { id: 'gamma', deadline: { value: '2026-09-14', provenance: 'user' } }, collection: { status: 'ok' } }] };
  assert.doesNotThrow(() => attachForecasts(data, {}));
  assert.deepEqual(attachForecasts(data, {}).projects[0].forecast, { state: 'unknown', reason: 'execution-unknown' });
});
