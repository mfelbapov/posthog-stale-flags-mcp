# PostHog Feature Flag Debt MCP — Claude Context

A Model Context Protocol (MCP) server that helps developers clean up stale PostHog feature flags from inside Claude Code: *find → diff → PR → archive*, human-in-the-loop on every destructive action.

Full design lives in [PLAN.MD](PLAN.MD). This file is the fast-orientation summary.

## What this project is

A TypeScript MCP server. The MCP is the **test rig**, not the product — the product vision is a closed-loop Feature Flag Debt Manager embedded in PostHog. This repo is the narrow, working prototype that proves the execution half.

## Tool surface (three tools)

1. **`find_stale_flags(repo_path, scan_config?, keep_tag?)`** — read-only. Fetches PostHog flags → filters to 100% / 0% rollout → skips anything tagged `permanent` (configurable) → greps repo for flag keys → returns three categorized lists: `stale`, `orphans`, `dangling`.

2. **`propose_cleanup(flag_key)`** — read-only. Returns `{ code_edits: [...], posthog_action: {...} }`. Operations: `remove_gate` (collapse if/else to surviving branch) or `remove_call`. The MCP returns a plan; Claude applies edits with its own Edit tool.

3. **`archive_flag(flag_id, confirm=false)`** — write. Defaults to dry-run. Only mutates PostHog when `confirm=true` is explicitly passed.

## Stack

- TypeScript, Node 20+
- `@modelcontextprotocol/sdk` with stdio transport
- `zod` for schema validation
- Shell out to `ripgrep`; JS regex walker fallback
- Hand-rolled PostHog REST client with `fetch` (no SDK dependency)
- `vitest` for tests, fixtures in `test/fixtures/`
- `pnpm` for package management
- `biome` for lint + format

## Safety model (non-negotiable)

- API keys from env vars only (`POSTHOG_READ_KEY`, `POSTHOG_WRITE_KEY`) — never through tool arguments.
- `archive_flag` defaults to dry-run; write requires explicit `confirm=true`.
- `repo_path` validated against working directory; reject `..` and escaping symlinks.
- Prod projects refuse writes unless `ALLOW_PROD=true`.
- Separate scoped keys: read-only for scan, flags-only for archive.
- Audit log for every write operation.
- **No generic `posthog_api_request` escape hatch.** No bulk mutations — one flag per call.

## SDK patterns to detect (v1, TS/JS)

- `posthog.isFeatureEnabled('key')`
- `posthog.getFeatureFlag('key')`
- `posthog.onFeatureFlag('key', ...)`
- `useFeatureFlagEnabled('key')`
- `useFeatureFlagVariantKey('key')`

Exclude matches inside comments, string literals in test fixtures, and files under `node_modules/`, `.next/`, `dist/`, `build/`, or user-configured excludes. Grep is **flag-key-list-driven** (keys from PostHog API), not SDK-pattern-driven.

## The `permanent` tag

PostHog has native tag support on feature flags. Any flag tagged with the configured `keep_tag` (default `"permanent"`) is exempt end-to-end — `find_stale_flags` skips it, `propose_cleanup` refuses, `archive_flag` refuses.

## Project structure (target)

Feature-isolated: each MCP tool owns its own folder under `src/features/<name>/`, a `.feature` spec, and a test directory. Cross-feature code lives under `src/shared/`.

```
src/
├── index.ts                # MCP server entrypoint
├── features/
│   ├── find_stale_flags/   # tool.ts + local scan/classify
│   ├── propose_cleanup/
│   └── archive_flag/
└── shared/
    ├── posthog/            # client.ts, types.ts
    ├── safety/             # paths.ts, env.ts, audit.ts
    └── util/               # snippets.ts, ripgrep helpers
features/
├── find_stale_flags.feature
├── propose_cleanup.feature
└── archive_flag.feature
test/
├── fixtures/               # repo-clean, repo-stale, repo-permanent, repo-wrapper, repo-dangling, repo-commented
└── features/               # one scenario per test file, path mirrors features/
    ├── find_stale_flags/
    ├── propose_cleanup/
    └── archive_flag/
scripts/
├── check-features.mjs      # drift linter
└── hooks/pre-commit        # coupling + freeze enforcement
```

## Build order

1. Scaffold TS project + MCP server boilerplate with one dummy tool.
2. PostHog REST client: list flags with pagination, include tags.
3. Flag classifier: rollout + tag filter.
4. Scanner: ripgrep wrapper against known flag keys.
5. Wire `find_stale_flags` end-to-end.
6. Fixture tests for all six fixtures.
7. Add `propose_cleanup`.
8. Add `archive_flag` with dry-run + confirm + audit log.
9. Safety layer: paths, env, prod guard.
10. README, INSTALL, SAFETY docs.

## What NOT to do

- No generic `posthog_api_request` tool.
- No automatic code edits from the MCP — only return plans, Claude edits.
- No bulk archive. One flag per call.
- No confidence scoring — three clean buckets.
- No CI pipelines, no GitHub app, no Slack integration in v1.
- No Python/Go/Ruby in v1. TypeScript only.
- No call-site telemetry, no SDK changes, no data collection in the MCP itself. v1 runs entirely on existing PostHog API data + local grep.

## Conventions

- Default to writing no comments unless the WHY is non-obvious.
- Prefer editing existing files over creating new ones.
- Match the scope of changes to what was asked — no drive-by refactors.

## Coding workflow (TDD with Gherkin specs)

This project uses a somewhat test-driven workflow: Gherkin `.feature` files are human-readable specs (not executed via a BDD runner), and `vitest` is the executable layer. The feature file is the **design artifact**; the test file is the **executable artifact**; both must stay in lockstep.

### The loop

1. **Feature.** A new behavior starts with a `Scenario:` added to `features/<feature>.feature`. Gherkin `Given / When / Then`. One scenario = one testable assertion.
2. **Failing test.** A matching test file is created at `test/features/<feature>/NN-<slug>.test.ts` with a single `it('<exact scenario title>', ...)` that initially fails (throws or `expect.fail()`).
3. **Run red.** `pnpm vitest run test/features/<feature>/NN-<slug>.test.ts` — confirm it actually fails for the right reason.
4. **Code.** Modify `src/features/<feature>/**` until the specific test goes green.
5. **Run green.** Re-run the test file; confirm green. Move on.

Use the `/add-scenario` skill to drive this loop — it refuses to let you skip steps.

### Feature-isolated folders

Two code regions with different rules:

- `src/features/<X>/**` — owned by `features/<X>.feature` and `test/features/<X>/**`. One feature = one folder. Reaching across features (importing from `src/features/Y/` inside `src/features/X/`) is a smell — the shared piece belongs in `src/shared/`.
- `src/shared/**` — cross-feature code (PostHog client, safety utilities, snippet helpers). Owned by no single feature. Changes here must be verified against *every* consuming feature.

### Coupled-commit rule (enforced by the pre-commit hook)

- If a commit modifies `src/features/<X>/**`, it must also stage `features/<X>.feature` **or** a file under `test/features/<X>/**`. Otherwise the commit is rejected.
- If a commit modifies `src/shared/**`, it must also stage at least one file under `test/features/**/`. Otherwise the commit is rejected.
- Whitespace-only and comment-only edits to `src/**` do **not** trigger the coupling check (the hook strips those before deciding). Renames, import reordering, and format-only passes fall through without fuss.

### One-scenario-per-test-file convention

- Test file name stem must match a `Scenario:` title (slugified). A scenario with no matching test file, or a test file with no matching scenario, is a drift error and fails `pnpm precommit` via `scripts/check-features.mjs`.
- `it()` string must be the **exact scenario title**, not a paraphrase. The linter diffs these as strings.
- Prefix test filenames with a two-digit ordinal (`01-`, `02-`) so ordering is stable and scenario additions don't reshuffle the directory.

### Re-read-before-edit rule (LLM discipline)

Before modifying any `test/features/**/*.test.ts`, re-read the corresponding `.feature` file. Before modifying any `src/features/<X>/**`, re-read both `features/<X>.feature` and the test files for that feature. This keeps scenario, test, and code aligned during the editing loop — the LLM's own memory is not a reliable anchor, the files are.

### Frozen features

Once a feature is complete, run the `/freeze-feature <name>` skill. This adds `status: frozen` to the feature file's frontmatter. The pre-commit hook then rejects any edit to `src/features/<X>/**` for frozen features. To modify a frozen feature, run `/unfreeze-feature <name> "<reason>"` first — this removes the freeze and appends a history entry with the reason. The unfreeze is auditable in `git log`.

### The `[no-feature]` trailer (escape hatch)

For genuine behavior-preserving refactors (pure renames, import reordering, moving code between shared utilities) where coupling doesn't apply, include a `[no-feature]` trailer in the commit message. The hook skips coupling checks when this trailer is present. Use it sparingly — it's auditable in `git log`, and routine use means the coupling rule is miscalibrated. If you reach for it more than occasionally, either the feature boundaries are wrong or `src/shared/` is doing too much.

### Workflow skills

- **`/add-scenario <feature> <gherkin>`** — append a new scenario, generate its failing test, enforce red → green. Use when adding any new user-visible behavior.
- **`/propagate-shared-change <path>`** — intelligence layer for `src/shared/**` edits. Finds consumer features, runs their tests, walks failures. Use before editing anything under `src/shared/`.
- **`/freeze-feature <feature>`** — mark a feature done. Requires all tests green. Use when a feature is stable and you don't want silent drive-by edits.
- **`/unfreeze-feature <feature> "<reason>"`** — explicit, auditable unfreeze. Use when you need to modify a frozen feature — the reason ends up in `git log`.

### Scope of brutality

The coupled-commit rule and one-scenario-per-file convention apply to `src/features/**` and `src/shared/**`. Small pure utilities that don't correspond to user-visible behavior (internal type helpers, format utilities) can live under `src/shared/util/` with plain vitest tests — no `.feature` file needed. Don't write Gherkin for things that aren't tool-visible behavior; the ceremony isn't worth it.

### Installing the pre-commit hook

The hook script lives at `scripts/hooks/pre-commit`. It's not auto-installed. After cloning, run:

```bash
ln -s ../../scripts/hooks/pre-commit .git/hooks/pre-commit
chmod +x scripts/hooks/pre-commit
```

Without the symlink, the coupling rules and freeze checks are **advisory only** — the drift linter still runs as part of `pnpm precommit`, but commits that skip the gate can land. The hook is the floor; skills are the ergonomic layer; `pnpm precommit` is the belt on top.
