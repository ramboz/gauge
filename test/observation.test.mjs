import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { observeAll, observeProject, validateObservation } from '../src/observation.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, 'fixtures');

const project = (name, extra = {}) => ({
  id: name,
  label: name,
  path: path.join(FIXTURES, name),
  adapters: [],
  pinnedWorkstreams: [],
  hiddenWorkstreams: [],
  signalPolicies: {},
  ...extra,
});

function signal(observation, type) {
  return observation.signals.find((entry) => entry.type === type);
}

test('observation v1 is source-neutral and schema/runtime validation agree', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'schemas', 'observation-v1.schema.json')));
  assert.equal(schema.properties.schemaVersion.const, 1);
  const observation = observeProject(project('proj-plain'), { now: '2026-07-13T20:00:00.000Z' });
  assert.deepEqual(validateObservation(observation), []);
  assert.equal(observation.schemaVersion, 1);
  assert.equal(observation.collection.status, 'ok');
  assert.equal(signal(observation, 'repository').status, 'supported');
  assert.equal(signal(observation, 'execution').status, 'unsupported');
  assert.equal(signal(observation, 'workstreams').status, 'unsupported');
  assert.ok(observation.provenance.adapters.every((adapter) => adapter.collectedAt));
  assert.throws(() => validateObservation({ ...observation, schemaVersion: 2 }, { throwOnError: true }), /schemaVersion/);
  const malformed = structuredClone(observation);
  malformed.provenance.adapters = [{ id: 'x', status: 'ok', collectedAt: observation.collectedAt, freshness: { state: 'fresh' } }];
  assert.ok(validateObservation(malformed).some((error) => error.includes('sourceRevision')));
});

test('optional Jig adapter maps POC value into canonical signals', () => {
  const observation = observeProject(project('proj-jig', {
    label: 'fixture project',
    adapters: ['jig'],
    pinnedWorkstreams: ['docs/runbook-caption.md'],
  }), { now: '2026-07-13T20:00:00.000Z' });
  assert.deepEqual(validateObservation(observation), []);
  const execution = signal(observation, 'execution');
  assert.equal(execution.status, 'supported');
  assert.equal(execution.value.progress.pct, 67);
  assert.equal(execution.value.items.length, 4);
  const workstreams = signal(observation, 'workstreams');
  assert.equal(workstreams.status, 'supported');
  assert.ok(workstreams.value.items.some((item) => item.kind === 'release'));
  assert.ok(workstreams.value.items.some((item) => item.kind === 'runbook'));
  const hygiene = signal(observation, 'hygiene');
  assert.equal(hygiene.value.worktreeOnlyDocs.length, 1);
  const narrative = signal(observation, 'narrative');
  assert.equal(narrative.value.headline, 'beta is close');
  assert.ok(observation.errors.some((error) => error.code === 'malformed-legacy-compass'));
});

test('missing sources produce explicit error observations rather than zero health', () => {
  const observation = observeProject(project('does-not-exist', { adapters: ['jig'] }), {
    now: '2026-07-13T20:00:00.000Z',
  });
  assert.equal(observation.collection.status, 'error');
  assert.equal(signal(observation, 'repository').status, 'error');
  assert.equal(signal(observation, 'execution').status, 'error');
  assert.ok(observation.errors.some((error) => error.code === 'source-unavailable'));
  assert.deepEqual(validateObservation(observation), []);
});

test('adapter attempts and canonical signals are deterministic', () => {
  const cfg = project('proj-jig', { adapters: ['unknown', 'jig'] });
  const first = observeProject(cfg, { now: '2026-07-13T20:00:00.000Z', recordId: '11111111-1111-4111-8111-111111111111' });
  const second = observeProject({ ...cfg, adapters: ['jig', 'unknown'] }, { now: first.collectedAt, recordId: first.recordId });
  assert.deepEqual(first, second);
  assert.deepEqual(first.provenance.adapters.map((entry) => entry.id), ['jig', 'unknown']);
  assert.equal(first.provenance.adapters.find((entry) => entry.id === 'unknown').status, 'unsupported');
  assert.equal(first.collection.status, 'partial');
});

test('schema and runtime enforce the same malformed-value matrix', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'schemas', 'observation-v1.schema.json')));
  const base = observeProject(project('proj-plain'), {
    now: '2026-07-13T20:00:00.000Z',
    recordId: '11111111-1111-4111-8111-111111111111',
  });
  const cases = [
    {
      name: 'date-only timestamp',
      mutate: (value) => { value.collectedAt = '2026-07-13'; },
      schemaProof: () => assert.equal(schema.properties.collectedAt.format, 'date-time'),
    },
    {
      name: 'impossible calendar timestamp',
      mutate: (value) => { value.collectedAt = '2026-02-30T00:00:00Z'; },
      schemaProof: () => {
        assert.equal(schema.properties.collectedAt.format, 'date-time');
        assert.ok(schema.properties.collectedAt.pattern);
      },
    },
    {
      name: 'non-leap February 29',
      mutate: (value) => { value.collectedAt = '2025-02-29T00:00:00Z'; },
      schemaProof: () => assert.equal(new RegExp(schema.properties.collectedAt.pattern).test('2025-02-29T00:00:00Z'), false),
    },
    {
      name: 'April 31',
      mutate: (value) => { value.collectedAt = '2026-04-31T00:00:00Z'; },
      schemaProof: () => assert.equal(new RegExp(schema.properties.collectedAt.pattern).test('2026-04-31T00:00:00Z'), false),
    },
    {
      name: 'leap second unsupported by persistence runtime',
      mutate: (value) => { value.collectedAt = '2016-12-31T23:59:60Z'; },
      schemaProof: () => assert.equal(new RegExp(schema.properties.collectedAt.pattern).test('2016-12-31T23:59:60Z'), false),
    },
    {
      name: 'numeric label',
      mutate: (value) => { value.project.label = 42; },
      schemaProof: () => assert.equal(schema.properties.project.properties.label.type, 'string'),
    },
    {
      name: 'numeric source revision',
      mutate: (value) => { value.provenance.sourceRevision = 42; },
      schemaProof: () => {
        assert.equal(schema.properties.provenance.properties.sourceRevision.$ref, '#/$defs/nullableRevision');
        assert.deepEqual(schema.$defs.nullableRevision.type, ['string', 'null']);
      },
    },
    {
      name: 'numeric signal source timestamp',
      mutate: (value) => { signal(value, 'repository').provenance.sourceTimestamp = 42; },
      schemaProof: () => {
        assert.equal(schema.$defs.sourceProvenance.properties.sourceTimestamp.$ref, '#/$defs/nullableTimestamp');
        assert.equal(schema.$defs.nullableTimestamp.anyOf[1].format, 'date-time');
      },
    },
    {
      name: 'impossible nested source timestamp',
      mutate: (value) => { signal(value, 'repository').provenance.sourceTimestamp = '2026-04-31T12:00:00Z'; },
      schemaProof: () => {
        assert.equal(schema.$defs.nullableTimestamp.anyOf[1].format, 'date-time');
        assert.ok(schema.$defs.nullableTimestamp.anyOf[1].pattern);
      },
    },
    {
      name: 'supported signal without a value',
      mutate: (value) => { delete signal(value, 'repository').value; },
      schemaProof: () => assert.ok(schema.properties.signals.items.allOf.some((rule) => rule.then?.required?.includes('value'))),
    },
    {
      name: 'invalid nested freshness type',
      mutate: (value) => { signal(value, 'repository').freshness = 'fresh'; },
      schemaProof: () => assert.equal(schema.$defs.freshness.type, 'object'),
    },
    {
      name: 'malicious record id',
      mutate: (value) => { value.recordId = '../../../source/pwned'; },
      schemaProof: () => assert.equal(new RegExp(schema.properties.recordId.pattern).test('../../../source/pwned'), false),
    },
  ];
  for (const entry of cases) {
    const malformed = structuredClone(base);
    entry.mutate(malformed);
    entry.schemaProof();
    assert.notDeepEqual(validateObservation(malformed), [], entry.name);
  }
  for (const validTimestamp of ['2024-02-29T23:59:59Z', '2026-07-13T12:00:00-08:00']) {
    const valid = structuredClone(base);
    valid.collectedAt = validTimestamp;
    assert.equal(new RegExp(schema.properties.collectedAt.pattern).test(validTimestamp), true);
    assert.deepEqual(validateObservation(valid), []);
  }
});

test('known capability v1 values are typed and malformed adapters are isolated', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'schemas', 'observation-v1.schema.json')));
  const warningObject = schema.$defs.hygieneValue.properties.warnings.items.oneOf
    .find((entry) => entry.type === 'object');
  assert.ok(warningObject.required.includes('message'));
  assert.equal(warningObject.properties.message.minLength, 1);
  const malformedValues = {
    repository: { nope: true },
    execution: { strategy: 'x', items: [], counts: {} },
    workstreams: { items: 'not-an-array', discovered: [] },
    hygiene: { worktreeOnlyDocs: [], warnings: [{}] },
    narrative: { headline: 42 },
  };
  for (const [type, value] of Object.entries(malformedValues)) {
    const observation = observeProject(project('proj-plain', { adapters: ['bad'] }), {
      adapterRegistry: { bad: fakeAdapter(type, value) },
    });
    assert.equal(observation.provenance.adapters[0].status, 'error', type);
    assert.equal(signal(observation, type).status, type === 'repository' ? 'supported' : 'error', type);
    assert.deepEqual(validateObservation(observation), [], type);
  }
});

function fakeAdapter(type, value, freshness = { state: 'fresh' }) {
  return () => ({
    status: 'ok',
    signals: [{ type, status: 'supported', value, freshness }],
    errors: [],
  });
}

function executionValue(marker) {
  return {
    strategy: 'fixture',
    progress: { done: 0, total: 1, abandoned: 0, deferred: 0, denom: 1, pct: 0, by: {} },
    items: [],
    counts: {},
    marker,
  };
}

test('adapter composition is order-independent, ambiguity-safe, policy-selectable, and merge-provenanced', () => {
  const registry = {
    alpha: fakeAdapter('execution', executionValue('alpha')),
    beta: fakeAdapter('execution', executionValue('beta')),
    left: () => ({ status: 'ok', signals: [
      { type: 'workstreams', status: 'supported', value: { items: [{ id: 'plan', title: 'Left' }], discovered: [] }, freshness: { state: 'fresh' } },
      { type: 'hygiene', status: 'supported', value: { worktreeOnlyDocs: [{ id: 'doc', path: 'left.md' }], warnings: [] }, freshness: { state: 'fresh' } },
    ], errors: [] }),
    right: () => ({ status: 'ok', signals: [
      { type: 'workstreams', status: 'supported', value: { items: [{ id: 'plan', title: 'Right' }], discovered: [] }, freshness: { state: 'fresh' } },
      { type: 'hygiene', status: 'supported', value: { worktreeOnlyDocs: [{ id: 'doc', path: 'right.md' }], warnings: [] }, freshness: { state: 'fresh' } },
    ], errors: [] }),
  };
  const base = project('proj-plain', { adapters: ['beta', 'right', 'alpha', 'left'] });
  const fixed = { adapterRegistry: registry, now: '2026-07-13T20:00:00.000Z', recordId: '11111111-1111-4111-8111-111111111111' };
  const first = observeProject(base, fixed);
  const second = observeProject({ ...base, adapters: [...base.adapters].reverse() }, fixed);
  assert.deepEqual(first, second);
  const ambiguous = signal(first, 'execution');
  assert.equal(ambiguous.status, 'unknown');
  assert.equal(ambiguous.resolution.reason, 'ambiguous-signal-source');
  assert.deepEqual(ambiguous.candidates.map((candidate) => candidate.adapterId), ['alpha', 'beta']);

  const selected = observeProject({ ...base, signalPolicies: { execution: 'beta' } }, fixed);
  assert.equal(signal(selected, 'execution').status, 'supported');
  assert.equal(signal(selected, 'execution').value.marker, 'beta');
  assert.equal(signal(selected, 'execution').resolution.selected, 'beta:execution');

  const streams = signal(first, 'workstreams').value.items;
  assert.equal(signal(first, 'workstreams').candidates.length, 2);
  assert.deepEqual(streams.map((item) => item.contributor.adapterId), ['left', 'right']);
  const docs = signal(first, 'hygiene').value.worktreeOnlyDocs;
  assert.deepEqual(docs.map((item) => item.contributor.adapterId), ['left', 'right']);
});

test('adapter failures are isolated per project and remain explicit in observeAll', () => {
  const registry = { jig: () => { throw new Error('deterministic Jig adapter failure'); } };
  const config = {
    warnings: [],
    projects: [
      project('proj-plain', { id: 'broken', adapters: ['jig'] }),
      project('proj-plain', { id: 'healthy', adapters: [] }),
    ],
  };
  const result = observeAll(config, { adapterRegistry: registry, now: '2026-07-13T20:00:00.000Z' });
  assert.equal(result.projects.length, 2);
  const broken = result.projects.find((entry) => entry.project.id === 'broken');
  const healthy = result.projects.find((entry) => entry.project.id === 'healthy');
  assert.equal(broken.collection.status, 'partial');
  assert.equal(broken.provenance.adapters[0].status, 'error');
  assert.equal(signal(broken, 'execution').status, 'error');
  assert.ok(broken.errors.some((error) => error.code === 'adapter-failed'));
  assert.equal(healthy.collection.status, 'ok');
});

test('malformed adapter results are isolated as valid error observations', () => {
  const cases = [
    ['missing supported value', () => ({ status: 'ok', signals: [{ type: 'execution', status: 'supported', freshness: { state: 'fresh' } }], errors: [] })],
    ['signals not array', () => ({ status: 'ok', signals: {}, errors: [] })],
    ['malformed contribution', () => ({ status: 'ok', signals: [42], errors: [] })],
    ['malformed errors', () => ({ status: 'ok', signals: [], errors: ['bad'] })],
    ['malformed error adapter id', () => ({ status: 'ok', signals: [], errors: [{ code: 'bad', message: 'bad', adapterId: 42 }] })],
    ['non-error empty throw', () => { throw ''; }],
    ['non-string Error message', () => { const error = new Error(); error.message = 1n; throw error; }],
  ];
  for (const [name, adapter] of cases) {
    const observation = observeProject(project('proj-plain', { adapters: ['bad'] }), {
      adapterRegistry: { bad: adapter },
    });
    assert.equal(observation.provenance.adapters[0].status, 'error', name);
    assert.equal(signal(observation, 'execution').status, 'error', name);
    const failure = observation.errors.find((error) => error.code === 'adapter-failed');
    assert.ok(failure?.message, name);
    assert.deepEqual(validateObservation(observation), [], name);
  }
});

test('absent legacy Compass no longer degrades a healthy jig project (retired feature)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nocompass-jig-'));
  try {
    fs.mkdirSync(path.join(dir, 'docs', 'specs', '001-x'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'docs', 'specs', '001-x', 'spec.md'), '---\nstatus: DONE\n---\n# X\n');
    const observation = observeProject({
      id: 'nocompass-jig', label: 'No Compass', path: dir, adapters: ['jig'],
      pinnedWorkstreams: [], hiddenWorkstreams: [], signalPolicies: {},
    });
    // The retired Compass narrative source is absent, so the adapter contributes
    // no narrative signal; it resolves to a non-degrading unsupported signal,
    // never `unknown`, and must not pull collection health to `partial`.
    assert.equal(signal(observation, 'narrative').status, 'unsupported');
    assert.equal(observation.provenance.adapters[0].freshness.state, 'fresh');
    assert.equal(observation.collection.status, 'ok');
    assert.deepEqual(validateObservation(observation), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('stale legacy Jig narrative makes adapter freshness and collection partial', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stale-jig-'));
  try {
    fs.mkdirSync(path.join(dir, 'docs', 'specs'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'docs', 'status'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'docs', 'status', 'compass-history.jsonl'),
      '{"v":1,"ts":"2020-01-01T00:00:00Z","headline":"old"}\n');
    const observation = observeProject({
      id: 'stale-jig', label: 'Stale Jig', path: dir, adapters: ['jig'],
      pinnedWorkstreams: [], hiddenWorkstreams: [], signalPolicies: {},
    });
    assert.equal(signal(observation, 'narrative').freshness.state, 'stale');
    assert.equal(observation.provenance.adapters[0].freshness.state, 'stale');
    assert.equal(observation.collection.status, 'partial');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('stale and unknown adapter signals conservatively aggregate to partial', () => {
  const registry = {
    stale: fakeAdapter('narrative', { headline: 'old' }, { state: 'stale', reason: 'old-source' }),
    unknown: () => ({ status: 'ok', signals: [{ type: 'execution', status: 'unknown', freshness: { state: 'unknown', reason: 'no-data' } }], errors: [] }),
  };
  const stale = observeProject(project('proj-plain', { adapters: ['stale'] }), { adapterRegistry: registry });
  assert.equal(stale.provenance.adapters[0].freshness.state, 'stale');
  assert.equal(stale.collection.status, 'partial');
  const unknown = observeProject(project('proj-plain', { adapters: ['unknown'] }), { adapterRegistry: registry });
  assert.equal(unknown.provenance.adapters[0].freshness.state, 'unknown');
  assert.equal(unknown.collection.status, 'partial');
});

test('a policy that matches multiple candidate dimensions remains ambiguous', () => {
  const registry = {
    alpha: () => ({ status: 'ok', signals: [{
      id: 'pick', type: 'execution', status: 'supported', value: executionValue('alpha'),
      freshness: { state: 'fresh' },
    }], errors: [] }),
    beta: () => ({ status: 'ok', signals: [{
      type: 'execution', strategy: 'pick', status: 'supported', value: executionValue('beta'),
      freshness: { state: 'fresh' },
    }], errors: [] }),
  };
  const observation = observeProject(project('proj-plain', {
    adapters: ['alpha', 'beta'], signalPolicies: { execution: 'pick' },
  }), { adapterRegistry: registry });
  const execution = signal(observation, 'execution');
  assert.equal(execution.status, 'unknown');
  assert.equal(execution.resolution.reason, 'ambiguous-signal-policy');
  assert.equal(execution.candidates.length, 2);
});

test('supported capability versions are never composed across incompatible versions', () => {
  const registry = {
    one: () => ({ status: 'ok', signals: [{
      type: 'workstreams', version: 1, status: 'supported',
      value: { items: [], discovered: [] }, freshness: { state: 'fresh' },
    }], errors: [] }),
    two: () => ({ status: 'ok', signals: [{
      type: 'workstreams', version: 2, status: 'supported',
      value: { items: [{ id: 'future' }], discovered: [] }, freshness: { state: 'fresh' },
    }], errors: [] }),
  };
  const fixed = { adapterRegistry: registry, now: '2026-07-13T20:00:00Z', recordId: '11111111-1111-4111-8111-111111111111' };
  const config = project('proj-plain', { adapters: ['two', 'one'] });
  const first = observeProject(config, fixed);
  const second = observeProject({ ...config, adapters: ['one', 'two'] }, fixed);
  assert.deepEqual(first, second);
  const workstreams = signal(first, 'workstreams');
  assert.equal(workstreams.status, 'unknown');
  assert.equal(workstreams.resolution.reason, 'incompatible-capability-versions');
  assert.deepEqual(workstreams.candidates.map((candidate) => candidate.provenance.adapterId), ['one', 'two']);
});

test('merge metadata is derived only from supported contributions actually merged', () => {
  const registry = {
    one: () => ({ status: 'ok', signals: [{
      type: 'workstreams', version: 1, status: 'supported',
      value: { items: [{ id: 'active' }], discovered: [] }, freshness: { state: 'fresh' },
    }], errors: [] }),
    two: () => ({ status: 'ok', signals: [{
      type: 'workstreams', version: 2, status: 'unsupported',
      freshness: { state: 'unknown', reason: 'future-adapter-disabled' },
    }], errors: [] }),
  };
  const observation = observeProject(project('proj-plain', { adapters: ['two', 'one'] }), {
    adapterRegistry: registry,
  });
  const workstreams = signal(observation, 'workstreams');
  assert.equal(workstreams.status, 'supported');
  assert.equal(workstreams.version, 1);
  assert.equal(workstreams.freshness.state, 'fresh');
  assert.equal(observation.collection.status, 'partial');
});

test('cyclic and non-JSON adapter payloads isolate cleanly and never break portfolio serialization', () => {
  const cyclic = {};
  cyclic.self = cyclic;
  const cyclicExtension = {};
  cyclicExtension.self = cyclicExtension;
  const customSerialization = { headline: 'x' };
  Object.defineProperty(customSerialization, 'toJSON', {
    enumerable: false,
    value: () => 1n,
  });
  const registry = {
    cycle: fakeAdapter('narrative', { headline: 'x', extra: cyclic }),
    bigint: fakeAdapter('narrative', { headline: 'x', count: 1n }),
    function: fakeAdapter('narrative', { headline: 'x', callback() {} }),
    symbol: fakeAdapter('narrative', { headline: 'x', state: Symbol('unsafe') }),
    nonfinite: fakeAdapter('narrative', { headline: 'x', score: Number.POSITIVE_INFINITY }),
    undefined: fakeAdapter('narrative', { headline: 'x', missing: undefined }),
    tojson: fakeAdapter('narrative', customSerialization),
    extensions: () => ({ status: 'ok', signals: [], errors: [], extensions: cyclicExtension }),
    errors: () => ({
      status: 'ok', signals: [],
      errors: [{ code: 'unsafe', message: 'unsafe', detail: 1n }],
    }),
  };
  const unsafeIds = Object.keys(registry);
  const config = {
    warnings: [],
    projects: [
      ...unsafeIds.map((id) => project('proj-plain', { id, adapters: [id] })),
      project('proj-plain', { id: 'healthy', adapters: [] }),
    ],
  };
  const result = observeAll(config, { adapterRegistry: registry });
  assert.doesNotThrow(() => JSON.stringify(result));
  for (const id of unsafeIds) {
    const observation = result.projects.find((entry) => entry.project.id === id);
    assert.equal(observation.provenance.adapters[0].status, 'error');
    assert.ok(observation.errors.find((error) => error.code === 'adapter-failed')?.message);
    assert.deepEqual(validateObservation(observation), []);
  }
  assert.equal(result.projects.find((entry) => entry.project.id === 'healthy').collection.status, 'ok');
});

test('valid Git repository observations carry HEAD source revision', () => {
  const root = path.join(HERE, '..');
  const observation = observeProject({ id: 'gauge', label: 'Gauge', path: root, adapters: [] });
  assert.match(observation.provenance.sourceRevision, /^[0-9a-f]{40,64}$/);
  assert.equal(signal(observation, 'repository').provenance.sourceRevision, observation.provenance.sourceRevision);
});

test('Jig adapter and every Jig signal carry the scanned Git HEAD revision', () => {
  const root = path.join(HERE, '..');
  const observation = observeProject({
    id: 'gauge', label: 'Gauge', path: root, adapters: ['jig'],
    pinnedWorkstreams: [], hiddenWorkstreams: [], signalPolicies: {},
  });
  const revision = observation.provenance.sourceRevision;
  const jig = observation.provenance.adapters.find((entry) => entry.id === 'jig');
  assert.equal(jig.sourceRevision, revision);
  const jigCandidates = observation.signals.flatMap((entry) => entry.candidates)
    .filter((candidate) => candidate.adapterId === 'jig');
  assert.ok(jigCandidates.length > 0);
  assert.ok(jigCandidates.every((candidate) => candidate.provenance.sourceRevision === revision));
});
