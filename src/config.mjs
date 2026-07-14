import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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
  const projects = input.projects.map((project, index) => {
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
    return {
      id,
      label: project.label || path.basename(project.path),
      path: resolveFrom(base, project.path),
      adapters,
      signalPolicies: policiesOf(project.signalPolicies, id),
      pinnedWorkstreams: stringArray(project.pinnedWorkstreams, `project ${id} pinnedWorkstreams`),
      hiddenWorkstreams: stringArray(project.hiddenWorkstreams, `project ${id} hiddenWorkstreams`),
    };
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
