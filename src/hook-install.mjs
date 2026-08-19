// Pure merge/uninstall logic for the SessionEnd hook installer (slice
// 014-01, AC4/AC6). Kept separate from I/O (reading/writing
// ~/.claude/settings.json, backups — all in scripts/install-hook.mjs) so the
// merge is directly unit-testable against plain JS objects, never the real
// settings file (see slice DoR: a real machine's settings.json already
// carries a populated SessionEnd group + 8 other events; these functions
// must merge into it, never create-or-clobber).

// SessionEnd hooks share a ~1.5s budget (spec `## Current state`); the
// snapshot write can involve git/adapter I/O, so the installer sets an
// explicit, more generous per-hook timeout rather than relying on the
// shared default.
export const DEFAULT_HOOK_TIMEOUT_MS = 10000;

export function buildHookEntry(command, timeout = DEFAULT_HOOK_TIMEOUT_MS) {
  const entry = { type: 'command', command };
  if (timeout !== undefined && timeout !== null) entry.timeout = timeout;
  return entry;
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function cloneGroup(group) {
  const safe = asObject(group);
  return { ...safe, hooks: Array.isArray(safe.hooks) ? safe.hooks.map((entry) => ({ ...entry })) : [] };
}

function isSameCommand(hookEntry, command) {
  return Boolean(hookEntry) && hookEntry.type === 'command' && hookEntry.command === command;
}

export function hasHook(settings, command) {
  const hooks = asObject(asObject(settings).hooks);
  const sessionEnd = Array.isArray(hooks.SessionEnd) ? hooks.SessionEnd : [];
  return sessionEnd.some((group) => Array.isArray(group?.hooks) && group.hooks.some((entry) => isSameCommand(entry, command)));
}

// Adds `hookEntry` as its OWN new group appended to the existing
// `hooks.SessionEnd` array. Every pre-existing group (and every other hook
// event / top-level settings key) is copied through untouched, byte-for-byte
// (AC4) — this never mutates or reshapes an existing group, it only appends.
// Idempotent: if an entry with the same `command` already exists in ANY
// SessionEnd group, this is a no-op (re-running never duplicates the entry).
export function installHook(settings, hookEntry) {
  const base = asObject(settings);
  const hooks = asObject(base.hooks);
  const sessionEnd = Array.isArray(hooks.SessionEnd) ? hooks.SessionEnd.map(cloneGroup) : [];
  const alreadyInstalled = sessionEnd.some((group) => group.hooks.some((entry) => isSameCommand(entry, hookEntry.command)));
  const nextSessionEnd = alreadyInstalled ? sessionEnd : [...sessionEnd, { hooks: [{ ...hookEntry }] }];
  return { ...base, hooks: { ...hooks, SessionEnd: nextSessionEnd } };
}

// Inverse of installHook (AC6): removes any hook entry matching `command`
// from every SessionEnd group. A group left with zero hooks and no other own
// keys — exactly the shape installHook creates — is dropped entirely,
// restoring the pre-install shape. A group that pre-existed with OTHER hooks
// (or other keys) keeps everything except the matching entry.
export function uninstallHook(settings, hookEntry) {
  const base = asObject(settings);
  const hooks = asObject(base.hooks);
  if (!Array.isArray(hooks.SessionEnd)) return { ...base, hooks: { ...hooks } };
  const nextSessionEnd = hooks.SessionEnd
    .map(cloneGroup)
    .map((group) => ({ ...group, hooks: group.hooks.filter((entry) => !isSameCommand(entry, hookEntry.command)) }))
    .filter((group) => group.hooks.length > 0 || Object.keys(group).length > 1);
  return { ...base, hooks: { ...hooks, SessionEnd: nextSessionEnd } };
}
