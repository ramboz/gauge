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

const FIELDS = Object.keys(PROFILE_SCHEMA.properties);

export const PROFILE_DEFAULTS = Object.fromEntries(
  FIELDS.map((field) => [field, PROFILE_SCHEMA.properties[field].default]),
);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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
    if (typeof entry !== 'string' || !entry.trim()) {
      errors.push(`profile.${key} must be a non-empty string`);
    }
  }
  return errors;
}
