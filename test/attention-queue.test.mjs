import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attentionQueue } from '../src/derive.mjs';

// --- fixture builders --------------------------------------------------

function entry(id, forecast, { deadline, blockers, label } = {}) {
  const project = { id, label: label || id };
  if (deadline !== undefined) project.deadline = { value: deadline, provenance: 'user' };
  const signals = blockers ? [{ type: 'narrative', status: 'supported', value: { headline: 'x', blockers } }] : [];
  return { project, collection: { status: 'ok' }, signals, forecast };
}

const GENERATED_AT = '2026-08-05T00:00:00Z';

function queueOf(entries) {
  return attentionQueue({ generatedAt: GENERATED_AT, projects: entries });
}

// --- AC2: five tiers, verbatim ADR-0012 reason mapping -------------------

test('tier 1: at_risk forecast (any reason) (AC2)', () => {
  const [ranked] = queueOf([entry('alpha', { state: 'at_risk', reason: 'pace-behind-required' }, { deadline: '2026-09-01' })]);
  assert.equal(ranked.tier, 1);
});

test('tier 2: unknown/stale-evidence maps to tier 2 (AC2)', () => {
  const [ranked] = queueOf([entry('alpha', { state: 'unknown', reason: 'stale-evidence' }, { deadline: '2026-09-01' })]);
  assert.equal(ranked.tier, 2);
});

test('tier 3: unknown/deadline-unknown maps to tier 3 (AC2)', () => {
  const [ranked] = queueOf([entry('alpha', { state: 'unknown', reason: 'deadline-unknown' })]);
  assert.equal(ranked.tier, 3);
});

test('tier 3: unknown/scope-changed maps to tier 3 (AC2)', () => {
  const [ranked] = queueOf([entry('alpha', { state: 'unknown', reason: 'scope-changed' }, { deadline: '2026-09-01' })]);
  assert.equal(ranked.tier, 3);
});

test('tier 4: unknown/insufficient-history maps to tier 4 (AC2)', () => {
  const [ranked] = queueOf([entry('alpha', { state: 'unknown', reason: 'insufficient-history' }, { deadline: '2026-09-01' })]);
  assert.equal(ranked.tier, 4);
});

test('tier 4: unknown/execution-unknown maps to tier 4 (AC2, incl. the denom===0 all-abandoned case which reuses this reason)', () => {
  const [ranked] = queueOf([entry('alpha', { state: 'unknown', reason: 'execution-unknown' })]);
  assert.equal(ranked.tier, 4);
});

test('tier 5: on_track forecast (any reason) maps to tier 5 (AC2)', () => {
  const [ranked] = queueOf([entry('alpha', { state: 'on_track', reason: 'pace-meets-required' }, { deadline: '2026-09-01' })]);
  assert.equal(ranked.tier, 5);
});

test('all five tiers populated simultaneously from one fixture set (DoD)', () => {
  const ranked = queueOf([
    entry('at-risk-proj', { state: 'at_risk', reason: 'deadline-passed' }, { deadline: '2026-08-06' }),
    entry('stale-proj', { state: 'unknown', reason: 'stale-evidence' }, { deadline: '2026-09-01' }),
    entry('needs-owner-proj', { state: 'unknown', reason: 'deadline-unknown' }),
    entry('awaiting-proj', { state: 'unknown', reason: 'insufficient-history' }, { deadline: '2026-09-01' }),
    entry('healthy-proj', { state: 'on_track', reason: 'pace-meets-required' }, { deadline: '2026-12-01' }),
  ]);
  assert.deepEqual(ranked.map((r) => r.tier), [1, 2, 3, 4, 5]);
  assert.deepEqual(ranked.map((r) => r.id), [
    'at-risk-proj', 'stale-proj', 'needs-owner-proj', 'awaiting-proj', 'healthy-proj',
  ]);
});

// --- AC2: most-urgent-tier-wins, first-match top-down ---------------------

test('most-urgent-tier-wins: at_risk + blocker present lands in tier 1, not tier 2 (AC2)', () => {
  const [ranked] = queueOf([
    entry('alpha', { state: 'at_risk', reason: 'pace-behind-required' }, { deadline: '2026-09-01', blockers: ['stuck'] }),
  ]);
  assert.equal(ranked.tier, 1);
});

test('most-urgent-tier-wins: on_track + blocker present is raised to tier 2, not left at tier 5 (AC2)', () => {
  const [ranked] = queueOf([
    entry('alpha', { state: 'on_track', reason: 'pace-meets-required' }, { deadline: '2026-09-01', blockers: ['stuck'] }),
  ]);
  assert.equal(ranked.tier, 2);
  assert.match(ranked.reason, /blocked/);
});

test('most-urgent-tier-wins: deadline-unknown + blocker present is raised to tier 2, not tier 3 (AC2)', () => {
  const [ranked] = queueOf([
    entry('alpha', { state: 'unknown', reason: 'deadline-unknown' }, { blockers: ['stuck'] }),
  ]);
  assert.equal(ranked.tier, 2);
});

// --- AC1/AC2: within-tier deadline proximity, unknown/absent sorts last ---

test('within tier: soonest concrete deadline sorts first (AC1)', () => {
  const ranked = queueOf([
    entry('far', { state: 'on_track', reason: 'pace-meets-required' }, { deadline: '2026-12-01' }),
    entry('near', { state: 'on_track', reason: 'pace-meets-required' }, { deadline: '2026-08-10' }),
  ]);
  assert.deepEqual(ranked.map((r) => r.id), ['near', 'far']);
});

test('within tier: a literal "unknown" deadline sorts last (AC1)', () => {
  const ranked = queueOf([
    entry('has-date', { state: 'on_track', reason: 'pace-meets-required' }, { deadline: '2026-12-01' }),
    entry('unknown-deadline', { state: 'on_track', reason: 'pace-meets-required' }, { deadline: 'unknown' }),
  ]);
  assert.deepEqual(ranked.map((r) => r.id), ['has-date', 'unknown-deadline']);
});

test('within tier: an entirely absent deadline field sorts last, exactly like literal "unknown" (AC1)', () => {
  const ranked = queueOf([
    entry('has-date', { state: 'on_track', reason: 'pace-meets-required' }, { deadline: '2026-12-01' }),
    entry('no-field', { state: 'on_track', reason: 'pace-meets-required' }), // no deadline key at all
  ]);
  assert.deepEqual(ranked.map((r) => r.id), ['has-date', 'no-field']);
});

test('within tier: unknown deadline and entirely-absent deadline tie with each other, broken by project.id (AC1)', () => {
  const ranked = queueOf([
    entry('zzz-unknown', { state: 'on_track', reason: 'pace-meets-required' }, { deadline: 'unknown' }),
    entry('aaa-absent', { state: 'on_track', reason: 'pace-meets-required' }),
  ]);
  assert.deepEqual(ranked.map((r) => r.id), ['aaa-absent', 'zzz-unknown']);
});

// --- AC1: project.id tie-break --------------------------------------------

test('tie-break: identical tier and identical deadline break by project.id, stable and deterministic (AC1)', () => {
  const ranked = queueOf([
    entry('zeta', { state: 'on_track', reason: 'pace-meets-required' }, { deadline: '2026-09-01' }),
    entry('alpha', { state: 'on_track', reason: 'pace-meets-required' }, { deadline: '2026-09-01' }),
  ]);
  assert.deepEqual(ranked.map((r) => r.id), ['alpha', 'zeta']);
});

// --- AC1: deterministic ordering -------------------------------------------

test('deterministic: identical inputs yield an identical order every call (AC1)', () => {
  const projects = [
    entry('beta', { state: 'unknown', reason: 'stale-evidence' }, { deadline: '2026-09-01' }),
    entry('alpha', { state: 'at_risk', reason: 'pace-behind-required' }, { deadline: '2026-08-20' }),
    entry('gamma', { state: 'on_track', reason: 'pace-meets-required' }, { deadline: '2026-10-01' }),
  ];
  const first = queueOf(projects).map((r) => r.id);
  const second = queueOf(projects.map((p) => JSON.parse(JSON.stringify(p)))).map((r) => r.id);
  assert.deepEqual(first, second);
});

// --- AC1: explained reason --------------------------------------------------

test('each entry carries a short reason describing its tier position (AC1)', () => {
  const ranked = queueOf([
    entry('alpha', { state: 'at_risk', reason: 'pace-behind-required' }, { deadline: '2026-08-08' }),
    entry('beta', { state: 'unknown', reason: 'deadline-unknown' }),
  ]);
  assert.match(ranked[0].reason, /at risk/);
  assert.match(ranked[0].reason, /day/);
  assert.equal(ranked[1].reason, 'needs a goal set');
});

test('tier 2-4 reason strings are the exact user-facing dashboard copy (AC1)', () => {
  // These display strings are what the dashboard shows; a typo would otherwise
  // pass CI since the tier tests only check `.tier`.
  const staleReason = queueOf([entry('a', { state: 'unknown', reason: 'stale-evidence' }, { deadline: '2026-09-01' })])[0].reason;
  const blockedReason = queueOf([entry('a', { state: 'unknown', reason: 'stale-evidence' }, { deadline: '2026-09-01', blockers: ['stuck'] })])[0].reason;
  const scopeReason = queueOf([entry('a', { state: 'unknown', reason: 'scope-changed' }, { deadline: '2026-09-01' })])[0].reason;
  const histReason = queueOf([entry('a', { state: 'unknown', reason: 'insufficient-history' }, { deadline: '2026-09-01' })])[0].reason;
  const execReason = queueOf([entry('a', { state: 'unknown', reason: 'execution-unknown' })])[0].reason;
  assert.equal(staleReason, 'stale — verify');
  assert.equal(blockedReason, 'blocked — verify');
  assert.equal(scopeReason, 'scope changed — needs review');
  assert.equal(histReason, 'awaiting more history');
  assert.equal(execReason, 'no delivery status yet');
});

// --- honesty: a malformed forecast must not be coerced to the healthiest tier ---

test('a malformed/unrecognized forecast is surfaced for attention (tier 2), never sunk to on_track tier 5', () => {
  // Unreachable in the composed pipeline (attachForecasts always yields a
  // well-formed ADR-0012 forecast); as a standalone export, an unknown-shaped
  // forecast must not read as "healthy" (product-vision: never unknown→healthy).
  const [bad] = queueOf([entry('alpha', { state: 'weird', reason: 'nonsense' }, { deadline: '2026-09-01' })]);
  assert.equal(bad.tier, 2);
  const [empty] = queueOf([entry('beta', {}, { deadline: '2026-09-01' })]);
  assert.equal(empty.tier, 2);
});

test('a queue entry forecast is a copy — mutating result[i].forecast does not write back to source (AC3)', () => {
  const data = { generatedAt: GENERATED_AT, projects: [entry('alpha', { state: 'at_risk', reason: 'pace-behind-required' }, { deadline: '2026-08-08' })] };
  const ranked = attentionQueue(data);
  ranked[0].forecast.state = 'on_track';
  assert.equal(data.projects[0].forecast.state, 'at_risk');
});

// --- AC3: never a rewrite of project-local priority (no mutation) ---------

test('attentionQueue does not mutate its input — projects array and its entries are untouched (AC3)', () => {
  const projects = [
    entry('alpha', { state: 'at_risk', reason: 'pace-behind-required' }, { deadline: '2026-08-08' }),
    entry('beta', { state: 'on_track', reason: 'pace-meets-required' }, { deadline: '2026-12-01' }),
  ];
  const data = { generatedAt: GENERATED_AT, projects };
  const before = JSON.parse(JSON.stringify(data));
  attentionQueue(data);
  assert.deepEqual(data, before);
});

test('attentionQueue returns fresh entries — mutating the result does not affect the source data (AC3)', () => {
  const data = { generatedAt: GENERATED_AT, projects: [entry('alpha', { state: 'at_risk', reason: 'pace-behind-required' }, { deadline: '2026-08-08' })] };
  const ranked = attentionQueue(data);
  ranked[0].tier = 999;
  assert.notEqual(attentionQueue(data)[0].tier, 999);
});

// --- AC4: import-boundary invariant (shared with derive.test.mjs's AC1 check) ---

test('attentionQueue lives in the same zero-import derive.mjs module (AC4)', () => {
  // The dedicated zero-import assertion lives in derive.test.mjs (AC1); this
  // is a targeted sanity check that attentionQueue itself performs no I/O and
  // takes the project-id set purely from its `data` argument.
  const data = { generatedAt: GENERATED_AT, projects: [] };
  assert.deepEqual(attentionQueue(data), []);
});

// --- AC5 relies on public/index.html — covered in runtime.test.mjs --------
