---
name: macro-spec-two-surfaces
description: When specing a test-helper macro (e.g. behaviour-conformance), require TWO public surfaces — `__using__/1` for the user-facing `use` invocation AND a `validate!/1`-style runtime helper — so the test file can probe negative paths with broken fixtures without recompiling
metadata:
  type: feedback
---

When the scenario asks for a `use SomeMacro, adapter: Foo` test-helper API, do NOT spec compile-time-only checks. Require the macro module to ALSO expose a public runtime function (`validate!/1`, `check_conformance!/1`, etc.) that:

1. The macro's generated tests call internally (it's the engine the macro is built around).
2. Your test file calls directly against deliberately-broken fixture modules to prove the negative path ("fails clearly").

**Why:** Compile-time-only checks force the test file to recompile every time a fixture changes, and prevent you from writing fixture-driven negative tests at all (broken adapters can't be loaded). The runtime helper also gives adapter authors an `iex>` debugging entry-point — they paste their module name into `validate!/1` and see what's wrong without writing a test. Validated on FlowStay adapter-phase-a S2 (2026-05-21) — advisor flagged the two-surface design explicitly and it produced a clean RED with 7 failures + 1 sanity-pin GREEN.

**How to apply:**
- Spec the user-facing `use` surface AND a runtime probe surface in the BDD "Then" clauses.
- Negative tests build small `defmodule MissingFooFixture do ... end` blocks INSIDE the test file (no `@behaviour` annotation — you're testing the macro's runtime check, not the compiler's static warning). Fixtures stay isolated to the test file; they don't escape to lib/.
- Loose regex on error messages (`~r/foo/`) — pong picks phrasing, the regex just verifies the missing element is named.
- Pin the GENERATED tests' behaviour via test-run GREEN (`mix test` passes), NOT by introspecting the macro's AST output. AST pinning is brittle and over-constrains pong's implementation.
- Related: [[function-exported-otp21-load-order]] — any macro that uses `function_exported?` internally must include `Code.ensure_loaded!(adapter)` in its generated setup. Spec this via the GREEN test run requirement, not via AST inspection.
