Strongest critiques of the idea, then concrete improvements.

## The core reframe

The plan treats the MCP as a **reporter + transformer** (find → diff → archive). The better framing is **curator**: surface the right candidates, with the right evidence, in the right order, to the right person. Cleanup is easy — *deciding what to clean and whose job it is* is the hard part. Most of the improvements below flow from that shift.

## Seven changes I'd make

**1. Drop "three clean buckets, no confidence scoring." Ship an evidence dossier instead.**
The plan's fear of confidence scoring is over-corrected. Each candidate should come with: rollout %, age at rollout, last evaluation timestamp, evaluation count trend, # call sites, git blame on those sites, whether tests reference it, whether the creator is still at the company. Let the human (or LLM) judge. Three buckets is presentation; the substrate should be facts.

**2. Two-pass scan: literal grep → LLM fallback.**
Literal grep handles 80% cleanly. For flags the scanner didn't find, hand the LLM `src/flags/` (or `grep -r` over the repo) and ask "where is `foo-flag` accessed, even indirectly?" Solves wrappers, dynamic keys, constant indirection — and makes the MCP language-agnostic as a side effect. Plays to the LLM's strength instead of fighting it with regex.

**3. Prioritize by cost × ease.**
A team with 200 stale flags needs triage. Rank candidates by "code-health cost (churn-weighted LOC in the gated branch) × ease (# files, presence of tests, simple if/else vs. nested)." Top of the list is "400-day-old 100% flag, 5 files, plain if/else, in hot code." Turns long-tail drudgery into a sprint of easy wins.

**4. Ownership via git blame + CODEOWNERS.**
Flag debt's real problem isn't "find" — it's "whose job?" For every call site, attach: who introduced it, who's touched it last, which CODEOWNERS entry covers it. Now each cleanup routes to a named owner. This is the social problem, and it's free to solve with data you already have.

**5. Handle the multi-day loop honestly.**
The "closed loop in one session" claim is wishful. Real flow: scan → edits → PR → CI → review → merge → archive, over days. Add local state — `.posthog-flag-debt.json` — that tracks pending archives. Next session: "PR #42 merged yesterday, archive `new-checkout-flow`?" That's the actual closed loop, honestly represented.

**6. Richer input to `propose_cleanup` so the LLM isn't heuristic-guessing.**
"100% → keep `then` branch" is wrong whenever the flag is inverted or the semantic is non-obvious. Include flag description, variants, recent evaluation distribution ("on" fires for 100% of users → confirms which branch is live). Let the LLM reason from evidence instead of a rule.

**7. Bulk orphan archival as a separate first-class flow.**
Orphans (PostHog flag, no code refs) are pure free wins — no code change, no risk. The three-tool shape buries this. Add a `list_orphans → archive_orphan_batch` flow with per-flag confirmation. Demoable impact on minute one.

## Smaller things worth doing

- **Auto-infer permanent candidates.** Name patterns (`kill-switch-*`, `enable-*-ops`), creator intent in flag descriptions, low evaluation volume — offer to pre-tag, human confirms. Fixes the day-1-no-tags problem.
- **Local debt metric.** Ship a `flag_debt_score` number computed locally. Hooks into §1.13's moat story, works offline, gives the developer a number to drive down.
- **Post-cleanup verification handoff.** Tool output says "run `pnpm tsc && pnpm test`." Small thing, big confidence boost.
- **Co-occurrence detection.** If flags A and B appear in the same function, propose cleaning them together or neither.
- **Richer PR body generator.** Link to PostHog flag, evaluation counts, original rollout date, who created it. Makes the PR self-documenting for reviewers.

## What I'd cut

- The strict "TypeScript only" constraint, if you take the LLM-fallback scan. Your v1 becomes quietly polyglot for free.
- The three-buckets-no-scoring dogma (see #1).

## The meta-point for a PostHog PM application

These improvements aren't "more features" — they're **a different bet about what the MCP is for**. If you pitch this to PostHog, the version that lands isn't "I built the cleanup tool." It's: "Flag debt is a curation problem, not a detection problem. Here's the evidence, here's what I'd propose PostHog build, and here's a working prototype that validates the core loop." That's a PM artifact.
