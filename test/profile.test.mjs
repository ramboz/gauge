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
      value: { entries: [] },
      schemaProof: () => assert.equal(schema.additionalProperties, false),
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
