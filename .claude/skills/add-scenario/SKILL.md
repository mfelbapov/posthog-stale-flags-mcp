---
name: add-scenario
description: Add a new Gherkin scenario to a feature and drive the red-to-green TDD loop. Appends the scenario, generates a failing test, runs it, unlocks code edits, and refuses to start a new scenario until the current one is green.
---

# add-scenario

Drives the test-first loop for a single new scenario. The skill enforces the order: feature → failing test → code → green. It refuses to let you skip ahead.

## Inputs

- `feature` — short name of the feature (e.g. `find_stale_flags`). Must correspond to an existing `features/<feature>.feature` file and `src/features/<feature>/` folder.
- `scenario` — Gherkin block (title + Given / When / Then steps).

## Preconditions

- `features/<feature>.feature` exists.
- `src/features/<feature>/` exists.
- `test/features/<feature>/` exists.
- The last scenario added via this skill is green. If the most recent `test/features/<feature>/NN-<slug>.test.ts` is red, stop and finish it before starting a new one.

## Steps

1. **Refuse if frozen.** Read `features/<feature>.feature` frontmatter. If it contains `status: frozen`, stop and tell the user to run `/unfreeze-feature <feature> "<reason>"` first.
2. **Append scenario.** Append the Gherkin block to `features/<feature>.feature` under the existing `Feature:` section.
3. **Derive slug + ordinal.** Slugify the scenario title (lowercase, spaces → `-`, strip punctuation). Find the next ordinal by listing existing `NN-*.test.ts` files in `test/features/<feature>/` and incrementing the max.
4. **Generate failing test.** Create `test/features/<feature>/NN-<slug>.test.ts` with:
   - `import { describe, it, expect } from 'vitest';`
   - `describe('<feature>', () => { it('<exact scenario title>', () => { expect.fail('not implemented'); }); });`
   The `it()` string must be the scenario title verbatim — the drift linter checks this.
5. **Run red.** `pnpm vitest run test/features/<feature>/NN-<slug>.test.ts`. Assert exit code is non-zero and output names the scenario title. If green without any code change, stop — the scenario is trivially true or the test is malformed.
6. **Unlock code.** Return control to the user/LLM to edit `src/features/<feature>/**` until the specific test goes green. The skill does not write production code itself.
7. **Run green.** Once the user signals done, re-run `pnpm vitest run test/features/<feature>/NN-<slug>.test.ts`. If still red, loop back to step 6.
8. **Done.** Report the scenario title, the test file path, and a one-line reminder to commit via `/commit-and-push` so the coupling hook sees all three (feature + test + code).

## Safety rules

- **Never skip step 5.** If you can't confirm red before code edits, you risk writing a test that trivially passes and doesn't actually check behavior.
- **Never modify other scenarios' tests in this skill.** If an existing test is wrong, finish this scenario first, then refactor the other test separately (that's its own scenario rewrite, not a side effect).
- **Never freeze the feature inside this skill.** Freezing is an explicit separate act via `/freeze-feature`.
- **`it()` string is the scenario title verbatim.** Paraphrasing breaks the drift linter.
