import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectObservation, readObservationHistory } from '../src/state.mjs';
import { observeProject } from '../src/observation.mjs';

// 014-02 AC1: keep-latest coalescing (opt-in via collectObservation's
// `coalesce` option, used by the session-stop hook). A run of identical-state
// captures collapses to one record at the NEWEST collectedAt.

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-coalesce-'));
  const source = path.join(dir, 'source');
  const stateDir = path.join(dir, 'private', 'state');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'README.md'), '# source\n');
  const project = { id: 'p', label: 'P', path: source, adapters: [], pinnedWorkstreams: [], hiddenWorkstreams: [] };
  const config = { stateDir, projects: [project] };
  const recordsDir = path.join(stateDir, 'observations', 'p');
  const jsonCount = () => fs.readdirSync(recordsDir).filter((n) => n.endsWith('.json')).length;
  return { dir, project, config, recordsDir, jsonCount };
}

test('coalesce: a run of identical-state captures collapses to ONE record at the newest collectedAt', { skip: process.platform !== 'darwin' }, () => {
  const { dir, project, config, recordsDir, jsonCount } = setup();
  try {
    collectObservation(config, observeProject(project, { now: '2026-08-01T00:00:00.000Z' }), { coalesce: true });
    collectObservation(config, observeProject(project, { now: '2026-08-02T00:00:00.000Z' }), { coalesce: true });
    collectObservation(config, observeProject(project, { now: '2026-08-03T00:00:00.000Z' }), { coalesce: true });
    assert.equal(jsonCount(), 1); // three identical captures → one record
    const { observations } = readObservationHistory(config.stateDir, 'p');
    assert.equal(observations.length, 1);
    assert.equal(observations[0].collectedAt, '2026-08-03T00:00:00.000Z'); // newest, not oldest — timestamp advanced
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('coalesce: a genuine-change capture (different sourceRevision) is KEPT, not coalesced', { skip: process.platform !== 'darwin' }, () => {
  const { dir, project, config, recordsDir, jsonCount } = setup();
  try {
    collectObservation(config, observeProject(project, { now: '2026-08-01T00:00:00.000Z' }), { coalesce: true });
    // Simulate a commit landing between captures: same project, new HEAD.
    const changed = observeProject(project, { now: '2026-08-02T00:00:00.000Z' });
    changed.provenance = { ...changed.provenance, sourceRevision: 'commit-xyz' };
    collectObservation(config, changed, { coalesce: true });
    assert.equal(jsonCount(), 2); // genuine change point preserved
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('no coalesce (default): existing append-per-call behavior is unchanged — identical captures both persist', { skip: process.platform !== 'darwin' }, () => {
  const { dir, project, config, jsonCount } = setup();
  try {
    collectObservation(config, observeProject(project, { now: '2026-08-01T00:00:00.000Z' }));
    collectObservation(config, observeProject(project, { now: '2026-08-02T00:00:00.000Z' }));
    assert.equal(jsonCount(), 2); // no coalescing without the opt-in
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('coalesce: first capture into an empty history is retained (no prior to compare)', { skip: process.platform !== 'darwin' }, () => {
  const { dir, project, config, jsonCount } = setup();
  try {
    collectObservation(config, observeProject(project, { now: '2026-08-01T00:00:00.000Z' }), { coalesce: true });
    assert.equal(jsonCount(), 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
