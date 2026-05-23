# Extraction Procedure

For the FlowStay feature catalog. Three stages, with an extractor + reviewer pair at each agent stage. Standards in this file drive the reviewer's checklist.

## Stage 1 — Build the commitments index

**Extractor agent** reads the doc once linearly + does six lensed re-reads, producing `.scratch/feature-extraction/index.html`:

| Lens | Reading question |
|---|---|
| Journey | What can a guest do? What happens system-wide when they do it? |
| Invariant | What contracts must always hold? What rejects what? |
| Security/auth | Where are the trust boundaries? What does each protect? |
| Observability | What events must emit? What gets logged/traced/alerted? |
| Data | What rows, columns, relationships, lifecycles exist? |
| Failure | What can fail? What recovers it? What gets narrated honestly? |

**§14 is the spine.** §14.2 rows seed invariant index entries; §14.3 rubrics seed journey scenarios with `Judge:` lines naming the rubric; §14.4 simulations seed journey scenarios identified by `@ref:§14.4-NNN`. The lensed passes cover §1–§13 and §15–§20.

**v1 deferred judge work.** §14.3 (LLM judge) and §14.4 (conversation simulations) belong to the architecture's eval framework, but the JUDGE LAYER implementation is deferred to the follow-up plan per the v1 spec. Scenarios in this range carry `@phase:1` (matching the arch doc's §13 step-1 placement, which DOES include judge-harness scaffolding) but their Judge: lines won't execute until the follow-up plan lands. `/features run --det-only` (v1's default and only mode) skips Judge: lines automatically.

Index row format (within standard HTML `<table>` body):

```html
<tr id="sec-X.Y-NNN"><td>§X.Y-NNN</td><td><section ref></td><td><one-line promise></td><td>journey|invariant|both</td><td><source quote/cite></td></tr>
```

**Reviewer agent** checks the index against these standards:
- Every row has ID, section ref, kind, one-line promise
- §14.2 / §14.3 / §14.4 rows all present
- Every doc H3 produces ≥1 row OR is explicitly tagged in an HTML comment: `<!-- no-feature: §X.Y reason -->`
- No duplicate rows (same promise stated twice with different IDs)

If issues → extractor revises → reviewer re-checks. Loop until clean.

## Stage 2 — Write the `.feature` files

**Extractor agent** clusters index rows into ~80–120 features and writes `features/journeys.feature` + `features/invariants.feature` per the protagonist rule and tag taxonomy.

**Idempotency rule (load-bearing).** On any extraction run *after* the first (i.e., when `features/*.feature` already exist), the extractor MUST read the existing files first and only mutate scenarios whose covered index entries appear in the diff against the prior `features/index.html`. Untouched scenarios are preserved byte-for-byte. Stable row IDs (`§7.3-013` never gets renumbered) make this safe.

**Reviewer agent** checks the catalog:
- Every scenario carries `@journey` or `@invariant` (file matches tag)
- Every scenario has ≥1 `@ref:§X.Y` tag
- `@phase:N` assigned per §13 build-order where applicable
- `Judge:` lines present where context-dependent; absent where mechanically checkable
- No duplicated coverage of the same `@ref` across multiple scenarios unless deliberate
- Scenario titles describe a single capability
- Then-steps are concrete enough to back with a test or inline helper

## Stage 3 — Coverage check (mechanical script)

`.claude/skills/features/scripts/coverage_check.exs` reads `features/index.html` + both `.feature` files, asserts every index row ID appears in ≥1 scenario's `@ref` tags. Non-empty unmapped → kick back to stage 2 extractor.

## How extraction gets driven

Subagent dispatches. Stages sequential:

```
extractor(stage 1) → reviewer(stage 1) → [retry loop]
  ↓ index.html
extractor(stage 2) → reviewer(stage 2) → [retry loop]
  ↓ features/journeys.feature, features/invariants.feature
script(stage 3) → coverage report
```

Each agent receives only its required context (doc + relevant prior artifact). Main session stays clean.

## Subagent dispatch templates (operational)

When executing this procedure, dispatch each agent with the prompt template below. Each agent gets ONLY the context it needs.

### Stage 1 Extractor

Dispatch as: `Agent({subagent_type: "general-purpose", description: "Extract commitments index", prompt: <below>})`

~~~
You are the Stage 1 extractor for the FlowStay feature catalog. Your job is to read `docs/architecture.html` and produce a flat commitments index at `.scratch/feature-extraction/index.html`.

Procedure:
1. Linear pass: read the full doc top to bottom. Capture every "the system shall…" promise as one row.
2. §14 spine: §14.2 rows seed invariant entries; §14.3 rubrics seed journey entries with Judge: lines naming the rubric; §14.4 simulations seed journey entries identified by @ref:§14.4-NNN.
3. Lensed re-reads: do six more passes, each asking a different question:
   - Journey: What can a guest do? What happens system-wide?
   - Invariant: What contracts must always hold?
   - Security/auth: Where are trust boundaries?
   - Observability: What events must emit?
   - Data: What rows, columns, relationships, lifecycles?
   - Failure: What can fail? What recovers? What gets narrated honestly?
   Each lens adds rows missed by prior passes.

Row format (within a `<table><tbody>` block):
`<tr id="sec-X.Y-NNN"><td>§X.Y-NNN</td><td><section ref></td><td><one-line promise></td><td>journey|invariant|both</td><td><source quote/cite></td></tr>`

Rules:
- ID is `§X.Y-NNN` where X.Y is the section (e.g., 7.3) and NNN is a 3-digit zero-padded sequence within that section starting at 001.
- Every doc H3 produces ≥1 row OR an explicit HTML comment: `<!-- no-feature: §X.Y reason -->`
- No duplicates.

Output:
- Write `.scratch/feature-extraction/index.html`.
- Print a one-line summary: "Index complete: <N> rows, <K> H3 sections covered."
~~~

### Stage 1 Reviewer

Dispatch as: `Agent({subagent_type: "general-purpose", description: "Review commitments index", prompt: <below>})`

~~~
You are the Stage 1 reviewer for the FlowStay feature catalog. Your job is to verify the commitments index at `.scratch/feature-extraction/index.html` against documented standards.

Read the index and check:
1. Every row has: ID matching `§X.Y-NNN`, section ref, one-line promise, kind (`journey`/`invariant`/`both`).
2. §14.2, §14.3, and §14.4 each have rows (verify by sampling: at least one row from each).
3. Every doc H3 in `docs/architecture.html` produces ≥1 row OR is marked with an explicit HTML comment: `<!-- no-feature: §X.Y reason -->`
4. No duplicate rows (same promise text from same section twice).

Output:
- If clean: print "PASS" and stop.
- If issues: print a numbered list of findings with row IDs / section refs. DO NOT modify the index yourself — return findings only.

Findings format:
- ` 1. §3.5: no rows produced and no '# no-feature' marker. Section has prose about conversational pacing — likely needs row(s) or explicit no-feature.`
- ` 2. Duplicate: rows §7.3-005 and §7.3-009 both describe "hold released on go_back".`
~~~

### Stage 2 Extractor

~~~
You are the Stage 2 extractor for the FlowStay feature catalog. Read `.scratch/feature-extraction/index.html` and write `features/journeys.feature` + `features/invariants.feature`.

Schema standards (LOAD `.claude/skills/features/references/schema-standards.md` BEFORE WORKING):
- File split: protagonist-based (guest → journeys, system → invariants; cross-cutting → journeys with @invariant tag).
- Required tags per scenario: `@journey` or `@invariant`, ≥1 `@ref:§X.Y`.
- `@phase:N` recommended per §13 build-order.
- `Judge:` line only when context-dependent.

Procedure:
1. Cluster index rows into ~80–200 features (estimate may be low — see spec sizing note). Each feature ≈ PR-sized capability.
2. Write `features/journeys.feature` and `features/invariants.feature`.
3. Every scenario tags ALL index rows it covers with `@ref:§X.Y-NNN`.
4. If updating existing files (idempotency rule, see iteration-procedure.md): read existing files FIRST and only mutate scenarios whose covered index entries appear in the diff. Untouched scenarios are byte-for-byte preserved.

Output:
- `features/journeys.feature` and `features/invariants.feature`.
- Print a one-line summary: "<F> features, <S> scenarios written across journeys+invariants."
~~~

### Stage 2 Reviewer

~~~
You are the Stage 2 reviewer. Verify `features/journeys.feature` and `features/invariants.feature` against schema standards.

Read both files and check:
1. Every scenario has `@journey` or `@invariant` (file matches kind).
2. Every scenario has ≥1 `@ref:§X.Y` tag.
3. `@phase:N` tags use 1..11 only (per §13 build order).
4. `Judge:` lines present on context-dependent scenarios (narration, tone, recovery) and absent on mechanically-checkable ones (sample-check 10 scenarios).
5. Cross-coverage: no two scenarios cover the same `@ref:§X.Y-NNN` row without explicit deliberate-note comment.
6. Scenario titles describe a single capability (no grab-bags like "various auth checks").
7. Then-steps are concrete enough to back with a test or inline helper (no vague "system works correctly").

Output:
- If clean: print "PASS".
- If issues: numbered findings. DO NOT modify files — return findings only.
~~~
