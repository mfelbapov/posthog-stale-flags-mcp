# PostHog Feature Flag Debt MCP — Implementation Plan

Task breakdown for shipping the MVP: two MCP tools (`find_stale_flags` + `archive_flag` with dry-run), a seeded PostHog demo project, a demo repo, a screencast, and a product memo. `propose_cleanup` is intentionally out of scope — Claude handles code edits directly in the demo.

Tasks are grouped into phases. Within a phase, tasks are ordered. Across phases, dependencies are called out. "Human" tasks are non-coding; "Code" tasks produce files in this repo.

---

## Phase 1 — Project Scaffold (Code)

**Blocks:** everything downstream.

- [ ] **1.1 Initialize pnpm workspace.** `pnpm init`. Set `"type": "module"`, Node `>=20`.
  Files: `package.json`.
  Done when: `pnpm --version` runs and `package.json` exists with scripts stubs (`build`, `test`, `lint`, `format`).

- [ ] **1.2 Install core dependencies.**
  `@modelcontextprotocol/sdk`, `zod`.
  Dev: `typescript`, `@types/node`, `vitest`, `@biomejs/biome`, `tsx`.
  Done when: `pnpm install` completes cleanly, lockfile committed.

- [ ] **1.3 Configure TypeScript.** `tsconfig.json` with `module: "NodeNext"`, `target: "ES2022"`, `strict: true`, `outDir: "dist"`.
  Done when: `pnpm exec tsc --noEmit` passes on an empty `src/`.

- [ ] **1.4 Configure Biome.** `biome.json` with recommended rules + 2-space indent.
  Done when: `pnpm exec biome check .` passes.

- [ ] **1.5 Configure Vitest.** `vitest.config.ts` with `test.include: ['test/**/*.test.ts']`, 30s timeout for integration-style tests.
  Done when: `pnpm test` runs (with 0 tests, exits 0).

- [ ] **1.6 Dummy MCP server.** `src/index.ts` registers one dummy tool (`ping` → returns `"pong"`) via stdio transport. Smoke-test by launching with `tsx src/index.ts` and verifying it speaks MCP JSON-RPC.
  Files: `src/index.ts`.
  Done when: a minimal MCP client (or `npx @modelcontextprotocol/inspector`) can call `ping` and get `"pong"`.

- [ ] **1.7 `.env.example`.** Keys only, no values: `POSTHOG_READ_KEY`, `POSTHOG_WRITE_KEY`, `POSTHOG_HOST`, `POSTHOG_PROJECT_ID`, `ALLOW_PROD` (default `false`).
  Done when: file exists and is committed; real `.env` is gitignored.

- [ ] **1.8 `.gitignore` hygiene.** Ensure `node_modules/`, `dist/`, `.env`, `.DS_Store`, `coverage/` are ignored.

---

## Phase 2 — PostHog Setup (Human)

**Can run in parallel with Phase 1.** Blocks Phase 5 (`find_stale_flags` live test) and Phase 7 (`archive_flag` live test).

- [ ] **2.1 Sign up.** Create account at posthog.com (free tier).

- [ ] **2.2 Pick cloud region.** US or EU. Record host URL (e.g., `https://us.posthog.com`) → paste into `.env` as `POSTHOG_HOST`.

- [ ] **2.3 Create demo project.** Name it `flag-debt-demo`. Record the numeric Project ID → `.env` as `POSTHOG_PROJECT_ID`.

- [ ] **2.4 Create read-only API key.** Personal API key, scopes: `feature_flag:read`, `insight:read`. → `.env` as `POSTHOG_READ_KEY`.

- [ ] **2.5 Create write API key.** Personal API key, scopes: `feature_flag:write` only. → `.env` as `POSTHOG_WRITE_KEY`.

- [ ] **2.6 Seed demo flags (~8 total).** Via UI or a throwaway seed script:
  - 3× rollout 100%, `created_at` >14 days ago, referenced in demo repo → **hero stale case**
  - 1× rollout 0%, >30 days since last evaluation → **kill-switch stale**
  - 1× rollout 50%, active, referenced in demo repo → **must NOT be flagged**
  - 1× exists in PostHog, no code reference → **orphan**
  - 1× referenced in demo repo, **does not exist** in PostHog → **dangler** (just don't create it)
  - 1× rollout 100%, tagged `permanent` → **must be skipped**

- [ ] **2.7 Backdate "old" flags.** The UI may not allow `created_at` edits; use `PATCH /api/projects/:id/feature_flags/:id/` via a one-off curl or node script. If the API rejects `created_at`, fall back to seeding flags manually and waiting — or just document the limitation and rely on evaluation-count recency.

- [ ] **2.8 Record flag keys + IDs.** Keep a local `demo-flags.md` (gitignored) listing each seeded flag's `key`, `id`, rollout %, tags. This is the cheat sheet for Phase 5/7 manual verification.

---

## Phase 3 — PostHog REST Client (Code)

**Depends on:** Phase 1. **Blocks:** Phase 5, Phase 7.

- [ ] **3.1 Types.** Model only what we use: `FeatureFlag` (`id`, `key`, `name`, `active`, `rollout_percentage`, `tags: string[]`, `created_at`, `filters`), `PaginatedResponse<T>` (`results`, `next`, `previous`).
  Files: `src/shared/posthog/types.ts`.

- [ ] **3.2 Client constructor.** `createPostHogClient({ host, projectId, apiKey })`. Builds a `fetch` wrapper that injects `Authorization: Bearer <apiKey>` and base URL.
  Files: `src/shared/posthog/client.ts`.

- [ ] **3.3 `listFeatureFlags()`.** Follows pagination via `next` URL. Returns `FeatureFlag[]`. Retry-on-429 with exponential backoff (2 retries max).
  Done when: unit test against a mocked `fetch` returns a merged flag list across 2 pages.

- [ ] **3.4 `archiveFlag(flagId)`.** `PATCH /api/projects/:projectId/feature_flags/:flagId/` with body `{ deleted: true }` (PostHog's archive semantic — verify once against a test flag in your demo project).
  Done when: a dry-run unit test mocks the PATCH and asserts the body.

- [ ] **3.5 Error classes.** `PostHogAuthError`, `PostHogRateLimitError`, `PostHogNotFoundError`. Thrown from the client on 401/403, 429, 404.
  Done when: tests assert each class is thrown for the appropriate status.

---

## Phase 4 — Safety Layer (Code)

**Depends on:** Phase 1. **Blocks:** Phase 5, Phase 7.

- [ ] **4.1 Env loader with prod guard.** `loadEnv()` reads required vars, throws on missing. Detects "prod" via a project name/tag check (e.g., `POSTHOG_PROJECT_ID` matching a known prod ID, or a `POSTHOG_PROJECT_ENV=prod` env var). If prod, refuse write operations unless `ALLOW_PROD=true`.
  Files: `src/shared/safety/env.ts`.

- [ ] **4.2 Path sanitization.** `validateRepoPath(input, cwd)`. Rejects absolute paths escaping `cwd`, rejects `..` segments, resolves symlinks and rejects those that escape. Returns a normalized absolute path.
  Files: `src/shared/safety/paths.ts`.
  Done when: unit tests cover `../`, absolute outside cwd, symlink to outside, valid subdirectory.

- [ ] **4.3 Audit log.** `appendAuditEntry({ tool, action, flagId, confirm, timestamp, result })`. Appends JSONL to `.posthog-flag-mcp-audit.log` in the user's home or repo. Every `archive_flag` write calls this.
  Files: `src/shared/safety/audit.ts`.
  Done when: writing an entry and re-reading it round-trips.

---

## Phase 5 — `find_stale_flags` Tool (Code)

**Depends on:** Phases 1, 3, 4. Live test depends on Phase 2.

- [ ] **5.1 Flag classifier.** Pure function: given `FeatureFlag[]` + `keepTag`, partition into `candidates` (rollout 0 or 100, `keepTag ∉ tags`) and `exempted` (the rest).
  Files: `src/find_stale_flags/classify.ts`.
  Done when: unit test covers 100% + no tag, 100% + permanent tag, 50% + no tag, 0% + no tag.

- [ ] **5.2 Ripgrep wrapper.** `scanRepo(repoPath, flagKeys, excludes)` shells to `rg --json` with `--fixed-strings` per key. Parses JSON stream, returns `Array<{ flagKey, file, line, snippet }>`. Falls back to a tiny JS walker if `rg` is not on PATH.
  Files: `src/find_stale_flags/scan.ts`.
  Excludes default: `node_modules/`, `.next/`, `dist/`, `build/`, `coverage/`, `.git/`, plus user-provided `exclude_dirs`.
  Done when: unit test against a fixture finds the expected matches and respects excludes.

- [ ] **5.3 Bucket classifier.** Given `candidates` + scan results + full flag set, compute three buckets:
  - `stale`: candidate with ≥1 code reference.
  - `orphans`: candidate with 0 code references.
  - `dangling`: flag keys found in code but not present in the PostHog flag set. (Requires the scanner to also look for a user-provided "suspected flag keys" list, OR infer from SDK patterns — v1 scope: skip dangling detection if it adds complexity; document the limitation. **Recommend: skip for MVP, document in README.**)
  Files: `src/find_stale_flags/classify.ts`.

- [ ] **5.4 Tool handler.** Zod schema for input (`repo_path: string`, `scan_config?: { exclude_dirs?: string[] }`, `keep_tag?: string` default `"permanent"`). Wires fetch → classify → scan → bucket. Returns a structured response with `stale`, `orphans`, (optionally `dangling`).
  Files: `src/find_stale_flags/tool.ts`.

- [ ] **5.5 Register tool in `src/index.ts`.** Replace the dummy `ping` tool. Wire env via `loadEnv()`.

- [ ] **5.6 Manual live test.** Against the demo project from Phase 2: run the MCP inspector, call `find_stale_flags` with `repo_path` pointing at Phase 8's demo repo. Verify the 3 hero stale flags + 1 kill-switch appear in `stale`, the orphan appears in `orphans`, the permanent-tagged flag does NOT appear anywhere.

---

## Phase 6 — Testing (Code)

**Depends on:** Phase 5.

- [ ] **6.1 Fixture repo: `repo-stale`.** Minimal TypeScript project under `test/fixtures/repo-stale/`. Contains ≥3 files with `posthog.isFeatureEnabled('<key>')` calls matching the hero stale flag keys from Phase 2. Also include one comment-only reference to verify grep doesn't false-positive (or document this limitation for v1).
  Done when: `rg` manually against the fixture finds the expected matches.

- [ ] **6.2 Integration test.** `test/find_stale_flags.test.ts`. Mocks the PostHog client (returns a canned flag list), runs the real scanner against `repo-stale`, asserts bucket contents.
  Done when: `pnpm test` passes.

- [ ] **6.3 Unit tests for safety layer.** Cover path traversal rejection, env loader missing-var error, audit round-trip.

---

## Phase 7 — `archive_flag` Tool (Code)

**Depends on:** Phases 1, 3, 4. Live test depends on Phase 2.

- [ ] **7.1 Tool handler.** Zod schema: `flag_id: number` (or string, match PostHog API), `confirm: boolean` default `false`.
  - If `confirm=false`: fetch the flag, return `{ dry_run: true, would_archive: { id, key, active, rollout_percentage, tags } }`. No API mutation.
  - If `confirm=true`: refuse if flag is tagged `keep_tag`. Otherwise call `archiveFlag(flagId)`. Append audit entry. Return `{ dry_run: false, archived: {...} }`.
  Files: `src/archive_flag/tool.ts`.

- [ ] **7.2 Register in `src/index.ts`.**

- [ ] **7.3 Unit test.** Mocked client: verify dry-run returns preview and does NOT call PATCH; verify confirm=true calls PATCH and writes audit entry; verify permanent-tagged flag is refused.

- [ ] **7.4 Manual live test.** Against a throwaway flag in the demo project: call dry-run → verify no state change → call with `confirm=true` → verify flag is archived in PostHog UI → verify audit log has the entry.

---

## Phase 8 — Demo Repo (Human + small code)

**Depends on:** Phase 2 flag keys being decided.

- [ ] **8.1 Create `posthog-flag-demo` repo.** Separate from this MCP repo. Next.js 14 + TypeScript, `pnpm create next-app`.

- [ ] **8.2 Install `posthog-node` + `posthog-js`.** Wire up a minimal provider in `_app.tsx`.

- [ ] **8.3 Add 8-12 flag call sites.** Across 4-6 files. Mix:
  - Direct: `if (posthog.isFeatureEnabled('hero-stale-1')) { ... }`
  - Hook: `const on = useFeatureFlagEnabled('hero-stale-2')`
  - Variant key: `useFeatureFlagVariantKey('active-flag')`
  - In a comment: `// TODO: remove hero-stale-3 gate` (false-positive probe)
  - One call site for the dangler flag key (exists in code, not in PostHog)

- [ ] **8.4 Commit with a realistic git history.** Multiple commits, different authors if possible (use `--author` flag). Makes git-blame memo claims honest later.

- [ ] **8.5 Deploy or keep local.** Local is fine for the screencast; deployment is not required.

---

## Phase 9 — Product Memo (Human)

**Can run in parallel with all code phases.** Target: 6-8 pages.

- [ ] **9.1 Draft opening: workflow vs reference MCP.** Define both categories; position existing PostHog AI as reference; position this MCP as workflow; argue first-mover advantage.

- [ ] **9.2 Problem section: flag debt as silent tax.** Evidence-based (no user quotes). Pull concrete cost examples from `PLAN.MD §1.3`.

- [ ] **9.3 Competitive teardown: LaunchDarkly.** `ld-find-code-refs`, Code References UI, Stale Flag Insights, lifecycle states, GitHub integration, their MCP. What LD has. What LD doesn't (agentic execution loop).

- [ ] **9.4 PostHog gap analysis.** What exists (tags, `$feature_flag_called` events, last-evaluated timestamps). What's missing (scanner, lifecycle states, staleness dashboard, GitHub integration).

- [ ] **9.5 Curator reframe.** Adopted from `plan2.md`: flag debt is a curation problem, not a detection problem. Evidence dossier (rollout %, age, last eval, eval-count trend, # call sites, git blame, tests reference). Cost × ease ranking. Git-blame + CODEOWNERS ownership. Multi-day `.posthog-flag-debt.json` state. Bulk orphan flow.

- [ ] **9.6 "Stale Flags" dashboard mockup + metrics.** 6-8 metrics, each with:
  - Definition (plain English)
  - SQL or pseudo-SQL sketch against PostHog's event model
  - What decision it drives
  Metrics:
  - Flag debt ratio (stale / total)
  - Cleanup velocity (detection → removal)
  - Average flag lifetime (creation → archive)
  - Time-to-100% (rollout decisiveness)
  - Time-to-cleanup (100% → removal)
  - Stale concentration by team/service
  - Experiment hygiene
  - Orphan count

- [ ] **9.7 Phased roadmap.** Phase 0 (MCP, built) → Phase 1 (dashboard) → Phase 2 (lifecycle + GitHub app) → Phase 3 (opt-in hashed call-site telemetry) → Phase 4 (cross-customer benchmarks). Each phase names what it unlocks commercially.

- [ ] **9.8 Pricing / packaging angle.** Free tier (ad-hoc queries), Paid (dashboard + GitHub auto-archive), Enterprise (benchmarks, self-hosted call-site telemetry, audit export).

- [ ] **9.9 Safety model writeup.** Four gates with shrinking blast radius: read-only scan auto-approve, Claude's diff approval, dry-run + confirm on external writes, PR merge as final. Scoped keys, prod guard, audit log, narrow tool surface. Cross-reference the prototype as proof.

- [ ] **9.10 Honest limitations.** Dynamic flag access via variables, dangling-flag ambiguity, monorepo scoping, TS-only v1, rollout % as weak day-1 signal, MCP defensibility = 0 until Phase 4 benchmarks. Name each. The defensibility concession is the one critique most memos duck — make it explicit.

- [ ] **9.11 Closing.** One paragraph tying prototype + memo + roadmap together.

- [ ] **9.12 Final pass.** Read aloud. Cut anything that isn't a claim or evidence. Target 6-8 pages.

---

## Phase 10 — Polish & Release (Mixed)

- [ ] **10.1 README.** Install, configure `.env`, register in Claude Code, run examples for both tools, link to memo + screencast.
  Files: `README.md`.

- [ ] **10.2 Screencast (Human).** 90 seconds max. Script:
  1. Open Claude Code in the demo repo (5s)
  2. "Find stale PostHog flags in this repo" → show three buckets returned (25s)
  3. Claude reads one call site, proposes a code edit, user approves via native diff prompt (25s)
  4. "Archive flag `<id>`, dry-run" → show preview (10s)
  5. "Archive with confirm=true" → show PostHog UI flag now archived + audit log entry (20s)
  6. Cross-cut to memo closing line (5s)
  Tools: QuickTime + any light editor.

- [ ] **10.3 Repo hygiene.** Remove any TODOs, fix lint, ensure `pnpm test` + `pnpm exec biome check` pass clean. Verify `.env` is gitignored and no secrets leaked.

- [ ] **10.4 Cross-link.** Memo links to repo + screencast. README links to memo. Screencast description links to memo + repo.

---

## Dependency summary (what blocks what)

```
Phase 1 (scaffold) ──┬──> Phase 3 (client) ──┬──> Phase 5 (find_stale_flags) ──> Phase 6 (testing)
                     │                       │                                  │
                     ├──> Phase 4 (safety) ──┴──> Phase 7 (archive_flag) ───────┤
                     │                                                          │
Phase 2 (PostHog)────┴──> Phase 8 (demo repo) ────────────────────────────────> Phase 10 (polish)
                                                                                │
Phase 9 (memo) ─── parallel with all of the above ──────────────────────────────┘
```

## Pre-flight checks before starting

- [ ] `pnpm --version` and `node --version` (≥20).
- [ ] `rg --version` installed (macOS: `brew install ripgrep`).
- [ ] Claude Code config file location known (for Phase 5/7 MCP registration).
- [ ] Decide US vs EU PostHog cloud up-front (affects every host URL).