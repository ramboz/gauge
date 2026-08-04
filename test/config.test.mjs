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
    });
    assert.deepEqual(explicitDefaults.profile, {
      artifactRoot: path.join(dir, 'sources', 'explicit-defaults', 'docs'),
      specsDir: 'specs',
      decisionsDir: 'decisions',
      statusProperty: 'status',
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

test('malformed project profile is rejected with one actionable error (007-01 AC2)', () => {
  const cases = [
    ['profile not an object', { profile: 'docs' }],
    ['profile is an array', { profile: ['docs'] }],
    ['numeric artifactRoot', { profile: { artifactRoot: 42 } }],
    ['empty artifactRoot', { profile: { artifactRoot: '' } }],
    ['numeric specsDir', { profile: { specsDir: 0 } }],
    ['whitespace decisionsDir', { profile: { decisionsDir: '   ' } }],
    ['numeric statusProperty', { profile: { statusProperty: false } }],
    ['unknown profile field', { profile: { entries: [] } }],
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
