# PostHog Feature Flag Debt — Project Plan

## 1. The Idea

### 1.1 What this project is

A Model Context Protocol (MCP) server for Claude Code that lets a developer clean up stale PostHog feature flags from their editor in one session: *find → diff → PR → archive*. Human-in-the-loop on every destructive action. Zero CI setup.

The MCP is the **test rig**, not the product. The product vision is a closed-loop **Feature Flag Debt Manager** inside PostHog that removes the cognitive load of flag cleanup from engineering teams.

### 1.2 The closed-loop product vision

Four surfaces, linked end to end:

1. **Discovery (PostHog UI):** a "Stale Flags" insight dashboard. Engineering managers see flag debt as a first-class metric — alongside retention and conversion.
2. **Nudge (Slack / GitHub):** when a flag crosses a staleness threshold, the right engineer gets a notification with one click to generate a cleanup PR.
3. **Execution (agent + MCP):** an agent scans the connected repo, generates the cleanup diff, opens a PR. This is what the MCP prototype proves works.
4. **Archive (loop closure):** PostHog detects PR merge via webhook and auto-archives the flag.

The MCP implements step 3, locally and editor-hosted. The full product runs all four steps, orchestrated by PostHog.

### 1.3 The problem: flag debt

Every flag is a dated contract between code and a dashboard. Once rolled out to 100% or permanently off, the gated code becomes dead — but it stays in the codebase because cleanup is nobody's job.

Concrete costs:

- Dead `if/else` branches that engineers read, reason about, and maintain
- Orphan flags in the dashboard ("is this one live?")
- Dangling references to flags that were deleted in PostHog, silently evaluating to defaults
- Slower refactors around gated code nobody owns
- Onboarding tax — new engineers read every flag check and wonder "on or off?"

Flag debt is long-tail velocity drag, not a clean dollar number. Pitch it as *"a silent tax on engineering velocity"*, not as *"N hours saved per week"* which invites math disputes.

### 1.4 How teams solve this today

Badly:

- **Quarterly "flag bankruptcy" sprints** — manual, dreaded.
- **Naming conventions** — prefix with date; weak defense.
- **Cleanup-ticket-when-you-flag rituals** — rarely followed through.
- **Custom grep scripts** one senior engineer maintains.
- **Ignore it** — most common.

### 1.5 Competitive landscape: LaunchDarkly

LaunchDarkly solves detection with mature, layered tooling:

- **`ld-find-code-refs`** — open-source CLI (Apache 2.0). Runs in CI. Uses ripgrep with per-language patterns. Supports wrapper aliases. ~5 years mature.
- **Code References UI** — every flag's detail page links to call sites in GitHub.
- **Stale flag insights** — dashboard with custom staleness rules per org.
- **Lifecycle states** — `new` → `active` → `launched` → `archived`. "Launched" is the explicit "clean me up" state.
- **GitHub integration** — PR comments, status checks, audit trail.
- **Recent MCP support** — mostly for flag management, not code transformation.

**What LaunchDarkly doesn't have:** the agentic execution half. Their system reports; it doesn't rewrite code. The human still does the `if/else` surgery.

### 1.6 What PostHog has today

- Good flag product: targeting, variants, local evaluation, last-evaluated timestamps
- `$feature_flag_called` events with evaluation metadata
- **Tags on feature flags** — organizational metadata, purely categorical, don't affect evaluation (confirmed in PostHog API docs)
- Active / archived status

### 1.7 What PostHog is missing

- No code-reference scanner (no equivalent of `ld-find-code-refs`)
- No formal lifecycle states ("launched" as a step before archive)
- No staleness dashboard surfaced as an eng-manager-facing insight
- No GitHub integration for flag cleanup — archive is a manual UI action

### 1.8 The gap nobody has filled

Neither PostHog nor LaunchDarkly closes the loop. LaunchDarkly hands you a list; you do the code change manually. PostHog doesn't even produce the list. Nobody, as of today, does:

> *Find stale flag → rewrite code → open PR → archive in dashboard* — in one developer interaction, from the editor.

This gap is addressable now because of two things that didn't exist 18 months ago:

1. **Agentic coding tools** (Claude Code, Cursor) that read repos, propose diffs, open PRs.
2. **MCP** as a standard way for those tools to consume structured domain capabilities.

Small, narrow MCP now delivers what previously required a whole platform.

### 1.9 The MVP, simplified

After several rounds of refinement, the MVP is **dramatically simpler** than scanner-based approaches:

1. Fetch all flags from PostHog's API (rollout %, status, tags).
2. Filter to flags at 100% or 0% rollout that are **not** tagged `permanent` (or whatever convention the team uses).
3. For each candidate, grep the repo for the flag key to find call sites.
4. Claude reads the call site, identifies the surviving branch, generates the cleanup diff.
5. User reviews, merges PR.
6. MCP archives the flag in PostHog via the API.

**No SDK changes. No telemetry collection. No privacy tradeoffs. No language-specific parsers beyond simple grep.**

Emergent property: flag debt trends to zero over time. New flags reach 100% → either get tagged `permanent` (explicit opt-in) or get cleaned up. In steady state, every flag in the codebase is either **active**, **permanent**, or **about-to-be-cleaned-up**. No long tail of forgotten flags.

### 1.10 The "permanent" tag — what exists, what's missing

**Exists today in PostHog:**

- Tags are first-class metadata on feature flags (via UI and API).
- Tags are purely organizational; they don't affect evaluation logic.
- Customers can tag a flag `permanent` / `kill-switch` / `ops` etc. today.

**Missing:**

- No formal lifecycle state distinguishing `release` flags from `ops` flags. PostHog's own docs describe the distinction but the schema doesn't enforce it.

**MCP v1 uses tag convention:**

- Configurable "keep" tag (defaults to `permanent`).
- On first run, MCP prompts: *"Found N flags at 100% rollout. Which should be tagged as permanent before we propose cleanup?"* — prevents accidental removal of genuine kill switches.

**Product opportunity (for the pitch):**

Promote the tag convention to a first-class lifecycle state (`release` / `permanent` / `experiment`). This makes cleanup automation safer and more legible.

### 1.11 Why this approach makes sense

**Division of labor between MCP and LLM:**

- MCP gives the LLM **structured, verified facts** it can't easily derive: flag state from API, rollout %, tags.
- LLM does the **code transformation in context** — preserves style, fixes imports, runs formatters.

Playing to each tool's strength.

**Structural advantages over LaunchDarkly:**

- **Zero setup.** No CI pipeline. Install MCP, paste API key, run.
- **In-the-loop with code changes.** Closes the loop in one session; LD stops at "here's a list."
- **Portable.** Same MCP pattern extends to Statsig, Unleash, OpenFeature. Provider is a plugin; workflow is stable.

**Honest framing (no overclaims):**

LaunchDarkly's scanner is deterministic, CI-verified, and mature. Agentic workflows are *more convenient*, not *more reliable*. The claim is "better UX and distribution for the common case," not "beats LaunchDarkly technically." **We don't out-scan LaunchDarkly; we out-loop them.**

`ld-find-code-refs` is Apache 2.0. Five years of edge-case learnings are publicly readable. We port patterns with attribution — the scanner's maturity is essentially public domain. We spend our time on the execution loop nobody has built.

### 1.12 Who it's for

- **User** (hands-on-keyboard): individual engineers during development, especially when they see an `if (posthog.isFeatureEnabled("old-thing"))` and wonder if it's still needed.
- **Buyer** (at scale): engineering managers who want the `Stale Flags` insight dashboard and periodic cleanup as a visible workflow.

MCP alone serves the user. The full product converts the eng manager from "interested" to "purchaser." MCP is the wedge.

### 1.13 Data as the commercial moat

Flag health as a *metric*, not a cleanup chore.

Once scans run periodically (CI or hosted), PostHog accumulates per-org flag debt time series:

- **Flag debt ratio** — stale / total. Single number for eng managers.
- **Cleanup velocity** — time from stale detection to removal.
- **Average flag lifetime** — creation to archive.
- **Time-to-100%** — how long partial rollouts sit (short = decisive; long = paralyzed).
- **Time-to-cleanup** — from 100% to code removal. The metric this product directly improves.
- **Stale concentration** — which teams / services carry the most debt.
- **Experiment hygiene** — experiments that end with cleanup vs. linger.

Each is an insight card in a "Code Health" surface inside PostHog.

**Benchmarks become the moat.** Opt-in cross-customer aggregates: *"Your flag debt ratio is 34%. P50 across SaaS companies your size is 18%."* No competitor can replicate this without comparable data.

**Prototype stays local.** Data story is the *vision* you pitch, not the thing you build upfront. Adding telemetry to the prototype introduces privacy concerns, slows the demo, and doesn't help close the interview loop.

### 1.14 The runtime data bet (Phase 2)

Long-term strategic bet beyond the MVP.

**Two separate questions:**

1. *Which* flags are alive/stale/orphaned? — answerable today from existing `$feature_flag_called` telemetry + flag state. No SDK changes needed.
2. *Where* in code each flag is evaluated from? — requires SDK augmentation (call-site metadata) OR static scanner.

The MVP (Section 1.9) answers both without telemetry work — by using rollout % as the staleness signal and grep for location.

Phase 2 strengthens question 2 with **call-site telemetry** (augmented SDKs attach file/line/function to every `$feature_flag_called` event). This captures **what actually runs in production**, which is strictly stronger than static analysis for identifying dead branches.

**Why this would beat LaunchDarkly structurally** (not a near-term claim — aspirational):

- LaunchDarkly has evaluation telemetry too. The difference isn't *having* the data; it's what the platform around it enables.
- PostHog's event pipeline is customer-facing. Every event is queryable in SQL, composable in insights, joinable with user events. LD's telemetry feeds their own dashboards but isn't generally customer-queryable.
- Composability wins. At PostHog you can ask *"users who hit the old branch — did they churn more?"* as one query. LD would need external analytics.
- Velocity. For PostHog, adding call-site properties is one field on an existing event. For LD, matching it means building an analytics platform.

**What telemetry can't catch (the gap):**

- **Dead branches** — SDK call fires, but the unused branch of the `if/else` is dead code. Detecting which branch survives still needs source reading.
- **Never-executed code** — admin panels, regional features, error branches. Telemetry-blind.
- **Non-SDK flag logic** — apps that load YAML/config and branch on it without calling `posthog.isFeatureEnabled()`. Telemetry-blind.

So the honest framing for Phase 2 is: **telemetry + lightweight scanner composed**. Telemetry does the 95% case cheaply; scanner covers the long tail.

### 1.15 Privacy considerations (Phase 2 only)

Call-site telemetry sends file path + line + function name with every flag evaluation. More sensitive than regular events because:

- **Reveals codebase structure.** File paths expose internal module organization, product architecture, in-flight features.
- **Developer intent, not user intent.** Users can't observe this data being collected the way they observe their clicks.
- **Competitive intelligence leak risk.** Internal breach / support access could expose a customer's product roadmap shape.
- **Regulatory constraints.** Finance/healthcare/defense customers often can't export source-adjacent metadata to SaaS.
- **IP / trade secret category.** Many companies treat file paths and internal naming as trade secrets.

**Mitigations (design requirements, not afterthoughts):**

- **Default off, explicit opt-in.** `posthog.init({ captureCallSite: true })`.
- **Hashed mode.** Send `sha256(path)` instead of raw paths. Preserves unique call-site identity without revealing structure.
- **Granularity tiers.** Level 0: nothing. Level 1: function only. Level 2: file + line. Level 3: full path + stack trace.
- **Self-hosted PostHog** for enterprise. Data never leaves.
- **Separate retention bucket.** Shorter default (30 days) than regular events.
- **Access scoping.** Readable only by accounts with `code_insights` permission.
- **Open-source SDK code.** Auditable collection logic.
- **DPA addendum** specific to code telemetry.
- **Differential privacy** for cross-customer aggregates.

Done well, privacy becomes part of the trust story. Done badly, it kills the feature. Many analytics products have died here; PostHog's brand gives them room to do it right.

### 1.16 Phased roadmap

| Phase | What | Data collection |
|-------|------|-----------------|
| 0 | Local MCP (this project) | None |
| 1 | PostHog "Stale Flags" dashboard from existing evaluation data | Existing events only |
| 2 | Ship lifecycle states + GitHub app for PR automation | Existing events |
| 3 | Call-site telemetry (opt-in, hashed) | New SDK field |
| 4 | Cross-customer benchmarks, LLM-inferred scanner patterns | Aggregated, opt-in |

Phase 0 is defensible standalone. Each later phase stands on its own and builds on the last.

### 1.17 Safety model and human-in-the-loop

Four gates, layered:

1. **Scan is read-only.** Auto-approvable. No mutations possible.
2. **Code edits gated by Claude Code's native permission prompt.** Developer sees every diff before it applies.
3. **PostHog mutations default to dry-run.** `archive_flag(flag_id, confirm=false)` returns what *would* happen. Explicit `confirm=true` required.
4. **PR review is the final checkpoint.** No code reaches prod until merged.

Additional properties:

- **Credentials never flow through the model** — read from MCP env vars, not tool arguments.
- **Scoped API keys** — read-only for scan, flags-only for archive.
- **Dev/prod separation** — MCP refuses write operations on production projects unless `ALLOW_PROD=true`.
- **Narrow tool surface** — no generic `posthog_api_request(...)` escape hatch.
- **Path sanitization** — `repo_path` validated against working directory.
- **Audit log** — every write operation logged locally and echoed in PR body.
- **No bulk mutations** — one flag per call, one confirmation per call.

## 2. Tool Surface

Three tools. Buckets, not confidence scores.

### `find_stale_flags`

Read-only. Fetches PostHog flags, filters to stale candidates (100%/0% rollout, not tagged permanent), grep for call sites.

**Input:**
- `repo_path` (string, required)
- `scan_config` (optional): `exclude_dirs`, `include_comments`
- `keep_tag` (optional, default `"permanent"`): tag name that exempts flags from cleanup

**Output:** three categorized lists — `stale`, `orphans`, `dangling`. Each entry has flag key, PostHog metadata (rollout %, tags, last modified), call sites (`file:line` + snippet).

### `propose_cleanup`

Read-only. Given a flag key, returns a structured plan: code edits to make, PostHog action to take. Claude applies edits with its Edit tool.

**Input:** `flag_key`
**Output:** `{ code_edits: [{file, line_range, operation}], posthog_action: {type, flag_id} }`

Operations: `remove_gate` (replace if/else with surviving branch) or `remove_call` (for bare calls).

### `archive_flag`

Write. Default dry-run.

**Input:** `flag_id`, `confirm` (bool, default `false`)
**Output:** dry-run description, or actual API result if `confirm=true`.

## 3. Stack

- **TypeScript**, Node 20+
- `@modelcontextprotocol/sdk` with stdio transport
- `zod` for input/output schema validation
- Shell out to `ripgrep`; JS regex walker fallback
- Hand-rolled PostHog REST client with `fetch` — no SDK dependency
- `vitest` for tests, fixture repos in `test/fixtures/`
- `pnpm` for package management
- `biome` for lint + format
- Target platforms: macOS, Linux. Windows best-effort via WSL.

## 4. Project Structure

Feature-isolated layout: each MCP tool owns its own folder under `src/features/<name>/`, a matching `features/<name>.feature` spec, and a matching `test/features/<name>/` test directory. Cross-feature code lives under `src/shared/`. Scanner logic (ripgrep wrapper, classify) lives inside each feature's own folder — there is no global `scanner/` module. Only genuinely shared bits (e.g. ripgrep argv helpers) move to `src/shared/util/`.

```
posthog-stale-flags-mcp/
├── src/
│   ├── index.ts                  # MCP server entrypoint
│   ├── features/
│   │   ├── find_stale_flags/     # tool.ts + local scan/classify
│   │   ├── propose_cleanup/
│   │   └── archive_flag/
│   └── shared/
│       ├── posthog/              # client.ts, types.ts
│       ├── safety/               # paths.ts, env.ts, audit.ts
│       └── util/                 # snippets.ts, ripgrep helpers
├── features/                     # Gherkin specs (one per feature)
│   ├── find_stale_flags.feature
│   ├── propose_cleanup.feature
│   └── archive_flag.feature
├── test/
│   ├── fixtures/
│   │   ├── repo-clean/
│   │   ├── repo-stale/
│   │   ├── repo-wrapper/
│   │   └── repo-dangling/
│   └── features/                 # one scenario per test file
│       ├── find_stale_flags/
│       ├── propose_cleanup/
│       └── archive_flag/
├── scripts/
│   ├── check-features.mjs        # .feature ↔ test drift linter
│   └── hooks/pre-commit          # coupling + freeze enforcement
├── docs/
│   ├── README.md
│   ├── INSTALL.md
│   └── SAFETY.md
├── package.json
├── tsconfig.json
├── biome.json
└── .env.example
```

The folder split is load-bearing: the pre-commit hook enforces *coupled commits* — edits under `src/features/<X>/**` require a matching `features/<X>.feature` or `test/features/<X>/**` to also be staged, and edits under `src/shared/**` require at least one `test/features/**` file to also be staged. See [CLAUDE.md](CLAUDE.md) "Coding workflow" for the full rules.

## 5. Demo App Requirements

Separate repo (not part of MCP repo). `posthog-demo-app`.

**Stack:** Next.js 14 + TypeScript. ~15 files, ~500 lines. Small enough to grok in 10 seconds.

**Content:**
- 15 flag check call sites across 5–8 files
- Mix of direct calls and one wrapper function
- Flag checks in comments (false-positive tests)
- Realistic git history

**PostHog demo project setup (12–15 flags):**

| Count | Category | Purpose |
|-------|----------|---------|
| 4 | 100% rollout, >14 days old, in code | Hero stale case |
| 2 | 0% rollout, not evaluated 30+ days | Kill-switch stale |
| 2 | 50% rollout, active | Must NOT be flagged |
| 2 | In PostHog, no code references | Orphans |
| 2 | In code, not in PostHog | Danglers |
| 2 | Tagged `permanent` | Must be skipped |
| 1 | Wrapped in helper | Edge case / graceful limitation |

Backdate "old" flags via API so timestamps look real.

## 6. PostHog Account Setup

1. Sign up at posthog.com (free tier).
2. Pick US or EU cloud. Note host URL.
3. Create a `demo` project. Record Project ID.
4. Create two personal API keys:
   - Read-only, flags + insights scope — for `find_stale_flags`
   - Write, flags-only scope — for `archive_flag`
5. Create 12–15 demo flags per table in Section 5.
6. Tag 2 flags as `permanent` — demonstrates the exemption.
7. Instrument demo app with `posthog-js` and `posthog-node` so flags have real evaluation telemetry.

## 7. Phased Build Plan

### Prior-art pass

- Clone `ld-find-code-refs`. Skim the code.
- Read recurring GitHub issues. Catalog edge cases.
- Port relevant TS/JS regex patterns + default exclusion list.
- Note their alias config syntax; adopt wholesale.

### Core MCP (read-only)

- TS scaffold, MCP SDK stdio transport, one dummy tool to verify wiring.
- PostHog client: list flags with pagination, get tags, get evaluation metadata.
- Scanner: ripgrep patterns for TS/JS, flag-key-list-driven grep.
- `find_stale_flags`: fetch → filter by rollout + tag → scan → classify → three buckets.
- Fixture tests for every bucket including the `permanent`-tag case.

### Cleanup and write path

- `propose_cleanup` returns code-edit plan.
- `archive_flag` with dry-run default, confirm gate, audit log.
- Safety layer: paths, env, prod guard.
- End-to-end test: MCP + demo app + demo PostHog project.

### Polish

- README with install + GIF demo.
- Screencast: Claude Code session, stale flags found, PR opened, flag archived.
- Writeup of honest limitations: wrapper detection, dynamic keys, monorepo, multi-repo.

## 8. Known Gaps

- **Monorepo scoping** — v1 assumes single package. Note in writeup.
- **Cross-provider plugin model** — Statsig/LD/Unleash support is Phase 2.
- **Language breadth** — v1 is TypeScript. Python/Go next.
- **Offline mode** — if PostHog is unreachable, no useful action. Defer.
- **Dead code never executed** — scanner sees, MCP proposes cleanup based on rollout state alone.

## 9. Open Product Questions (for the pitch)

- Should PostHog promote `permanent` tag to a first-class lifecycle state?
- When should auto-archive trigger — on PR open or PR merge?
- How opinionated should the default staleness threshold be?
- Does PostHog ship the dashboard first, or the MCP first?

---

## 10. Prompt for Claude Code

Paste into a fresh Claude Code session in an empty directory:

```
I want to build a Model Context Protocol (MCP) server that helps developers
clean up stale PostHog feature flags from inside Claude Code. The product
vision is larger — a closed-loop flag debt manager embedded in PostHog — but
this project is the narrow, working prototype that proves the execution half.

## What to build

A TypeScript MCP server exposing three tools:

1. `find_stale_flags(repo_path, scan_config?, keep_tag?)` — read-only.
   - Fetches all flags from PostHog via API.
   - Filters to flags at 100% or 0% rollout.
   - Skips any flag tagged with `keep_tag` (default: "permanent").
   - Greps the repo for each remaining flag key.
   - Returns three categorized lists: `stale` (in code + at rollout extreme),
     `orphans` (in PostHog, no code refs), `dangling` (in code, not in PostHog).
   - Each entry: flag metadata, call sites [{file, line, snippet}].

2. `propose_cleanup(flag_key)` — read-only. Returns:
   `{ code_edits: [{file, line_range, operation}], posthog_action: {type, flag_id} }`.
   Operation is `remove_gate` (replace if/else with surviving branch based on
   rollout %: 100% → keep `then` branch, 0% → keep `else` branch) or
   `remove_call` (bare calls without branching). Tool returns a plan; Claude
   applies edits with its own Edit tool.

3. `archive_flag(flag_id, confirm=false)` — write. Defaults to dry-run.
   Only mutates PostHog when confirm=true is explicitly passed.

## Stack

- TypeScript, Node 20+
- @modelcontextprotocol/sdk with stdio transport
- zod for schema validation
- Shell out to ripgrep; fall back to JS walker
- Hand-rolled PostHog REST client with fetch — no SDK dependency
- vitest for tests
- pnpm for package management
- biome for lint + format

## Safety requirements (non-negotiable)

- API keys from env vars (POSTHOG_READ_KEY, POSTHOG_WRITE_KEY), never from
  tool arguments.
- `archive_flag` defaults to dry-run.
- `repo_path` validated against working directory; reject `..` and escaping
  symlinks.
- Detect production projects on startup (check project env tag); refuse write
  operations unless ALLOW_PROD=true is set.
- Separate scoped keys: read-only key for find_stale_flags, flags-only write
  key for archive_flag.
- Audit log for every write operation.
- Do NOT expose a generic posthog_api_request tool.
- No bulk mutations — one flag per archive_flag call.

## SDK patterns to detect (v1, TypeScript/JavaScript)

- posthog.isFeatureEnabled('key')
- posthog.getFeatureFlag('key')
- posthog.onFeatureFlag('key', ...)
- useFeatureFlagEnabled('key')
- useFeatureFlagVariantKey('key')

Exclude matches inside comments, string literals in test fixtures, and files
under node_modules/, .next/, dist/, build/, or user-configured excludes.

Use grep against the list of known flag keys (from PostHog API) rather than
language-wide parsing. This is flag-key-list-driven, not SDK-pattern-driven.

## The "permanent" tag

PostHog has native tag support on feature flags. Any flag tagged with the
configured keep_tag (default: "permanent") is exempt from cleanup. The MCP
respects this tag end-to-end — find_stale_flags skips them, propose_cleanup
refuses if called on one, archive_flag refuses if called on one.

On first run, the MCP should prompt the user:
"Found N flags at 100% or 0% rollout. Before proposing cleanup, should any of
these be tagged as permanent in PostHog? [list them]"

## Test fixtures (under test/fixtures/)

- repo-clean: one active flag, no stale candidates
- repo-stale: three flags at 100%, still gated in code
- repo-permanent: stale rollout but tagged permanent — must be skipped
- repo-wrapper: flag accessed through `flags.newUI()` helper
- repo-dangling: flag key in code with no matching PostHog flag
- repo-commented: flag-like strings inside comments (must NOT match)

## Build order

1. Scaffold TS project + MCP server boilerplate registering one dummy tool.
2. PostHog REST client: list flags with pagination, include tags.
3. Flag classifier: apply rollout + tag filter.
4. Scanner: ripgrep wrapper against known flag keys.
5. Wire find_stale_flags end-to-end.
6. Fixture tests for all six fixtures.
7. Add propose_cleanup.
8. Add archive_flag with dry-run + confirm + audit log.
9. Safety layer: paths, env, prod guard.
10. README, INSTALL.md, SAFETY.md.

## What NOT to do

- No generic posthog_api_request tool.
- No automatic code edits from the MCP — only return plans, Claude edits.
- No bulk archive. One flag per call.
- No confidence scoring — three clean buckets.
- No CI pipelines, no GitHub app, no Slack integration.
- No Python/Go/Ruby in v1. TypeScript only.
- No call-site telemetry, no SDK changes, no data collection in the MCP
  itself. v1 runs entirely on existing PostHog API data + local grep.

Start by scaffolding the project and MCP server boilerplate. Show me the
package.json, tsconfig.json, and entrypoint file before going further.
```

---

*End of plan.*
