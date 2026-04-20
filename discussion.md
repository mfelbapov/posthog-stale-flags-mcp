
Mostly yes, but with real cracks worth naming.
What’s solid
• Scope is honest. Three tools, one language, one provider. Realistic for a prototype.
• “Out-loop, not out-scan” is the right framing — LD’s scanner has a 5-year head start and is public domain; no point competing there.
• Division of labor (MCP returns facts, LLM does code transformation) plays to each tool’s strength.
• Safety model (dry-run default, scoped keys, no generic API escape hatch, one-flag-per-call) is defensible.
Where the plan over-promises
1. Rollout % is a weak staleness signal. A 100% flag might be a kill switch someone wants at 100%. A 0% flag might be a not-yet-launched experiment. The permanent tag is the mitigation, but on day 1 no flags are tagged — the “prompt the user to tag first” step is clever but fragile. §1.14 quietly admits telemetry would be strictly stronger.
2. remove_gate is stated as a trivial structured operation, but it isn’t. Nested conditions, ternaries, early returns, variable assignments gated on the flag, mocked flags in tests — the MCP plan shape (code_edits: [{file, line_range, operation}]) implies this is deterministic, but the LLM is actually doing all the reasoning. The tool output is closer to a hint than a plan.
3. Grep-by-flag-key misses dynamic access. Any getFlag(flagName) where flagName is a variable is invisible. §8 acknowledges it, but real codebases often centralize flag access through exactly this pattern — it’s a bigger hole than the plan admits.
4. Dangling flags have no safe action. Flag key in code but not in PostHog could be a deleted flag, a typo, or a flag from another environment. propose_cleanup on a dangler could silently remove live code paths. The bucket exists in the plan but the action for it is vague.
5. The loop isn’t actually closed in one session. Find → diff → PR → wait for CI → review → merge → archive is multi-session. Phase 2 vision (PR-merge webhook → auto-archive) is what makes the loop real, and that’s not in the MVP.
6. “Agentic cleanup is better UX” may not land with the buyers. LD’s “we hand you a list, human does the edit” is a feature to risk-averse enterprises. The pitch “we rewrite your code” needs strong trust signals.
The structural weakness
The MCP prototype’s defensibility is zero — anyone can port ld-find-code-refs patterns and wrap them. The real moat (§1.13 cross-customer benchmarks) only exists at Phase 4. That’s a long road, and the plan leans on “PostHog ships the product” to get there. The MCP alone doesn’t earn it.
Verdict: The plan makes sense as a prototype to demonstrate the loop. It doesn’t yet make sense as “this will beat LaunchDarkly.” Treat it as the wedge, not the product — which is what §1.1 actually says, so the honest framing is already there; just make sure the demo doesn’t overclaim.


Strongest critiques of the idea, then concrete improvements.
The core reframe
The plan treats the MCP as a reporter + transformer (find → diff → archive). The better framing is curator: surface the right candidates, with the right evidence, in the right order, to the right person. Cleanup is easy — deciding what to clean and whose job it is is the hard part. Most of the improvements below flow from that shift.
Seven changes I’d make
1. Drop “three clean buckets, no confidence scoring.” Ship an evidence dossier instead.
The plan’s fear of confidence scoring is over-corrected. Each candidate should come with: rollout %, age at rollout, last evaluation timestamp, evaluation count trend, # call sites, git blame on those sites, whether tests reference it, whether the creator is still at the company. Let the human (or LLM) judge. Three buckets is presentation; the substrate should be facts.
2. Two-pass scan: literal grep → LLM fallback.
Literal grep handles 80% cleanly. For flags the scanner didn’t find, hand the LLM src/flags/ (or grep -r over the repo) and ask “where is foo-flag accessed, even indirectly?” Solves wrappers, dynamic keys, constant indirection — and makes the MCP language-agnostic as a side effect. Plays to the LLM’s strength instead of fighting it with regex.
3. Prioritize by cost × ease.
A team with 200 stale flags needs triage. Rank candidates by “code-health cost (churn-weighted LOC in the gated branch) × ease (# files, presence of tests, simple if/else vs. nested).” Top of the list is “400-day-old 100% flag, 5 files, plain if/else, in hot code.” Turns long-tail drudgery into a sprint of easy wins.
4. Ownership via git blame + CODEOWNERS.
Flag debt’s real problem isn’t “find” — it’s “whose job?” For every call site, attach: who introduced it, who’s touched it last, which CODEOWNERS entry covers it. Now each cleanup routes to a named owner. This is the social problem, and it’s free to solve with data you already have.
5. Handle the multi-day loop honestly.
The “closed loop in one session” claim is wishful. Real flow: scan → edits → PR → CI → review → merge → archive, over days. Add local state — .posthog-flag-debt.json — that tracks pending archives. Next session: “PR #42 merged yesterday, archive new-checkout-flow?” That’s the actual closed loop, honestly represented.
6. Richer input to propose_cleanup so the LLM isn’t heuristic-guessing.
“100% → keep then branch” is wrong whenever the flag is inverted or the semantic is non-obvious. Include flag description, variants, recent evaluation distribution (“on” fires for 100% of users → confirms which branch is live). Let the LLM reason from evidence instead of a rule.
7. Bulk orphan archival as a separate first-class flow.
Orphans (PostHog flag, no code refs) are pure free wins — no code change, no risk. The three-tool shape buries this. Add a list_orphans → archive_orphan_batch flow with per-flag confirmation. Demoable impact on minute one.
Smaller things worth doing
• Auto-infer permanent candidates. Name patterns (kill-switch-*, enable-*-ops), creator intent in flag descriptions, low evaluation volume — offer to pre-tag, human confirms. Fixes the day-1-no-tags problem.
• Local debt metric. Ship a flag_debt_score number computed locally. Hooks into §1.13’s moat story, works offline, gives the developer a number to drive down.
• Post-cleanup verification handoff. Tool output says “run pnpm tsc && pnpm test.” Small thing, big confidence boost.
• Co-occurrence detection. If flags A and B appear in the same function, propose cleaning them together or neither.
• Richer PR body generator. Link to PostHog flag, evaluation counts, original rollout date, who created it. Makes the PR self-documenting for reviewers.
What I’d cut
• The strict “TypeScript only” constraint, if you take the LLM-fallback scan. Your v1 becomes quietly polyglot for free.
• The three-buckets-no-scoring dogma (see #1).
The meta-point for a PostHog PM application
These improvements aren’t “more features” — they’re a different bet about what the MCP is for. If you pitch this to PostHog, the version that lands isn’t “I built the cleanup tool.” It’s: “Flag debt is a curation problem, not a detection problem. Here’s the evidence, here’s what I’d propose PostHog build, and here’s a working prototype that validates the core loop.” That’s a PM artifact.


That’s a sharper framing than the PLAN.MD surfaces, and it’s worth putting at the top of your PostHog pitch. Let me press on it.
The distinction has real teeth
Most MCPs today are reference-style: the MCP exposes knowledge or queries, the LLM reads, the user gets an answer. Notion MCPs, doc MCPs, “query your data in English” MCPs, style-guide MCPs — all of these. The unit of value is “I learned something.”
Workflow-style MCPs — what you’re calling push — invert this. The unit of value is “state changed in the world.” A flag got archived. A PR got opened. A chore got done.
Concretely: PostHog AI today is a reference MCP. Your flag cleanup MCP is a workflow MCP. They’re complementary, not competitive — and PostHog has only shipped one half.
Why the framing matters strategically
1. Most SaaS companies don’t have a workflow-MCP strategy. They treat MCP as “make our data readable to Claude.” Whoever ships workflow MCPs first owns the editor surface for their domain. That’s a distribution moat more than a technical one.
2. It explains why this is specifically a PostHog opportunity. Flag cleanup can’t meaningfully live in PostHog’s UI — it requires edits in a repo PostHog can’t see. A workflow MCP is the only way PostHog can own the whole loop without becoming an IDE company.
3. It defines what’s a good candidate. Workflow MCPs fit chores: tasks with clear criteria, reversible, well-scoped, where the human’s role is approval not creativity. Flag cleanup is textbook. Other PostHog-shaped candidates: experiment cleanup (ended, declare winner, remove losing branch), session-replay triage (tag/label replays in bulk), event-schema cleanup (unused event names → deprecate).
One sharpening
“Push” is slightly misleading — it suggests notifications. The crisper cut is reference vs. workflow, or knower vs. doer. Workflow MCPs encode domain knowledge about how chores get done, not just access to data. That’s the defensibility: the LLM can query anyone’s data; it can’t replicate your workflow without the MCP.
The honest caveat
Workflow MCPs are harder to ship than reference MCPs. Safety model, dry-run, confirmation, rollback, audit — all table-stakes for writes, irrelevant for reads. The reason most SaaS companies stopped at reference MCPs isn’t that they didn’t think of writes; it’s that writes are scary. That difficulty is also the moat. Your §1.17 safety model is doing real work — lean on it in the pitch.
For the application: make this the opening of your memo, not a footnote. “PostHog has one reference MCP (PostHog AI). The next 10x comes from workflow MCPs — starting with the one I built.” That’s a framing PostHog’s team will recognize as a genuine product insight, not a project pitch.

Good pushback. Two moves.
Separate the fears
“Companies are scared” isn’t one thing:
• Users (developers): not actually scared. They happily let Claude edit code in their editor every day. The fear isn’t at this layer.
• Vendors (PostHog, LD, Stripe): scared of brand damage, support load, liability if their MCP nukes a customer’s prod.
• Buyers (eng managers, CISOs): want audit, scoped credentials, rollback, compliance stories.
Different fears, different mitigations. Conflating them is why most SaaS companies default to reference MCPs — one blanket “no writes” policy is easier than thinking it through.
Why propose this anyway
1. The fear is over-corrected. Reference-only MCPs are leaving obvious value on the table. If your MCP can’t do the chore, users go back to scripts or manual work — your MCP becomes fancy help text. You’re losing the distribution battle to whoever ships writes thoughtfully.
2. The fear is a moat. Anyone can expose their data (pull). Shipping safe writes requires domain expertise — knowing which operations are reversible, which need gates, which should never exist at all. That’s defensible. Pull MCPs commodify; workflow MCPs don’t.
3. Someone ships this eventually. GitHub’s MCP writes. Stripe’s MCP writes. LD’s MCP writes (flag management). The category isn’t “if,” it’s “who ships the credible ones.” First-mover shapes buyer expectations.
4. The asymmetry. Reference MCPs get you “nice to have.” Workflow MCPs get you “I can’t imagine doing this without it.” Different position on the value curve.
How to make it work
Human-in-the-loop is the right answer, but it’s a cliché unless you specify which humans check which things. The pattern is defense in depth with shrinking blast radius:
Four gates, each catches a different failure:
1. Scan = read-only, auto-approve. Zero risk. LLM runs freely.
2. Code edits = Claude Code’s native diff approval. The editor already shows every change before applying. Leverage the existing UX; don’t reinvent it.
3. External writes = dry-run default + explicit confirm=true. The MCP refuses to mutate without intentional opt-in per call. One flag per call, no bulk. This is §1.17 in your plan.
4. PR merge = final review. Nothing reaches prod without code review — the normal engineering checkpoint, not an MCP-specific one.
Supporting mechanisms that matter more than people realize:
• Preview with evidence, not description. Don’t say “I’ll archive X.” Say “X was at 100% for 147 days, last evaluated 3 days ago, 0 call sites remain after PR #42 merges. Proceed?” Approval quality depends on evidence quality.
• Scoped credentials. Read key for scan, flags-only write key for archive. Blast radius capped even if the LLM misbehaves.
• Narrow tool surface. No generic posthog_api_request escape hatch. The LLM can’t improvise destructive actions the tool shape doesn’t permit.
• Environment separation. Prod refuses writes unless ALLOW_PROD=true. Most workflows should default to dev-only.
• Audit trail. Every write logged locally, echoed in the PR body. When something goes wrong, the trail is the post-mortem.
The pitch framing
Don’t sell “we’re cautious.” Sell the promise:
The human stays in control of decisions; the machine handles drudgery.
Every safety mechanism above is the implementation that makes this promise credible. When you pitch PostHog, lead with the promise, back it with the four gates, and point to §1.17 as proof it’s not hand-waved.
That’s the version of “human-in-the-loop” that survives a security review.


Yes. It’s a weekend-to-weekend project depending on how polished you want it. Let me size it honestly.
Three realistic scopes
Demo-grade MVP — 1-2 weekends. Enough to screencord for the application.
• TS scaffold + MCP stdio boilerplate
• PostHog client: list flags, filter by rollout + tag
• Ripgrep wrapper against known flag keys
• find_stale_flags end-to-end, returning three buckets
• One fixture repo (repo-stale) + one fixture test
• 90-second demo video: run the tool, see output, show one manual cleanup
At this scope you skip propose_cleanup and archive_flag entirely. The demo is “look — from my editor, I found the stale flags in seconds.” That’s enough to prove the wedge.
Full v1 prototype — 2-3 weeks. What PLAN.MD describes.
• All three tools working end-to-end
• Six fixture repos
• Safety layer (dry-run, scoped env, prod guard, audit log)
• README + INSTALL + SAFETY docs
• Demo PostHog project with seeded flags
This is portfolio-grade. You can hand the repo to a hiring manager and they can run it.
Plan2.md-shaped version — 6-10 weeks. The curator reframe with evidence dossier, git-blame ownership, two-pass scan, multi-day state, bulk orphan flow. Great product. Not the right investment for an application.
What I’d actually build for the PostHog pitch
The MVP. Here’s why:
• The hiring manager has 15 minutes. They want to see the loop, not admire the feature list.
• A working minimal thing beats a half-working ambitious thing by a wide margin.
• The memo carries the vision (plan2.md improvements). The repo just has to make the core idea real.
• You can ship it in a weekend and spend the rest of the prep on user interviews and the memo.
Honest risks
• PostHog account setup is the longest unknown. Create a free-tier project, seed 12-15 flags, backdate timestamps. Probably 2-3 hours if the API cooperates.
• Ripgrep on corporate repos can be noisy — matches in minified bundles, lockfiles. Default exclusion list matters.
• Testing the write path requires a throwaway PostHog project. Don’t test archive against your main demo — you’ll churn through flag IDs and it gets confusing.
What I need from you to start
Three choices:
1. Which scope — MVP, v1, or plan2-shaped?
2. Do you already have a PostHog account with an API key, or do we start from zero?
3. Do you want me to start scaffolding now, or sketch a build order first?
My recommendation: MVP scope, start scaffolding now, set up PostHog in parallel. I can have the package.json + MCP boilerplate + PostHog client stub in the next few tool calls.
