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

```
src/
├── index.ts                # MCP server entrypoint
├── tools/
│   ├── find_stale_flags.ts
│   ├── propose_cleanup.ts
│   └── archive_flag.ts
├── scanner/                # patterns.ts, scan.ts, classify.ts
├── posthog/                # client.ts, types.ts
├── safety/                 # paths.ts, env.ts, audit.ts
└── util/                   # snippets.ts
test/
├── fixtures/               # repo-clean, repo-stale, repo-permanent, repo-wrapper, repo-dangling, repo-commented
└── tools/
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
