---
name: propagate-shared-change
description: Intelligence layer for edits under src/shared/. Identifies consumer features, captures baseline test state, applies the change, re-runs affected tests, and walks through failures to classify behavior deltas vs overfit tests. Refuses if target is outside src/shared/.
---

# propagate-shared-change

Drives safe edits to cross-feature code. A change to `src/shared/posthog/client.ts` can silently break any feature that imports it; the pre-commit hook only catches the gross case (no test file touched at all). This skill does the semantic work the hook can't — walks every consumer, verifies nothing regressed, and forces explicit reasoning when a test goes red.

## Inputs

- `target` — path to the file or module under `src/shared/**` that will be modified.
- `change_description` — one-line summary of what the change does (for the commit message and for reasoning about behavior deltas).

## Preconditions

- `target` resolves to a real file or directory under `src/shared/**`. Refuse if outside.
- `pnpm` is available and `pnpm precommit` is defined (i.e., package.json scaffolded).

## Steps

1. **Refuse outside shared.** If `target` does not start with `src/shared/`, stop with a message pointing the user at `/add-scenario` for feature-local edits.
2. **Find consumers.** `grep -rl "<import path>"` across `src/features/**`. Normalize import paths (strip file extensions, resolve index files). Produce the consumer-features list, e.g. `[find_stale_flags, archive_flag]`.
3. **Baseline.** For each consumer: `pnpm vitest run test/features/<consumer>`. Record pass/fail per file. If **any** test is already red before the change, **stop** — pre-existing drift must be resolved first (use `/add-scenario` to rework the relevant scenario, or fix the test). Do not proceed with red baseline.
4. **Apply the change.** Edit `target` per the user's request.
5. **Re-run consumers.** `pnpm vitest run test/features/<consumer>` for each consumer identified in step 2.
6. **Classify failures.** For each test that was green in baseline and is now red:
   - Read the scenario in `features/<consumer>.feature` that owns the failing `it()`.
   - Decide (ask the user if ambiguous):
     - **(a) Real behavior delta** — the feature's contract changed. Update the scenario via `/add-scenario` (if new) or rewrite the existing scenario + test. The `.feature` file must reflect the new behavior.
     - **(b) Overfit test** — the feature's contract is unchanged, but the test was checking an implementation detail. Update the test only. Note the decision explicitly in the commit message body.
7. **Loop.** Re-run all consumers until every test file that was green in baseline is green again.
8. **Report.** Print:
   - target file changed
   - consumers touched
   - scenarios rewritten (if any), with a one-line reason each
   - tests updated as overfit fixes (if any), with one-line reason each
9. **Hand off.** Do **not** commit inside this skill. Direct the user to `/commit-and-push` so the full change (shared code + any consumer feature/test updates) lands as a coherent commit that the hook can validate.

## Safety rules

- **Never proceed with a red baseline.** If pre-existing tests fail before your change, you cannot distinguish regressions from pre-existing drift. Fix those first.
- **Never silently "fix" a scenario to match broken code.** If a test goes red and you can't articulate whether it's a behavior delta or an overfit test, stop and ask the user.
- **Never edit `src/features/**` without also editing the matching `features/<X>.feature`** — the coupled-commit hook enforces this, but this skill should keep them in lockstep proactively.
- **Never use this skill for edits under `src/features/**`.** That's `/add-scenario` territory.
- **One shared change per invocation.** Mixing two unrelated shared edits in one run makes failure classification ambiguous.
