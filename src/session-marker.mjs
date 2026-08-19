// Live-session "running now" enrichment (spec 014, slice 014-04). The thin
// client OWNS the active-session signal via a start/end bracket: a SessionStart
// hook writes a marker { session_id, cwd, transcriptPath, startedAt } under
// <stateDir>/active-sessions/, and 014-01's SessionEnd hook clears it. Liveness
// is the transcript file's MTIME — which Claude Code advances as it writes the
// JSONL transcript, for free, no per-turn hook (the converged frame-critique
// design; a Stop-hook heartbeat would tax the engineer's session every turn).
//
// This module holds the PURE logic: the marker filename, and the fold that
// decides which configured projects are "running now" given the markers and
// each marker's transcript mtime. All I/O (listing the marker dir, reading
// markers, `stat`-ing transcripts — never reading their content) lives in the
// read layer (src/server.mjs), mirroring velocity/cost/trends.
import { matchProjectForCwd } from './session-hook.mjs';

// The staleness window: a marker whose transcript mtime is older than this is
// NOT "running now". Sized generously (>= the expected max inter-write gap of a
// long active-but-write-silent tool call) so a busy-but-quiet session is not
// false-negatived; the residual is bounded and owned (spec AC5). A named
// constant, not a magic literal.
export const RUNNING_STALE_AFTER_MS = 15 * 60 * 1000; // 15 minutes

// AC1: markers are named by session id so SessionEnd can clear exactly one.
export function markerFilename(sessionId) {
  return `${String(sessionId).replace(/[^0-9A-Za-z_-]/g, '')}.json`;
}

// AC4/AC5 (pure fold): the set of configured project ids that have a live
// session right now. A marker counts when (a) its cwd maps to a configured
// project (same longest-prefix match 014-01 uses) and (b) its transcript's
// mtime is within RUNNING_STALE_AFTER_MS of `nowMs`. `mtimeByPath` is a map
// `transcriptPath -> epoch-ms mtime` (or null/absent when the transcript is
// missing/unreadable — treated as not-running, never a throw). Two concurrent
// markers for one project collapse to one running id (a Set). Deterministic
// given the same inputs.
export function runningProjectIds(markers, mtimeByPath, nowMs, projects, staleMs = RUNNING_STALE_AFTER_MS) {
  const running = new Set();
  for (const marker of markers || []) {
    if (!marker || typeof marker.cwd !== 'string') continue;
    const project = matchProjectForCwd(projects, marker.cwd);
    if (!project) continue; // session in a project not under Gauge config — ignored
    const mtime = mtimeByPath?.[marker.transcriptPath];
    if (typeof mtime !== 'number' || !Number.isFinite(mtime)) continue; // missing/unreadable transcript → not running
    if (nowMs - mtime <= staleMs) running.add(project.id);
  }
  return running;
}

// Read-layer join (pure), mirroring attachVelocity/attachTokenCost. Attaches a
// boolean `runningNow` to each project — additive enrichment of the derived
// in-flight signal (AC6), never overriding it. Absent-safe: an empty/absent
// running set attaches `false` everywhere (today's behavior — AC7).
export function attachRunningNow(data, runningProjectIdSet) {
  const running = runningProjectIdSet || new Set();
  return {
    ...data,
    projects: data.projects.map((entry) => ({
      ...entry,
      runningNow: running.has(entry.project.id),
    })),
  };
}
