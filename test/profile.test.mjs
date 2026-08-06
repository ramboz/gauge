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
  // specLayout (ADR-0010, slice 008-01) is additive: default 'nested', so it
  // flows into PROFILE_DEFAULTS with the 007 identity value.
  assert.equal(schema.properties.specLayout.default, 'nested');
  assert.deepEqual(PROFILE_DEFAULTS, {
    artifactRoot: 'docs', specsDir: 'specs', decisionsDir: 'decisions', statusProperty: 'status',
    specLayout: 'nested',
  });
});

// --- 008-01: specLayout capability (ADR-0010) ---

test('specLayout is an additive enum {nested,flat,auto} defaulting to nested (008-01 AC1)', () => {
  const schema = loadSchema();
  assert.deepEqual(schema.properties.specLayout.enum, ['nested', 'flat', 'auto']);
  assert.equal(schema.properties.specLayout.default, 'nested');
  assert.deepEqual(schema.properties.entries.items.properties.specLayout.enum, ['nested', 'flat', 'auto']);
});

test('a profile with no specLayout validates (007 identity, 008-01 AC1)', () => {
  assert.deepEqual(validateProfile({ artifactRoot: 'docs', specsDir: 'specs' }), []);
});

test('valid specLayout values are accepted at the profile and entry level (008-01 AC1)', () => {
  for (const layout of ['nested', 'flat', 'auto']) {
    assert.deepEqual(validateProfile({ specLayout: layout }), [], layout);
  }
  assert.deepEqual(validateProfile({
    entries: [{ id: 'a', label: 'A', artifactRoot: 'tracks/a', specLayout: 'flat' }],
  }), []);
});

test('a bad specLayout value is rejected with one actionable error (008-01 AC1)', () => {
  const schema = loadSchema();
  assert.deepEqual(schema.properties.specLayout.enum, ['nested', 'flat', 'auto']);
  const topErrors = validateProfile({ specLayout: 'weekly' });
  assert.equal(topErrors.length, 1);
  assert.match(topErrors[0], /profile\.specLayout must be one of: nested, flat, auto/);
  // A numeric specLayout is rejected the same way (not "non-empty string").
  assert.notDeepEqual(validateProfile({ specLayout: 42 }), []);
  // Per-entry override is enum-gated with an equally actionable error.
  const entryErrors = validateProfile({
    entries: [{ id: 'a', label: 'A', artifactRoot: 'tracks/a', specLayout: 'weekly' }],
  });
  assert.equal(entryErrors.length, 1);
  assert.match(entryErrors[0], /profile\.entries\[0\]\.specLayout must be one of: nested, flat, auto/);
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

// --- 009-01: goal/deadline (ADR-0011) additive profile fields ---

test('goal/deadline are additive: a profile with neither validates exactly as the 007 identity (AC1)', () => {
  const schema = loadSchema();
  assert.ok(schema.properties.goal, 'schema must declare goal');
  assert.ok(schema.properties.deadline, 'schema must declare deadline');
  assert.deepEqual(validateProfile({ artifactRoot: 'docs', specsDir: 'specs' }), []);
  assert.deepEqual(validateProfile(undefined), []);
  // goal/deadline carry no default, so PROFILE_DEFAULTS stays the 007-01 five.
  assert.deepEqual(PROFILE_DEFAULTS, {
    artifactRoot: 'docs', specsDir: 'specs', decisionsDir: 'decisions', statusProperty: 'status',
    specLayout: 'nested',
  });
  assert.equal(PROFILE_DEFAULTS.goal, undefined);
  assert.equal(PROFILE_DEFAULTS.deadline, undefined);
});

test('additionalProperties: false still holds with goal/deadline declared (AC1)', () => {
  const schema = loadSchema();
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.goal.additionalProperties, false);
  assert.equal(schema.$defs.deadline.additionalProperties, false);
});

test('a valid goal/deadline pair validates (AC1)', () => {
  assert.deepEqual(validateProfile({
    goal: { value: 'Ship the MVP', provenance: 'product-vision' },
    deadline: { value: '2026-09-01', provenance: 'release' },
  }), []);
  assert.deepEqual(validateProfile({
    goal: { value: 'Ship the MVP', provenance: 'user' },
    deadline: { value: 'unknown', provenance: 'user' },
  }), []);
});

test('every declared provenance value is accepted for both fields (AC1)', () => {
  const schema = loadSchema();
  for (const provenance of schema.$defs.goal.properties.provenance.enum) {
    assert.deepEqual(validateProfile({ goal: { value: 'x', provenance } }), [], `goal provenance ${provenance}`);
  }
  for (const provenance of schema.$defs.deadline.properties.provenance.enum) {
    assert.deepEqual(validateProfile({ deadline: { value: 'unknown', provenance } }), [], `deadline provenance ${provenance}`);
  }
});

test('goal/deadline provenance enum is exactly product-vision|release|readme|user (AC1)', () => {
  const schema = loadSchema();
  assert.deepEqual(schema.$defs.goal.properties.provenance.enum, ['product-vision', 'release', 'readme', 'user']);
  assert.deepEqual(schema.$defs.deadline.properties.provenance.enum, ['product-vision', 'release', 'readme', 'user']);
});

test('a bad provenance value is rejected with one actionable error (AC1)', () => {
  const goalErrors = validateProfile({ goal: { value: 'Ship it', provenance: 'github-milestone' } });
  assert.equal(goalErrors.length, 1);
  assert.match(goalErrors[0], /profile\.goal\.provenance must be one of: product-vision, release, readme, user/);

  const deadlineErrors = validateProfile({ deadline: { value: '2026-09-01', provenance: 'github-milestone' } });
  assert.equal(deadlineErrors.length, 1);
  assert.match(deadlineErrors[0], /profile\.deadline\.provenance must be one of: product-vision, release, readme, user/);
});

test('a bad deadline value (not a date, not "unknown") is rejected (AC1)', () => {
  const errors = validateProfile({ deadline: { value: 'maximum two weeks', provenance: 'release' } });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /profile\.deadline\.value must be an ISO date/);
  // A well-formed but nonsense date-shaped string is still schema-valid — the
  // schema checks shape, not calendar validity (matching the git-date fields
  // elsewhere in the corpus, e.g. schemas/observation-v1.schema.json).
  assert.deepEqual(validateProfile({ deadline: { value: '2026-13-40', provenance: 'user' } }), []);
});

test('the literal deadline value "unknown" is always valid (AC1, ADR-0011)', () => {
  assert.deepEqual(validateProfile({ deadline: { value: 'unknown', provenance: 'user' } }), []);
});

test('goal/deadline require both value and provenance (AC1)', () => {
  assert.notDeepEqual(validateProfile({ goal: { value: 'Ship it' } }), []);
  assert.notDeepEqual(validateProfile({ goal: { provenance: 'user' } }), []);
  assert.notDeepEqual(validateProfile({ deadline: { value: '2026-09-01' } }), []);
  assert.notDeepEqual(validateProfile({ deadline: { provenance: 'user' } }), []);
});

test('goal/deadline reject unrecognized nested fields and non-object values (AC1)', () => {
  assert.notDeepEqual(validateProfile({ goal: { value: 'Ship it', provenance: 'user', extra: true } }), []);
  assert.notDeepEqual(validateProfile({ goal: 'Ship it' }), []);
  assert.notDeepEqual(validateProfile({ deadline: '2026-09-01' }), []);
  assert.notDeepEqual(validateProfile({ goal: ['Ship it'] }), []);
});

test('an empty goal value is rejected (AC1)', () => {
  assert.notDeepEqual(validateProfile({ goal: { value: '', provenance: 'user' } }), []);
  assert.notDeepEqual(validateProfile({ goal: { value: '   ', provenance: 'user' } }), []);
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
    specLayout: 'nested',
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

// --- 010-01: entry-level goal/deadline (ADR-0011 + ADR-0009 D2 composed) ---

test('the schema single-sources goal/deadline via $defs, $ref\'d from both the top-level and entries[] (AC1)', () => {
  const schema = loadSchema();
  assert.ok(schema.$defs.goal, 'schema must declare $defs.goal');
  assert.ok(schema.$defs.deadline, 'schema must declare $defs.deadline');
  assert.deepEqual(schema.properties.goal, { $ref: '#/$defs/goal' });
  assert.deepEqual(schema.properties.deadline, { $ref: '#/$defs/deadline' });
  assert.equal(schema.properties.entries.items.properties.goal.$ref, '#/$defs/goal');
  assert.equal(schema.properties.entries.items.properties.deadline.$ref, '#/$defs/deadline');
  // Shape/enum/pattern parity is guaranteed by construction (same $defs
  // object), not by two independently-authored copies.
  assert.deepEqual(schema.$defs.goal.required, ['value', 'provenance']);
  assert.deepEqual(schema.$defs.deadline.required, ['value', 'provenance']);
  assert.equal(schema.$defs.deadline.properties.value.pattern, '^(\\d{4}-\\d{2}-\\d{2}|unknown)$');
});

test('a valid entry-level goal/deadline is accepted (AC2)', () => {
  assert.deepEqual(validateProfile({
    entries: [{
      id: 'a', label: 'A', artifactRoot: 'tracks/a',
      goal: { value: 'Ship track A', provenance: 'product-vision' },
      deadline: { value: '2026-09-01', provenance: 'release' },
    }],
  }), []);
  // The literal deadline value "unknown" is valid at the entry level too.
  assert.deepEqual(validateProfile({
    entries: [{
      id: 'a', label: 'A', artifactRoot: 'tracks/a',
      deadline: { value: 'unknown', provenance: 'user' },
    }],
  }), []);
});

test('entry-level goal/deadline malformed-value matrix mirrors the top-level one (AC2)', () => {
  const cases = [
    {
      name: 'entry goal not an object',
      value: { entries: [{ id: 'a', label: 'A', artifactRoot: 'tracks/a', goal: 'Ship it' }] },
      expected: /profile\.entries\[0\]\.goal must be an object/,
    },
    {
      name: 'entry deadline not an object',
      value: { entries: [{ id: 'a', label: 'A', artifactRoot: 'tracks/a', deadline: '2026-09-01' }] },
      expected: /profile\.entries\[0\]\.deadline must be an object/,
    },
    {
      name: 'entry goal unrecognized sub-field',
      value: { entries: [{ id: 'a', label: 'A', artifactRoot: 'tracks/a', goal: { value: 'x', provenance: 'user', extra: true } }] },
      expected: /profile\.entries\[0\]\.goal\.extra is not a recognized field/,
    },
    {
      name: 'entry goal missing value',
      value: { entries: [{ id: 'a', label: 'A', artifactRoot: 'tracks/a', goal: { provenance: 'user' } }] },
      expected: /profile\.entries\[0\]\.goal\.value must be a non-empty string/,
    },
    {
      name: 'entry goal empty value',
      value: { entries: [{ id: 'a', label: 'A', artifactRoot: 'tracks/a', goal: { value: '  ', provenance: 'user' } }] },
      expected: /profile\.entries\[0\]\.goal\.value must be a non-empty string/,
    },
    {
      name: 'entry goal bad provenance',
      value: { entries: [{ id: 'a', label: 'A', artifactRoot: 'tracks/a', goal: { value: 'x', provenance: 'github-milestone' } }] },
      expected: /profile\.entries\[0\]\.goal\.provenance must be one of: product-vision, release, readme, user/,
    },
    {
      name: 'entry deadline bad provenance',
      value: { entries: [{ id: 'a', label: 'A', artifactRoot: 'tracks/a', deadline: { value: '2026-09-01', provenance: 'github-milestone' } }] },
      expected: /profile\.entries\[0\]\.deadline\.provenance must be one of: product-vision, release, readme, user/,
    },
    {
      name: 'entry deadline bad value pattern',
      value: { entries: [{ id: 'a', label: 'A', artifactRoot: 'tracks/a', deadline: { value: 'soonish', provenance: 'release' } }] },
      expected: /profile\.entries\[0\]\.deadline\.value must be an ISO date/,
    },
  ];
  for (const { name, value, expected } of cases) {
    const errors = validateProfile(value);
    assert.equal(errors.length, 1, name);
    assert.match(errors[0], expected, name);
  }
});

test('entry-level goal/deadline never hit the generic non-empty-string check (AC2)', () => {
  // A plain-object goal/deadline must never be reported via the generic
  // "must be a non-empty string" message the other entry fields use.
  const errors = validateProfile({
    entries: [{ id: 'a', label: 'A', artifactRoot: 'tracks/a', goal: { value: 'x', provenance: 'user' }, deadline: 42 }],
  });
  assert.ok(errors.every((message) => !message.includes('.deadline must be a non-empty string')), errors.join('; '));
});
