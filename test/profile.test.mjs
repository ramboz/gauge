import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProfile, PROFILE_DEFAULTS } from '../src/profile.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function loadSchema() {
  return JSON.parse(fs.readFileSync(path.join(HERE, '..', 'schemas', 'project-profile-v1.schema.json'), 'utf8'));
}

test('project-profile v1 schema declares the ADR-0009 field set with defaults', () => {
  const schema = loadSchema();
  assert.equal(schema.type, 'object');
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.artifactRoot.default, 'docs');
  assert.equal(schema.properties.specsDir.default, 'specs');
  assert.equal(schema.properties.decisionsDir.default, 'decisions');
  assert.equal(schema.properties.statusProperty.default, 'status');
  assert.deepEqual(PROFILE_DEFAULTS, {
    artifactRoot: 'docs', specsDir: 'specs', decisionsDir: 'decisions', statusProperty: 'status',
  });
});

test('an absent profile is valid (no-profile identity, AC2)', () => {
  assert.deepEqual(validateProfile(undefined), []);
});

test('a fully-specified valid profile passes', () => {
  assert.deepEqual(validateProfile({
    artifactRoot: 'docs/opportunities/cwv',
    specsDir: 'specs',
    decisionsDir: 'decisions',
    statusProperty: 'status',
  }), []);
});

test('schema and runtime enforce the same malformed-value matrix', () => {
  const schema = loadSchema();
  const cases = [
    {
      name: 'profile not an object',
      value: 'docs',
      schemaProof: () => assert.equal(schema.type, 'object'),
    },
    {
      name: 'profile is an array',
      value: ['docs'],
      schemaProof: () => assert.equal(schema.type, 'object'),
    },
    {
      name: 'numeric artifactRoot',
      value: { artifactRoot: 42 },
      schemaProof: () => assert.equal(schema.properties.artifactRoot.type, 'string'),
    },
    {
      name: 'empty artifactRoot',
      value: { artifactRoot: '' },
      schemaProof: () => assert.equal(schema.properties.artifactRoot.minLength, 1),
    },
    {
      name: 'numeric specsDir',
      value: { specsDir: 0 },
      schemaProof: () => assert.equal(schema.properties.specsDir.type, 'string'),
    },
    {
      name: 'empty decisionsDir',
      value: { decisionsDir: '' },
      schemaProof: () => assert.equal(schema.properties.decisionsDir.minLength, 1),
    },
    {
      name: 'numeric statusProperty',
      value: { statusProperty: false },
      schemaProof: () => assert.equal(schema.properties.statusProperty.type, 'string'),
    },
    {
      name: 'unknown field',
      value: { notAField: true },
      schemaProof: () => assert.equal(schema.additionalProperties, false),
    },
    {
      name: 'empty entries array',
      value: { entries: [] },
      schemaProof: () => assert.equal(schema.properties.entries.minItems, 1),
    },
  ];
  for (const entry of cases) {
    entry.schemaProof();
    assert.notDeepEqual(validateProfile(entry.value), [], entry.name);
  }
});

// A whitespace-only string satisfies the schema's `minLength: 1` (length 3,
// no content constraint) but the runtime validator additionally trims —
// runtime is intentionally stricter here, not a schema/runtime disagreement
// bug. Recorded as its own test rather than folded into the malformed-value
// matrix above, which asserts schema and runtime agree.
test('runtime is intentionally stricter than the schema for whitespace-only strings', () => {
  const schema = loadSchema();
  assert.equal(schema.properties.artifactRoot.minLength, 1);
  assert.notDeepEqual(validateProfile({ artifactRoot: '   ' }), []);
});

// --- 007-02: entries[] (ADR-0009 D2, multi-entry decomposition) ---

test('entries[] is additive to v1: PROFILE_DEFAULTS stays the 007-01 scalar four (forward note)', () => {
  const schema = loadSchema();
  assert.equal(schema.type, 'object');
  assert.equal(schema.additionalProperties, false);
  assert.ok(schema.properties.entries, 'entries must be declared additively, not as a v2 schema');
  assert.deepEqual(PROFILE_DEFAULTS, {
    artifactRoot: 'docs', specsDir: 'specs', decisionsDir: 'decisions', statusProperty: 'status',
  });
  assert.equal(PROFILE_DEFAULTS.entries, undefined);
});

test('a fully-specified multi-entry profile passes (AC1)', () => {
  assert.deepEqual(validateProfile({
    entries: [
      { id: 'rtb', label: 'RTB', artifactRoot: 'tracks/rtb' },
      {
        id: 'offer-management', label: 'Offer management', artifactRoot: 'tracks/offer-management',
        specsDir: 'specs', decisionsDir: 'decisions', statusProperty: 'status',
      },
    ],
  }), []);
});

test('schema and runtime agree on the entries[] malformed-value matrix (AC1/AC2)', () => {
  const schema = loadSchema();
  const itemSchema = schema.properties.entries.items;
  const cases = [
    {
      name: 'entries not an array',
      value: { entries: 'tracks/rtb' },
      schemaProof: () => assert.equal(schema.properties.entries.type, 'array'),
    },
    {
      name: 'entries empty array',
      value: { entries: [] },
      schemaProof: () => assert.equal(schema.properties.entries.minItems, 1),
    },
    {
      name: 'entry not an object',
      value: { entries: ['rtb'] },
      schemaProof: () => assert.equal(itemSchema.type, 'object'),
    },
    {
      name: 'entry missing id',
      value: { entries: [{ label: 'RTB', artifactRoot: 'tracks/rtb' }] },
      schemaProof: () => assert.ok(itemSchema.required.includes('id')),
    },
    {
      name: 'entry missing label',
      value: { entries: [{ id: 'rtb', artifactRoot: 'tracks/rtb' }] },
      schemaProof: () => assert.ok(itemSchema.required.includes('label')),
    },
    {
      name: 'entry missing artifactRoot',
      value: { entries: [{ id: 'rtb', label: 'RTB' }] },
      schemaProof: () => assert.ok(itemSchema.required.includes('artifactRoot')),
    },
    {
      name: 'entry has an unrecognized field',
      value: { entries: [{ id: 'rtb', label: 'RTB', artifactRoot: 'tracks/rtb', extra: 'nope' }] },
      schemaProof: () => assert.equal(itemSchema.additionalProperties, false),
    },
    {
      name: 'entry id is numeric',
      value: { entries: [{ id: 42, label: 'RTB', artifactRoot: 'tracks/rtb' }] },
      schemaProof: () => assert.equal(itemSchema.properties.id.type, 'string'),
    },
    {
      name: 'entry label is empty',
      value: { entries: [{ id: 'rtb', label: '', artifactRoot: 'tracks/rtb' }] },
      schemaProof: () => assert.equal(itemSchema.properties.label.minLength, 1),
    },
    {
      name: 'entry artifactRoot is empty',
      value: { entries: [{ id: 'rtb', label: 'RTB', artifactRoot: '' }] },
      schemaProof: () => assert.equal(itemSchema.properties.artifactRoot.minLength, 1),
    },
    {
      name: 'entry specsDir is numeric',
      value: { entries: [{ id: 'rtb', label: 'RTB', artifactRoot: 'tracks/rtb', specsDir: 0 }] },
      schemaProof: () => assert.equal(itemSchema.properties.specsDir.type, 'string'),
    },
    {
      name: 'entry decisionsDir is numeric',
      value: { entries: [{ id: 'rtb', label: 'RTB', artifactRoot: 'tracks/rtb', decisionsDir: 0 }] },
      schemaProof: () => assert.equal(itemSchema.properties.decisionsDir.type, 'string'),
    },
    {
      name: 'entry statusProperty is numeric',
      value: { entries: [{ id: 'rtb', label: 'RTB', artifactRoot: 'tracks/rtb', statusProperty: 0 }] },
      schemaProof: () => assert.equal(itemSchema.properties.statusProperty.type, 'string'),
    },
  ];
  for (const entry of cases) {
    entry.schemaProof();
    assert.notDeepEqual(validateProfile(entry.value), [], entry.name);
  }
});
