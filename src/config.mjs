import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateProfile, PROFILE_DEFAULTS } from './profile.mjs';

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ADAPTER_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

function configError(message) {
  throw new Error(`invalid configuration: ${message}`);
}

function stringArray(value, name, fallback = []) {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !entry.trim())) {
    configError(`${name} must be an array of non-empty strings`);
  }
  return [...value];
}

function policiesOf(value, projectName) {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    configError(`project ${projectName} signalPolicies must be an object`);
  }
  for (const [capability, policy] of Object.entries(value)) {
    if (!capability || typeof policy !== 'string' || !policy.trim()) {
      configError(`project ${projectName} signalPolicies values must be non-empty strings`);
    }
  }
  return { ...value };
}

export function expandHome(value) {
  return value.startsWith('~') ? path.join(os.homedir(), value.slice(1)) : value;
}

export function safeProjectId(value) {
  const id = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!id) throw new Error('cannot derive a safe project id; add an explicit id');
  if (!ID_PATTERN.test(id)) throw new Error(`derived project id is invalid or too long: ${id}`);
  return id;
}

function resolveFrom(base, value) {
  const expanded = expandHome(value);
  return path.resolve(base, expanded);
}

// Project-shape profile (ADR-0009, spec 007-01, config-inline home only).
// A malformed profile is rejected with one actionable error, mirroring the
// existing configError style. A project with no `profile` normalizes to
// exactly the same defaults a project could declare explicitly (AC2/AC3).
function resolvedSingleProfile(merged, projectRoot) {
  return {
    artifactRoot: resolveFrom(projectRoot, merged.artifactRoot),
    specsDir: merged.specsDir,
    decisionsDir: merged.decisionsDir,
    statusProperty: merged.statusProperty,
  };
}

// No-entries case: a profile behaves exactly as 007-01 (single entry).
function profileOf(value, projectName, projectRoot) {
  const merged = { ...PROFILE_DEFAULTS, ...(value || {}) };
  return resolvedSingleProfile(merged, projectRoot);
}

// Composite id `<baseId>-<entryId>` (ADR-0009 D2, spec 007-02): must stay
// within the project id pattern and its 64-char cap.
function compositeId(baseId, entryId, projectName) {
  const id = `${baseId}-${entryId}`;
  if (id.length > 64 || !ID_PATTERN.test(id)) {
    configError(`project ${projectName} entry ${entryId} composite id "${id}" is invalid or exceeds 64 characters`);
  }
  return id;
}

// Multi-entry decomposition (ADR-0009 D2, spec 007-02, "Pattern C"): one
// config project whose profile declares `entries` expands into N normalized
// projects sharing the same umbrella repository path (a shared repository/git
// signal, per D3) but each carrying its own single-entry, artifactRoot-scoped
// profile. observation.mjs/state.mjs see only ordinary single-entry projects
// afterward — no change required there.
function expandEntries(project, id, resolvedPath, adapters, signalPolicies, pinnedWorkstreams, hiddenWorkstreams, seen) {
  const profileValue = project.profile;
  const seenEntryIds = new Set();
  return profileValue.entries.map((entry) => {
    if (seenEntryIds.has(entry.id)) configError(`project ${id} duplicate entry id: ${entry.id}`);
    seenEntryIds.add(entry.id);
    const composite = compositeId(id, entry.id, id);
    if (seen.has(composite)) configError(`duplicate project id: ${composite}; add unique explicit ids`);
    seen.add(composite);
    const merged = {
      artifactRoot: entry.artifactRoot,
      specsDir: entry.specsDir || profileValue.specsDir || PROFILE_DEFAULTS.specsDir,
      decisionsDir: entry.decisionsDir || profileValue.decisionsDir || PROFILE_DEFAULTS.decisionsDir,
      statusProperty: entry.statusProperty || profileValue.statusProperty || PROFILE_DEFAULTS.statusProperty,
    };
    return {
      id: composite,
      label: entry.label,
      path: resolvedPath,
      adapters,
      signalPolicies,
      pinnedWorkstreams,
      hiddenWorkstreams,
      profile: resolvedSingleProfile(merged, resolvedPath),
    };
  });
}

export function normalizeConfig(input, configPath) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) configError('root must be an object');
  const base = path.dirname(path.resolve(configPath));
  const legacy = path.basename(configPath) === 'dashboard.config.json';
  if (!legacy && input.version !== 1) {
    configError(`unsupported Gauge config version: ${input.version}`);
  }
  if (input.port !== undefined && (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535)) {
    configError('port must be an integer from 1 through 65535');
  }
  if (input.stateDir !== undefined && (typeof input.stateDir !== 'string' || !input.stateDir.trim())) {
    configError('stateDir must be a non-empty string');
  }
  if (!Array.isArray(input.projects)) configError('projects must be an array');

  const seen = new Set();
  const projects = input.projects.flatMap((project, index) => {
    if (!project || typeof project !== 'object' || Array.isArray(project)) {
      configError(`project at index ${index} must be an object`);
    }
    if (!project || typeof project.path !== 'string' || !project.path.trim()) {
      configError(`project at index ${index} requires a non-empty path`);
    }
    if (project.label !== undefined && (typeof project.label !== 'string' || !project.label.trim())) {
      configError(`project at index ${index} label must be a non-empty string`);
    }
    let id;
    if (project.id !== undefined) {
      if (typeof project.id !== 'string' || !project.id) {
        configError(`project at index ${index} id must be a non-empty string`);
      }
      id = project.id;
      if (!ID_PATTERN.test(id)) configError(`invalid project id: ${id}`);
    } else {
      if (!legacy) configError(`project at index ${index} requires an explicit project id in gauge.config.json`);
      try {
        id = safeProjectId(project.label || path.basename(project.path));
      } catch (error) {
        configError(error.message);
      }
    }
    if (seen.has(id)) configError(`duplicate project id: ${id}; add unique explicit ids`);
    seen.add(id);
    const adapters = stringArray(project.adapters, `project ${id} adapters`, legacy ? ['jig'] : []);
    if (adapters.some((adapter) => !ADAPTER_ID_PATTERN.test(adapter))) {
      configError(`project ${id} adapters must use lowercase slug ids`);
    }
    const resolvedPath = resolveFrom(base, project.path);
    const signalPolicies = policiesOf(project.signalPolicies, id);
    const pinnedWorkstreams = stringArray(project.pinnedWorkstreams, `project ${id} pinnedWorkstreams`);
    const hiddenWorkstreams = stringArray(project.hiddenWorkstreams, `project ${id} hiddenWorkstreams`);

    // Project-shape profile (ADR-0009). A malformed profile is rejected with
    // one actionable error before any expansion decision is made.
    const profileErrors = validateProfile(project.profile);
    if (profileErrors.length) configError(`project ${id} profile: ${profileErrors.join('; ')}`);

    // Multi-entry decomposition (ADR-0009 D2, spec 007-02): one config
    // project whose profile declares `entries` expands into N normalized
    // projects here, at config-normalization time — the lowest-blast-radius
    // seam, since observation.mjs/state.mjs downstream see only ordinary
    // single-entry projects either way (AC1).
    if (project.profile && Array.isArray(project.profile.entries)) {
      return expandEntries(project, id, resolvedPath, adapters, signalPolicies, pinnedWorkstreams, hiddenWorkstreams, seen);
    }

    // No-entries case normalizes exactly as 007-01 (single-entry identity, AC1).
    return [{
      id,
      label: project.label || path.basename(project.path),
      path: resolvedPath,
      adapters,
      signalPolicies,
      pinnedWorkstreams,
      hiddenWorkstreams,
      profile: profileOf(project.profile, id, resolvedPath),
    }];
  });

  return {
    version: 1,
    port: input.port,
    stateDir: resolveFrom(base, input.stateDir || '.gauge'),
    projects,
    warnings: legacy
      ? ['Legacy dashboard.config.json loaded; migrate to version 1 gauge.config.json with explicit project ids and stateDir.']
      : [],
    configPath: path.resolve(configPath),
  };
}

export function loadConfig(configPath) {
  const raw = fs.readFileSync(configPath, 'utf8');
  return normalizeConfig(JSON.parse(raw), configPath);
}

export function resolveConfigPath(root, explicit) {
  if (explicit) return expandHome(explicit);
  const canonical = path.join(root, 'gauge.config.json');
  if (fs.existsSync(canonical)) return canonical;
  const legacy = path.join(root, 'dashboard.config.json');
  return fs.existsSync(legacy) ? legacy : canonical;
}
