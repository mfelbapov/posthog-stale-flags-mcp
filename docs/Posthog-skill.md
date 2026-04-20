# How to create the repo for the PostHog Flag Cleanup Skill

Concrete structure, then two paths.

## Name and visibility

- **Name:** `posthog-flag-cleanup` (direct, SEO-friendly, mirrors `launchdarkly-flag-cleanup`)
- **Visibility:** public — proves you ship in the open, fits PostHog culture
- **License:** MIT
- **Disclaimer:** "Unofficial" somewhere in the README, so nobody mistakes it for a PostHog release

## Structure

```
posthog-flag-cleanup/
├── README.md                    # public-facing: what/why/how, PostHog tools it uses
├── LICENSE                      # MIT
├── .gitignore                   # node_modules, .env, .flag-cleanup.log
├── skill.md                     # the actual skill (the whole product)
├── INSTALL.md                   # how to install in Claude Code
├── examples/
│   ├── example-output.md        # sample classification output
│   └── demo.mp4                 # 60-90 second screencast
└── docs/
    ├── MEMO.md                  # the PM memo (or link to Notion)
    ├── PLAN.md                  # original design doc
    ├── plan2.md                 # critique + improvements
    └── research/                # notes from your competitive research
```

One file is the product (`skill.md`). Everything else is context.

## README shape

```markdown
# posthog-flag-cleanup

Unofficial Claude Code skill for cleaning up stale PostHog feature flags.
Built on top of PostHog's official MCP server.

## What it does
[one-line description]

## How it works
1. Uses PostHog's MCP to fetch flag state and evaluation data
2. Uses Claude's Grep/Edit tools to scan and modify the repo
3. Classifies flags: stale / orphan / dangling
4. Proposes edits, you approve, it applies
5. Archives via PostHog MCP with confirmation gate

## PostHog MCP tools composed
- feature-flag-get-all
- feature-flags-status-retrieve
- feature-flags-dependent-flags-retrieve
- delete-feature-flag

## Install
[5-step instructions]

## Example
[terminal output snippet]

## Why a skill, not an MCP
PostHog's MCP already exposes the primitives we need. This skill adds the
opinionated workflow, following the pattern LaunchDarkly shipped as
launchdarkly-flag-cleanup.

## Acknowledgments
- PostHog for the MCP surface
- LaunchDarkly for the workflow pattern
```

## skill.md shape

The skill file is your product. Minimum contents:

```markdown
---
name: posthog-flag-cleanup
description: Identify and clean up stale PostHog feature flags
---

# PostHog Flag Cleanup

Use this skill when the user asks to identify or clean up stale PostHog feature flags.

## Procedure

1. Call `feature-flag-get-all` via PostHog MCP. Exclude flags tagged `permanent`.
2. For each remaining flag, call `feature-flags-status-retrieve` to get last-evaluated.
3. Classify:
   - **Stale candidate:** rollout = 100% or 0%, last evaluated > 30 days ago
   - Skip active flags
4. For each stale candidate:
   - Use Grep to find the flag key in the repo
   - If found: `stale` bucket
   - If not found in repo: `orphan` bucket
5. Additionally: Grep for all flag-key-like patterns in code and check against PostHog's flag list. Keys in code but not in PostHog = `dangling` bucket.
6. Present results to user, ranked by staleness + call-site count.
7. For each flag user selects:
   - Show call sites with 3 lines of context
   - Propose cleanup edit (keep surviving branch based on rollout: 100% → `then`, 0% → `else`)
   - Apply with Edit tool after user confirms
8. After code changes merged:
   - Ask user to confirm archive
   - Call `delete-feature-flag`
   - Log to `.flag-cleanup.log`

## Safety
- Never archive a flag tagged `permanent`
- Never archive without explicit user confirmation
- Dangling flags: do not propose cleanup — these may be typos or cross-environment; alert user
```

## Two paths — pick one

### Path A: new repo (cleaner)

Start fresh. The current `posthog-stale-flags-mcp` repo keeps the research artifacts (PLAN.md, plan2.md, posthog.md). The new `posthog-flag-cleanup` repo has the clean skill artifact. Two repos, two purposes:

- **research repo** — private or public, shows depth of thinking
- **product repo** — public, clean, one skill, demoable

### Path B: rename + restructure existing (simpler)

Rename `posthog-stale-flags-mcp` → `posthog-flag-cleanup`. Move PLAN.md, plan2.md, posthog.md into a `docs/` folder. Add `skill.md`, clean README, INSTALL.md. One repo, one narrative.

**I'd pick B.** Single repo keeps everything together. The research artifacts become *context* for the skill. Hiring manager sees one link and gets the full story.

## Want me to scaffold Path B now?

I can:
1. Move PLAN.md, plan2.md, posthog.md into `docs/`
2. Create skill.md, README.md, INSTALL.md, LICENSE, .gitignore
3. Commit to the existing branch
4. Push

~15 minutes end-to-end. Ready to go?
