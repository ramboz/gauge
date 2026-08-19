// Pure logic for the SessionEnd capture hook (slice 014-01): parsing the
// hook's stdin JSON payload and matching a session's `cwd` to a configured
// Gauge project. Kept separate from I/O (stdin reading, config loading,
// `collectObservation` writes — all in scripts/session-stop-hook.mjs) so it
// is directly unit-testable without a real stdin stream or git checkout.
import path from 'node:path';

// Verified 2026-08-18 (spec `## Assumptions` A1): the SessionEnd hook
// receives `{cwd, session_id, transcript_path, hook_event_name, exit_reason}`
// on stdin as a single JSON object. Only `cwd` is required by this slice.
export function parseHookPayload(raw) {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    throw new Error(`invalid SessionEnd payload: not valid JSON (${error.message})`);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('invalid SessionEnd payload: expected a JSON object');
  }
  if (typeof payload.cwd !== 'string' || !payload.cwd.trim()) {
    throw new Error('invalid SessionEnd payload: missing cwd');
  }
  return payload;
}

function normalized(target) {
  return path.resolve(target);
}

// Containment match: a session's cwd matches a configured project when it IS
// the project's root, or is a path.sep-bounded descendant of it (this also
// covers a `.claude/worktrees/<name>` linked worktree of a configured
// project — src/scan.mjs's wtRoot convention nests worktrees under the main
// project's `path`, so plain prefix containment already handles them; no
// special-casing needed). When a session's cwd falls under more than one
// configured project (nested entries), the LONGEST matching project.path
// wins — the more specific/nested project, not its ancestor.
export function matchProjectForCwd(projects, cwd) {
  if (typeof cwd !== 'string' || !cwd.trim()) return null;
  const target = normalized(cwd);
  let best = null;
  let bestLength = -1;
  for (const project of projects || []) {
    if (!project || typeof project.path !== 'string') continue;
    const root = normalized(project.path);
    const isMatch = target === root || target.startsWith(root + path.sep);
    if (isMatch && root.length > bestLength) {
      best = project;
      bestLength = root.length;
    }
  }
  return best;
}
