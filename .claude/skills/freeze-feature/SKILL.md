---
name: freeze-feature
description: Mark a feature as done. Verifies all its tests are green, then adds status frozen to the feature file's frontmatter. The pre-commit hook will reject further edits to src/features/<name>/ unless unfreeze-feature is run first.
---

# freeze-feature

Closes out a feature. Once frozen, drive-by edits to the feature's source folder are rejected at commit time. The only way back in is an explicit, auditable `/unfreeze-feature` call with a reason.

## Inputs

- `feature` — short name of the feature (e.g. `find_stale_flags`). Must correspond to an existing `features/<feature>.feature` file.

## Preconditions

- `features/<feature>.feature` exists.
- `test/features/<feature>/` exists and contains at least one test file.

## Steps

1. **Verify tests green.** `pnpm vitest run test/features/<feature>`. If **any** test fails, stop — refuse to freeze a feature with red tests.
2. **Verify drift-free.** `node scripts/check-features.mjs`. If the linter reports drift for this feature, stop — fix drift before freezing.
3. **Write frontmatter.** Read `features/<feature>.feature`. If it has no YAML frontmatter, prepend:
   ```
   ---
   status: frozen
   frozen_at: <ISO 8601 date>
   ---
   ```
   If it already has frontmatter, add/overwrite `status: frozen` and `frozen_at: <ISO 8601 date>` keys. Preserve any existing `history:` block.
4. **Report.** Print:
   - feature name
   - number of scenarios in the feature file
   - number of tests under `test/features/<feature>/`
   - confirmation: the pre-commit hook will now reject any edit to `src/features/<feature>/**` unless `/unfreeze-feature <feature>` is run first.

## Safety rules

- **Never freeze with red tests.** A frozen feature with broken tests is a bug generator — future readers will assume the tests prove correctness.
- **Never freeze with drift.** Scenario/test mismatch means the feature isn't really "done"; the spec and the tests disagree.
- **Never bulk-freeze.** One feature per invocation. Bulk freezes hide which feature was verified when.
- **Never add behavior to the feature during this skill.** This is a state transition, not an edit.
