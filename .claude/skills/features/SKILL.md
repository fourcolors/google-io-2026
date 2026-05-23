---
name: features
description: Run, extract, update, or check the status of the FlowStay feature catalog at `features/`. Use when the user invokes `/features`, asks to extract features from the architecture doc, asks to run the feature catalog against the codebase, asks to re-sync the catalog after a doc edit, or asks about catalog coverage status.
---

# FlowStay Feature Catalog Skill

This skill operates on the **feature catalog** — a Gherkin-style executable specification of every promise the FlowStay architecture doc (`docs/architecture.html`) makes. The catalog lives at `features/journeys.feature` + `features/invariants.feature`, with `features/index.html` as the coverage receipt.

The skill has six modes. **Always announce which mode you're entering** so the operator can confirm.

| Invocation | Mode | What you do |
|---|---|---|
| `/features` or `/features run [@tag-filter] [--det-only]` | RUN | Execute the deterministic layer: parse `.feature` files, dispatch each scenario's `@requires` tests, call inline helpers, aggregate verdicts. |
| `/features judge [@tag-filter]` | JUDGE | **POC shipped 2026-05-15** via Claude Code Agent SDK (no ANTHROPIC_API_KEY needed — uses existing session auth per Mr. Cobb direction). For each scenario: spawn `Agent({subagent_type: 'general-purpose', prompt: scenario + evidence + verdict-format spec})`. Subagent reads evidence files, decides pass/fail with specific reasoning, archives verdict JSON to `.scratch/judge-runs/<timestamp>/<ref>.json`. Validated on §1.0-014 (round 1: fail = caught real coverage gap; round 2 with expanded @requires: pass with paragraph of identifier-level reasoning). Per §14.3 — was deferred in v1, now in scope and unblocked. |
| `/features judge --drifted` | JUDGE-DRIFTED | **Phase 4 of build.py rewrite, shipped 2026-05-22.** Re-judges ONLY scenarios that `scripts/traceability/build.py` flagged as drifted or unjudged. Reads `.scratch/judge-drift.json`, dispatches parallel subagents per scenario, writes verdicts to `features/.judge-cache.json`. Closes the 4-condition green gate from the 2026-05-22 doc-organization workshop. See "JUDGE-DRIFTED procedure" below. |
| `/features audit-archdoc` | AUDIT-ARCHDOC | **Shipped 2026-05-15.** Invoke: `elixir .claude/skills/features/scripts/audit_archdoc.exs`. Three checks against `features/index.html` (the Stage-1 extraction snapshot): orphans (index rows with no scenario @ref), dangling refs (scenario @ref to non-existent index row), doubles (commitment referenced by >1 scenario). Exit 0 on clean audit, 1 otherwise with itemized findings. Source-of-truth note: arch doc HTML has no direct `§X.Y-NNN` refs — those were assigned by extractor agents during Stage-1; `/features update` keeps the index in sync. |
| `/features extract` | EXTRACT | First-time extraction: dispatch subagents to (1) build commitments index, (2) write `.feature` files, (3) run coverage check. See `references/extraction-procedure.md`. |
| `/features update` | UPDATE | Re-run extraction with diff against current `features/index.html`. Only mutate scenarios whose covered index entries appear in the diff. See `references/iteration-procedure.md`. |
| `/features status` | STATUS | Show coverage receipt (`features/index.html` row count, how many are mapped, when last extracted). No execution. |

## Standards (always honor these)

The catalog has a strict schema. Read `references/schema-standards.md` before authoring or modifying any scenario:

- **File split** is protagonist-based: guest → `journeys.feature`, system → `invariants.feature`. Cross-cutting scenarios go in `journeys.feature` with `@invariant` tag.
- **Required tags**: every scenario carries `@journey` or `@invariant` and ≥1 `@ref:§X.Y`.
- **`@requires:<path>`** is per-runner native. Elixir: `elixir/test/foo.exs:LINE`. Python: `python/tests/foo.py::test_name`.
- **`Judge:` lines** belong only on scenarios where the right answer is context-dependent (narration tone, recovery framing). Mechanically-checkable scenarios get no judge line.

## Procedure references

For any non-trivial mode invocation, **load the relevant reference before acting**:

- `references/schema-standards.md` — schema details for authoring/modifying scenarios
- `references/extraction-procedure.md` — 3-stage extraction (index → catalog → coverage), pair-of-agents pattern, six lenses
- `references/iteration-procedure.md` — doc-changed flow, idempotency rule, edge cases
- `references/runner-procedure.md` — how to execute the catalog as the runner

## Scripts

- `scripts/coverage_check.exs` — mechanical gate run at stage 3 of extraction. Confirms every `features/index.html` row appears in ≥1 scenario's `@ref:` tags. Invoke: `elixir .claude/skills/features/scripts/coverage_check.exs`.

## JUDGE-DRIFTED procedure

`/features judge --drifted` is the agent-side half of Phase 4 (build.py rewrite). Build.py is read-only by design (Q3 lock); this skill does the dispatch.

**Workflow:**

1. **Read the drift report.** `cat .scratch/judge-drift.json`. Schema: `{summary: {total_scenarios, cached_fresh, cached_stale, unjudged, needs_judging}, scenarios_needing_judging: [{scenario_id, title, feature, source_file, refs, requires, drift_kind, cached_verdict, scenario_text_sha, requires_sha}]}`. If the file doesn't exist, run `python3 scripts/traceability/build.py` first.

2. **Sanity-check scope.** Print `summary.needs_judging`. Confirm with operator before dispatching if > 50 scenarios (parallel agent runs cost real time/$). Allow `--limit=N` to cap.

3. **Dispatch parallel judges.** For each scenario in `scenarios_needing_judging`, spawn `Agent({subagent_type: 'general-purpose', description: "Judge §X.Y-NNN scenario", prompt: <judge-prompt>})`. Batch in groups of 5-10 concurrent. Judge prompt MUST include:
   - The scenario title + `@ref:` commitments
   - The full @requires test file contents (read by the dispatcher; subagent receives as evidence)
   - The relevant implementation file paths (derived from `app/lib/...` mirror of `app/test/...`)
   - A strict verdict-format spec: `{verdict: "PASS"|"FAIL", reasoning: "<one paragraph>"}`
   - The Q3 lock: judge verifies the test ACTUALLY DEMONSTRATES the contract (not just that the test passes mechanically)

4. **Aggregate verdicts.** Collect each subagent's verdict JSON. Each entry becomes `{scenario_id: {verdict: "PASS"|"FAIL"|"UNKNOWN", judged_at: <iso8601>, reasoning: "..." , scenario_text_sha: <from drift report>, requires_sha: <from drift report>}}`.

5. **Merge into cache.** Read existing `features/.judge-cache.json` (may be empty); merge new verdicts (new entries replace old). Write atomically. Cache is pretty-printed, sort-keyed for git-friendly diffs.

6. **Re-run build.py.** `python3 scripts/traceability/build.py`. Dashboard now shows fresh state.

**Limitations honored:**
- @notwired discipline is bounded by author tagging — the judge can verify "test demonstrates contract" but won't automatically detect "production entry-point doesn't reach this code" unless the judge prompt is extended to do so (future enhancement, documented in build.py rewrite thread).
- First-run is slow (411 scenarios from empty cache). Subsequent runs are sparse (only drifted ones).
- The Q3 lock means build.py never calls Claude — all judge calls go through this skill's Agent tool dispatches in a chat session.

## Scope (as of 2026-05-15)

- **Deterministic layer** — IN scope. `/features run` must reach 410/410 green; `mix test` + `uv run pytest` underneath.
- **Haiku-4.5 judge layer** — IN scope (was deferred in v1; pulled in for the goal-tracked long run). `/features judge` to be scaffolded mid-run. Scenarios with `Judge:` lines get a Haiku verdict; scenarios without still get a contract-check judge call per §14.3.
- **Arch-doc round-trip audit** — IN scope. `/features audit-archdoc` validates the catalog ↔ `§X.Y-NNN` commitments mapping is lossless and unique.
- **Stubbing** — Phase-4 scenarios needing prod credentials (WorkOS / TravelClick / Stripe) get `@stubbed:<reason>` tag; implement against in-process mocks; both det + judge layers see the stub. Final report enumerates stubs for separate re-validation.
- **CI integration** — still deferred. Skill is operator-driven; CI wiring lives in a follow-up plan.
- **Phoenix + Python apps** — partially scaffolded as of 2026-05-15 (worker shipped through M4.3a; Elixir app shipped through M3). Phase 1 remainder (M4.3b, M4.4, M5) closes the harness loop before phase-2 scenarios become runnable.
