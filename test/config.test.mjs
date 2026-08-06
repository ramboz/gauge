import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, normalizeConfig, resolveConfigPath, safeProjectId } from '../src/config.mjs';

test('canonical Gauge config resolves state and project paths from the config directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-config-'));
  try {
    const file = path.join(dir, 'gauge.config.json');
    fs.writeFileSync(file, JSON.stringify({
      version: 1,
      stateDir: 'private-state',
      projects: [{ id: 'alpha', label: 'Alpha', path: 'sources/alpha', adapters: ['jig'] }],
    }));
    const config = loadConfig(file);
    assert.equal(config.version, 1);
    assert.equal(config.stateDir, path.join(dir, 'private-state'));
    assert.equal(config.projects[0].path, path.join(dir, 'sources/alpha'));
    assert.deepEqual(config.projects[0].adapters, ['jig']);
    assert.deepEqual(config.warnings, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('canonical version 1 requires explicit stable ids while legacy may derive them', () => {
  assert.throws(
    () => normalizeConfig({ version: 1, projects: [{ label: 'Alpha', path: '/tmp/alpha' }] }, '/tmp/gauge.config.json'),
    /explicit project id/,
  );
  const legacy = normalizeConfig({ projects: [{ label: 'Alpha Project', path: '/tmp/alpha' }] }, '/tmp/dashboard.config.json');
  assert.equal(legacy.projects[0].id, 'alpha-project');
});

test('legacy dashboard config migrates deterministically with one actionable warning', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-legacy-'));
  try {
    const file = path.join(dir, 'dashboard.config.json');
    fs.writeFileSync(file, JSON.stringify({ projects: [{ label: 'Project A', path: './a' }] }));
    const config = loadConfig(file);
    assert.equal(config.projects[0].id, 'project-a');
    assert.deepEqual(config.projects[0].adapters, ['jig']);
    assert.equal(config.warnings.length, 1);
    assert.match(config.warnings[0], /gauge\.config\.json/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('project ids are safe, unique, and empty derivations fail', () => {
  assert.equal(safeProjectId('Hello, World!'), 'hello-world');
  assert.throws(() => safeProjectId('---'), /derive/);
  assert.throws(() => normalizeConfig({ version: 1, projects: [
    { id: '../bad', path: '/tmp/a' },
  ] }, '/tmp/gauge.config.json'), /invalid project id/);
  assert.throws(() => normalizeConfig({ projects: [
    { label: 'Same', path: '/tmp/a' },
    { label: 'Same', path: '/tmp/b' },
  ] }, '/tmp/dashboard.config.json'), /duplicate project id/);
  assert.throws(() => normalizeConfig({ projects: [] }, '/tmp/gauge.config.json'), /version/);
});

test('default config discovery prefers Gauge and falls back to the legacy filename', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-discovery-'));
  try {
    const legacy = path.join(dir, 'dashboard.config.json');
    fs.writeFileSync(legacy, '{}');
    assert.equal(resolveConfigPath(dir), legacy);
    const canonical = path.join(dir, 'gauge.config.json');
    fs.writeFileSync(canonical, '{}');
    assert.equal(resolveConfigPath(dir), canonical);
    assert.equal(resolveConfigPath(dir, '/tmp/explicit.json'), '/tmp/explicit.json');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('project profile normalizes with no-profile identity (007-01 AC2)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-profile-'));
  try {
    const file = path.join(dir, 'gauge.config.json');
    fs.writeFileSync(file, JSON.stringify({
      version: 1,
      projects: [
        { id: 'no-profile', path: 'sources/no-profile', adapters: ['jig'] },
        {
          id: 'explicit-defaults', path: 'sources/explicit-defaults', adapters: ['jig'],
          profile: { artifactRoot: 'docs', specsDir: 'specs', decisionsDir: 'decisions', statusProperty: 'status' },
        },
        {
          id: 'nested', path: 'sources/nested', adapters: ['jig'],
          profile: { artifactRoot: 'docs/opportunities/cwv' },
        },
      ],
    }));
    const config = loadConfig(file);
    const [noProfile, explicitDefaults, nested] = config.projects;

    // A project with no `profile` normalizes exactly as today: default
    // artifactRoot/specsDir/decisionsDir/statusProperty, resolved against
    // the project's own root — identical to a project that spells the
    // defaults out explicitly (AC2 no-profile identity).
    assert.deepEqual(noProfile.profile, {
      artifactRoot: path.join(dir, 'sources', 'no-profile', 'docs'),
      specsDir: 'specs',
      decisionsDir: 'decisions',
      statusProperty: 'status',
      specLayout: 'nested',
    });
    assert.deepEqual(explicitDefaults.profile, {
      artifactRoot: path.join(dir, 'sources', 'explicit-defaults', 'docs'),
      specsDir: 'specs',
      decisionsDir: 'decisions',
      statusProperty: 'status',
      specLayout: 'nested',
    });

    // A non-default artifactRoot resolves relative to the project's own
    // (already-resolved) path, not the config file's directory (AC2).
    assert.equal(nested.profile.artifactRoot, path.join(dir, 'sources', 'nested', 'docs', 'opportunities', 'cwv'));
    assert.equal(nested.profile.specsDir, 'specs');
    assert.equal(nested.profile.decisionsDir, 'decisions');
    assert.equal(nested.profile.statusProperty, 'status');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- 009-01: goal/deadline (ADR-0011) additive profile fields ---

test('a profile with no goal/deadline normalizes with the 007 identity (no extra keys) (AC1)', () => {
  const config = normalizeConfig({
    version: 1,
    projects: [{ id: 'alpha', path: '/tmp/alpha', adapters: ['jig'] }],
  }, '/tmp/gauge.config.json');
  assert.deepEqual(config.projects[0].profile, {
    artifactRoot: path.join('/tmp/alpha', 'docs'),
    specsDir: 'specs', decisionsDir: 'decisions', statusProperty: 'status', specLayout: 'nested',
  });
  assert.ok(!('goal' in config.projects[0].profile));
  assert.ok(!('deadline' in config.projects[0].profile));
});

test('an authored goal/deadline threads verbatim onto the normalized project profile (AC5)', () => {
  const config = normalizeConfig({
    version: 1,
    projects: [{
      id: 'alpha', path: '/tmp/alpha', adapters: ['jig'],
      profile: {
        goal: { value: 'Ship the MVP', provenance: 'product-vision' },
        deadline: { value: '2026-09-01', provenance: 'release' },
      },
    }],
  }, '/tmp/gauge.config.json');
  assert.deepEqual(config.projects[0].profile.goal, { value: 'Ship the MVP', provenance: 'product-vision' });
  assert.deepEqual(config.projects[0].profile.deadline, { value: '2026-09-01', provenance: 'release' });
});

test('deadline: "unknown" threads verbatim, never coerced (AC3)', () => {
  const config = normalizeConfig({
    version: 1,
    projects: [{
      id: 'alpha', path: '/tmp/alpha', adapters: ['jig'],
      profile: { deadline: { value: 'unknown', provenance: 'user' } },
    }],
  }, '/tmp/gauge.config.json');
  assert.deepEqual(config.projects[0].profile.deadline, { value: 'unknown', provenance: 'user' });
});

test('a malformed goal/deadline is rejected with one actionable error (AC1)', () => {
  const cases = [
    ['goal missing provenance', { profile: { goal: { value: 'Ship it' } } }],
    ['deadline bad value', { profile: { deadline: { value: 'soonish', provenance: 'release' } } }],
    ['goal bad provenance', { profile: { goal: { value: 'Ship it', provenance: 'github-milestone' } } }],
  ];
  for (const [name, override] of cases) {
    assert.throws(
      () => normalizeConfig({
        version: 1,
        projects: [{ id: 'alpha', path: '/tmp/alpha', adapters: ['jig'], ...override }],
      }, '/tmp/gauge.config.json'),
      /invalid configuration: project alpha profile:/,
      name,
    );
  }
});

test('malformed project profile is rejected with one actionable error (007-01 AC2)', () => {
  const cases = [
    ['profile not an object', { profile: 'docs' }],
    ['profile is an array', { profile: ['docs'] }],
    ['numeric artifactRoot', { profile: { artifactRoot: 42 } }],
    ['empty artifactRoot', { profile: { artifactRoot: '' } }],
    ['numeric specsDir', { profile: { specsDir: 0 } }],
    ['whitespace decisionsDir', { profile: { decisionsDir: '   ' } }],
    ['numeric statusProperty', { profile: { statusProperty: false } }],
    ['empty entries array', { profile: { entries: [] } }],
  ];
  for (const [name, override] of cases) {
    assert.throws(
      () => normalizeConfig({
        version: 1,
        projects: [{ id: 'alpha', path: '/tmp/alpha', adapters: ['jig'], ...override }],
      }, '/tmp/gauge.config.json'),
      /invalid configuration: project alpha profile:/,
      name,
    );
  }
});

// --- 007-02: multi-entry decomposition (ADR-0009 D2, Pattern C) ---

test('a profile with entries expands one project into N normalized projects (AC1/AC2)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-entries-'));
  try {
    const file = path.join(dir, 'gauge.config.json');
    fs.writeFileSync(file, JSON.stringify({
      version: 1,
      projects: [
        {
          id: 'umbrella', label: 'Umbrella (ignored)', path: 'sources/umbrella', adapters: ['jig'],
          pinnedWorkstreams: ['docs/runbook.md'], hiddenWorkstreams: ['docs/skip.md'],
          signalPolicies: { execution: 'jig' },
          profile: {
            entries: [
              { id: 'rtb', label: 'RTB', artifactRoot: 'tracks/rtb' },
              { id: 'offer-management', label: 'Offer management', artifactRoot: 'tracks/offer-management' },
              {
                id: 'contextual-experimentation', label: 'Contextual experimentation',
                artifactRoot: 'tracks/contextual-experimentation', statusProperty: 'state',
              },
            ],
          },
        },
        { id: 'solo', path: 'sources/solo', adapters: ['jig'] },
      ],
    }));
    const config = loadConfig(file);
    assert.equal(config.projects.length, 4);

    const [rtb, offerManagement, contextualExperimentation, solo] = config.projects;
    const umbrellaPath = path.join(dir, 'sources', 'umbrella');

    // Composite ids, in declared entry order (AC2, AC5 determinism).
    assert.equal(rtb.id, 'umbrella-rtb');
    assert.equal(offerManagement.id, 'umbrella-offer-management');
    assert.equal(contextualExperimentation.id, 'umbrella-contextual-experimentation');

    // Labelled by entry label, not the umbrella project's own label (AC5).
    assert.equal(rtb.label, 'RTB');
    assert.equal(offerManagement.label, 'Offer management');
    assert.equal(contextualExperimentation.label, 'Contextual experimentation');

    // Every entry shares the umbrella repository path (shared git signal, D3).
    assert.equal(rtb.path, umbrellaPath);
    assert.equal(offerManagement.path, umbrellaPath);
    assert.equal(contextualExperimentation.path, umbrellaPath);

    // Each entry gets its own single-entry, artifactRoot-scoped profile with
    // no `entries` key (observation.mjs/state.mjs see ordinary single-entry
    // projects downstream).
    assert.deepEqual(rtb.profile, {
      artifactRoot: path.join(umbrellaPath, 'tracks', 'rtb'),
      specsDir: 'specs', decisionsDir: 'decisions', statusProperty: 'status', specLayout: 'nested',
    });
    assert.deepEqual(offerManagement.profile, {
      artifactRoot: path.join(umbrellaPath, 'tracks', 'offer-management'),
      specsDir: 'specs', decisionsDir: 'decisions', statusProperty: 'status', specLayout: 'nested',
    });
    // Per-entry statusProperty override wins over the (absent) profile-level default.
    assert.deepEqual(contextualExperimentation.profile, {
      artifactRoot: path.join(umbrellaPath, 'tracks', 'contextual-experimentation'),
      specsDir: 'specs', decisionsDir: 'decisions', statusProperty: 'state', specLayout: 'nested',
    });
    assert.equal(rtb.profile.entries, undefined);

    // Shared config fields (adapters, signal policies, pins/hidden) carry
    // through to every entry unchanged.
    for (const entry of [rtb, offerManagement, contextualExperimentation]) {
      assert.deepEqual(entry.adapters, ['jig']);
      assert.deepEqual(entry.signalPolicies, { execution: 'jig' });
      assert.deepEqual(entry.pinnedWorkstreams, ['docs/runbook.md']);
      assert.deepEqual(entry.hiddenWorkstreams, ['docs/skip.md']);
    }

    // A project without entries normalizes exactly as 007-01 (single entry).
    assert.equal(solo.id, 'solo');
    assert.equal(solo.profile.entries, undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('entries: per-entry specsDir/decisionsDir override the profile-level and default values', () => {
  const config = normalizeConfig({
    version: 1,
    projects: [{
      id: 'umbrella', path: '/tmp/umbrella', adapters: ['jig'],
      profile: {
        specsDir: 'profile-specs', decisionsDir: 'profile-decisions',
        entries: [
          { id: 'a', label: 'A', artifactRoot: 'tracks/a' },
          { id: 'b', label: 'B', artifactRoot: 'tracks/b', specsDir: 'entry-specs', decisionsDir: 'entry-decisions' },
        ],
      },
    }],
  }, '/tmp/gauge.config.json');
  const [a, b] = config.projects;
  // No per-entry override: falls back to the profile-level override.
  assert.equal(a.profile.specsDir, 'profile-specs');
  assert.equal(a.profile.decisionsDir, 'profile-decisions');
  // Per-entry override wins over the profile-level override.
  assert.equal(b.profile.specsDir, 'entry-specs');
  assert.equal(b.profile.decisionsDir, 'entry-decisions');
});

test('entries: specLayout threads with entry→profile→default fallback (008-01 AC1)', () => {
  const config = normalizeConfig({
    version: 1,
    projects: [{
      id: 'umbrella', path: '/tmp/umbrella', adapters: ['jig'],
      profile: {
        specLayout: 'flat',
        entries: [
          { id: 'a', label: 'A', artifactRoot: 'tracks/a' },
          { id: 'b', label: 'B', artifactRoot: 'tracks/b', specLayout: 'nested' },
        ],
      },
    }],
  }, '/tmp/gauge.config.json');
  const [a, b] = config.projects;
  // No per-entry override: falls back to the profile-level specLayout.
  assert.equal(a.profile.specLayout, 'flat');
  // Per-entry override wins over the profile-level value.
  assert.equal(b.profile.specLayout, 'nested');
});

test('single-entry profile threads specLayout with default fallback (008-01 AC1)', () => {
  const config = normalizeConfig({
    version: 1,
    projects: [
      { id: 'flat', path: '/tmp/flat', adapters: ['jig'], profile: { specLayout: 'flat' } },
      { id: 'plain', path: '/tmp/plain', adapters: ['jig'] },
    ],
  }, '/tmp/gauge.config.json');
  assert.equal(config.projects[0].profile.specLayout, 'flat');
  // Absent specLayout defaults to nested (007 identity).
  assert.equal(config.projects[1].profile.specLayout, 'nested');
});

test('entries: duplicate entry id is rejected with an actionable error', () => {
  assert.throws(
    () => normalizeConfig({
      version: 1,
      projects: [{
        id: 'umbrella', path: '/tmp/umbrella', adapters: ['jig'],
        profile: {
          entries: [
            { id: 'rtb', label: 'RTB', artifactRoot: 'tracks/rtb' },
            { id: 'rtb', label: 'RTB again', artifactRoot: 'tracks/rtb2' },
          ],
        },
      }],
    }, '/tmp/gauge.config.json'),
    /duplicate entry id: rtb/,
  );
});

test('entries: an oversized or pattern-invalid composite id is rejected (AC2)', () => {
  const longEntryId = 'x'.repeat(60);
  assert.throws(
    () => normalizeConfig({
      version: 1,
      projects: [{
        id: 'umbrella', path: '/tmp/umbrella', adapters: ['jig'],
        profile: { entries: [{ id: longEntryId, label: 'Too long', artifactRoot: 'tracks/x' }] },
      }],
    }, '/tmp/gauge.config.json'),
    /composite id .* is invalid or exceeds 64 characters/,
  );
  assert.throws(
    () => normalizeConfig({
      version: 1,
      projects: [{
        id: 'umbrella', path: '/tmp/umbrella', adapters: ['jig'],
        profile: { entries: [{ id: 'RTB_bad', label: 'Bad chars', artifactRoot: 'tracks/rtb' }] },
      }],
    }, '/tmp/gauge.config.json'),
    /composite id .* is invalid or exceeds 64 characters/,
  );
});

// --- 010-01: entry-level goal/deadline (ADR-0011 + ADR-0009 D2 composed) ---

test('entries: an entry-declared goal/deadline threads verbatim onto the expanded project profile (AC3)', () => {
  const config = normalizeConfig({
    version: 1,
    projects: [{
      id: 'umbrella', path: '/tmp/umbrella', adapters: ['jig'],
      profile: {
        entries: [{
          id: 'a', label: 'A', artifactRoot: 'tracks/a',
          goal: { value: 'Ship track A', provenance: 'product-vision' },
          deadline: { value: '2026-09-01', provenance: 'release' },
        }],
      },
    }],
  }, '/tmp/gauge.config.json');
  assert.deepEqual(config.projects[0].profile.goal, { value: 'Ship track A', provenance: 'product-vision' });
  assert.deepEqual(config.projects[0].profile.deadline, { value: '2026-09-01', provenance: 'release' });
});

test('entries: an entry with no goal/deadline inherits the parent profile\'s goal/deadline (AC3)', () => {
  const config = normalizeConfig({
    version: 1,
    projects: [{
      id: 'umbrella', path: '/tmp/umbrella', adapters: ['jig'],
      profile: {
        goal: { value: 'Ship the umbrella', provenance: 'product-vision' },
        deadline: { value: '2026-10-01', provenance: 'release' },
        entries: [
          { id: 'a', label: 'A', artifactRoot: 'tracks/a' },
          {
            id: 'b', label: 'B', artifactRoot: 'tracks/b',
            goal: { value: 'Ship track B', provenance: 'user' },
            deadline: { value: '2026-11-01', provenance: 'user' },
          },
        ],
      },
    }],
  }, '/tmp/gauge.config.json');
  const [a, b] = config.projects;
  // No per-entry override: falls back to the parent profile's goal/deadline.
  assert.deepEqual(a.profile.goal, { value: 'Ship the umbrella', provenance: 'product-vision' });
  assert.deepEqual(a.profile.deadline, { value: '2026-10-01', provenance: 'release' });
  // Per-entry override wins over the parent profile's value.
  assert.deepEqual(b.profile.goal, { value: 'Ship track B', provenance: 'user' });
  assert.deepEqual(b.profile.deadline, { value: '2026-11-01', provenance: 'user' });
});

test('entries: neither entry nor parent declares goal/deadline — no own-property, byte-identical to pre-010 (AC3/AC5)', () => {
  const config = normalizeConfig({
    version: 1,
    projects: [{
      id: 'umbrella', path: '/tmp/umbrella', adapters: ['jig'],
      profile: {
        entries: [{ id: 'a', label: 'A', artifactRoot: 'tracks/a' }],
      },
    }],
  }, '/tmp/gauge.config.json');
  assert.deepEqual(config.projects[0].profile, {
    artifactRoot: path.join('/tmp/umbrella', 'tracks', 'a'),
    specsDir: 'specs', decisionsDir: 'decisions', statusProperty: 'status', specLayout: 'nested',
  });
  assert.ok(!('goal' in config.projects[0].profile));
  assert.ok(!('deadline' in config.projects[0].profile));
});

test('entries: an entry-declared deadline "unknown" threads verbatim, never coerced (AC3)', () => {
  const config = normalizeConfig({
    version: 1,
    projects: [{
      id: 'umbrella', path: '/tmp/umbrella', adapters: ['jig'],
      profile: {
        deadline: { value: '2026-10-01', provenance: 'release' },
        entries: [{
          id: 'a', label: 'A', artifactRoot: 'tracks/a',
          deadline: { value: 'unknown', provenance: 'user' },
        }],
      },
    }],
  }, '/tmp/gauge.config.json');
  assert.deepEqual(config.projects[0].profile.deadline, { value: 'unknown', provenance: 'user' });
});

test('entries: a malformed entry-level goal/deadline is rejected with one actionable error (AC2)', () => {
  const cases = [
    ['entry goal missing provenance', { entries: [{ id: 'a', label: 'A', artifactRoot: 'tracks/a', goal: { value: 'Ship it' } }] }],
    ['entry deadline bad value', { entries: [{ id: 'a', label: 'A', artifactRoot: 'tracks/a', deadline: { value: 'soonish', provenance: 'release' } }] }],
  ];
  for (const [name, profile] of cases) {
    assert.throws(
      () => normalizeConfig({
        version: 1,
        projects: [{ id: 'umbrella', path: '/tmp/umbrella', adapters: ['jig'], profile }],
      }, '/tmp/gauge.config.json'),
      /invalid configuration: project umbrella profile:/,
      name,
    );
  }
});

test('entries: a composite id colliding with another project id is rejected', () => {
  assert.throws(
    () => normalizeConfig({
      version: 1,
      projects: [
        { id: 'umbrella-rtb', path: '/tmp/other', adapters: ['jig'] },
        {
          id: 'umbrella', path: '/tmp/umbrella', adapters: ['jig'],
          profile: { entries: [{ id: 'rtb', label: 'RTB', artifactRoot: 'tracks/rtb' }] },
        },
      ],
    }, '/tmp/gauge.config.json'),
    /duplicate project id: umbrella-rtb/,
  );
});

test('configuration rejects malformed public fields before observation', () => {
  const valid = {
    version: 1,
    port: 5111,
    projects: [{
      id: 'alpha', label: 'Alpha', path: '/tmp/alpha', adapters: ['jig'],
      signalPolicies: { execution: 'jig' },
      pinnedWorkstreams: ['docs/runbook.md'], hiddenWorkstreams: [],
    }],
  };
  const cases = [
    ['numeric project id', (value) => { value.projects[0].id = 42; }],
    ['numeric label', (value) => { value.projects[0].label = 42; }],
    ['empty label', (value) => { value.projects[0].label = ''; }],
    ['adapters not array', (value) => { value.projects[0].adapters = 'jig'; }],
    ['numeric adapter', (value) => { value.projects[0].adapters = [42]; }],
    ['invalid adapter id', (value) => { value.projects[0].adapters = ['../jig']; }],
    ['signal policies not object', (value) => { value.projects[0].signalPolicies = []; }],
    ['numeric policy', (value) => { value.projects[0].signalPolicies = { execution: 42 }; }],
    ['zero port', (value) => { value.port = 0; }],
    ['oversize port', (value) => { value.port = 65536; }],
    ['string port', (value) => { value.port = '5111'; }],
    ['pins not array', (value) => { value.projects[0].pinnedWorkstreams = 'docs/x.md'; }],
    ['numeric pin', (value) => { value.projects[0].pinnedWorkstreams = [42]; }],
    ['hidden not array', (value) => { value.projects[0].hiddenWorkstreams = {}; }],
  ];
  for (const [name, mutate] of cases) {
    const malformed = structuredClone(valid);
    mutate(malformed);
    assert.throws(
      () => normalizeConfig(malformed, '/tmp/gauge.config.json'),
      /invalid configuration:/,
      name,
    );
  }
});
