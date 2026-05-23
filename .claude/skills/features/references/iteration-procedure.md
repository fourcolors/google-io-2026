# Iteration Procedure

When the architecture doc evolves; the catalog must stay in sync without churning.

## No-op fast path (idempotency guard)

Before running ANY extraction, check whether the architecture doc has changed since the last catalog commit. If not, `/features update` is a no-op — exit early with `no doc changes — catalog up to date`.

```bash
last_catalog_commit=$(git log -1 --format=%H -- features/)
docs_since_catalog=$(git log "${last_catalog_commit}..HEAD" -- docs/architecture.html)
if [ -z "$docs_since_catalog" ]; then
  echo "Doc unchanged since last catalog commit ($(git log -1 --format=%h -- features/)) — no update needed."
  exit 0
fi
```

This is the load-bearing mechanism for the idempotency invariant: re-running `/features update` against an unchanged doc deterministically produces a zero `git diff` because no LLM extraction runs at all. The Stage 1 extractor's stochastic nature only matters when there's actually doc work to absorb.

## Flow (when doc HAS changed since last catalog commit)

```
1. Mr. Cobb edits docs/architecture.html, commits.
2. Re-run extraction (same subagent sequence).
3. Stage 1 extractor reads (new doc + existing features/index.html):
     - Builds new index from new doc, same lensed method.
     - Diffs new vs existing index:
         + N added rows     (new promises)
         - M removed rows   (deprecated)
         ~ K modified rows  (text drift, threshold changes)
4. Stage 1 reviewer checks:
     - New IDs follow numbering (§7.3-013 sits after §7.3-012)
     - Removals justified by doc edits (not gratuitous)
     - Modifications track actual text changes
5. Stage 2 extractor reads (existing features/*.feature + diff summary):
     - ADDED → extend an existing scenario OR add a new one
     - REMOVED → remove the scenario OR mark @v2/@removed
     - MODIFIED → surgical text update of the affected scenario
     # Does NOT rewrite untouched scenarios.
6. Stage 2 reviewer checks:
     - Diff is surgical (no gratuitous rewrites)
     - No orphaned @ref tags pointing at deleted index rows
     - New scenarios match the schema
7. Stage 3 coverage script → PASS.
8. PR: features/index.html + features/journeys.feature + features/invariants.feature.
   git diff makes the catalog change reviewable alongside the doc change.
```

## Idempotency invariant

**If the architecture doc doesn't change, re-running extraction produces zero diff in `features/`.** Load-bearing — without it, every re-run produces noise that drowns real changes.

Idempotency comes from: stable row IDs (`§7.3-013` doesn't get renumbered just because someone re-ran), deterministic clustering (same index → same feature partition), and the stage-2 reviewer's surgical-update standard.

Spot-check: re-run extraction on an unchanged doc → expect `git diff features/` to be empty. If it isn't, reviewer should have caught it.

## Operational notes for re-running extraction

### Computing the index diff

After Stage 1 produces a new index, write a diff summary at `.scratch/feature-extraction/index-diff.html`:

```
ADDED:
- §7.3-014 | new commitment text
- §17.5-009 | new commitment text

REMOVED:
- §8.5-007 | deprecated commitment text

MODIFIED:
- §8.5-003 | OLD: capture never runs before crs_confirmed
             NEW: capture runs only after crs_confirmed AND idempotency_key matches
```

Generate this by comparing `features/index.html` (current committed version) against the new index just produced (`.scratch/feature-extraction/index.html`). The Stage 2 extractor consumes this diff to know which scenarios to mutate.

### Verifying idempotency

After a successful `/features update` run, before committing the changes:

```bash
# If the architecture doc was UNCHANGED, expect zero diff:
git diff features/

# If the doc was changed, expect a surgical diff matching the index changes only:
git diff features/journeys.feature features/invariants.feature features/index.html
```

If `git diff features/` shows changes on an unchanged-doc run, the Stage 2 extractor violated the idempotency rule. File a bug; do NOT commit.

## Edge cases

- **Stale `@requires` paths**: stage-2 reviewer checks paths exist; `/features run` fails loudly on missing backing tests. Two acceptable resolutions: update the `@requires` to the new path (if the test still exists, just moved); remove the `@requires` tag (if the test was deleted).
- **v1 ↔ v2 visibility shifts**: when a doc edit promotes a feature v2 → v1, remove the `@v2` tag — done. No deletion + re-creation.
- **Doc-only edits that aren't promises**: typo fixes, prose rewrites → new index has same rows as old → zero feature churn.
