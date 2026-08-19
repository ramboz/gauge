import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spliceLiveObservation } from '../src/live-tail.mjs';
import { deriveForecast } from '../src/derive.mjs';

// --- spliceLiveObservation (pure) -----------------------------------------

function obs(collectedAt, { done, denom, freshness = { state: 'fresh' } } = {}) {
  return {
    collectedAt,
    collection: { status: 'ok' },
    signals: [{
      type: 'execution',
      status: 'supported',
      freshness,
      value: { progress: { done, denom, pct: denom ? Math.round((done / denom) * 100) : 0 } },
    }],
  };
}

test('spliceLiveObservation: appends the live observation as the tail', () => {
  const stored = [obs('2026-08-01T00:00:00Z', { done: 1, denom: 4 })];
  const live = obs('2026-08-30T00:00:00Z', { done: 1, denom: 4 });
  const out = spliceLiveObservation(stored, live);
  assert.equal(out.length, 2);
  assert.equal(out[out.length - 1], live); // live is the new latest
  assert.equal(out[0], stored[0]);
});

test('spliceLiveObservation: null live observation returns the stored series unchanged', () => {
  const stored = [obs('2026-08-01T00:00:00Z', { done: 1, denom: 4 })];
  assert.equal(spliceLiveObservation(stored, null), stored);
  assert.deepEqual(spliceLiveObservation(stored, undefined), stored);
});

test('spliceLiveObservation: empty/missing stored history still yields the live tail', () => {
  const live = obs('2026-08-30T00:00:00Z', { done: 1, denom: 4 });
  assert.deepEqual(spliceLiveObservation([], live), [live]);
  assert.deepEqual(spliceLiveObservation(undefined, live), [live]);
});

test('spliceLiveObservation: ALWAYS appends even when the live obs equals the newest stored (no skip-when-equal)', () => {
  // The equal-value tail is the desired timestamp advance, not a double-count.
  // A "skip when equal" would reintroduce the frozen-latest false on_track.
  const newest = obs('2026-08-02T00:00:00Z', { done: 3, denom: 4 });
  const stored = [obs('2026-08-01T00:00:00Z', { done: 1, denom: 4 }), newest];
  const live = obs('2026-08-30T00:00:00Z', { done: 3, denom: 4 }); // same {done,denom} as newest
  const out = spliceLiveObservation(stored, live);
  assert.equal(out.length, 3);
  assert.equal(out[out.length - 1].collectedAt, '2026-08-30T00:00:00Z'); // latest advanced to now
});

// --- AC4 bite tests: the splice flips a false on_track to the honest band ---
// Scenario: a project PROGRESSED (0.25 → 0.75) then went quiet. Its newest
// STORED record is frozen near the progress point, far from the deadline, so
// deriveForecast off the stored series alone reads a false on_track. Splicing
// the live `now` tail advances the latest timestamp toward the deadline.

const DEADLINE = '2026-09-01'; // deriveForecast's deadline is a YYYY-MM-DD calendar date
const STORED_PROGRESS_THEN_FLAT = [
  obs('2026-08-01T00:00:00Z', { done: 1, denom: 4 }),
  obs('2026-08-02T00:00:00Z', { done: 3, denom: 4 }), // progressed to 0.75, then no more
];

test('AC4 without the splice: a progressed-then-quiet project reads a FALSE on_track off the frozen latest', () => {
  const forecast = deriveForecast(STORED_PROGRESS_THEN_FLAT, DEADLINE);
  assert.equal(forecast.state, 'on_track'); // the bug the splice exists to kill
});

test('AC4 fresh-but-flat: splicing a FRESH now-tail flips the false on_track to at_risk', () => {
  const liveFresh = obs('2026-08-30T00:00:00Z', { done: 3, denom: 4, freshness: { state: 'fresh' } });
  const spliced = spliceLiveObservation(STORED_PROGRESS_THEN_FLAT, liveFresh);
  const forecast = deriveForecast(spliced, DEADLINE);
  assert.equal(forecast.state, 'at_risk'); // honest: flat progress, deadline near
  // (reason is pace-behind-required or no-forward-progress depending on the window;
  //  the load-bearing assertion is the on_track → at_risk flip.)
});

test('AC4 quiet: splicing a STALE now-tail short-circuits Gate 2 to unknown(stale-evidence), never coerced to at_risk or on_track', () => {
  const liveStale = obs('2026-08-30T00:00:00Z', { done: 3, denom: 4, freshness: { state: 'stale', reason: 'source-last-committed-20d-ago' } });
  const spliced = spliceLiveObservation(STORED_PROGRESS_THEN_FLAT, liveStale);
  const forecast = deriveForecast(spliced, DEADLINE);
  assert.equal(forecast.state, 'unknown');
  assert.equal(forecast.reason, 'stale-evidence'); // honest — never a fabricated fresh band
});

test('AC5 bar measured post-splice: 0 stored supported records + a single live tail stays insufficient-history', () => {
  // Only the live now-tail is supported → Gate 3 sees 1 supported observation → insufficient-history.
  const liveOnly = spliceLiveObservation([], obs('2026-08-30T00:00:00Z', { done: 1, denom: 4 }));
  const forecast = deriveForecast(liveOnly, DEADLINE);
  assert.equal(forecast.state, 'unknown');
  assert.equal(forecast.reason, 'insufficient-history');
});

test('AC5 bar measured post-splice: 1 stored supported (≥1 day old) + the live tail can clear the gate into a real band', () => {
  const stored = [obs('2026-08-01T00:00:00Z', { done: 1, denom: 4 })]; // one real, time-separated reading
  const spliced = spliceLiveObservation(stored, obs('2026-08-30T00:00:00Z', { done: 2, denom: 4 }));
  const forecast = deriveForecast(spliced, DEADLINE);
  assert.notEqual(forecast.reason, 'insufficient-history'); // two time-separated readings clear the bar
  assert.ok(['on_track', 'at_risk'].includes(forecast.state));
});
