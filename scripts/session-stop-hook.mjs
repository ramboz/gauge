// SessionEnd capture hook (spec 014, slice 014-01): the thin client's write
// path. Invoked by Claude Code as a `hooks.SessionEnd[].hooks[]` command; it
// reads the SessionEnd payload from stdin, matches the session's `cwd` to a
// configured Gauge project, and writes exactly one observation snapshot for
// that project via the existing observeProject/collectObservation path —
// the same path scripts/snapshot.mjs uses for manual collection.
//
// Contract (AC2/AC7): this script must NEVER throw in a way that disrupts
// Claude Code's shutdown, and must NEVER write to stdout. Every failure path
// — unmatched cwd, malformed payload/config, an unreadable stateDir, a
// write error — is a single stderr diagnostic line followed by a clean
// `exit 0`. Read-only-source boundary (AC3) is enforced by the reused
// `collectObservation`, which already asserts disjointness from every
// configured `project.path`.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, resolveConfigPath } from '../src/config.mjs';
import { observeProject } from '../src/observation.mjs';
import { collectObservation } from '../src/state.mjs';
import { parseSessionEndPayload, matchProjectForCwd } from '../src/session-hook.mjs';

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
  console.error(`Gauge session-stop hook: ${message}`);
}

// Exported for in-process testing (drive the capture path without spawning a
// child or a real stdin stream) and as the clean extension seam slice 014-04
// builds on (its SessionEnd hook also clears the active-session marker). The
// CLI entrypoint below wires real stdin to it for end-to-end integration.
export async function run({ rawStdin, root = ROOT } = {}) {
  let payload;
  try {
    payload = parseSessionEndPayload(rawStdin);
  } catch (error) {
    diagnostic(error.message);
    return;
  }

  let config;
  try {
    const configPath = resolveConfigPath(root, process.env.GAUGE_CONFIG);
    config = loadConfig(configPath);
  } catch (error) {
    diagnostic(`failed to load config: ${error.message}`);
    return;
  }

  const project = matchProjectForCwd(config.projects, payload.cwd);
  if (!project) {
    diagnostic(`no configured project matches cwd: ${payload.cwd}`);
    return;
  }

  try {
    const observation = observeProject(project);
    // 014-02 AC1: session ends fire unconditionally, so opt into keep-latest
    // coalescing — a run of identical-state captures collapses to one record at
    // the newest collectedAt (storage hygiene; the timestamp still advances, so
    // a stall is never masked).
    collectObservation(config, observation, { coalesce: true });
  } catch (error) {
    diagnostic(`failed to capture snapshot for ${project.label}: ${error.message}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  readStdin()
    .then((rawStdin) => run({ rawStdin }))
    .catch((error) => diagnostic(`unexpected error: ${error.message}`))
    .finally(() => process.exit(0));
}
