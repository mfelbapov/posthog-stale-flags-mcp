---
name: push-merge-main
description: Fast path for small changes. Runs commit-and-push, then opens a PR against main, merges it immediately (merge commit), deletes the feature branch, and leaves the user on a freshly pulled main. Bypasses CI gates — use only for trivial changes.
---

# push-merge-main

Fast-ship flow for small, low-risk changes. Does everything [commit-and-push](../commit-and-push/SKILL.md) does, then merges the PR immediately (no auto-merge, no CI wait), cleans up the branch, and returns the user to a fresh main.

**WARNING — intentionally insecure.** This bypasses CI, code review, and branch protection. Only use for trivial changes (typos, doc tweaks, config one-liners). For anything non-trivial, use `commit-and-push` and merge via the PR UI.

## Steps

1. **Refuse on main.** Check current branch with `git rev-parse --abbrev-ref HEAD`. If it is `main` or `master`, warn and stop.

2. **Run `pnpm precommit`.** If it fails, fix the issues and re-run until it passes.

3. **Review changes.** Look at the full git diff (staged + unstaged) and recent commit log to understand the changes and match the repo's commit style.

4. **Stage relevant files.** Do NOT stage files containing secrets — `.env`, `.env.*`, anything under `.claude/settings.local.json`, API keys, credentials.

5. **Commit.** Write a detailed commit message:
   - Subject line: WHAT changed, imperative mood, under 72 chars
   - Body: WHY the change was made
   - List key modifications if multiple logical changes

6. **Push.** Push the current branch to origin (with `-u` if needed).

7. **Open PR.** Run `gh pr create --base main --fill` (fall back to explicit `--title` / `--body` if `--fill` is thin). Capture the PR URL.

8. **Merge immediately.** Run `gh pr merge --merge --delete-branch`. This creates a merge commit on main and deletes the remote feature branch. No `--auto`, no waiting on CI.

9. **Sync local main.** `git checkout main` → `git pull origin main` (fast-forward).

10. **Delete local feature branch.** `git branch -D <feature-branch>` (use `-D` because the branch is already merged into the just-pulled main, but the local ref might not track that).

11. **Report.** Print the merged PR URL and confirm user is on main, up to date.

## Safety rules

- **Never push directly to main.** If on main at step 1, stop.
- **Never force-push.** No `--force`, no `--force-with-lease`.
- **Never stage secrets.** Same filter as `commit-and-push`.
- **Stop on any failure.** If `gh pr merge` fails (branch protection blocks direct merge, required checks not green, permissions insufficient), surface the error. Do not retry with different flags to bypass it — if the repo blocks the direct merge, that's the repo telling you this flow isn't appropriate here. Fall back to `commit-and-push` + manual PR review.
- **One-shot only.** This skill is not for batch operations. One branch, one PR, one merge.
