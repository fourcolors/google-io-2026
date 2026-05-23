# Runner Procedure

How to execute the catalog when invoked as `/features run [@tag-filter] [--det-only]`.

In v1, there is no compiled runner. Claude executes this procedure by reading the `.feature` files and dispatching commands.

## High-level flow

```
1. Parse features/journeys.feature + features/invariants.feature
2. Apply tag filter (if provided): e.g., @phase:1, @journey, @invariant
3. For each scenario:
   3a. Run every @requires:<path>:
       - elixir/test/foo.exs:LINE → Bash: `cd elixir && mix test foo.exs:LINE`
       - python/tests/foo.py::name → Bash: `cd python && pytest foo.py::name`
   3b. For each Then step with `# → helper:` annotation, invoke that helper.
       (v1 has no helper lib yet — log "helper not implemented" and mark deterministic FAIL.)
   3c. Collect (passed: bool, output: string) per dispatch.
   3d. Scenario deterministic verdict = ALL dispatches passed.
   3e. If scenario has a `Judge:` line and we are NOT in --det-only mode: SKIP for v1 (judge layer is out of scope per Open Question 6 in the spec).
4. Aggregate per-feature roll-up.
5. Print output (see format below).
6. Report exit-equivalent: "0" if all deterministic checks passed, "1" if any deterministic failure.
```

## Tag filtering

Arguments after `run` that begin with `@` are tag filters. `--det-only` is a flag (no judge layer execution; v1 is always --det-only).

- `/features run @phase:1` → only scenarios tagged `@phase:1`
- `/features run @journey @phase:8` → only scenarios tagged BOTH `@journey` AND `@phase:8` (intersection)
- `/features run` (no filter) → all scenarios

If `@v2` or `@flake` tags are present on a scenario, exclude unless explicitly requested.

## Output format

```
features/journeys.feature — 41 / 43 passed
  [PASS] §7.3 Hold released when guest backs out of cart   det 3/3
  [FAIL] §3.5 One question at a time                       det 4/4 BUT no helper for "asks one thing"
         missing: helper assert_one_question_per_turn/0
  [FAIL] §5.2 Searching narrates within 2s                 det 0/1
         missing: elixir/test/search_test.exs:14 (file not found)

features/invariants.feature — 53 / 53 passed

Coverage: 458/458 commitments mapped     PASS
Result: 94 / 96 features passed
Exit: 1 (deterministic failures present)
```

## v1 expected behavior

Because the Phoenix and Python apps are not scaffolded yet:
- Most `@requires:<path>` paths will not resolve to a runnable test.
- The runner reports these as `missing: <path> (file not found)`.
- The output is *useful for development*: each missing path is a TODO of what to build.
- Exit code 1 is the expected result on an empty implementation.

This is correct behavior; v1 success criterion: "/features run executes against an empty implementation and reports failures with concrete @requires test paths — failure attribution is actionable."

## Modes that DEFER to other references

- `/features extract` → load `references/extraction-procedure.md`, dispatch subagent sequence.
- `/features update` → load `references/iteration-procedure.md`, dispatch update sequence.
- `/features status` → read `features/index.html` head, print row count, mapped count from last coverage_check.exs run, last extraction commit timestamp from git log.
