---
name: commit-and-push
description: Run precommit checks (lint, typecheck, tests), then commit all relevant changes with a detailed message and push the current branch to origin. Never pushes to main.
---

# commit-and-push

Run `pnpm precommit` first. If it fails, fix the issues and re-run until it passes.

Then look at the full git diff (staged + unstaged) and recent commit log to understand the changes and commit style.

Stage all relevant changed files (do NOT stage files containing secrets — e.g. `.env`, anything under `.claude/settings.local.json`, API keys, credentials). Write a detailed commit message that:
- Summarizes WHAT changed in the subject line (imperative mood, under 72 chars)
- Explains WHY the change was made in the body
- Lists key modifications if there are multiple logical changes

Create the commit, then push the current branch to origin (with `-u` if needed).

IMPORTANT: Never push to main directly. If on main, warn and stop.
