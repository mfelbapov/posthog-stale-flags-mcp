#!/usr/bin/env node
// Drift linter: enforces .feature ↔ test/features/ one-to-one mapping.
// Exits 0 on success, 1 on drift. Pure Node, no deps.
//
// Rules:
//   1. Every Scenario: title in features/<X>.feature has exactly one matching
//      it('<exact title>', ...) in test/features/<X>/**/*.test.ts.
//   2. Every it(...) string in test/features/<X>/ matches a Scenario: title in
//      features/<X>.feature.
//   3. Test file name stem matches a slugified scenario title.
//
// Invoke from repo root: `node scripts/check-features.mjs`

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const ROOT = process.cwd();
const FEATURES_DIR = join(ROOT, 'features');
const TESTS_DIR = join(ROOT, 'test', 'features');

const errors = [];

function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function extractScenarios(featurePath) {
  const src = readFileSync(featurePath, 'utf8');
  const titles = [];
  for (const line of src.split(/\r?\n/)) {
    const m = line.match(/^\s*Scenario:\s*(.+?)\s*$/);
    if (m) titles.push(m[1]);
  }
  return titles;
}

function extractItStrings(testPath) {
  const src = readFileSync(testPath, 'utf8');
  const titles = [];
  // Matches it('...') or it("...") with single-line titles.
  const re = /\bit\(\s*(['"])((?:\\\1|(?!\1).)*?)\1\s*,/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    titles.push(m[2].replace(/\\(['"])/g, '$1'));
  }
  return titles;
}

if (!existsSync(FEATURES_DIR)) {
  // No features yet — nothing to lint. Exit clean.
  process.exit(0);
}

const featureFiles = readdirSync(FEATURES_DIR).filter((f) => f.endsWith('.feature'));
const featureNames = featureFiles.map((f) => basename(f, '.feature'));

// Per-feature checks.
for (const name of featureNames) {
  const featurePath = join(FEATURES_DIR, `${name}.feature`);
  const testDir = join(TESTS_DIR, name);

  const scenarios = extractScenarios(featurePath);
  const scenarioSlugs = new Map(scenarios.map((t) => [t, slugify(t)]));

  if (!existsSync(testDir)) {
    if (scenarios.length > 0) {
      errors.push(
        `[${name}] feature file has ${scenarios.length} scenario(s) but no test/features/${name}/ directory`,
      );
    }
    continue;
  }

  const testFiles = walk(testDir).filter((f) => f.endsWith('.test.ts'));
  const testTitles = new Map(); // it-string → file
  for (const tf of testFiles) {
    for (const title of extractItStrings(tf)) {
      if (testTitles.has(title)) {
        errors.push(
          `[${name}] duplicate it() title "${title}" in ${tf} (also in ${testTitles.get(title)})`,
        );
      } else {
        testTitles.set(title, tf);
      }
    }
  }

  // Rule 1: every scenario has a matching it().
  for (const scenario of scenarios) {
    if (!testTitles.has(scenario)) {
      errors.push(
        `[${name}] scenario "${scenario}" has no matching it() in test/features/${name}/`,
      );
    }
  }

  // Rule 2: every it() has a matching scenario.
  for (const [title, file] of testTitles) {
    if (!scenarios.includes(title)) {
      errors.push(
        `[${name}] it("${title}") in ${file} has no matching Scenario: in features/${name}.feature`,
      );
    }
  }

  // Rule 3: test file name stem matches a scenario slug.
  const expectedSlugs = new Set(scenarioSlugs.values());
  for (const tf of testFiles) {
    const stem = basename(tf, '.test.ts');
    // Strip leading ordinal prefix like "01-" / "10-" for the slug comparison.
    const slugPart = stem.replace(/^\d+-/, '');
    if (!expectedSlugs.has(slugPart)) {
      errors.push(
        `[${name}] test file ${tf} has stem "${slugPart}" which doesn't match any scenario slug ` +
          `(expected one of: ${[...expectedSlugs].join(', ') || '<none>'})`,
      );
    }
  }
}

// Orphan test directories (test/features/<name>/ with no features/<name>.feature).
if (existsSync(TESTS_DIR)) {
  for (const entry of readdirSync(TESTS_DIR)) {
    const full = join(TESTS_DIR, entry);
    if (!statSync(full).isDirectory()) continue;
    if (!featureNames.includes(entry)) {
      errors.push(
        `orphan test directory test/features/${entry}/ has no matching features/${entry}.feature`,
      );
    }
  }
}

if (errors.length > 0) {
  console.error('check-features: drift detected\n');
  for (const e of errors) console.error(`  - ${e}`);
  console.error(`\n${errors.length} error(s). Fix drift by:`);
  console.error('  - adding missing tests via /add-scenario');
  console.error('  - removing orphan tests that no longer match a scenario');
  console.error('  - ensuring it() string is the exact Scenario: title');
  process.exit(1);
}

console.log(`check-features: ok (${featureNames.length} feature(s))`);
process.exit(0);
