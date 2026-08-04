import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectObservation, descriptorContains, descriptorsOverlap, identityDescriptor, readObservationHistory } from '../src/state.mjs';
import { observeAll, observeProject } from '../src/observation.mjs';
import { normalizeConfig } from '../src/config.mjs';

function tree(root) {
  const out = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(dir, entry.name);
      const relative = path.relative(root, absolute);
      out.push(entry.isDirectory() ? `d:${relative}` : `f:${relative}:${fs.readFileSync(absolute, 'hex')}`);
      if (entry.isDirectory()) visit(absolute);
    }
  }
  visit(root);
  return out;
}

test('identity descriptors reject equality and containment in either direction', () => {
  const root = { dev: 1, ino: 1 };
  const a = { nodes: [root, { dev: 1, ino: 2 }], prospective: [] };
  const child = { nodes: [root, { dev: 1, ino: 2 }, { dev: 1, ino: 3 }], prospective: [] };
  const sibling = { nodes: [root, { dev: 1, ino: 4 }], prospective: [] };
  const prospectiveChild = { nodes: [root, { dev: 1, ino: 2 }], prospective: ['future'] };
  assert.equal(descriptorsOverlap(a, a), true);
  assert.equal(descriptorsOverlap(a, child), true);
  assert.equal(descriptorsOverlap(child, a), true);
  assert.equal(descriptorsOverlap(a, prospectiveChild), true);
  assert.equal(descriptorsOverlap(a, sibling), false);
  assert.equal(descriptorContains(a, child), true);
  assert.equal(descriptorContains(child, a), false);
});

test('collector rejects traversal-bearing record ids before any state or source write', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-state-record-id-'));
  const source = path.join(dir, 'source');
  const stateDir = path.join(dir, 'state');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'sentinel'), 'unchanged');
  try {
    const project = { id: 'p', label: 'P', path: source, adapters: [] };
    const observation = observeProject(project);
    observation.recordId = '../../../source/pwned';
    const before = tree(source);
    assert.throws(() => collectObservation({ stateDir, projects: [project] }, observation), /recordId/);
    assert.deepEqual(tree(source), before);
    assert.equal(fs.existsSync(path.join(source, 'pwned.json')), false);
    assert.equal(fs.existsSync(stateDir), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('filesystem identity recognizes the qualified macOS data-volume alias', { skip: process.platform !== 'darwin' }, (t) => {
  const alias = path.join('/System/Volumes/Data', process.cwd());
  if (!fs.existsSync(alias)) return t.skip('data-volume alias is unavailable');
  assert.equal(descriptorsOverlap(identityDescriptor(process.cwd()), identityDescriptor(alias)), true);
});

test('durable collection is fail-closed outside qualified Darwin APFS', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-state-platform-'));
  const source = path.join(dir, 'source');
  fs.mkdirSync(source);
  try {
    const project = { id: 'p', label: 'P', path: source, adapters: [], pinnedWorkstreams: [], hiddenWorkstreams: [] };
    const observation = observeProject(project, { now: '2026-07-13T20:00:00.000Z' });
    assert.throws(() => collectObservation({ stateDir: path.join(dir, 'state'), projects: [project] }, observation, { platform: 'linux' }), /unsupported-filesystem-identity/);
    assert.equal(fs.existsSync(path.join(dir, 'state')), false, 'qualification fails before creating state');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('durable collection refuses missing sources and symmetric source/state overlap before writes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-state-overlap-'));
  const source = path.join(dir, 'source');
  fs.mkdirSync(source);
  try {
    const missing = { id: 'missing', label: 'Missing', path: path.join(dir, 'missing'), adapters: [] };
    const missingObservation = observeProject(missing);
    assert.throws(() => collectObservation({ stateDir: path.join(dir, 'state'), projects: [missing] }, missingObservation), /unverifiable-source-root/);

    const project = { id: 'p', label: 'P', path: source, adapters: [] };
    const observation = observeProject(project);
    assert.throws(() => collectObservation({ stateDir: path.join(source, '.gauge'), projects: [project] }, observation), /source-state-overlap/);
    assert.throws(() => collectObservation({ stateDir: dir, projects: [project] }, observation), /source-state-overlap/);
    assert.equal(fs.existsSync(path.join(source, '.gauge')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('collector writes immutable central records and never changes the source tree', { skip: process.platform !== 'darwin' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-state-write-'));
  const source = path.join(dir, 'source');
  const stateDir = path.join(dir, 'private', 'state');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'README.md'), '# source\n');
  try {
    const project = { id: 'p', label: 'P', path: source, adapters: [], pinnedWorkstreams: [], hiddenWorkstreams: [] };
    const observation = observeProject(project, { now: '2026-07-13T20:00:00.000Z' });
    const before = tree(source);
    const recordPath = collectObservation({ stateDir, projects: [project] }, observation);
    assert.deepEqual(tree(source), before);
    assert.ok(recordPath.startsWith(path.join(stateDir, 'observations', 'p') + path.sep));
    assert.deepEqual(JSON.parse(fs.readFileSync(recordPath, 'utf8')), observation);
    assert.equal(fs.readdirSync(path.dirname(recordPath)).filter((name) => name.includes('.tmp')).length, 0);
    const second = collectObservation({ stateDir, projects: [project] }, observeProject(project, { now: observation.collectedAt }));
    assert.notEqual(second, recordPath);
    assert.equal(fs.readdirSync(path.dirname(recordPath)).filter((name) => name.endsWith('.json')).length, 2);

    fs.writeFileSync(path.join(path.dirname(recordPath), '.ignored.tmp'), 'partial');
    fs.writeFileSync(path.join(path.dirname(recordPath), 'bad.json'), '{}');
    const history = readObservationHistory(stateDir, 'p');
    assert.equal(history.observations.length, 2);
    assert.equal(history.errors.length, 1);
    assert.equal(history.errors[0].code, 'invalid-history-record');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('collector qualifies before creation, then qualifies and probes the actual project history directory', { skip: process.platform !== 'darwin' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-state-targets-'));
  const source = path.join(dir, 'source');
  const stateDir = path.join(dir, 'state');
  fs.mkdirSync(source);
  try {
    const project = { id: 'p', label: 'P', path: source, adapters: [] };
    const qualified = [];
    const probed = [];
    collectObservation(
      { stateDir, projects: [project] },
      observeProject(project),
      {
        onQualification: (target) => qualified.push(target),
        onCapabilityProbe: (target) => probed.push(target),
      },
    );
    const projectDir = path.join(stateDir, 'observations', 'p');
    assert.equal(qualified[0], dir, 'first qualification happens before state creation');
    assert.equal(qualified.at(-1), projectDir, 'mounted descendant is qualified at the write boundary');
    assert.deepEqual(probed, [projectDir], 'the complete capability probe runs on the record filesystem');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('history filenames and ordering normalize offset timestamps to UTC', { skip: process.platform !== 'darwin' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-state-utc-'));
  const source = path.join(dir, 'source');
  const stateDir = path.join(dir, 'state');
  fs.mkdirSync(source);
  try {
    const project = { id: 'p', label: 'P', path: source, adapters: [] };
    const later = observeProject(project, {
      now: '2026-07-13T12:00:00-08:00',
      recordId: '11111111-1111-4111-8111-111111111111',
    });
    const earlier = observeProject(project, {
      now: '2026-07-13T19:30:00Z',
      recordId: '22222222-2222-4222-8222-222222222222',
    });
    const laterPath = collectObservation({ stateDir, projects: [project] }, later);
    collectObservation({ stateDir, projects: [project] }, earlier);
    assert.match(path.basename(laterPath), /^20260713T200000000Z-/);
    const history = readObservationHistory(stateDir, 'p');
    assert.deepEqual(history.observations.map((entry) => entry.recordId), [earlier.recordId, later.recordId]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('collector rejects a symlink below stateDir before it can redirect a write', { skip: process.platform !== 'darwin' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-state-link-'));
  const source = path.join(dir, 'source');
  const stateDir = path.join(dir, 'state');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'sentinel'), 'unchanged');
  try {
    const project = { id: 'p', label: 'P', path: source, adapters: [] };
    const observation = observeProject(project);
    collectObservation({ stateDir, projects: [project] }, observation);
    const projectDir = path.join(stateDir, 'observations', 'p');
    fs.rmSync(projectDir, { recursive: true });
    fs.symlinkSync(source, projectDir);
    const before = tree(source);
    assert.throws(() => collectObservation({ stateDir, projects: [project] }, observeProject(project)), /unsafe-state-component/);
    assert.deepEqual(tree(source), before);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- 007-02: multi-entry decomposition (ADR-0009 D2, Pattern C) ---

test('multi-entry: each composite-id entry lands under its own state subdirectory, no collision (AC3)', { skip: process.platform !== 'darwin' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-state-entries-'));
  const source = path.join(dir, 'source');
  const stateDir = path.join(dir, 'state');
  fs.mkdirSync(path.join(source, 'tracks', 'a'), { recursive: true });
  fs.mkdirSync(path.join(source, 'tracks', 'b'), { recursive: true });
  try {
    const config = normalizeConfig({
      version: 1,
      stateDir: 'state',
      projects: [{
        id: 'umbrella', path: source, adapters: [],
        profile: {
          entries: [
            { id: 'a', label: 'Track A', artifactRoot: 'tracks/a' },
            { id: 'b', label: 'Track B', artifactRoot: 'tracks/b' },
          ],
        },
      }],
    }, path.join(dir, 'gauge.config.json'));
    assert.equal(config.stateDir, stateDir);
    assert.deepEqual(config.projects.map((p) => p.id), ['umbrella-a', 'umbrella-b']);

    const { projects: observations } = observeAll(config, { now: '2026-07-13T20:00:00.000Z' });
    const before = tree(source);
    const recordPaths = observations.map((observation) => collectObservation(config, observation));

    // ADR-0005 disjointness/containment still hold — no writes to source.
    assert.deepEqual(tree(source), before);

    // Each entry's immutable record lands under its own composite-id
    // subdirectory of stateDir/observations — no cross-entry collision.
    assert.ok(recordPaths[0].startsWith(path.join(stateDir, 'observations', 'umbrella-a') + path.sep));
    assert.ok(recordPaths[1].startsWith(path.join(stateDir, 'observations', 'umbrella-b') + path.sep));
    assert.notEqual(recordPaths[0], recordPaths[1]);

    const historyA = readObservationHistory(stateDir, 'umbrella-a');
    const historyB = readObservationHistory(stateDir, 'umbrella-b');
    assert.equal(historyA.observations.length, 1);
    assert.equal(historyB.observations.length, 1);
    assert.equal(historyA.observations[0].project.id, 'umbrella-a');
    assert.equal(historyB.observations[0].project.id, 'umbrella-b');
    assert.equal(historyA.errors.length, 0);
    assert.equal(historyB.errors.length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
