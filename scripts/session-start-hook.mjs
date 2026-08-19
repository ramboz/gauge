// SessionStart marker hook (spec 014, slice 014-04): the thin client's
// active-session write path. Invoked by Claude Code as a `hooks.SessionStart`
// command; it reads the SessionStart payload from stdin, matches the session's
// `cwd` to a configured Gauge project, and writes a marker
// { session_id, cwd, transcriptPath, startedAt } under
// `<stateDir>/active-sessions/<session_id>.json`. 014-01's SessionEnd hook
// clears the marker; liveness at read time is the transcript's mtime.
//
// Same isolation contract as 014-01's SessionEnd hook (AC7/AC8): never writes
// stdout, never throws in a way that disrupts session start, every failure is a
// single stderr diagnostic + clean exit 0. The marker holds no transcript
// content — only the four identity fields (AC8).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, resolveConfigPath } from '../src/config.mjs';
import { parseSessionEndPayload, matchProjectForCwd } from '../src/session-hook.mjs';
import { markerFilename } from '../src/session-marker.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function diagnostic(message) {
  console.error(`Gauge session-start hook: ${message}`);
}

export async function run({ rawStdin, root = ROOT, nowIso } = {}) {
  let payload;
  try {
    payload = parseSessionEndPayload(rawStdin); // shares the {cwd, ...} shape; validates cwd
  } catch (error) {
    diagnostic(error.message);
    return;
  }

  let config;
  try {
    config = loadConfig(resolveConfigPath(root, process.env.GAUGE_CONFIG));
  } catch (error) {
    diagnostic(`failed to load config: ${error.message}`);
    return;
  }

  const project = matchProjectForCwd(config.projects, payload.cwd);
  if (!project) {
    diagnostic(`no configured project matches cwd: ${payload.cwd}`);
    return;
  }

  const sessionId = payload.session_id;
  if (!sessionId || typeof sessionId !== 'string') {
    diagnostic('SessionStart payload missing session_id — cannot write an addressable marker');
    return;
  }

  try {
    const dir = path.join(path.resolve(config.stateDir), 'active-sessions');
    fs.mkdirSync(dir, { recursive: true });
    const marker = {
      session_id: sessionId,
      cwd: payload.cwd,
      transcriptPath: typeof payload.transcript_path === 'string' ? payload.transcript_path : null,
      startedAt: nowIso || new Date().toISOString(),
    };
    // Atomic write (temp + rename), mirroring collectObservation's atomicRecord.
    const target = path.join(dir, markerFilename(sessionId));
    const tmp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(marker));
    fs.renameSync(tmp, target);
  } catch (error) {
    diagnostic(`failed to write active-session marker for ${project.label}: ${error.message}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  readStdin()
    .then((rawStdin) => run({ rawStdin }))
    .catch((error) => diagnostic(`unexpected error: ${error.message}`))
    .finally(() => process.exit(0));
}
