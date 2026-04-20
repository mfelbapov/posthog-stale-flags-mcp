# PostHog Stale Feature Flag MCP — Project Plan

## 1. The Idea

### 1.1 What this project is

A Model Context Protocol (MCP) server that plugs into Claude Code (or any MCP-capable editor) and lets a developer clean up stale PostHog feature flags from their editor in one session: *scan → review → PR → archive*. Three tools, human-in-the-loop on every destructive action, no CI setup.

But the MCP itself is the test rig, not the product. The product vision is a closed-loop **Feature Flag Debt Manager** inside the PostHog ecosystem that removes the cognitive load of flag cleanup from engineering teams.

Section 1.12: Data as the commercial moat. The MCP executes cleanup; the larger product measures flag health. Once scans run continuously (CI pipeline in Phase 1, or PostHog-hosted scanner in Phase 2), PostHog accumulates per-org flag debt time series. This enables (a) an eng-manager dashboard surface — debt ratio, cleanup velocity, time-to-100% — which is the buyer-facing view, (b) opt-in cross-customer benchmarks, a defensible moat that compounds with customer count, and (c) correlations between flag hygiene and other engineering metrics PostHog already captures (deploy frequency, error rates). The prototype is local-only to respect trust boundaries; the productized version uploads metrics, never code.

Section 1.13: The runtime data bet. Beyond the MCP execution loop, PostHog's long-term moat isn't a better scanner — it's shifting the source of truth from static code analysis to runtime evaluation telemetry. Every $feature_flag_called event already records a flag evaluation; augmenting the SDKs to also capture the call site (file, line, function) turns PostHog's event stream into a live index of where flags are evaluated. Combined with LLM-inferred scanner patterns for the static cases telemetry misses, this reframes flag debt from a parsing problem into a data problem — which is PostHog's home territory, not LaunchDarkly's. The MCP prototype validates the execution loop; the SDK augmentation validates the data approach; together they define the product category.

### 1.2 The closed-loop product vision

The MCP proves the mechanism works. The real product is four linked surfaces:

1. **Discovery (PostHog UI):** a "Stale Flags" insight dashboard. Engineering managers see "42 flags at 100% rollout for 30+ days" as a first-class metric, alongside retention and conversion.
2. **Nudge (Slack / GitHub):** when a flag crosses a staleness threshold, PostHog notifies the right engineer — not the whole team — with one click to generate a cleanup PR.
3. **Execution (agent + MCP-style tooling):** an agent scans the connected repo, finds the dead `if/else` gated by the stale flag, opens a PR with the diff. This is what the MCP prototype proves works.
4. **Archive (loop closure):** PostHog detects the PR merge via GitHub webhook and automatically archives the flag in the dashboard. No orphans, no cleanup backlog.

The MCP is step 3, standalone and editor-hosted. The full product runs all four steps with PostHog as the orchestrator.

### 1.3 The problem: flag debt

Every feature flag is a small, dated contract between code and a dashboard. Once a flag is rolled out to 100% or turned permanently off, the gated code becomes dead — but it keeps living in the codebase because cleanup is nobody's job.

Concrete costs:

- **Dead branches in `if/else` gates** that developers still read, reason about, and maintain.
- **Orphan flags in the dashboard** that confuse new engineers ("is this one live?").
- **Dangling references in code** to flags that were deleted in PostHog, silently evaluating to the default every request.
- **Slower refactors** because engineers fear touching gated code they don't own.
- **Onboarding tax** — new engineers read every flag check and ask "is this on or off right now?"

Flag debt is long-tail reliability and velocity drag, not a clean dollar number. That matters for how the product is pitched: *"reduces a silent tax on engineering velocity"* is more honest than *"saves N hours per week."*



### 1.4 How teams solve this today

Badly:

- **Quarterly "flag bankruptcy" sprints** — manual audit of every flag, cleanup in a batch. Engineers dread them.
- **Naming conventions** — prefix with creation date or ticket number so they sort chronologically. Weak defense.
- **Ticket-when-you-flag rituals** — create a cleanup ticket whenever a flag is created. Rarely followed through.
- **Custom grep scripts** that one senior engineer maintains.
- **Most commonly: ignore it.** Flags accumulate. A 5-year-old codebase with 200 flags and 30 actually active is normal.

### 1.5 Competitive landscape: LaunchDarkly

LaunchDarkly solves this problem with mature, layered tooling:

- **`ld-find-code-refs`** — an open-source CLI (Go) that scans a repo for flag keys and uploads results to LaunchDarkly. Runs in CI (GitHub Actions, CircleCI, GitLab, Bitbucket). Uses ripgrep with configurable per-language patterns. Supports aliases for wrapper functions. About 5 years mature.
- **Code References UI** — each flag's detail page shows file paths, line numbers, and links to GitHub. Click any flag, see where it's used.
- **Stale flag insights** — dashboard listing flags not modified in N days, not evaluated in N days. Custom staleness rules per org.
- **Lifecycle states** — flags have formal states (`new` → `active` → `launched` → `archived`). "Launched" is the explicit "clean me up" state.
- **GitHub integration** — PR comments when flag references change, status checks that fail a PR if a removed flag is still referenced elsewhere, audit trail.
- **Recent AI/MCP features** — an MCP server exists for their API, oriented toward reading/managing flags, not code transformation.

**What LaunchDarkly does not have:** an agentic end-to-end cleanup. Their system reports where flags live; it doesn't rewrite the code. The human still has to do the `if/else` surgery.

### 1.6 What PostHog has today

PostHog's feature flag product is good — targeting, variants, local evaluation, last-evaluated timestamps — but has gaps specifically around the cleanup workflow:

- **No code reference scanner.** PostHog has no equivalent of `ld-find-code-refs`.
- **No formal lifecycle states.** Flags are flatter (active / archived) without a "launched / should be cleaned up" state.
- **No staleness insights dashboard.** Last-evaluated data exists but isn't surfaced as an eng-manager-friendly insight.
- **No PR/GitHub integration for flag cleanup.** Flag archival is a manual UI action.

So PostHog has the raw telemetry (evaluation history, rollout state) but not the workflow.

### 1.7 The gap nobody has filled

Neither PostHog nor LaunchDarkly closes the loop. LaunchDarkly gives you a list; you still do the code change by hand. PostHog doesn't even give you the list. Nobody, as of today, does:

> *Find the stale flag → rewrite the code → open a PR → archive the flag in the dashboard* — in one developer interaction, from the editor.

This gap is now addressable because of two things that didn't exist 18 months ago:

1. **Agentic coding tools (Claude Code, Cursor, Copilot Workspace)** that can read a repo, propose diffs, and open PRs with minimal human orchestration.
2. **MCP** as a standard way for those tools to consume structured, domain-specific capabilities.

The combination lets a small, narrow MCP deliver what previously required a whole platform.

### 1.8 Our approach

**Phase 0 (this project): a standalone MCP for Claude Code.** Three tools, narrow scope, TypeScript-first. A developer installs it, points it at their repo, asks Claude to clean up stale PostHog flags, gets a PR. Proves the mechanism works end-to-end.

**Phase 1 (if adopted): productize as "PostHog Code Cleanup."** Add the insights dashboard (`Stale Flags` view in PostHog UI), a GitHub app for PR creation without a local editor, and Slack nudges. The MCP becomes one of several execution paths.

**Phase 2 (full vision): the closed loop.** Webhook on PR merge → auto-archive flag. Integration with experiments (when a test concludes, suggest cleanup of the losing variant). Extend beyond flags to other debt signals PostHog uniquely sees (dead events, unused cohorts).

### 1.9 Why this approach makes sense

**Division of labor between MCP and LLM, correctly done:**

- MCPs are good at giving LLMs **structured, verified facts** the LLM can't easily derive: current flag state from an API, cross-references between code and dashboard, safe write operations with dry-run.
- LLMs are good at **code transformation in context**: preserving style, fixing imports, running formatters, handling edge cases.

Trying to make the MCP write code is fighting the LLM's strength. Trying to make the LLM guess API shapes is fighting the LLM's weakness. Our three-tool surface plays to both.

**Structural advantages over LaunchDarkly's CI-based approach:**

- **Zero setup.** No CI pipeline, no workflow YAML, no pre-configured keys in GitHub. Developer installs the MCP, pastes an API key into their env, runs.
- **In-the-loop with code changes.** LaunchDarkly's scanner reports; a human still does the cleanup. Our flow closes the loop in one session.
- **Portable.** The same MCP pattern extends to LaunchDarkly, Statsig, Unleash, OpenFeature. Flag provider is a plugin; workflow is stable.

**Honest competitive note (do not overclaim):**

LaunchDarkly's scanner is deterministic, CI-verified, and mature. An agentic workflow is *more convenient* but *less deterministic* today. The right claim is "better UX and distribution for the common case," not "beats LaunchDarkly technically." Reliability parity comes from good test coverage on the scanner, not from the agent.

### 1.10 Who it's for

- **User** (hands-on-keyboard): individual engineers during regular development, especially when they see `if (posthog.isFeatureEnabled("old-thing"))` and wonder if it's still needed.
- **Buyer** (at scale): engineering managers who want the `Stale Flags` insight dashboard and periodic cleanup as a visible workflow. They approve the PostHog plan upgrade.

This matters because the MCP alone serves the user; the full product (Phase 1+) is what converts an eng manager from "interested" to "purchaser." The MCP is the wedge.

### 1.11 Safety model and human-in-the-loop

Every destructive action crosses at least one human checkpoint. The principle isn't "the LLM can't be trusted" — it's "flag cleanup is boring work that shouldn't have surprising outcomes."

Gates, layered:

1. **Scan is read-only and safe.** Auto-approvable. No mutations possible.
2. **Code edits go through Claude Code's native permission prompt.** Developer sees every diff before it applies.
3. **PostHog mutations (archive) default to dry-run.** `archive_flag(flag_id, confirm=false)` returns what *would* happen. Explicit `confirm=true` required to mutate. Also gated by Claude Code's tool permission prompt.
4. **PR review is the final checkpoint.** No code reaches production until the developer merges.

Additional safety properties:

- **Credentials never flow through the model.** API keys are read from the MCP's environment, not passed as tool arguments.
- **Scoped API keys.** Read-only key for scanning, write-scoped key (flags-only) for archiving. Principle of least privilege.
- **Dev/prod separation.** The MCP checks the PostHog project environment on startup and runs read-only against anything flagged production unless `--allow-prod` is explicitly set.
- **Narrow tool surface, no generic API proxy.** The MCP does not expose `posthog_api_request(endpoint, method, body)`. Only specific tools with specific shapes.
- **Path sanitization.** `repo_path` is validated against the user's working directory, no `..` or symlink escape.
- **Audit log.** Every write operation logged locally and echoed in the PR body.
- **No bulk mutations.** One flag per call, one confirmation per call. Slow is safe.

## 2. Tool Surface

Three tools, simple and categorized (no confidence scores — buckets, not probabilities):

### `find_stale_flags`

Read-only. Scans the repo, fetches PostHog flag state, cross-references.

**Input:**
- `repo_path` (string, required)
- `scan_config` (optional): `languages`, `exclude_dirs`, `include_comments`
- `staleness_rules` (optional): `rollout_at_100_days`, `rollout_at_0_days`, `not_evaluated_days`

**Output:** three categorized lists — `stale`, `orphans`, `dangling`. Each entry has the flag key, PostHog metadata, call sites (`file:line` + snippet), and which branch survives cleanup (`then` or `else`).

### `propose_cleanup`

Read-only. Given a single flag key, returns a structured plan: which code edits to make, which PostHog action to take. Claude applies the edits using its own Edit tool.

**Input:** `flag_key`
**Output:** `{ code_edits: [{file, line_range, operation}], posthog_action: {type, flag_id} }`

### `archive_flag`

Write. Default dry-run. Archives a flag in PostHog only if `confirm=true`.

**Input:** `flag_id`, `confirm` (bool, default `false`)
**Output:** in dry-run mode, a description of what would happen. In confirm mode, the API result.

## 3. Stack

**Language: TypeScript** on Node 20+.
- Matches PostHog's primary SDK stack (their users are mostly TS/JS).
- MCP TypeScript SDK (`@modelcontextprotocol/sdk`) is the most mature.
- Easy to distribute via `npx`.

**MCP SDK:** `@modelcontextprotocol/sdk` with stdio transport for v1. HTTP/SSE later if hosted.

**Schema validation:** `zod` for tool input/output schemas. Surfaces clean error messages to Claude.

**Repo scanning:** shell out to `ripgrep` (`rg`) for speed. It's already installed on most dev machines and in Claude Code environments. Fall back to a JS regex walker if `rg` isn't available.

**AST (Phase 2):** `ts-morph` for TypeScript-specific wrapper detection. Skip for v1 — regex covers the common case.

**PostHog API client:** hand-rolled using `fetch`. Don't pull in a heavy SDK for five endpoints.

**Testing:** `vitest`. One fixture repo per test case.

**Package manager:** `pnpm`. Faster, stricter, cleaner lockfile than npm.

**Linting:** `biome` (single tool for lint + format, faster than eslint+prettier).

**Target platforms:** macOS and Linux. Windows best-effort via WSL.

## 4. Project Structure

```
posthog-stale-flags-mcp/
├── src/
│   ├── index.ts                  # MCP server entrypoint, tool registration
│   ├── tools/
│   │   ├── find_stale_flags.ts
│   │   ├── propose_cleanup.ts
│   │   └── archive_flag.ts
│   ├── scanner/
│   │   ├── patterns.ts           # SDK regex patterns per language
│   │   ├── scan.ts               # ripgrep wrapper
│   │   └── classify.ts           # join PostHog state + code refs into buckets
│   ├── posthog/
│   │   ├── client.ts             # REST wrapper (fetch)
│   │   └── types.ts              # flag, variant, evaluation types
│   ├── safety/
│   │   ├── paths.ts              # path sanitization
│   │   ├── env.ts                # key loading, dev/prod check
│   │   └── audit.ts              # audit log
│   └── util/
│       └── snippets.ts           # extract code context around a line
├── test/
│   ├── fixtures/
│   │   ├── repo-clean/           # no stale flags
│   │   ├── repo-stale/           # multiple stale flags
│   │   ├── repo-wrapper/         # wrapped flag calls
│   │   └── repo-dangling/        # code refs without PostHog flags
│   └── tools/
│       ├── find_stale_flags.test.ts
│       └── archive_flag.test.ts
├── docs/
│   ├── README.md
│   ├── INSTALL.md
│   └── SAFETY.md
├── package.json
├── tsconfig.json
├── biome.json
└── .env.example
```

## 5. Demo App Requirements

Separate repo. `posthog-demo-app` or similar. Not part of this repo.

**Stack:** Next.js 14 + TypeScript, minimal Supabase or plain file-backed data. ~15 files, ~500 lines.

**Content:**
- 15 flag check call sites across 5–8 files
- Mix of direct calls and one wrapper function
- A couple of flag checks in comments (for false-positive testing)
- Realistic git history

**PostHog state for the demo project (12–15 flags):**

| Count | Category | Purpose |
|-------|----------|---------|
| 4 | 100% rollout, >14 days old, in code | Hero stale case |
| 2 | 0% rollout, not evaluated in 30+ days | Kill-switch stale |
| 2 | 50% rollout, active experiments | Must NOT be flagged as stale |
| 2 | In PostHog, no code references | Orphans |
| 2 | In code, not in PostHog | Danglers |
| 1 | Wrapped in helper | Edge case / graceful limitation |

Backdate the "old" flags via the PostHog API so timestamps look real.

## 6. PostHog Account Setup

1. Sign up at posthog.com (free tier covers the demo).
2. Pick US or EU cloud. Note the host URL.
3. Create a project named `demo` (or similar).
4. Record the Project ID.
5. Create two personal API keys in user settings:
   - Read-only, scoped to flags + insights — used by `find_stale_flags`
   - Write, scoped to flags only — used by `archive_flag`
6. Create the 12–15 demo flags per the table above.
7. Instrument the demo app with `posthog-js` and `posthog-node` so flags have evaluation telemetry.

## 7. Phased Build Plan

**Week 1: Core MCP (read-only).**
- Scaffold: TypeScript, MCP SDK, stdio transport, one trivial tool that proves wiring.
- PostHog client: list flags, pagination, evaluation timestamps.
- Scanner: ripgrep patterns for TypeScript/JavaScript. Emit `file:line:snippet` triples.
- `find_stale_flags` tool: fetch → scan → classify → return three buckets.
- Fixture tests for all three buckets and the false-positive comment case.

**Week 2: Cleanup and write path.**
- `propose_cleanup` tool: given a flag, return the code-edit plan.
- `archive_flag` tool: dry-run by default, confirm gate, audit log.
- Safety layer: path sanitization, env-based credential loading, dev/prod guard.
- End-to-end test against the demo app + demo PostHog project.

**Week 3: Polish.**
- README with install instructions and a GIF demo.
- A 2-minute screencast of the end-to-end flow: open Claude Code, ask to clean up stale flags, review the PR.
- One-page writeup of limitations: wrapped flags, dynamic keys, multi-repo, monorepo handling.

## 8. Open Questions (Known Gaps)

- **Monorepo handling.** How does the scanner scope a scan to one package in a pnpm workspace? Out of scope for v1; note it in the writeup.
- **Flag key conventions across providers.** A later plugin model for LaunchDarkly/Statsig/Unleash needs a shared interface. Defer to Phase 2.
- **Language breadth.** v1 is TypeScript only. Python and Go are the obvious next additions.
- **Offline mode.** If PostHog is unreachable, fall back to "scan only, no PostHog context"? Defer.

---

## 9. Prompt for Claude Code

Paste the following into a fresh Claude Code session, in an empty directory where you want the project to live:

```
I want to build a Model Context Protocol (MCP) server that helps developers
clean up stale PostHog feature flags from inside Claude Code. The product
vision is larger — a closed-loop flag debt manager embedded in PostHog — but
this project is the narrow, working prototype that proves the execution half.

## What to build

A TypeScript MCP server exposing three tools:

1. `find_stale_flags(repo_path, scan_config?, staleness_rules?)` — read-only.
   Scans the repo for PostHog SDK call sites, fetches flag state from the
   PostHog API, and returns three categorized lists: `stale` (in code, at 100%
   or 0% for longer than the threshold), `orphans` (in PostHog, no code refs),
   `dangling` (in code, not in PostHog). Each entry has flag metadata, call
   sites as {file, line, snippet}, and for stale flags the surviving branch
   (`then` or `else`).

2. `propose_cleanup(flag_key)` — read-only. Returns a structured plan:
   { code_edits: [{file, line_range, operation}], posthog_action: {type, flag_id} }.
   The operation is either `remove_gate` (replace the whole if/else with the
   surviving branch) or `remove_call` (for bare calls without branching).
   The tool returns a plan; Claude applies edits using its own Edit tool.

3. `archive_flag(flag_id, confirm=false)` — write. Defaults to dry-run and
   returns a description of what would happen. Only mutates PostHog when
   `confirm=true` is explicitly passed.

## Stack

- TypeScript, Node 20+
- `@modelcontextprotocol/sdk` with stdio transport
- `zod` for schema validation
- Shell out to `ripgrep` for scanning; fall back to a JS walker if `rg` is unavailable
- Hand-rolled PostHog REST client using `fetch` — no SDK dependency
- `vitest` for tests, fixture repos under `test/fixtures/`
- `pnpm` for package management
- `biome` for lint + format

## Project structure

(see Section 4 of the plan doc — mirror it exactly)

## Safety requirements (non-negotiable)

- API keys read from env vars (POSTHOG_API_KEY, POSTHOG_WRITE_KEY),
  never from tool arguments.
- `archive_flag` defaults to dry-run; explicit `confirm=true` required to mutate.
- `repo_path` validated against the working directory; reject `..` and escaping symlinks.
- Detect production projects on startup (check project environment tag);
  refuse write operations unless `ALLOW_PROD=true` is set.
- Separate scoped keys: read-only key for `find_stale_flags`, flags-only
  write key for `archive_flag`.
- Log every write operation to an audit file.
- Do NOT expose a generic `posthog_api_request` tool.

## SDK call patterns to detect (v1)

For TypeScript/JavaScript:
- `posthog.isFeatureEnabled('key')`
- `posthog.getFeatureFlag('key')`
- `posthog.onFeatureFlag('key', ...)` (and variants)
- `useFeatureFlagEnabled('key')` (posthog-js/react hooks)
- `useFeatureFlagVariantKey('key')`

Exclude matches inside comments (// or /* */), string literals in test
fixtures, and flags inside files under `node_modules/`, `.next/`, `dist/`,
`build/`, or user-configured excludes.

## Test fixtures to build

Under `test/fixtures/`:
- `repo-clean`: one active flag, no stale candidates
- `repo-stale`: three flags rolled out to 100%, still gated in code
- `repo-wrapper`: a flag accessed through `flags.newUI()` helper — v1 may
  flag as "dynamic reference, manual review"
- `repo-dangling`: flag key in code with no matching PostHog flag
- `repo-commented`: flag-like strings inside comments (must NOT match)

## Build order

1. Scaffold TS project + MCP server boilerplate that registers one dummy tool.
2. PostHog REST client: list flags with pagination, get evaluation history.
3. Scanner: ripgrep wrapper + pattern file.
4. Classifier: join flags + code refs into three buckets.
5. Wire `find_stale_flags` end-to-end.
6. Write fixture tests for all five fixture repos.
7. Add `propose_cleanup`.
8. Add `archive_flag` with dry-run + confirm gate + audit log.
9. Safety layer: path sanitization, env handling, prod guard.
10. README, INSTALL.md, SAFETY.md.

## What NOT to do

- No generic `posthog_api_request` tool.
- No automatic code edits from the MCP — only return plans, Claude edits.
- No bulk archive. One flag per call.
- No confidence scoring — use three clean buckets instead.
- No CI pipelines, no GitHub app, no Slack integration. Those belong to
  later product phases, not this prototype.
- No Python/Go/Ruby scanner support in v1. TypeScript only.

Start by scaffolding the project and the MCP server boilerplate. Show me the
`package.json`, `tsconfig.json`, and the entrypoint file before going further.
```

---

*End of plan.*
