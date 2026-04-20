# PostHog Feature Flag Debt MCP — Build Plan (Product-Depth + MVP Prototype)

## Context

Three documents in this repo form a layered argument about what to build:

- [PLAN.MD](PLAN.MD) — builder's spec: three tools, three clean buckets, full safety model, six fixtures.
- [plan2.md](plan2.md) — product critic's reframe: MCP is a **curator**, not a reporter. Evidence dossier, two-pass scan, ownership, multi-day loop, bulk orphan flow.
- [discussion.md](discussion.md) — pragmatic synthesizer: scope options, the **workflow-vs-reference MCP** framing as the PM-memo hook, the "we out-loop, not out-scan" honest pitch.

Two other files fix the application context:
- [job.md](job.md) — **PostHog Product Manager** role. Discovery-focused PMs who "don't engage in delivery almost at all." Explicit non-goals: writing tickets/PRDs, shipping features, deciding what to build. Hiring signal: product sense, data/SQL, commercial thinking, proactive; "written code before" is a prerequisite, not the deliverable.
- [resume.md](resume.md) — 9y engineering at Accenture/Pillar, MBA, trucking P&L, MCP already shipped in a prior AI project. Code-credibility is not the gap; PM artifacts are.

The project is greenfield — no `src/`, no `package.json`, no tests. PostHog account and API keys do **not** exist yet.

## Synthesis

The role rewards **product judgment made legible through artifacts**, not shipping features. The user is not doing user interviews, so the memo is a thought-piece — it has to stand on competitive depth, data/metric proposals, and product reasoning instead of user quotes. This raises the bar for memo substance.

The right posture is therefore: **MVP prototype + deep memo**. Prototype proves the loop exists. Memo carries the product thinking that the PostHog team is actually hiring for.

Two memo framings from the discussion are load-bearing and cost nothing to carry:
1. **Workflow vs reference MCP.** PostHog AI is a reference MCP; this is a workflow MCP; PostHog has shipped one half. Opening sentence.
2. **"We out-loop, not out-scan LaunchDarkly."** Honest framing that survives scrutiny — LD's scanner is mature and public domain; the differentiator is the execution loop nobody has built.

## Recommended scope

Code: **MVP with 1.5 tools**. `find_stale_flags` end-to-end plus `archive_flag` with dry-run only. Skip `propose_cleanup` — Claude handles code edits manually in the demo; the MCP returns facts, Claude transforms code, which is exactly the division of labor PLAN.MD §1.11 argues for.

Why 1.5 and not 1: shipping only `find_stale_flags` leaves the demo as a read tool, which quietly undercuts the "workflow MCP" thesis the memo opens with. Adding `archive_flag` (dry-run default, explicit `confirm=true`) is a small delta of code but proves the safety model is real, not hand-waved. It's the cheapest honest way to keep the workflow-MCP claim intact.

Why not `propose_cleanup`: it implies structured code-transformation plans (`remove_gate`, `line_range`), but [discussion.md:10](discussion.md#L10) correctly notes the LLM is doing all the real reasoning there. The tool is closer to a hint than a plan. Shipping it adds complexity without adding signal.

Memo: **6-8 pages, deep.** This is the primary PM deliverable.

## Code spec

### What ships

1. TS scaffold (pnpm, tsconfig, biome, vitest).
2. MCP server over stdio registering two tools.
3. PostHog REST client: `GET /api/projects/:id/feature_flags/` with pagination, including `tags`, `rollout_percentage`, `active`, plus `PATCH` for archive.
4. Flag classifier: filter to `rollout_percentage ∈ {0, 100}` and `keep_tag ∉ tags`.
5. Ripgrep wrapper: scan repo for each surviving flag key, return `{file, line, snippet}` per match. Excludes: `node_modules/`, `.next/`, `dist/`, `build/`, plus user config.
6. `find_stale_flags` end-to-end: fetch → filter → scan → classify into three buckets (`stale`, `orphans`, `dangling`).
7. `archive_flag(flag_id, confirm=false)`: dry-run by default; only mutates on explicit `confirm=true`. Audit log for every write.
8. Safety layer: env-var credentials (`POSTHOG_READ_KEY`, `POSTHOG_WRITE_KEY`), path sanitization on `repo_path`, prod-project guard (`ALLOW_PROD=true` required for writes), no generic `posthog_api_request` escape hatch.
9. One fixture repo (`test/fixtures/repo-stale`) + one vitest integration test asserting bucket contents.
10. README with install snippet, `.env.example`, screencast link.

### What's deferred

- `propose_cleanup` — see reasoning above.
- Six fixtures → one. Others (`repo-permanent`, `repo-wrapper`, `repo-dangling`, `repo-commented`, `repo-clean`) are nice-to-have.
- plan2.md improvements (evidence dossier, two-pass scan, ownership, multi-day state, orphan batch). All live in the memo, not the code.
- Feature-isolated folder layout + coupled-commit hook from [CLAUDE.md](CLAUDE.md). Overkill for two tools; promote if/when `propose_cleanup` ships.

### Critical files to create

```
src/
├── index.ts                     # MCP stdio server, registers both tools
├── find_stale_flags/
│   ├── tool.ts                  # zod schema + handler
│   ├── classify.ts              # rollout + tag filter
│   └── scan.ts                  # ripgrep wrapper
├── archive_flag/
│   └── tool.ts                  # dry-run + confirm + audit
├── shared/
│   ├── safety/
│   │   ├── paths.ts             # repo_path validation
│   │   ├── env.ts               # env-var loading, prod guard
│   │   └── audit.ts             # write-op logging
│   └── posthog/
│       ├── client.ts            # fetch-based REST client
│       └── types.ts             # FeatureFlag, Tag, etc.
test/
├── fixtures/repo-stale/         # minimal TS project with ≥3 flags at 100%
└── find_stale_flags.test.ts     # end-to-end bucket assertions
package.json
tsconfig.json
biome.json
.env.example                     # POSTHOG_READ_KEY, POSTHOG_WRITE_KEY, POSTHOG_HOST, POSTHOG_PROJECT_ID
README.md
```

## Memo spec (the primary PM deliverable)

Target: 6-8 pages, written as a PM memo, not a README. Sections:

1. **Opening: workflow vs reference MCP.** Most MCPs today are reference-style (expose data, LLM reads). Workflow MCPs invert this: the unit of value is "state changed in the world." PostHog AI is reference; this prototype is workflow; PostHog has shipped one half. First-mover on workflow MCPs owns the editor surface for their domain.

2. **Problem: flag debt as a silent tax.** Evidence-based, no user quotes (not interviewing). Concrete cost examples from [PLAN.MD §1.3](PLAN.MD). Frame as long-tail velocity drag, not dollars saved.

3. **Competitive teardown: LaunchDarkly.** `ld-find-code-refs` (5y Apache-2.0, CI-verified), Code References UI, Stale Flag Insights, lifecycle states, GitHub integration, their recent MCP. What LD has, what LD doesn't (agentic execution). [PLAN.MD §1.5](PLAN.MD) is the source; memo expands.

4. **What PostHog has / is missing.** Tags, `$feature_flag_called` events, last-evaluated timestamps (has). No code-reference scanner, no lifecycle states, no staleness dashboard, no GitHub integration for cleanup (missing). [PLAN.MD §1.6-1.7](PLAN.MD).

5. **Curator reframe.** From [plan2.md](plan2.md): flag debt is a curation problem, not detection. Evidence dossier beats three-buckets presentation (rollout %, age, last eval, eval count trend, # call sites, git blame, tests reference). Cost × ease ranking. Ownership via git blame + CODEOWNERS. Multi-day state in `.posthog-flag-debt.json`. Bulk orphan flow.

6. **Proposed "Stale Flags" dashboard.** Mockup (ASCII or Figma link) with 6-8 metrics:
   - Flag debt ratio (stale / total)
   - Cleanup velocity (detection → removal)
   - Average flag lifetime (creation → archive)
   - Time-to-100% (rollout decisiveness)
   - Time-to-cleanup (100% → removal) — the metric this tool moves
   - Stale concentration by team/service
   - Experiment hygiene (ended experiments that cleaned up vs. lingered)
   - Orphan count
   Each metric: definition, SQL or pseudo-SQL sketch against PostHog's event model, what action it drives.

7. **Phased roadmap.** [PLAN.MD §1.16](PLAN.MD) table, expanded with what each phase unlocks commercially. Phase 0 (MCP) = wedge; Phase 1 (dashboard) = eng-manager surface; Phase 2 (lifecycle states + GitHub app) = auto-archive on PR merge; Phase 3 (opt-in call-site telemetry, hashed) = differentiator; Phase 4 (cross-customer benchmarks) = moat.

8. **Pricing / packaging angle.** Where does flag debt fit in PostHog's packaging?
   - Free tier: existing flag evaluation + ad-hoc staleness queries.
   - Teams / Paid: "Stale Flags" dashboard + GitHub integration for auto-archive.
   - Enterprise: cross-customer benchmarks ("your flag debt ratio vs P50 SaaS peers"), self-hosted call-site telemetry, compliance-grade audit export.
   Rough sizing: how many flags does a median PostHog customer have, and how does that scale per tier?

9. **Safety model, not hand-waved.** Four gates with shrinking blast radius ([discussion.md:79-90](discussion.md#L79-L90)): (1) scan = read-only auto-approve, (2) code edits = Claude Code's native diff approval, (3) external writes = dry-run + explicit confirm, (4) PR merge = final review. Scoped credentials, prod guard, audit trail, narrow tool surface. Reference the prototype's implementation as proof it's real.

10. **Honest limitations.** Dynamic flag access via variables (grep misses), dangling flags' ambiguous action, monorepo scoping, multi-language v1 gap, rollout % as weak staleness signal on day-1 untagged flags. [PLAN.MD §8](PLAN.MD) + [discussion.md:8-16](discussion.md#L8-L16).

11. **Closing.** "I'd build the workflow-MCP half of PostHog. This prototype proves the loop. The memo proposes the roadmap. Next 10x comes from chores you can finish without a meeting."

## PostHog setup (from zero)

Blocking before any live MCP run. Order:
1. Sign up at posthog.com (free tier), pick US or EU cloud, note host URL.
2. Create a `demo` project, record Project ID.
3. Create two scoped personal API keys:
   - Read-only (flags + insights scope) → `POSTHOG_READ_KEY`
   - Write (flags-only scope) → `POSTHOG_WRITE_KEY`
4. Seed ~8 demo flags (smaller than [PLAN.MD §5](PLAN.MD)'s 12-15 since `propose_cleanup` is out of scope):
   - 3× 100% rollout, >14 days old, used in demo repo → hero stale case
   - 1× 0% rollout, 30+ days since evaluation → kill-switch stale
   - 1× 50% rollout, active → must NOT be flagged
   - 1× in PostHog, no code refs → orphan
   - 1× in code, not in PostHog → dangler
   - 1× tagged `permanent` at 100% → must be skipped
   Backdate "old" flags via `PATCH /api/projects/:id/feature_flags/:id/` on `created_at` where the API allows.
5. Instrument a tiny Next.js demo repo with `posthog-node` so flag evaluations are real.

## Reusable prior art

- **`ld-find-code-refs`** (Apache 2.0) — port TS/JS regex patterns and default exclusion list, with attribution. PLAN.MD §1.11 already plans this.
- **`@modelcontextprotocol/sdk`** — stdio server boilerplate is minimal; register each tool with a zod input schema.
- **PostHog REST — `/api/projects/:id/feature_flags/`** — pagination via `next`/`previous`, tags as a top-level array. One `fetch` wrapper.

## Verification

End-to-end test sequence:
1. `pnpm install && pnpm build`
2. `pnpm test` — fixture test for `repo-stale` passes: ≥3 stale, 0 orphans, 0 dangling.
3. Register MCP in Claude Code config. Start Claude Code in the demo repo.
4. Ask Claude: *"Find stale PostHog flags in this repo."* Expect three buckets with `file:line` call sites.
5. Manually verify one stale flag's call site matches.
6. Ask Claude: *"Archive flag `<id>`, dry-run."* Expect a dry-run description, no mutation.
7. Ask Claude: *"Archive flag `<id>` with `confirm=true`."* Verify flag is archived in PostHog UI. Verify audit log entry.
8. Record 90-second screencast: find → propose (Claude edits manually) → archive.

## Risks

- **PostHog API rate limits or pagination quirks** on first live run. Mitigation: hand-rolled `fetch` client with explicit pagination + retry-on-429.
- **Ripgrep noise on real repos** (minified bundles, lockfiles). Mitigation: port `ld-find-code-refs`'s default exclusion list.
- **Memo quality without user quotes.** This is the real risk. Mitigation: lean hard on competitive depth, dashboard metric proposals with SQL sketches, and explicit product-judgment reasoning chains. Reviewer should come away able to quote specific metric definitions back to you.
- **Overbuilding code.** The role explicitly deprioritizes shipping features. Mitigation: fixed stop-point at 1.5 tools; do not add `propose_cleanup` even if tempted.
