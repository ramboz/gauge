// Project-shape profile v1 (ADR-0009, spec 007-01): a small, versioned
// contract declaring where a source's jig-style artifacts live. This module
// carries the schema-derived defaults and a zero-dependency runtime
// validator that agrees with schemas/project-profile-v1.schema.json,
// mirroring the observation-v1 dual-validation pattern in src/observation.mjs.
// Config-inline is the only home consumed in this slice (ADR-0009 D1); the
// source-owned gauge.profile.json home is the spec-006 seam.
import fs from 'node:fs';

export const PROFILE_SCHEMA = JSON.parse(
  fs.readFileSync(new URL('../schemas/project-profile-v1.schema.json', import.meta.url), 'utf8'),
);

// `entries` (spec 007-02, ADR-0009 D2) is array-typed, not a scalar override
// field, so it is excluded from the scalar defaults map. A profile with no
// `entries` normalizes to exactly the same four scalar defaults as before
// (007-01 identity); PROFILE_DEFAULTS.entries is intentionally absent (a
// profile's entries default to "not present", not `[]`, since only the
// single-entry case reads these scalar defaults).
const SCALAR_FIELDS = Object.keys(PROFILE_SCHEMA.properties).filter((field) => field !== 'entries');

export const PROFILE_DEFAULTS = Object.fromEntries(
  SCALAR_FIELDS.map((field) => [field, PROFILE_SCHEMA.properties[field].default]),
);

const ENTRY_SCHEMA = PROFILE_SCHEMA.properties.entries.items;
const ENTRY_FIELDS = Object.keys(ENTRY_SCHEMA.properties);
const ENTRY_REQUIRED = ENTRY_SCHEMA.required || [];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Validates a single entries[] item against the same shape the schema
// declares (id/label/artifactRoot required, specsDir/decisionsDir/
// statusProperty optional overrides, no unrecognized fields).
function validateEntry(entry, index, errors) {
  if (!isObject(entry)) {
    errors.push(`profile.entries[${index}] must be an object`);
    return;
  }
  for (const field of ENTRY_REQUIRED) {
    if (!Object.hasOwn(entry, field)) {
      errors.push(`profile.entries[${index}] requires ${field}`);
    }
  }
  for (const [key, value] of Object.entries(entry)) {
    if (!ENTRY_FIELDS.includes(key)) {
      errors.push(`profile.entries[${index}].${key} is not a recognized field`);
      continue;
    }
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`profile.entries[${index}].${key} must be a non-empty string`);
    }
  }
}

// Pure: returns a list of violations, never throws. Callers (src/config.mjs)
// decide how to surface them as a single actionable error.
export function validateProfile(value) {
  const errors = [];
  if (value === undefined) return errors;
  if (!isObject(value)) {
    errors.push('profile must be an object');
    return errors;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (!Object.hasOwn(PROFILE_SCHEMA.properties, key)) {
      errors.push(`profile.${key} is not a recognized field`);
      continue;
    }
    if (key === 'entries') {
      if (!Array.isArray(entry) || entry.length === 0) {
        errors.push('profile.entries must be a non-empty array');
        continue;
      }
      entry.forEach((item, index) => validateEntry(item, index, errors));
      continue;
    }
    if (typeof entry !== 'string' || !entry.trim()) {
      errors.push(`profile.${key} must be a non-empty string`);
    }
  }
  return errors;
}
