// Slice 013-01 (ADR-0018): git-backfill seed. Tests the pure reconstruction
// fold against a real fixture git repo (mirrors test/velocity.test.mjs's
// initRepo pattern — no stubbed git layer, real `git` process, real temp
// checkout), the honest observation-v1 shape it emits, and the end-to-end
// proof that the EXISTING deriveForecast (src/derive.mjs, untouched) lights
// up on the reconstructed history.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  DEFAULT_BACKFILL_CADENCE_DAYS,
  gitBackfillSeries,
  buildBackfillObservation,
  recordBackfillObservation,
} from '../src/backfill.mjs';
import { validateObservation } from '../src/observation.mjs';
import { deriveForecast } from '../src/derive.mjs';
import { collectObservation, readObservationHistory } from '../src/state.mjs';

// --- fixture repo helper ---------------------------------------------------
// One directory per "spec"; each commit rewrites frontmatter `status:` for
// whichever specs are given, mirroring the nested docs/specs/<slug>/spec.md
// convention scanSpecs reads today (src/scan.mjs).
function initSpecRepo() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-backfill-')));
  const commitDay = (isoDate, specs) => {
    for (const [slug, status] of Object.entries(specs)) {
      const dir = path.join(root, 'docs', 'specs', slug);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'spec.md'), `---\nstatus: ${status}\n---\n# ${slug}\n`);
    }
    execFileSync('git', ['-C', root, 'add', '-A'], { stdio: 'ignore' });
    execFileSync('git', ['-C', root, 'commit', '-qm', isoDate], {
      stdio: 'ignore',
      env: { ...process.env, GIT_AUTHOR_DATE: isoDate, GIT_COMMITTER_DATE: isoDate },
    });
  };
  execFileSync('git', ['-C', root, 'init', '-q', '-b', 'main'], { stdio: 'ignore' });
  execFileSync('git', ['-C', root, 'config', 'user.email', 'test@example.com'], { stdio: 'ignore' });
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Test'], { stdio: 'ignore' });
  return { root, commitDay };
}

function rm(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

// --- AC1: reconstruction command / pure fold shape -------------------------

test('gitBackfillSeries: reconstructs progressOf-shaped points across daily commits, mirroring src/lib.mjs semantics (AC1)', () => {
  const { root, commitDay } = initSpecRepo();
  try {
    commitDay('2026-07-01T10:00:00', { a: 'IN_PROGRESS', b: 'IN_PROGRESS' });
    commitDay('2026-07-02T10:00:00', { a: 'DONE', b: 'IN_PROGRESS' });
    commitDay('2026-07-03T10:00:00', { a: 'DONE', b: 'DONE' });
    const series = gitBackfillSeries(root, { specsDirRel: 'docs/specs' });
    assert.equal(series.length, 3);
    assert.deepEqual(series.map((p) => p.progress.pct), [0, 50, 100]);
    assert.deepEqual(series.map((p) => p.progress.denom), [2, 2, 2]);
    assert.deepEqual(series.map((p) => p.progress.done), [0, 1, 2]);
    // Every point carries a distinct sha + an ISO collectedAt on its commit day.
    assert.equal(new Set(series.map((p) => p.sha)).size, 3);
    for (const point of series) assert.match(point.collectedAt, /^2026-07-0[123]T/);
  } finally {
    rm(root);
  }
});

test('gitBackfillSeries: read-only against the source repo — never writes (hard constraint)', () => {
  const { root, commitDay } = initSpecRepo();
  try {
    commitDay('2026-07-01T10:00:00', { a: 'DONE' });
    const beforeHead = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const beforeStatus = execFileSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' });
    gitBackfillSeries(root, { specsDirRel: 'docs/specs' });
    const afterHead = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const afterStatus = execFileSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' });
    assert.equal(afterHead, beforeHead);
    assert.equal(afterStatus, beforeStatus);
  } finally {
    rm(root);
  }
});

test('gitBackfillSeries: cadence is a bounded, documented default (daily) — one point per commit-day, not per commit (AC5)', () => {
  const { root, commitDay } = initSpecRepo();
  try {
    // Two commits the same calendar day: only the last of the day should survive.
    commitDay('2026-07-01T09:00:00', { a: 'IN_PROGRESS' });
    commitDay('2026-07-01T20:00:00', { a: 'DONE' });
    const series = gitBackfillSeries(root, { specsDirRel: 'docs/specs' });
    assert.equal(series.length, 1);
    assert.equal(series[0].progress.done, 1);
    assert.equal(DEFAULT_BACKFILL_CADENCE_DAYS, 1);
  } finally {
    rm(root);
  }
});

test('gitBackfillSeries: no specs at a commit is skipped, never a fabricated 0/0 point', () => {
  const { root, commitDay } = initSpecRepo();
  try {
    execFileSync('git', ['-C', root, 'commit', '--allow-empty', '-qm', 'no specs yet'], {
      stdio: 'ignore',
      env: { ...process.env, GIT_AUTHOR_DATE: '2026-06-30T10:00:00', GIT_COMMITTER_DATE: '2026-06-30T10:00:00' },
    });
    commitDay('2026-07-01T10:00:00', { a: 'DONE' });
    const series = gitBackfillSeries(root, { specsDirRel: 'docs/specs' });
    assert.equal(series.length, 1);
    assert.match(series[0].collectedAt, /^2026-07-01T/);
  } finally {
    rm(root);
  }
});

// --- AC2: honest backfilled observations ------------------------------------

test('buildBackfillObservation: emits an observation-v1-valid record explicitly marked reconstructed-from-git, not live-collected (AC2)', () => {
  const project = { id: 'p', label: 'P', path: '/tmp/does-not-matter' };
  const point = {
    sha: 'a'.repeat(40),
    collectedAt: '2026-07-01T10:00:00.000Z',
    progress: { done: 1, total: 2, abandoned: 0, deferred: 0, denom: 2, pct: 50, by: { DONE: 1, IN_PROGRESS: 1 } },
  };
  const nowMs = Date.parse('2026-07-01T12:00:00.000Z');
  const observation = buildBackfillObservation(project, point, nowMs);
  const errors = validateObservation(observation);
  assert.deepEqual(errors, []);
  assert.equal(observation.collectedAt, point.collectedAt);
  assert.equal(observation.provenance.sourceRevision, point.sha);
  // Explicitly NOT the live jig adapter id — this is the honesty marker (AC2).
  assert.notEqual(observation.provenance.adapters[0].id, 'jig');
  assert.match(observation.provenance.adapters[0].id, /git-backfill/);
  const executionSignal = observation.signals.find((s) => s.type === 'execution');
  assert.equal(executionSignal.status, 'supported');
  assert.deepEqual(executionSignal.value.progress, point.progress);
  assert.match(executionSignal.freshness.reason, /reconstructed-from-git/);
  assert.match(executionSignal.provenance.adapterId, /git-backfill/);
});

test('buildBackfillObservation: freshness state is honestly derived from source recency at the real "now" (AC2/Gate2)', () => {
  const project = { id: 'p', label: 'P', path: '/tmp/does-not-matter' };
  const staleSha = 'b'.repeat(40);
  const oldPoint = {
    sha: staleSha,
    collectedAt: '2026-01-01T10:00:00.000Z',
    progress: { done: 1, total: 1, abandoned: 0, deferred: 0, denom: 1, pct: 100, by: { DONE: 1 } },
  };
  const nowMs = Date.parse('2026-08-01T10:00:00.000Z'); // 212 days later — stale
  const observation = buildBackfillObservation(project, oldPoint, nowMs);
  const executionSignal = observation.signals.find((s) => s.type === 'execution');
  assert.equal(executionSignal.freshness.state, 'stale');
  assert.match(executionSignal.freshness.reason, /reconstructed-from-git/);
});

// --- AC3: deadline forecast lights up on reconstructed history --------------

test('deriveForecast lights up (on_track) on a stable-window reconstructed series with a committed deadline (AC3)', () => {
  const { root, commitDay } = initSpecRepo();
  try {
    commitDay('2026-07-01T10:00:00', { a: 'IN_PROGRESS', b: 'IN_PROGRESS' });
    commitDay('2026-07-05T10:00:00', { a: 'DONE', b: 'IN_PROGRESS' });
    commitDay('2026-07-10T10:00:00', { a: 'DONE', b: 'DONE' });
    const series = gitBackfillSeries(root, { specsDirRel: 'docs/specs' });
    const nowMs = Date.parse('2026-07-10T12:00:00.000Z');
    const observations = series.map((point) => buildBackfillObservation({ id: 'p', label: 'P', path: root }, point, nowMs));
    for (const observation of observations) assert.deepEqual(validateObservation(observation), []);
    // A generous future deadline given the observed pace (100% reached already,
    // so already-complete → on_track) proves Gates 2/3/4/4.5 all cleared.
    const forecast = deriveForecast(observations, '2026-12-31');
    assert.equal(forecast.state, 'on_track');
    assert.notEqual(forecast.reason, 'insufficient-history');
  } finally {
    rm(root);
  }
});

test('deriveForecast computes a real pace-driven at_risk/on_track split on an incomplete reconstructed window, not just the already-complete shortcut (AC3)', () => {
  const { root, commitDay } = initSpecRepo();
  try {
    // Stable denom=4 throughout; done climbs 0→1→2 over 10 days (a real,
    // partial pace — never reaches 100%, so this exercises the actual
    // observedPace/requiredPace comparison, not the remaining<=0 shortcut).
    commitDay('2026-07-01T10:00:00', { a: 'IN_PROGRESS', b: 'IN_PROGRESS', c: 'IN_PROGRESS', d: 'IN_PROGRESS' });
    commitDay('2026-07-05T10:00:00', { a: 'DONE', b: 'IN_PROGRESS', c: 'IN_PROGRESS', d: 'IN_PROGRESS' });
    commitDay('2026-07-11T10:00:00', { a: 'DONE', b: 'DONE', c: 'IN_PROGRESS', d: 'IN_PROGRESS' });
    const series = gitBackfillSeries(root, { specsDirRel: 'docs/specs' });
    assert.deepEqual(series.map((p) => p.progress.pct), [0, 25, 50]);
    const nowMs = Date.parse('2026-07-11T12:00:00.000Z');
    const observations = series.map((point) => buildBackfillObservation({ id: 'p', label: 'P', path: root }, point, nowMs));

    // Generous far-future deadline at the observed pace → on_track.
    const generous = deriveForecast(observations, '2030-01-01');
    assert.equal(generous.state, 'on_track');
    assert.equal(generous.reason, 'pace-meets-required');

    // Near-term deadline the observed pace cannot meet → at_risk.
    const tight = deriveForecast(observations, '2026-07-12');
    assert.equal(tight.state, 'at_risk');
    assert.equal(tight.reason, 'pace-behind-required');
  } finally {
    rm(root);
  }
});

// --- AC4: Gate 4 honesty is preserved on churning scope ----------------------

test('deriveForecast still reads unknown(scope-changed) on a genuinely churning-denom reconstructed series (AC4)', () => {
  const { root, commitDay } = initSpecRepo();
  try {
    // The denom must churn BEYOND DENOM_TOLERANCE (±1) at the latest step for
    // Gate 4 to route to scope-changed: a single-spec (±1) drift is now
    // deliberately absorbed (see derive.mjs DENOM_TOLERANCE re-tune), so a
    // genuine scope shift here jumps by two (2 → 4) at the final commit-day.
    commitDay('2026-07-01T10:00:00', { a: 'IN_PROGRESS' });
    commitDay('2026-07-02T10:00:00', { a: 'IN_PROGRESS', b: 'IN_PROGRESS' });
    commitDay('2026-07-03T10:00:00', { a: 'IN_PROGRESS', b: 'IN_PROGRESS', c: 'IN_PROGRESS', d: 'IN_PROGRESS' });
    const series = gitBackfillSeries(root, { specsDirRel: 'docs/specs' });
    assert.equal(series.length, 3);
    assert.deepEqual(series.map((p) => p.progress.denom), [1, 2, 4]); // denom shifts by 2 at the latest step (beyond ±1 tolerance)
    const nowMs = Date.parse('2026-07-03T12:00:00.000Z');
    const observations = series.map((point) => buildBackfillObservation({ id: 'p', label: 'P', path: root }, point, nowMs));
    const forecast = deriveForecast(observations, '2026-12-31');
    assert.deepEqual(forecast, { state: 'unknown', reason: 'scope-changed' });
  } finally {
    rm(root);
  }
});

// --- AC5: idempotent + bounded -----------------------------------------------

test('recordBackfillObservation: re-running does not duplicate observations for the same project/commit-day (AC5)', { skip: process.platform !== 'darwin' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-backfill-state-'));
  const source = path.join(dir, 'source');
  const stateDir = path.join(dir, 'state');
  fs.mkdirSync(source);
  try {
    const project = { id: 'p', label: 'P', path: source, adapters: [] };
    const config = { stateDir, projects: [project] };
    const point = {
      sha: 'c'.repeat(40),
      collectedAt: '2026-07-01T10:00:00.000Z',
      progress: { done: 1, total: 1, abandoned: 0, deferred: 0, denom: 1, pct: 100, by: { DONE: 1 } },
    };
    const nowMs = Date.parse('2026-07-01T12:00:00.000Z');
    const observation = buildBackfillObservation(project, point, nowMs);
    const first = recordBackfillObservation(config, observation);
    assert.equal(first.created, true);
    const second = recordBackfillObservation(config, buildBackfillObservation(project, point, nowMs));
    assert.equal(second.created, false);
    const { observations } = readObservationHistory(stateDir, 'p');
    assert.equal(observations.length, 1);
  } finally {
    rm(dir);
  }
});

test('recordBackfillObservation: distinct commit-days produce distinct records (no over-collapsing)', { skip: process.platform !== 'darwin' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-backfill-state-multi-'));
  const source = path.join(dir, 'source');
  const stateDir = path.join(dir, 'state');
  fs.mkdirSync(source);
  try {
    const project = { id: 'p', label: 'P', path: source, adapters: [] };
    const config = { stateDir, projects: [project] };
    const points = [
      { sha: 'd'.repeat(40), collectedAt: '2026-07-01T10:00:00.000Z', progress: { done: 0, total: 1, abandoned: 0, deferred: 0, denom: 1, pct: 0, by: {} } },
      { sha: 'e'.repeat(40), collectedAt: '2026-07-02T10:00:00.000Z', progress: { done: 1, total: 1, abandoned: 0, deferred: 0, denom: 1, pct: 100, by: { DONE: 1 } } },
    ];
    for (const point of points) {
      const result = recordBackfillObservation(config, buildBackfillObservation(project, point, Date.parse(point.collectedAt)));
      assert.equal(result.created, true);
    }
    const { observations } = readObservationHistory(stateDir, 'p');
    assert.equal(observations.length, 2);
  } finally {
    rm(dir);
  }
});

// --- entry point (npm run backfill / scripts/backfill.mjs) ------------------

test('scripts/backfill.mjs backfills a configured jig project and is idempotent on re-run', { skip: process.platform !== 'darwin' }, () => {
  const { root, commitDay } = initSpecRepo();
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-backfill-cli-state-'));
  const configPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-backfill-cli-cfg-')), 'gauge.config.json');
  try {
    commitDay('2026-07-01T10:00:00', { a: 'IN_PROGRESS' });
    commitDay('2026-07-02T10:00:00', { a: 'DONE' });
    fs.writeFileSync(configPath, JSON.stringify({
      version: 1,
      stateDir,
      projects: [{ id: 'p', label: 'P', path: root, adapters: ['jig'] }],
    }));
    const script = path.join(process.cwd(), 'scripts', 'backfill.mjs');
    const beforeHead = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const out1 = execFileSync(process.execPath, [script, '--config', configPath], { encoding: 'utf8' });
    assert.match(out1, /backfilled P/i);
    const afterHead = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    assert.equal(afterHead, beforeHead); // never wrote to the source repo
    const firstCount = fs.readdirSync(path.join(stateDir, 'observations', 'p')).filter((f) => f.endsWith('.json')).length;
    assert.equal(firstCount, 2);
    execFileSync(process.execPath, [script, '--config', configPath], { encoding: 'utf8' });
    const secondCount = fs.readdirSync(path.join(stateDir, 'observations', 'p')).filter((f) => f.endsWith('.json')).length;
    assert.equal(secondCount, 2); // idempotent — no duplicates
  } finally {
    rm(root);
    rm(stateDir);
    rm(path.dirname(configPath));
  }
});
