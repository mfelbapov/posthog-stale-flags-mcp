---
name: unfreeze-feature
description: Explicitly unfreeze a previously frozen feature so it can be modified again. Requires a reason string that lands in the feature file's history block and the commit log. Refuses if the feature is not currently frozen.
---

# unfreeze-feature

The deliberate, auditable way to reopen a frozen feature. Writes the reason into the feature file so future readers can see *why* a "done" feature was reopened.

## Inputs

- `feature` — short name of the feature (e.g. `find_stale_flags`). Must correspond to an existing `features/<feature>.feature` file.
- `reason` — required non-empty string. Explains why the feature is being reopened (e.g. "adding kill-switch variant handling", "fixing edge case in permanent tag filter"). Becomes part of the audit trail.

## Preconditions

- `features/<feature>.feature` exists.
- The feature file's frontmatter contains `status: frozen`.
- `reason` is a non-empty string. Refuse if missing or blank.

## Steps

1. **Refuse if not frozen.** Read `features/<feature>.feature` frontmatter. If `status` is not `frozen`, stop with message "feature is not frozen; nothing to unfreeze."
2. **Refuse if reason missing.** If `reason` is empty, null, or whitespace-only, stop. The reason is the point.
3. **Update frontmatter.** Remove the `status: frozen` key (and `frozen_at` if present). Append a new entry to the `history:` list in frontmatter:
   ```yaml
   history:
     - unfrozen_at: <ISO 8601 date>
       reason: "<reason>"
   ```
   Preserve any existing `history:` entries. If `history:` doesn't exist yet, create it.
4. **Report.** Print:
   - feature name
   - the reason recorded
   - reminder: once the intended changes are green, run `/freeze-feature <feature>` to re-lock.

## Safety rules

- **Never unfreeze silently.** The reason string is non-negotiable — it's the only signal future readers have about why a "done" feature was reopened.
- **Never edit scenarios or tests during this skill.** This is a state transition only. Use `/add-scenario` for new behavior.
- **Never bulk-unfreeze.** One feature per invocation.
- **Don't forget to re-freeze.** An unfrozen feature with no subsequent freeze leaves the feature wide open forever, defeating the safeguard.
