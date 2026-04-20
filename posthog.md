# PostHog PM Application — Final Plan

## 1. Core strategic bet

**The category insight:** Most MCPs today are reference-style — they expose data for the LLM to read. The next 10x is **workflow-style MCPs** that *do work*: change state, execute chores, close loops. PostHog has one reference MCP (PostHog AI). The next move is workflow MCPs that compose on top of it.

**The specific wedge:** Flag debt cleanup. PostHog AI today returns *prompts* for cleanup. The next layer is *deterministic, audit-logged plans* that execute against PostHog's existing MCP surface.

**Why this lands at PostHog specifically:**
- Aligns with their philosophy ("Engineers can fix product management")
- Builds *on* their work rather than ignoring it
- Demonstrates discovery + technical execution + restraint in one artifact
- Targets a real but unsexy problem they've already started addressing

**What this is NOT:**
- Not "PostHog has a gap" — they don't, materially
- Not a competitive replacement for their MCP
- Not an attempt to out-engineer them
- Not a feature checklist vs. LaunchDarkly

---

## 2. What to build (the artifact)

A small skill / thin companion MCP that uses PostHog's official MCP for all PostHog-side operations. The boundary is clean:

| Concern | Owner |
|---|---|
| PostHog state (list flags, archive, status) | **PostHog's official MCP** (mcp.posthog.com) |
| Repo state (scan, plan, blame) | **Your skill** |
| Orchestration | **Claude** |

### Functional surface

- **Read:** Compose `feature-flag-get-all` + `feature-flags-status-retrieve` to find candidates matching staleness criteria (rollout extreme + last evaluated > N days)
- **Classify:** Three buckets — `stale` (in code + at rollout extreme), `orphan` (in PostHog, no code refs), `dangling` (in code, not in PostHog)
- **Plan:** Generate structured cleanup plan per flag (`remove_gate` / `remove_call`) with code edits Claude can apply
- **Safety:** Dry-run default on archival; explicit confirm required; respects `permanent` tag exemption
- **Audit:** Local log of every write proposed and executed

### Build scope

**Demo-grade MVP — one weekend.** Scaffold + PostHog client (using their MCP) + grep scanner + `find_stale_flags` end-to-end + one fixture + 90-second screencast. Skip `propose_cleanup` and live archive for v0; demo just the find-and-classify loop.

### Repo structure

```
posthog-stale-flags-skill/
├── README.md          # substantive: what it does, what PostHog tools it composes, how to run
├── src/               # the skill code
├── test/fixtures/     # one demo repo with seeded flag patterns
├── demo.mp4           # 90-second screencast (or link)
└── docs/
    ├── PLAN.md        # original design doc
    └── plan2.md       # critique + improvements
```

**Visibility:** Public GitHub repo. Code, README, screencast all public. Public-by-default fits PostHog's culture.

---

## 3. The memo (centerpiece)

**Format:** Notion page with "anyone with link can view" toggled on. Link-shareable. Editable across application stages.

**Length:** 4-6 pages. Not polished. Not a PRD. A working PM memo.

**Privacy:** *Existence* is public (LinkedIn post, cover letter mention). *Contents* are link-controlled — share only with people you choose.

### Modular structure (each section stands alone)

1. **Thesis (1 paragraph).** *"PostHog AI returns cleanup prompts. The next 10x is plans. Here's the wedge, the gap, and what to build."*

2. **What PostHog already ships.** Cite specifically: the MCP at mcp.posthog.com, the AI flag-cleanup workflow, the staleness definition (100% rollout + 30 days uneval), tag support, issue [#13845](https://github.com/PostHog/posthog/issues/13845). This proves you read the source.

3. **The precise gap.** Not "PostHog has nothing." Specifically:
   - No archive semantic distinct from delete
   - No dry-run / confirmation pattern
   - No staleness filter on `feature-flag-get-all`
   - No three-bucket classifier
   - No repo-side anything

4. **User interviews (5-7).** Mix:
   - 2-3 PostHog users (Slack community, GitHub stargazers)
   - 2-3 LaunchDarkly users (LinkedIn — high-value, especially anyone who switched between platforms)
   - 1-2 Accenture engineers (anonymized as *"engineers I work with at a large enterprise consulting firm"*)
   - Quote 3 verbatim

5. **Competitive landscape.** A 2x2 (governance vs. analytics × enterprise-sales vs. self-serve). Place LD, PostHog, Statsig, Unleash, ConfigCat. End with the philosophical split: *LD = release governance, PostHog = product learning. Flag debt sits in the seam.*

6. **Recommendation + phased plan.** What PostHog should ship, in what order:
   - Add `flag-archive` tool with dry-run and confirm gate
   - Add staleness filter to `feature-flag-get-all`
   - Build the "flag outcomes" insight (debt ratio, time-to-cleanup) on top
   - Each item: rough effort + expected impact

7. **SQL sketches + monthly growth review.** *"If I owned this product, here are the 5 numbers I'd track."* Maps directly to the JD's primary responsibility.

8. **Open questions.** Three things you don't know and would want to learn from PostHog's flags team. Humility + curiosity signal.

### Why modular matters

The take-home will likely ask for one of: a growth review, competitive analysis, opportunity memo, or research synthesis. Modular sections let you adapt in 2-3 hours instead of starting from scratch.

---

## 4. Supporting work (do these before applying)

### Hands-on time (6-10 hours, one weekend)

- Sign up for free PostHog tier
- Set up a small demo project, seed 5-10 flags, mix of rollouts, tag 2 as `permanent`
- Install mcp.posthog.com in Claude Code, use it
- Try PostHog AI's flag-cleanup workflow firsthand — *experience the prompts* your memo proposes upgrading
- Read the [handbook](https://posthog.com/handbook), especially the engineering and hiring sections

You should be able to honestly say all five of:
- *"I set up a free PostHog project and instrumented a demo."*
- *"I installed and used the official MCP."*
- *"I used PostHog AI's cleanup workflow."*
- *"I read the handbook section on PM responsibilities."*
- *"I read the docs on flags, MCP, and best practices."*

### User interviews (one week, async)

5-7 conversations, 30 minutes each. Lead with research, not job-hunting:

> *"I'm researching how teams handle flag debt — saw you use [PostHog/LD]. Got 20 minutes this week?"*

Sources:
- **PostHog Slack community** (open, very active) — best single source
- **LinkedIn** — search for engineers at companies with PostHog or LD in their stack
- **Twitter / X** — search `@posthog` mentions
- **HackerNews** comments on PostHog posts
- **Accenture colleagues** — your privileged access to enterprise engineers (anonymize everything)
- **Iowa local** — Workiva, Dwolla, John Deere, Principal Financial all have real eng orgs

The two highest-value interview targets:
1. Someone who tried PostHog and chose LaunchDarkly
2. Someone who left LaunchDarkly for PostHog

---

## 5. Application strategy

### What to share when

| Stage | Material |
|---|---|
| **Application form / cover letter** | One paragraph thesis + link to public repo + link to Notion memo (optional click) |
| **Recruiter screen** | Same materials + verbal walkthrough if asked |
| **Hiring manager call** | Walk through the memo. *You* drive. |
| **Take-home (likely exists)** | Adapt relevant memo sections to the prompt |
| **On-site / final** | Full memo with new interviews, refined recommendations. Present in person. |

### Cover letter (3 short paragraphs)

1. **Why PostHog (specific).** Quote a specific decision or philosophy point from their handbook that resonated. Not generic.
2. **What you built and wrote (one sentence each).** Link to repo and memo.
3. **Iowa + Accenture as positioning, not apology.** *"I work in the kind of company PostHog needs to reach (large enterprise, regulated, risk-averse) in the kind of geography PostHog recruits from (remote, distributed, outside the bubble). I see the friction your typical SF applicant doesn't."*

### Parallel paths (don't only submit through the form)

- **Direct outreach** to a PostHog employee on Twitter / LinkedIn / their Slack: *"Working on a PM application — wrote this and would love your eyes if you have 5 minutes."* Routes around recruiter screening.
- **LinkedIn post** (Accenture-policy compliant): *"Spent the weekend building on PostHog's MCP and writing up what I learned. DM if you want the writeup."* Generates inbound attention without leaking contents.

---

## 6. Positioning angles to lean into

### Iowa is an advantage

PostHog is fully remote and explicitly anti-monoculture. Iowa = perspective from outside the SF bubble + access to enterprise (John Deere, Principal Financial, Workiva, Dwolla) — exactly the segment PostHog needs to grow into.

### Accenture is an advantage

Privileged access to enterprise engineering teams using flags at scale in regulated environments. Most PostHog applicants have never worked in this world. You can quote: *"Across three large enterprise engineering teams, every one had >100 stale flags and no formal cleanup process. The tooling exists; the cultural permission to spend time on it doesn't."* No SF candidate can write that.

### Fresh eyes are an advantage

Don't fake power-user status. Lean into: *"I came to this with fresh eyes. New-user friction is what your team needs to surface; long-time customers have built blind workarounds. My read is closer to a new user's first impression."*

---

## 7. What NOT to do

- A 10-page PRD with feature specs
- A standalone MCP that reimplements PostHog's API
- A polished impressive app that signals *"I want to be an engineer"*
- A pitch deck with no user voice and no data
- A memo that cites no specific PostHog docs or GitHub issues
- Catalog-style competitive analysis (LD feature checklist)
- Cheap shots at LaunchDarkly or other competitors
- Apologizing for Iowa or Accenture
- Faking power-user expertise
- Public memo contents (keep link-controlled)
- Blog posts (Accenture policy risk — use LinkedIn one-liners and the public repo README instead)
- Leading the cover letter with the memo (tease it, don't dump it)

---

## 8. Timeline (4 focused weekends)

| Weekend | Output |
|---|---|
| **1** | Hands-on PostHog setup. Skill scaffold. PostHog client wired to mcp.posthog.com. `find_stale_flags` end-to-end with one fixture. |
| **2** | Memo v1 (modular sections, all skeletons in place). 3 user interviews started. |
| **3** | 4 more interviews. Memo v2 with quotes. Competitive 2x2 finalized. SQL sketches written. |
| **4** | Screencast. Cover letter. Submit application + parallel outreach. |

After submission, the memo continues to evolve through the interview process (v3 after recruiter screen, v4 after hiring manager call, full version for on-site).

---

## 9. The minimum bar to submit

You should not submit until all of these are true:

- The skill runs end-to-end and produces real output
- The screencast works on first take
- The repo README is substantive (cites which PostHog tools you compose)
- The Notion memo has all 8 sections, even if rough
- At least 3 user interviews are done with quotes captured
- You can honestly claim hands-on PostHog usage
- The cover letter doesn't apologize for anything
- The Notion link works in incognito mode

---

## 10. The pitch in one sentence

> *"PostHog AI returns flag-cleanup prompts. I built and validated the skill that turns those prompts into deterministic, audit-logged plans — using PostHog's existing MCP — and I wrote up what I'd build next on top of it. I'm not a long-time customer; I came at this fresh from an enterprise environment that looks more like your average customer than like SF, and that's the angle I'd bring to the team."*

That's the application. Everything above is in service of that sentence.
