import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { gitInfo, scanProject as scanJigProject } from './scan.mjs';
import { gitFreshness, hasDeliveryStatus } from './lib.mjs';

const OBSERVATION_SCHEMA = JSON.parse(
  fs.readFileSync(new URL('../schemas/observation-v1.schema.json', import.meta.url), 'utf8'),
);
const CAPABILITIES = ['repository', 'execution', 'workstreams', 'hygiene', 'narrative'];
const MERGEABLE = new Set(['workstreams', 'hygiene']);
const SIGNAL_STATUS = new Set(OBSERVATION_SCHEMA.properties.signals.items.properties.status.enum);
const FRESHNESS = new Set(OBSERVATION_SCHEMA.$defs.freshness.properties.state.enum);
const ADAPTER_STATUS = new Set(
  OBSERVATION_SCHEMA.properties.provenance.properties.adapters.items.properties.status.enum,
);
const COLLECTION_STATUS = new Set(OBSERVATION_SCHEMA.properties.collection.properties.status.enum);
const UUID_V4 = new RegExp(OBSERVATION_SCHEMA.properties.recordId.pattern);
const PROJECT_ID = new RegExp(OBSERVATION_SCHEMA.properties.project.properties.id.pattern);
const RFC3339 = new RegExp(OBSERVATION_SCHEMA.properties.collectedAt.pattern);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRfc3339(value) {
  return typeof value === 'string' && RFC3339.test(value);
}

function freshness(state, reason) {
  return { state, ...(reason ? { reason } : {}) };
}

function sourceProvenance(adapterId, collectedAt, sourceRevision = null, sourceTimestamp = null) {
  return { adapterId, collectedAt, sourceRevision, sourceTimestamp };
}

function normalizeFreshness(value, status) {
  if (isObject(value) && FRESHNESS.has(value.state)) {
    if (value.state === 'fresh') return { state: 'fresh' };
    return freshness(value.state, value.reason || `${status}-signal`);
  }
  return status === 'supported'
    ? freshness('fresh')
    : freshness(status === 'error' ? 'error' : 'unknown', `${status}-signal`);
}

function freshnessRank(value) {
  return { fresh: 0, unknown: 1, stale: 2, error: 3 }[value.state] ?? 3;
}

function aggregateFreshness(values, fallbackReason) {
  const worst = values.reduce((current, value) => freshnessRank(value) > freshnessRank(current) ? value : current, freshness('fresh'));
  return worst.state === 'fresh' ? worst : freshness(worst.state, worst.reason || fallbackReason || 'degraded-input');
}

function normalizeContribution(adapterId, raw, collectedAt) {
  const status = SIGNAL_STATUS.has(raw?.status) ? raw.status : 'error';
  const type = String(raw?.type || 'unknown');
  const provenance = sourceProvenance(
    adapterId,
    collectedAt,
    raw?.sourceRevision ?? null,
    raw?.sourceTimestamp ?? null,
  );
  const normalizedFreshness = normalizeFreshness(raw?.freshness, status);
  const id = String(raw?.id || `${adapterId}:${type}`);
  return {
    adapterId,
    id,
    type,
    version: Number.isInteger(raw?.version) && raw.version > 0 ? raw.version : 1,
    status,
    freshness: normalizedFreshness,
    provenance,
    strategy: raw?.strategy,
    ...(status === 'supported' ? { value: raw?.value } : {}),
  };
}

function candidateOf(contribution) {
  return {
    adapterId: contribution.adapterId,
    id: contribution.id,
    version: contribution.version,
    value: contribution.value,
    freshness: contribution.freshness,
    provenance: contribution.provenance,
    ...(contribution.strategy ? { strategy: contribution.strategy } : {}),
  };
}

function emptySignal(type, collectedAt, status = 'unsupported', reason = 'adapter-not-enabled') {
  return {
    type,
    version: 1,
    status,
    candidates: [],
    resolution: { strategy: 'none', reason },
    freshness: freshness(status === 'error' ? 'error' : 'unknown', reason),
    provenance: sourceProvenance('gauge-core', collectedAt),
  };
}

function unsupportedContributions(adapterId, collectedAt, reason) {
  return CAPABILITIES.slice(1).map((type) => normalizeContribution(adapterId, {
    type,
    status: 'unsupported',
    freshness: freshness('unknown', reason),
  }, collectedAt));
}

function errorContributions(adapterId, collectedAt, reason) {
  return CAPABILITIES.slice(1).map((type) => normalizeContribution(adapterId, {
    type,
    status: 'error',
    freshness: freshness('error', reason),
  }, collectedAt));
}

function runJigAdapter(project, { collectedAt }) {
  const scanned = scanJigProject(project);
  if (scanned.error) throw new Error(scanned.error);
  if (!scanned.jigManaged) {
    return {
      status: 'unsupported',
      signals: unsupportedContributions('jig', collectedAt, 'jig-artifacts-absent'),
      errors: [],
    };
  }
  const sourceRevision = scanned.git?.revision || null;
  // Signal freshness reflects source recency (ADR-0006 evidence), not a hardcoded
  // assertion: a repository quiet past the threshold reads stale, absent git
  // metadata reads unknown. Derived once from the scanned repository head.
  const jigFreshness = gitFreshness(scanned.git?.lastCommit, collectedAt);
  // Completion is vocabulary-gated at ROOT granularity (ADR-0010 sub-decision 3):
  //  - no specs at the conventional root → unknown (insufficient evidence);
  //  - specs exist AND ≥1 resolves a recognized delivery status → supported,
  //    rolled up by progressOf exactly as today (byte-identical jig cards);
  //  - specs exist but NONE resolve a recognized delivery status → unknown, never
  //    a fabricated 0/N (the real driver: superpowers' flat, prose-status docs).
  // In the last case the document count must reach the card ("N documents ·
  // completion unknown"). A `value` cannot carry it: normalizeContribution drops
  // the value of any non-supported signal. The minimal channel that survives
  // without expanding the observation contract is the freshness/resolution
  // reason string, which already embeds numbers elsewhere (gitFreshness'
  // `source-last-committed-63d-ago`). So the count travels in the reason.
  const executionSignal = !scanned.specs.length
    ? {
        // Jig-managed but no specs at the conventional docs/specs root — insufficient
        // evidence, never a coerced supported 0/0 (product-vision: unknown, not zero).
        type: 'execution', status: 'unknown',
        freshness: freshness('unknown', 'no-specs-at-conventional-root'),
      }
    : hasDeliveryStatus(scanned.specs)
      ? {
          type: 'execution', status: 'supported', strategy: 'jig-specs',
          value: {
            strategy: 'jig-specs', progress: scanned.progress, sliceProgress: scanned.sliceProgress,
            items: scanned.specs, counts: scanned.counts,
          },
          freshness: jigFreshness,
        }
      : {
          type: 'execution', status: 'unknown',
          freshness: freshness('unknown', `no-recognized-delivery-status-${scanned.specs.length}-documents`),
        };
  const signals = [
    executionSignal,
    {
      type: 'workstreams', status: 'supported',
      value: { items: scanned.workstreams, discovered: scanned.discovered },
      freshness: jigFreshness,
    },
    {
      type: 'hygiene', status: 'supported',
      value: { worktreeOnlyDocs: scanned.worktreeOnlyDocs, warnings: scanned.warnings },
      freshness: jigFreshness,
    },
  ];
  // The legacy Compass narrative is a retired, optional source. Contribute it
  // only when a Compass history file is actually present; its absence is the
  // normal case for a modern jig project and must not degrade adapter freshness
  // (which would otherwise force every such project to `partial`). With no
  // contribution, narrative resolves to a non-degrading unsupported signal.
  if (scanned.compass) {
    signals.push({
      type: 'narrative', status: 'supported', value: scanned.compass,
      sourceTimestamp: scanned.compass.ts,
      freshness: scanned.compass.stale
        ? freshness('stale', 'legacy-compass-older-than-seven-days')
        : freshness('fresh'),
    });
  }
  return {
    status: 'ok',
    sourceRevision,
    signals: signals.map((entry) => ({ ...entry, sourceRevision })),
    errors: (scanned.warnings || []).map((message) => ({
      code: 'malformed-legacy-compass', message, adapterId: 'jig',
    })),
    extensions: { managed: true },
  };
}

export const DEFAULT_ADAPTER_REGISTRY = Object.freeze({ jig: runJigAdapter });

function deriveAdapterFreshness(contributions, errors, status) {
  if (status === 'error') return freshness('error', 'adapter-failed');
  if (status === 'unsupported') return freshness('unknown', 'adapter-unsupported');
  if (errors.length) return freshness('unknown', 'adapter-reported-errors');
  const inputs = contributions.map((entry) => {
    if (entry.status === 'error') return freshness('error', entry.freshness.reason || 'signal-error');
    if (entry.status !== 'supported') return freshness('unknown', entry.freshness.reason || `signal-${entry.status}`);
    return entry.freshness;
  });
  return aggregateFreshness(inputs, 'adapter-signal-degraded');
}

function adapterContractError(message) {
  throw new Error(`invalid adapter result: ${message}`);
}

function validateJsonSafe(value, name, errors, active = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) errors.push(`${name} contains a non-finite number`);
    return;
  }
  if (typeof value === 'undefined' || typeof value === 'bigint'
      || typeof value === 'function' || typeof value === 'symbol') {
    errors.push(`${name} contains non-JSON value ${typeof value}`);
    return;
  }
  if (active.has(value)) {
    errors.push(`${name} contains a cycle`);
    return;
  }
  if (!Array.isArray(value)) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      errors.push(`${name} contains a non-plain object`);
      return;
    }
  }
  active.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) errors.push(`${name}[${index}] is an array hole`);
      else validateJsonSafe(value[index], `${name}[${index}]`, errors, active);
    }
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key === 'symbol') {
      errors.push(`${name} contains a symbol key`);
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (key === 'toJSON') {
      errors.push(`${name} contains an own toJSON property`);
      continue;
    }
    if (!descriptor?.enumerable || (Array.isArray(value) && /^\d+$/.test(key))) continue;
    if (!Object.hasOwn(descriptor, 'value')) {
      errors.push(`${name}.${key} contains an accessor`);
      continue;
    }
    validateJsonSafe(descriptor.value, `${name}.${key}`, errors, active);
  }
  active.delete(value);
}

function validateProgressValue(value, name, errors) {
  if (!isObject(value)) {
    errors.push(`${name} must be a progress object`);
    return;
  }
  for (const field of ['done', 'total', 'abandoned', 'deferred', 'denom']) {
    if (!Number.isInteger(value[field]) || value[field] < 0) errors.push(`${name}.${field} is invalid`);
  }
  if (value.pct !== null
      && (!Number.isInteger(value.pct) || value.pct < 0 || value.pct > 100)) {
    errors.push(`${name}.pct is invalid`);
  }
  if (!isObject(value.by)
      || Object.values(value.by).some((count) => !Number.isInteger(count) || count < 0)) {
    errors.push(`${name}.by is invalid`);
  }
}

function validateRepositoryValue(value, name, errors) {
  if (!isObject(value) || !Object.hasOwn(value, 'git')) {
    errors.push(`${name} must contain git`);
    return;
  }
  if (value.git === null) return;
  if (!isObject(value.git)) {
    errors.push(`${name}.git must be an object or null`);
    return;
  }
  if (typeof value.git.revision !== 'string' || !value.git.revision) errors.push(`${name}.git.revision is invalid`);
  for (const field of ['firstCommit', 'lastCommit']) {
    if (typeof value.git[field] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.git[field])) {
      errors.push(`${name}.git.${field} is invalid`);
    }
  }
  if (!Number.isInteger(value.git.commits) || value.git.commits < 0) errors.push(`${name}.git.commits is invalid`);
}

function validateExecutionValue(value, name, errors) {
  if (!isObject(value)) {
    errors.push(`${name} must be an execution object`);
    return;
  }
  if (typeof value.strategy !== 'string' || !value.strategy) errors.push(`${name}.strategy is invalid`);
  validateProgressValue(value.progress, `${name}.progress`, errors);
  if (value.sliceProgress !== undefined && value.sliceProgress !== null) {
    validateProgressValue(value.sliceProgress, `${name}.sliceProgress`, errors);
  }
  if (!Array.isArray(value.items) || value.items.some((item) => !isObject(item))) errors.push(`${name}.items is invalid`);
  if (!isObject(value.counts)) errors.push(`${name}.counts is invalid`);
}

function validateWorkstreamsValue(value, name, errors) {
  if (!isObject(value)
      || !Array.isArray(value.items) || value.items.some((item) => !isObject(item))
      || !Array.isArray(value.discovered) || value.discovered.some((item) => !isObject(item))) {
    errors.push(`${name} must contain object arrays items and discovered`);
  }
}

function validateHygieneValue(value, name, errors) {
  if (!isObject(value)
      || !Array.isArray(value.worktreeOnlyDocs)
      || value.worktreeOnlyDocs.some((item) => !isObject(item))
      || !Array.isArray(value.warnings)
      || value.warnings.some((warning) => typeof warning !== 'string'
        && (!isObject(warning) || typeof warning.message !== 'string' || !warning.message))) {
    errors.push(`${name} must contain worktreeOnlyDocs and warnings arrays`);
  }
}

function validateNarrativeValue(value, name, errors) {
  if (!isObject(value)) {
    errors.push(`${name} must be a narrative object`);
    return;
  }
  if (typeof value.headline !== 'string') errors.push(`${name}.headline is invalid`);
  if (value.next !== undefined && value.next !== null && typeof value.next !== 'string') errors.push(`${name}.next is invalid`);
  if (value.blockers !== undefined
      && (!Array.isArray(value.blockers) || value.blockers.some((item) => typeof item !== 'string'))) {
    errors.push(`${name}.blockers is invalid`);
  }
  if (value.ts !== undefined) validateNullableTimestamp(value.ts, `${name}.ts`, errors);
  if (value.ageLabel !== undefined && value.ageLabel !== null && typeof value.ageLabel !== 'string') errors.push(`${name}.ageLabel is invalid`);
  if (value.ageDays !== undefined && value.ageDays !== null
      && (typeof value.ageDays !== 'number' || !Number.isFinite(value.ageDays))) errors.push(`${name}.ageDays is invalid`);
  if (value.stale !== undefined && typeof value.stale !== 'boolean') errors.push(`${name}.stale is invalid`);
}

const CAPABILITY_VALUE_VALIDATORS = {
  repository: validateRepositoryValue,
  execution: validateExecutionValue,
  workstreams: validateWorkstreamsValue,
  hygiene: validateHygieneValue,
  narrative: validateNarrativeValue,
};

function validateCapabilityValue(type, version, value, name, errors) {
  if (version === 1) CAPABILITY_VALUE_VALIDATORS[type]?.(value, name, errors);
}

function validateRawFreshness(value, name) {
  if (!isObject(value) || !FRESHNESS.has(value.state)) adapterContractError(`${name} freshness is invalid`);
  if (value.state !== 'fresh' && (typeof value.reason !== 'string' || !value.reason)) {
    adapterContractError(`${name} freshness reason is required`);
  }
}

function validateRawAdapterResult(result) {
  if (!isObject(result)) adapterContractError('result must be an object');
  if (!ADAPTER_STATUS.has(result.status)) adapterContractError('status is invalid');
  if (!Array.isArray(result.signals)) adapterContractError('signals must be an array');
  if (!Array.isArray(result.errors)) adapterContractError('errors must be an array');
  if (result.sourceRevision !== undefined && result.sourceRevision !== null
      && typeof result.sourceRevision !== 'string') {
    adapterContractError('sourceRevision must be a string or null');
  }
  if (result.sourceTimestamp !== undefined && result.sourceTimestamp !== null
      && !isRfc3339(result.sourceTimestamp)) {
    adapterContractError('sourceTimestamp must be an RFC3339 date-time or null');
  }
  if (result.extensions !== undefined && !isObject(result.extensions)) {
    adapterContractError('extensions must be an object');
  }
  const jsonErrors = [];
  if (result.extensions !== undefined) validateJsonSafe(result.extensions, 'extensions', jsonErrors);
  validateJsonSafe(result.errors, 'errors', jsonErrors);
  for (const [index, contribution] of result.signals.entries()) {
    const name = `signal ${index}`;
    if (!isObject(contribution)) adapterContractError(`${name} must be an object`);
    if (typeof contribution.type !== 'string' || !contribution.type) adapterContractError(`${name} type is required`);
    if (!SIGNAL_STATUS.has(contribution.status)) adapterContractError(`${name} status is invalid`);
    if (contribution.version !== undefined
        && (!Number.isInteger(contribution.version) || contribution.version < 1)) {
      adapterContractError(`${name} version is invalid`);
    }
    if (contribution.id !== undefined
        && (typeof contribution.id !== 'string' || !contribution.id)) {
      adapterContractError(`${name} id is invalid`);
    }
    if (contribution.strategy !== undefined
        && (typeof contribution.strategy !== 'string' || !contribution.strategy)) {
      adapterContractError(`${name} strategy is invalid`);
    }
    if (contribution.status === 'supported'
        && (!Object.hasOwn(contribution, 'value') || contribution.value === undefined)) {
      adapterContractError(`${name} supported value is required`);
    }
    if (contribution.status === 'supported') {
      const valueErrors = [];
      const version = contribution.version ?? 1;
      validateCapabilityValue(contribution.type, version, contribution.value, `${name} value`, valueErrors);
      validateJsonSafe(contribution.value, `${name} value`, valueErrors);
      if (valueErrors.length) adapterContractError(valueErrors.join('; '));
    }
    if (contribution.sourceRevision !== undefined && contribution.sourceRevision !== null
        && typeof contribution.sourceRevision !== 'string') {
      adapterContractError(`${name} sourceRevision must be a string or null`);
    }
    if (contribution.sourceTimestamp !== undefined && contribution.sourceTimestamp !== null
        && !isRfc3339(contribution.sourceTimestamp)) {
      adapterContractError(`${name} sourceTimestamp must be an RFC3339 date-time or null`);
    }
    validateRawFreshness(contribution.freshness, name);
  }
  for (const [index, error] of result.errors.entries()) {
    if (!isObject(error) || typeof error.code !== 'string' || !error.code
        || typeof error.message !== 'string' || !error.message
        || (error.adapterId !== undefined
          && (typeof error.adapterId !== 'string' || !error.adapterId))) {
      adapterContractError(`error ${index} requires non-empty code and message`);
    }
  }
  if (jsonErrors.length) adapterContractError(jsonErrors.join('; '));
}

function caughtMessage(error) {
  let message;
  try { message = String(error instanceof Error ? error.message ?? '' : error ?? ''); } catch { message = ''; }
  return message.trim() || 'adapter threw a non-Error value';
}

function executeAdapter(adapterId, adapter, project, collectedAt) {
  if (typeof adapter !== 'function') {
    const contributions = unsupportedContributions(adapterId, collectedAt, 'adapter-not-installed');
    return {
      contributions,
      errors: [],
      extensions: undefined,
      provenance: {
        id: adapterId, status: 'unsupported', collectedAt, sourceRevision: null, sourceTimestamp: null,
        freshness: freshness('unknown', 'adapter-not-installed'),
      },
    };
  }
  try {
    const result = adapter(project, { collectedAt }) || {};
    validateRawAdapterResult(result);
    const status = ADAPTER_STATUS.has(result.status) ? result.status : 'ok';
    const contributions = (result.signals || []).map((entry) => normalizeContribution(adapterId, entry, collectedAt));
    const errors = (result.errors || []).map((entry) => ({ ...entry, adapterId: entry.adapterId || adapterId }));
    const derived = deriveAdapterFreshness(contributions, errors, status);
    return {
      contributions,
      errors,
      extensions: result.extensions,
      provenance: {
        id: adapterId,
        status,
        collectedAt,
        sourceRevision: result.sourceRevision ?? null,
        sourceTimestamp: result.sourceTimestamp ?? null,
        freshness: derived,
      },
    };
  } catch (error) {
    const message = caughtMessage(error);
    return {
      contributions: errorContributions(adapterId, collectedAt, 'adapter-failed'),
      errors: [{ code: 'adapter-failed', message, adapterId }],
      extensions: undefined,
      provenance: {
        id: adapterId, status: 'error', collectedAt, sourceRevision: null, sourceTimestamp: null,
        freshness: freshness('error', 'adapter-failed'),
      },
    };
  }
}

function statusWithoutSupported(contributions) {
  if (contributions.some((entry) => entry.status === 'error')) return 'error';
  if (contributions.some((entry) => entry.status === 'unknown')) return 'unknown';
  return 'unsupported';
}

function stableEntryId(entry, index) {
  return String(entry?.id || entry?.path || entry?.title || index);
}

function contributedEntries(contribution, entries) {
  return (entries || []).map((entry, index) => {
    const entryId = stableEntryId(entry, index);
    return {
      ...entry,
      contributor: { adapterId: contribution.adapterId, entryId },
    };
  });
}

function sortContributed(entries) {
  return entries.sort((left, right) =>
    left.contributor.adapterId.localeCompare(right.contributor.adapterId)
      || left.contributor.entryId.localeCompare(right.contributor.entryId));
}

function mergeValue(type, contributions) {
  if (type === 'workstreams') {
    return {
      items: sortContributed(contributions.flatMap((entry) => contributedEntries(entry, entry.value?.items))),
      discovered: sortContributed(contributions.flatMap((entry) => contributedEntries(entry, entry.value?.discovered))),
    };
  }
  if (type === 'hygiene') {
    const warnings = contributions.flatMap((entry) => (entry.value?.warnings || []).map((warning, index) => {
      const message = typeof warning === 'string' ? warning : warning?.message;
      if (typeof message !== 'string' || !message) return null;
      return {
        message,
        contributor: { adapterId: entry.adapterId, entryId: stableEntryId(warning, index) },
      };
    }).filter(Boolean));
    return {
      worktreeOnlyDocs: sortContributed(contributions.flatMap((entry) => contributedEntries(entry, entry.value?.worktreeOnlyDocs))),
      warnings: sortContributed(warnings),
    };
  }
  return contributions.map((entry) => ({ adapterId: entry.adapterId, value: entry.value }));
}

function composeSignal(type, contributions, policy, collectedAt) {
  if (!contributions.length) return emptySignal(type, collectedAt);
  const ordered = [...contributions].sort((left, right) => left.adapterId.localeCompare(right.adapterId) || left.id.localeCompare(right.id));
  const supported = ordered.filter((entry) => entry.status === 'supported');
  const candidates = supported.map(candidateOf);
  const supportedVersions = new Set(supported.map((entry) => entry.version));
  if (supportedVersions.size > 1) {
    const reason = 'incompatible-capability-versions';
    return {
      type,
      version: Math.max(...supportedVersions),
      status: 'unknown',
      candidates,
      resolution: { strategy: 'version-compatible-candidates-only', reason },
      freshness: freshness('unknown', reason),
      provenance: sourceProvenance('gauge-core', collectedAt),
    };
  }
  if (MERGEABLE.has(type) && supported.length) {
    const mergedFreshness = aggregateFreshness(supported.map((entry) => entry.freshness), 'merged-signal-degraded');
    return {
      type,
      version: Math.max(...supported.map((entry) => entry.version)),
      status: 'supported',
      candidates,
      resolution: {
        strategy: 'merge-by-adapter-and-id',
        contributors: candidates.map((candidate) => candidate.id),
      },
      freshness: mergedFreshness,
      provenance: sourceProvenance('gauge-core', collectedAt),
      value: mergeValue(type, supported),
    };
  }
  if (supported.length === 1) {
    const selected = supported[0];
    return {
      type,
      version: selected.version,
      status: 'supported',
      candidates,
      resolution: { strategy: selected.strategy || 'single-supported-candidate', selected: selected.id },
      freshness: selected.freshness,
      provenance: selected.provenance,
      value: selected.value,
    };
  }
  if (supported.length > 1) {
    const matches = policy
      ? supported.filter((entry) => entry.adapterId === policy || entry.id === policy || entry.strategy === policy)
      : [];
    if (matches.length === 1) {
      const selected = matches[0];
      return {
        type,
        version: selected.version,
        status: 'supported',
        candidates,
        resolution: { strategy: `policy:${policy}`, selected: selected.id },
        freshness: selected.freshness,
        provenance: selected.provenance,
        value: selected.value,
      };
    }
    const reason = policy
      ? matches.length > 1 ? 'ambiguous-signal-policy' : 'policy-not-found'
      : 'ambiguous-signal-source';
    return {
      type,
      version: Math.max(...supported.map((entry) => entry.version)),
      status: 'unknown',
      candidates,
      resolution: { strategy: policy ? `policy:${policy}` : 'explicit-policy-required', reason },
      freshness: freshness('unknown', reason),
      provenance: sourceProvenance('gauge-core', collectedAt),
    };
  }
  const status = statusWithoutSupported(ordered);
  const reason = ordered.find((entry) => entry.status === status)?.freshness.reason || `${type}-${status}`;
  return {
    type,
    version: Math.max(...ordered.map((entry) => entry.version)),
    status,
    candidates: [],
    resolution: { strategy: 'none', reason },
    freshness: aggregateFreshness(ordered.map((entry) => entry.freshness), reason),
    provenance: ordered[0].provenance,
  };
}

function composeSignals(contributions, policies, collectedAt) {
  const byType = new Map(CAPABILITIES.map((type) => [type, []]));
  for (const entry of contributions) {
    if (!byType.has(entry.type)) byType.set(entry.type, []);
    byType.get(entry.type).push(entry);
  }
  return [...byType.entries()]
    .map(([type, entries]) => composeSignal(type, entries, policies?.[type], collectedAt))
    .sort((left, right) => left.type.localeCompare(right.type));
}

export function observeProject(project, options = {}) {
  const collectedAt = options.now || new Date().toISOString();
  const recordId = options.recordId || randomUUID();
  const adapterRegistry = options.adapterRegistry || DEFAULT_ADAPTER_REGISTRY;
  const exists = (() => {
    try { return fs.statSync(project.path).isDirectory(); } catch { return false; }
  })();
  const errors = [];
  const git = exists ? gitInfo(project.path) : null;
  const repository = normalizeContribution('filesystem', exists
    ? {
        type: 'repository', status: 'supported', value: { git },
        sourceRevision: git?.revision || null,
        // Recency-derived, not asserted: stale when the source is quiet, unknown
        // when the directory exists but carries no git metadata.
        freshness: gitFreshness(git?.lastCommit, collectedAt),
      }
    : {
        type: 'repository', status: 'error',
        freshness: freshness('error', 'source-unavailable'),
      }, collectedAt);
  if (!exists) errors.push({ code: 'source-unavailable', message: `project source does not exist: ${project.path}` });

  const contributions = [repository];
  const adapterProvenance = [];
  const extensions = {};
  const adapters = [...new Set(project.adapters || [])].sort();
  for (const adapterId of adapters) {
    const attempt = executeAdapter(adapterId, adapterRegistry[adapterId], project, collectedAt);
    contributions.push(...attempt.contributions);
    adapterProvenance.push(attempt.provenance);
    errors.push(...attempt.errors);
    if (attempt.extensions !== undefined) extensions[adapterId] = attempt.extensions;
  }
  const signals = composeSignals(contributions, project.signalPolicies || {}, collectedAt);
  const hasUsable = signals.some((entry) => entry.status === 'supported');
  // collection.status reflects whether collection completed with usable evidence,
  // not source recency. `stale` is surfaced per signal (and on the card) but never
  // degrades the envelope — a quiet but cleanly-collected project stays `ok`. Only
  // genuine gaps mark `partial`: `unknown`/`error` freshness or a non-ok adapter.
  const collectionGap = (state) => state === 'unknown' || state === 'error';
  const adaptersDegraded = adapterProvenance.some((entry) => entry.status !== 'ok' || collectionGap(entry.freshness.state));
  const resolvedSignalsDegraded = signals.some((entry) =>
    entry.type === 'repository'
      ? entry.status !== 'supported' || collectionGap(entry.freshness.state)
      : entry.candidates.length > 0 && (entry.status !== 'supported' || collectionGap(entry.freshness.state)));
  const collectionStatus = !hasUsable ? 'error' : adaptersDegraded || resolvedSignalsDegraded ? 'partial' : 'ok';
  return {
    schemaVersion: 1,
    recordId,
    project: { id: project.id, label: project.label, path: project.path },
    collectedAt,
    collection: { status: collectionStatus },
    provenance: { sourceRevision: git?.revision || null, adapters: adapterProvenance },
    signals,
    extensions,
    errors,
  };
}

export function observeAll(config, options = {}) {
  const collectedAt = options.now || new Date().toISOString();
  return {
    generatedAt: collectedAt,
    warnings: config.warnings || [],
    projects: config.projects.map((project) => observeProject(project, { ...options, now: collectedAt })),
  };
}

function validateFreshness(value, name, errors) {
  if (!isObject(value) || !FRESHNESS.has(value.state)) {
    errors.push(`${name} freshness is invalid`);
    return;
  }
  if (value.state !== 'fresh' && (typeof value.reason !== 'string' || !value.reason)) {
    errors.push(`${name} freshness reason is required`);
  }
  if (value.reason !== undefined && (typeof value.reason !== 'string' || !value.reason)) {
    errors.push(`${name} freshness reason is invalid`);
  }
}

function validateNullableRevision(value, name, errors) {
  if (value !== null && typeof value !== 'string') errors.push(`${name} must be a string or null`);
}

function validateNullableTimestamp(value, name, errors) {
  if (value !== null && !isRfc3339(value)) errors.push(`${name} must be an RFC3339 date-time or null`);
}

function validateSourceProvenance(value, name, errors) {
  if (!isObject(value)) {
    errors.push(`${name} provenance must be an object`);
    return;
  }
  if (typeof value.adapterId !== 'string' || !value.adapterId) errors.push(`${name}.adapterId is invalid`);
  if (!isRfc3339(value.collectedAt)) errors.push(`${name}.collectedAt must be an RFC3339 date-time`);
  if (!Object.hasOwn(value, 'sourceRevision')) errors.push(`${name}.sourceRevision is required`);
  else validateNullableRevision(value.sourceRevision, `${name}.sourceRevision`, errors);
  if (!Object.hasOwn(value, 'sourceTimestamp')) errors.push(`${name}.sourceTimestamp is required`);
  else validateNullableTimestamp(value.sourceTimestamp, `${name}.sourceTimestamp`, errors);
}

export function validateObservation(observation, options = {}) {
  const errors = [];
  if (!isObject(observation)) errors.push('observation must be an object');
  if (observation?.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (typeof observation?.recordId !== 'string' || !UUID_V4.test(observation.recordId)) errors.push('recordId must be a lowercase UUID v4');
  if (!isObject(observation?.project)) errors.push('project must be an object');
  if (!PROJECT_ID.test(observation?.project?.id || '')) errors.push('project.id is invalid');
  if (typeof observation?.project?.label !== 'string' || !observation.project.label) errors.push('project.label is required');
  if (typeof observation?.project?.path !== 'string' || !observation.project.path) errors.push('project.path is required');
  if (!isRfc3339(observation?.collectedAt)) errors.push('collectedAt must be an RFC3339 date-time');
  if (!isObject(observation?.collection) || !COLLECTION_STATUS.has(observation.collection.status)) errors.push('collection.status is invalid');
  if (!isObject(observation?.provenance)) errors.push('provenance must be an object');
  if (!Object.hasOwn(observation?.provenance || {}, 'sourceRevision')) errors.push('provenance.sourceRevision is required');
  else validateNullableRevision(observation.provenance.sourceRevision, 'provenance.sourceRevision', errors);
  if (!Array.isArray(observation?.provenance?.adapters)) errors.push('provenance.adapters must be an array');
  for (const adapter of observation?.provenance?.adapters || []) {
    if (!isObject(adapter) || typeof adapter.id !== 'string' || !adapter.id || !ADAPTER_STATUS.has(adapter.status)) {
      errors.push('adapter provenance is invalid');
      continue;
    }
    if (!isRfc3339(adapter.collectedAt)) errors.push(`adapter ${adapter.id} collectedAt is invalid`);
    if (!Object.hasOwn(adapter, 'sourceRevision')) errors.push(`adapter ${adapter.id} sourceRevision is required`);
    else validateNullableRevision(adapter.sourceRevision, `adapter ${adapter.id} sourceRevision`, errors);
    if (!Object.hasOwn(adapter, 'sourceTimestamp')) errors.push(`adapter ${adapter.id} sourceTimestamp is required`);
    else validateNullableTimestamp(adapter.sourceTimestamp, `adapter ${adapter.id} sourceTimestamp`, errors);
    validateFreshness(adapter.freshness, `adapter ${adapter.id}`, errors);
  }
  if (!Array.isArray(observation?.signals)) errors.push('signals must be an array');
  for (const signal of observation?.signals || []) {
    if (!isObject(signal) || typeof signal.type !== 'string' || !signal.type
        || !Number.isInteger(signal.version) || signal.version < 1 || !SIGNAL_STATUS.has(signal.status)) {
      errors.push(`signal ${signal?.type || '?'} is invalid`);
      continue;
    }
    if (!Array.isArray(signal.candidates)) errors.push(`signal ${signal.type} candidates must be an array`);
    for (const candidate of signal.candidates || []) {
      if (!isObject(candidate) || typeof candidate.adapterId !== 'string' || !candidate.adapterId
          || typeof candidate.id !== 'string' || !candidate.id
          || !Number.isInteger(candidate.version) || candidate.version < 1
          || !Object.hasOwn(candidate, 'value') || candidate.value === undefined) {
        errors.push(`signal ${signal.type} candidate is invalid`);
        continue;
      }
      validateCapabilityValue(
        signal.type,
        candidate.version,
        candidate.value,
        `signal ${signal.type} candidate ${candidate.id} value`,
        errors,
      );
      validateJsonSafe(candidate.value, `signal ${signal.type} candidate ${candidate.id} value`, errors);
      validateFreshness(candidate.freshness, `signal ${signal.type} candidate ${candidate.id}`, errors);
      validateSourceProvenance(candidate.provenance, `signal ${signal.type} candidate ${candidate.id}`, errors);
    }
    if (!isObject(signal.resolution) || typeof signal.resolution.strategy !== 'string' || !signal.resolution.strategy) {
      errors.push(`signal ${signal.type} resolution is invalid`);
    }
    if (signal.resolution?.selected !== undefined
        && (typeof signal.resolution.selected !== 'string' || !signal.resolution.selected)) {
      errors.push(`signal ${signal.type} resolution.selected is invalid`);
    }
    if (signal.resolution?.reason !== undefined
        && (typeof signal.resolution.reason !== 'string' || !signal.resolution.reason)) {
      errors.push(`signal ${signal.type} resolution.reason is invalid`);
    }
    if (signal.resolution?.contributors !== undefined
        && (!Array.isArray(signal.resolution.contributors)
          || signal.resolution.contributors.some((entry) => typeof entry !== 'string' || !entry))) {
      errors.push(`signal ${signal.type} resolution.contributors is invalid`);
    }
    if (signal.status !== 'supported' && (typeof signal.resolution?.reason !== 'string' || !signal.resolution.reason)) {
      errors.push(`signal ${signal.type} resolution reason is required`);
    }
    validateFreshness(signal.freshness, `signal ${signal.type}`, errors);
    validateSourceProvenance(signal.provenance, `signal ${signal.type}`, errors);
    if (signal.status === 'supported' && (!Object.hasOwn(signal, 'value') || signal.value === undefined)) {
      errors.push(`signal ${signal.type} requires value`);
    } else if (signal.status === 'supported') {
      validateCapabilityValue(signal.type, signal.version, signal.value, `signal ${signal.type} value`, errors);
      validateJsonSafe(signal.value, `signal ${signal.type} value`, errors);
    }
  }
  if (!isObject(observation?.extensions)) errors.push('extensions must be an object');
  else validateJsonSafe(observation.extensions, 'extensions', errors);
  if (!Array.isArray(observation?.errors)) errors.push('errors must be an array');
  else validateJsonSafe(observation.errors, 'errors', errors);
  for (const error of observation?.errors || []) {
    if (!isObject(error) || typeof error.code !== 'string' || !error.code
        || typeof error.message !== 'string' || !error.message
        || (error.adapterId !== undefined && (typeof error.adapterId !== 'string' || !error.adapterId))) {
      errors.push('structured error requires string code, message, and optional adapterId');
    }
  }
  if (options.throwOnError && errors.length) throw new Error(`invalid observation: ${errors.join('; ')}`);
  return errors;
}
