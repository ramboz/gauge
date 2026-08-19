import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateObservation } from './observation.mjs';
import { sameCaptureState } from './capture-hygiene.mjs';

function identity(stats) {
  if (stats.dev === undefined || stats.ino === undefined) {
    throw new Error('unsupported-filesystem-identity: device/inode identity unavailable');
  }
  return { dev: String(stats.dev), ino: String(stats.ino) };
}

function key(node) {
  return `${node.dev}:${node.ino}`;
}

export function identityDescriptor(target, { allowMissing = false } = {}) {
  const absolute = path.resolve(target);
  let existing = absolute;
  const prospective = [];
  while (true) {
    try {
      fs.lstatSync(existing);
      break;
    } catch (error) {
      if (error.code !== 'ENOENT' || !allowMissing) throw error;
      const parent = path.dirname(existing);
      if (parent === existing) throw error;
      prospective.unshift(path.basename(existing));
      existing = parent;
    }
  }
  const canonical = fs.realpathSync(existing);
  const parsed = path.parse(canonical);
  const nodes = [identity(fs.statSync(parsed.root))];
  let cursor = parsed.root;
  for (const segment of canonical.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    nodes.push(identity(fs.statSync(cursor)));
  }
  return { nodes, prospective, diagnosticPath: canonical };
}

function tokensAfter(descriptor, nodeIndex) {
  return [
    ...descriptor.nodes.slice(nodeIndex + 1).map((node) => `i:${key(node)}`),
    ...descriptor.prospective.map((segment) => `p:${segment}`),
  ];
}

function prefix(a, b) {
  return a.length <= b.length && a.every((token, index) => token === b[index]);
}

export function descriptorsOverlap(a, b) {
  let sharedA = -1;
  let sharedB = -1;
  for (let i = a.nodes.length - 1; i >= 0 && sharedA === -1; i--) {
    for (let j = b.nodes.length - 1; j >= 0; j--) {
      if (key(a.nodes[i]) === key(b.nodes[j])) {
        sharedA = i;
        sharedB = j;
        break;
      }
    }
  }
  if (sharedA === -1) return false;
  const tailA = tokensAfter(a, sharedA);
  const tailB = tokensAfter(b, sharedB);
  return prefix(tailA, tailB) || prefix(tailB, tailA);
}

export function descriptorContains(parent, child) {
  let sharedParent = -1;
  let sharedChild = -1;
  for (let i = parent.nodes.length - 1; i >= 0 && sharedParent === -1; i--) {
    for (let j = child.nodes.length - 1; j >= 0; j--) {
      if (key(parent.nodes[i]) === key(child.nodes[j])) {
        sharedParent = i;
        sharedChild = j;
        break;
      }
    }
  }
  if (sharedParent === -1) return false;
  return prefix(tokensAfter(parent, sharedParent), tokensAfter(child, sharedChild));
}

function stableIdentity(target) {
  const first = identity(fs.statSync(target));
  const second = identity(fs.statSync(target));
  if (key(first) !== key(second)) throw new Error('unsupported-filesystem-identity: unstable device/inode identity');
}

function qualifyStateFilesystem(existingAncestor, options) {
  const platform = options.platform || process.platform;
  if (platform !== 'darwin') {
    throw new Error('unsupported-filesystem-identity: durable collection is qualified only on Darwin APFS');
  }
  if (typeof fs.statfsSync !== 'function') {
    throw new Error('unsupported-filesystem-identity: this Node runtime does not expose statfsSync');
  }
  const type = Number(fs.statfsSync(existingAncestor).type);
  if (type !== 26) {
    throw new Error(`unsupported-filesystem-identity: expected Darwin APFS type 26, received ${type}`);
  }
  stableIdentity(existingAncestor);
  options.onQualification?.(existingAncestor);
}

function sourceDescriptors(projects) {
  return projects.map((project) => {
    try {
      const stat = fs.statSync(project.path);
      if (!stat.isDirectory()) throw new Error('not a directory');
      stableIdentity(project.path);
      return { project, descriptor: identityDescriptor(project.path) };
    } catch (error) {
      throw new Error(`unverifiable-source-root: ${project.path}: ${error.message}`);
    }
  });
}

function assertDisjoint(stateDescriptor, sources) {
  for (const { project, descriptor } of sources) {
    if (descriptorsOverlap(stateDescriptor, descriptor)) {
      throw new Error(`source-state-overlap: state and project ${project.id} must be disjoint`);
    }
  }
}

function nearestExisting(target) {
  let cursor = path.resolve(target);
  const missing = [];
  while (true) {
    try {
      fs.lstatSync(cursor);
      return { cursor, missing };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw error;
      missing.unshift(path.basename(cursor));
      cursor = parent;
    }
  }
}

function ensureStateRoot(stateDir, sources) {
  const { cursor: ancestor, missing } = nearestExisting(stateDir);
  let cursor = ancestor;
  for (const segment of missing) {
    cursor = path.join(cursor, segment);
    fs.mkdirSync(cursor);
    const descriptor = identityDescriptor(cursor);
    assertDisjoint(descriptor, sources);
  }
  const rootLstat = fs.lstatSync(stateDir);
  if (rootLstat.isSymbolicLink() || !rootLstat.isDirectory()) {
    throw new Error('unsafe-state-component: stateDir must be a real directory');
  }
  return path.resolve(stateDir);
}

function ensureSafeChild(parent, name, stateDescriptor, sources) {
  const child = path.join(parent, name);
  try {
    const stats = fs.lstatSync(child);
    if (stats.isSymbolicLink() || !stats.isDirectory()) throw new Error(`unsafe-state-component: ${child}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    fs.mkdirSync(child);
  }
  const descriptor = identityDescriptor(child);
  const contained = descriptorContains(stateDescriptor, descriptor);
  if (!contained) throw new Error(`state-containment-error: ${child}`);
  assertDisjoint(descriptor, sources);
  return child;
}

function fsyncDirectory(directory) {
  const fd = fs.openSync(directory, 'r');
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function capabilityProbe(stateDir, options = {}) {
  const id = randomUUID();
  const temp = path.join(stateDir, `.gauge-probe-${id}.tmp`);
  const linked = path.join(stateDir, `.gauge-probe-${id}.linked`);
  let fd;
  try {
    fd = fs.openSync(temp, 'wx');
    fs.writeFileSync(fd, 'gauge-probe');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.linkSync(temp, linked);
    let collided = false;
    try { fs.linkSync(temp, linked); } catch (error) { collided = error.code === 'EEXIST'; }
    if (!collided) throw new Error('hard-link collision did not fail with EEXIST');
    fsyncDirectory(stateDir);
    if (fs.readFileSync(linked, 'utf8') !== 'gauge-probe') throw new Error('probe read-back mismatch');
    options.onCapabilityProbe?.(stateDir);
  } catch (error) {
    throw new Error(`unsupported-state-filesystem: ${error.message}`);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    try { fs.unlinkSync(linked); } catch {}
    try { fs.unlinkSync(temp); } catch {}
  }
}

function assertRecordDestination(destination, stateDescriptor, sources) {
  const descriptor = identityDescriptor(destination, { allowMissing: true });
  if (!descriptorContains(stateDescriptor, descriptor)) {
    throw new Error(`state-containment-error: record destination escapes stateDir: ${destination}`);
  }
  assertDisjoint(descriptor, sources);
}

function atomicRecord(directory, filename, observation, stateDescriptor, sources) {
  const finalPath = path.join(directory, filename);
  const tempPath = path.join(directory, `.${filename}.${randomUUID()}.tmp`);
  let fd;
  try {
    // ADR-0005: re-evaluate the concrete paths immediately before the first
    // open. Safe project ids are defense in depth, not the containment proof.
    assertRecordDestination(tempPath, stateDescriptor, sources);
    assertRecordDestination(finalPath, stateDescriptor, sources);
    fd = fs.openSync(tempPath, 'wx');
    fs.writeFileSync(fd, `${JSON.stringify(observation, null, 2)}\n`);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.linkSync(tempPath, finalPath);
    fsyncDirectory(directory);
    fs.unlinkSync(tempPath);
    return finalPath;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    try { fs.unlinkSync(tempPath); } catch {}
  }
}

export function collectObservation(config, observation, options = {}) {
  validateObservation(observation, { throwOnError: true });
  const sources = sourceDescriptors(config.projects || []);
  const stateDir = path.resolve(config.stateDir);
  const prospective = identityDescriptor(stateDir, { allowMissing: true });
  assertDisjoint(prospective, sources);
  const { cursor: ancestor } = nearestExisting(stateDir);
  qualifyStateFilesystem(ancestor, options);
  const root = ensureStateRoot(stateDir, sources);
  const stateDescriptor = identityDescriptor(root);
  assertDisjoint(stateDescriptor, sources);
  const observationsDir = ensureSafeChild(root, 'observations', stateDescriptor, sources);
  const projectDir = ensureSafeChild(observationsDir, observation.project.id, stateDescriptor, sources);
  assertDisjoint(identityDescriptor(projectDir), sources);
  // A mounted descendant can differ from the ancestor that was qualified
  // before state creation. Re-qualify and run the full protocol where the
  // actual immutable record will live.
  qualifyStateFilesystem(projectDir, options);
  capabilityProbe(projectDir, options);
  const stamp = new Date(observation.collectedAt).toISOString().replace(/[^0-9A-Za-z]/g, '');
  const filename = `${stamp}-${observation.recordId}.json`;
  const recordPath = atomicRecord(
    projectDir,
    filename,
    observation,
    stateDescriptor,
    sources,
  );
  // 014-02 AC1: keep-latest storage hygiene (opt-in — the session-stop hook
  // captures unconditionally, so a run of identical-state session ends would
  // otherwise bloat storage). After writing the new record, if the newest
  // PRIOR record shares this capture's state (same HEAD + execution
  // {done,denom}), remove it — collapsing the run to one record at the newest
  // `collectedAt`. Keeps the newest (advancing the timestamp), never the
  // oldest, so a stall is never masked by a frozen timestamp. Forecast-neutral
  // (pace is endpoint-based). Existing callers (manual snapshot, backfill) do
  // NOT opt in — backfill's records are genuinely spaced, not a dense run.
  if (options.coalesce) coalescePriorIdentical(projectDir, filename, observation);
  return recordPath;
}

// 014-02 AC1 helper: remove the single newest PRIOR record when it shares the
// new record's capture state. Records are named `<stampedCollectedAt>-<id>.json`
// so lexical sort is chronological (same ordering readObservationHistory uses);
// the newest name other than the just-written file is the prior latest. A
// malformed/unreadable prior record is left untouched (never deleted on a parse
// failure), and any hygiene error is swallowed — hygiene must never fail a
// capture.
function coalescePriorIdentical(projectDir, newFilename, newObservation) {
  try {
    const priors = fs
      .readdirSync(projectDir)
      .filter((name) => name.endsWith('.json') && name !== newFilename)
      .sort();
    if (priors.length === 0) return;
    const priorName = priors[priors.length - 1];
    const priorPath = path.join(projectDir, priorName);
    let prior;
    try {
      prior = JSON.parse(fs.readFileSync(priorPath, 'utf8'));
    } catch {
      return; // unreadable/malformed prior — never delete on a parse failure
    }
    if (sameCaptureState(newObservation, prior)) fs.unlinkSync(priorPath);
  } catch {
    // hygiene is best-effort; a failure here must never break the capture
  }
}

export function readObservationHistory(stateDir, projectId) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(projectId)) throw new Error(`invalid project id: ${projectId}`);
  const directory = path.join(path.resolve(stateDir), 'observations', projectId);
  let names;
  try {
    names = fs.readdirSync(directory).filter((name) => name.endsWith('.json')).sort();
  } catch (error) {
    if (error.code === 'ENOENT') return { observations: [], errors: [] };
    throw error;
  }
  const observations = [];
  const errors = [];
  for (const name of names) {
    try {
      const observation = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
      validateObservation(observation, { throwOnError: true });
      observations.push(observation);
    } catch (error) {
      errors.push({ code: 'invalid-history-record', file: name, message: error.message });
    }
  }
  observations.sort((a, b) => Date.parse(a.collectedAt) - Date.parse(b.collectedAt) || a.recordId.localeCompare(b.recordId));
  return { observations, errors };
}
