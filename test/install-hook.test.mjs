// Tests for the SessionEnd hook auto-installer (slice 014-01, AC4/AC6). The
// merge/uninstall logic (src/hook-install.mjs) is pure and unit-tested
// directly against plain JS objects; scripts/install-hook.mjs (I/O: reading/
// writing a settings.json, backups) is exercised end-to-end via
// child_process against ONLY temp fixture files — never the real
// ~/.claude/settings.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { installHook, uninstallHook, buildHookEntry, hasHook, DEFAULT_HOOK_TIMEOUT_MS } from '../src/hook-install.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'install-hook.mjs');
const COMMAND = 'node /abs/path/to/scripts/session-stop-hook.mjs';

// --- src/hook-install.mjs: pure merge logic ---------------------------------

test('buildHookEntry: shape matches the verified registration contract {type, command, timeout}', () => {
  const entry = buildHookEntry(COMMAND, 5000);
  assert.deepEqual(entry, { type: 'command', command: COMMAND, timeout: 5000 });
});

test('buildHookEntry: defaults to DEFAULT_HOOK_TIMEOUT_MS when no timeout is given', () => {
  const entry = buildHookEntry(COMMAND);
  assert.equal(entry.timeout, DEFAULT_HOOK_TIMEOUT_MS);
});

test('installHook: adding into an empty settings object creates hooks.SessionEnd with one group', () => {
  const next = installHook({}, buildHookEntry(COMMAND, 5000));
  assert.deepEqual(next, { hooks: { SessionEnd: [{ hooks: [{ type: 'command', command: COMMAND, timeout: 5000 }] }] } });
});

test('AC4: installHook merges into an EXISTING populated SessionEnd array, preserving every other event and key byte-for-byte', () => {
  const settings = {
    hooks: {
      Notification: [{ hooks: [{ type: 'command', command: 'notify-me' }] }],
      SessionEnd: [{ hooks: [{ type: 'command', command: '/usr/local/bin/existing-hook' }] }],
      SessionStart: [{ hooks: [{ type: 'command', command: 'start-hook' }] }],
    },
    worktree: { enabled: true },
    enabledPlugins: ['foo'],
  };
  const next = installHook(settings, buildHookEntry(COMMAND, 5000));
  assert.deepEqual(next.hooks.Notification, settings.hooks.Notification);
  assert.deepEqual(next.hooks.SessionStart, settings.hooks.SessionStart);
  assert.deepEqual(next.worktree, settings.worktree);
  assert.deepEqual(next.enabledPlugins, settings.enabledPlugins);
  assert.equal(next.hooks.SessionEnd.length, 2, 'the existing group is preserved, the Gauge entry is a NEW group');
  assert.deepEqual(next.hooks.SessionEnd[0], settings.hooks.SessionEnd[0]);
  assert.deepEqual(next.hooks.SessionEnd[1], { hooks: [{ type: 'command', command: COMMAND, timeout: 5000 }] });
});

test('AC4: installHook is idempotent — applying it twice never duplicates the Gauge entry', () => {
  const once = installHook({}, buildHookEntry(COMMAND, 5000));
  const twice = installHook(once, buildHookEntry(COMMAND, 5000));
  assert.deepEqual(twice, once);
  const sessionEndHooks = twice.hooks.SessionEnd.flatMap((group) => group.hooks);
  assert.equal(sessionEndHooks.filter((h) => h.command === COMMAND).length, 1);
});

test('hasHook: reports Gauge installed state correctly', () => {
  assert.equal(hasHook({}, COMMAND), false);
  const installed = installHook({}, buildHookEntry(COMMAND, 5000));
  assert.equal(hasHook(installed, COMMAND), true);
});

test('AC6: uninstallHook removes only the Gauge entry, restoring the pre-install shape', () => {
  const before = {
    hooks: {
      SessionEnd: [{ hooks: [{ type: 'command', command: '/usr/local/bin/existing-hook' }] }],
    },
    worktree: { enabled: true },
  };
  const installed = installHook(before, buildHookEntry(COMMAND, 5000));
  const uninstalled = uninstallHook(installed, buildHookEntry(COMMAND, 5000));
  assert.deepEqual(uninstalled, before);
});

test('uninstallHook: no-op when the Gauge entry is not present', () => {
  const settings = { hooks: { SessionEnd: [{ hooks: [{ type: 'command', command: 'someone-elses-hook' }] }] } };
  const result = uninstallHook(settings, buildHookEntry(COMMAND, 5000));
  assert.deepEqual(result, settings);
});

// --- scripts/install-hook.mjs: end-to-end (temp fixtures only) -------------

function runInstaller(args, env = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { env: { ...process.env, ...env }, encoding: 'utf8' });
}

function tmpSettingsPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gauge-install-hook-'));
  return path.join(dir, 'settings.json');
}

test('edge case: settings.json absent — the installer creates it', () => {
  const settingsPath = tmpSettingsPath();
  assert.equal(fs.existsSync(settingsPath), false);
  const result = runInstaller(['--settings', settingsPath]);
  assert.equal(result.status, 0);
  const written = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.equal(written.hooks.SessionEnd.length, 1);
  assert.match(written.hooks.SessionEnd[0].hooks[0].command, /session-stop-hook\.mjs/);
  fs.rmSync(path.dirname(settingsPath), { recursive: true, force: true });
});

test('AC4: --settings overridable path merges into an existing populated settings.json, backs up first, and is idempotent across two runs', () => {
  const settingsPath = tmpSettingsPath();
  const original = {
    hooks: {
      Notification: [{ hooks: [{ type: 'command', command: 'notify' }] }],
      PermissionRequest: [{ hooks: [{ type: 'command', command: 'perm' }] }],
      PostToolUse: [{ hooks: [{ type: 'command', command: 'post' }] }],
      PreToolUse: [{ hooks: [{ type: 'command', command: 'pre' }] }],
      SessionEnd: [{ hooks: [{ type: 'command', command: '/Users/x/.config/iterm2/cc-status' }] }],
      SessionStart: [{ hooks: [{ type: 'command', command: 'start' }] }],
      Stop: [{ hooks: [{ type: 'command', command: 'stop' }] }],
      StopFailure: [{ hooks: [{ type: 'command', command: 'stopfail' }] }],
      UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'submit' }] }],
    },
    worktree: { some: 'setting' },
    enabledPlugins: ['a', 'b'],
    extraKnownMarketplaces: { x: 'y' },
  };
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(original, null, 2));

  const firstRun = runInstaller(['--settings', settingsPath]);
  assert.equal(firstRun.status, 0);
  assert.equal(fs.existsSync(`${settingsPath}.bak`), true);
  assert.equal(fs.readFileSync(`${settingsPath}.bak`, 'utf8'), JSON.stringify(original, null, 2));

  const afterFirst = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  // 014-04: the installer now registers TWO hooks — SessionEnd (capture) and
  // SessionStart (marker) — so those two events are the only ones touched; all
  // others, and every top-level key, are preserved byte-for-byte.
  for (const event of ['Notification', 'PermissionRequest', 'PostToolUse', 'PreToolUse', 'Stop', 'StopFailure', 'UserPromptSubmit']) {
    assert.deepEqual(afterFirst.hooks[event], original.hooks[event], `${event} must be untouched`);
  }
  assert.deepEqual(afterFirst.worktree, original.worktree);
  assert.deepEqual(afterFirst.enabledPlugins, original.enabledPlugins);
  assert.deepEqual(afterFirst.extraKnownMarketplaces, original.extraKnownMarketplaces);
  assert.equal(afterFirst.hooks.SessionEnd.length, 2, 'pre-existing SessionEnd group preserved + one new Gauge group');
  assert.deepEqual(afterFirst.hooks.SessionEnd[0], original.hooks.SessionEnd[0]);
  // SessionStart pre-existed too → its group is preserved and the Gauge marker
  // hook is appended as a new group.
  assert.equal(afterFirst.hooks.SessionStart.length, 2, 'pre-existing SessionStart group preserved + one new Gauge marker group');
  assert.deepEqual(afterFirst.hooks.SessionStart[0], original.hooks.SessionStart[0]);
  assert.ok(afterFirst.hooks.SessionStart.flatMap((g) => g.hooks).some((h) => /session-start-hook\.mjs/.test(h.command)), 'the SessionStart marker hook is registered');

  const secondRun = runInstaller(['--settings', settingsPath]);
  assert.equal(secondRun.status, 0);
  const afterSecond = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.deepEqual(afterSecond, afterFirst, 're-running must not duplicate the Gauge entry');
  const gaugeEntries = afterSecond.hooks.SessionEnd
    .flatMap((group) => group.hooks)
    .filter((h) => /session-stop-hook\.mjs/.test(h.command));
  assert.equal(gaugeEntries.length, 1);

  fs.rmSync(path.dirname(settingsPath), { recursive: true, force: true });
});

test('AC6: --uninstall removes only the Gauge entry, restoring the pre-install shape; unrelated settings untouched', () => {
  const settingsPath = tmpSettingsPath();
  const original = {
    hooks: { SessionEnd: [{ hooks: [{ type: 'command', command: 'existing' }] }] },
    worktree: { some: 'setting' },
  };
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(original, null, 2));

  runInstaller(['--settings', settingsPath]);
  const installed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.equal(installed.hooks.SessionEnd.length, 2);

  const uninstallResult = runInstaller(['--settings', settingsPath, '--uninstall']);
  assert.equal(uninstallResult.status, 0);
  const uninstalled = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.deepEqual(uninstalled, original);

  fs.rmSync(path.dirname(settingsPath), { recursive: true, force: true });
});

test('edge case: --uninstall against a settings.json that does not exist is a clean no-op (exit 0, nothing created)', () => {
  const settingsPath = tmpSettingsPath();
  const dir = path.dirname(settingsPath);
  fs.mkdirSync(dir, { recursive: true });
  const result = runInstaller(['--settings', settingsPath, '--uninstall']);
  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(settingsPath), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('edge case: settings.json present but not valid JSON — refuse, diagnostic, never silently overwrite', () => {
  const settingsPath = tmpSettingsPath();
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  const invalid = '{ this is not json';
  fs.writeFileSync(settingsPath, invalid);
  const result = runInstaller(['--settings', settingsPath]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not valid JSON/);
  assert.equal(fs.readFileSync(settingsPath, 'utf8'), invalid, 'the invalid file must be left exactly as-is');
  assert.equal(fs.existsSync(`${settingsPath}.bak`), false, 'no backup should be written when the merge itself is refused');
  fs.rmSync(path.dirname(settingsPath), { recursive: true, force: true });
});

test('GAUGE_CLAUDE_SETTINGS env var overrides the settings path when --settings is not given (testability requirement)', () => {
  const settingsPath = tmpSettingsPath();
  const result = runInstaller([], { GAUGE_CLAUDE_SETTINGS: settingsPath });
  assert.equal(result.status, 0);
  assert.equal(fs.existsSync(settingsPath), true);
  const written = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.equal(written.hooks.SessionEnd.length, 1);
  fs.rmSync(path.dirname(settingsPath), { recursive: true, force: true });
});

// --- Reconciliation fixes (014-01 review nits) ------------------------------

test('reconcile: registered command quotes the script path (survives a space in the home dir)', () => {
  const settingsPath = tmpSettingsPath();
  const result = runInstaller(['--settings', settingsPath]);
  assert.equal(result.status, 0);
  const written = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const command = written.hooks.SessionEnd[0].hooks[0].command;
  // The absolute script path is wrapped in double quotes so a shell splitting
  // the command on whitespace treats a spaced path as one argument.
  assert.match(command, /^node "\/.*session-stop-hook\.mjs"$/, command);
  fs.rmSync(path.dirname(settingsPath), { recursive: true, force: true });
});

test('reconcile: a second install never clobbers the pristine .bak (AC6 reversibility stays honest)', () => {
  const settingsPath = tmpSettingsPath();
  const original = { hooks: { SessionEnd: [{ hooks: [{ type: 'command', command: 'pre-existing' }] }] }, keep: 1 };
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  const pristine = JSON.stringify(original, null, 2);
  fs.writeFileSync(settingsPath, pristine);

  runInstaller(['--settings', settingsPath]);              // first install writes .bak = pristine
  assert.equal(fs.readFileSync(`${settingsPath}.bak`, 'utf8'), pristine);
  runInstaller(['--settings', settingsPath]);              // second install must NOT overwrite .bak
  assert.equal(fs.readFileSync(`${settingsPath}.bak`, 'utf8'), pristine,
    'the pristine pre-Gauge original must survive a second install');
  fs.rmSync(path.dirname(settingsPath), { recursive: true, force: true });
});
