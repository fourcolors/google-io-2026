# Auditor verdict — §7.3-007 expiry recheck (cycle 1)

**Audit sha (parent HEAD)**: `e75c60f116ac9e24a41a684934ece30a0a69c790`
**Working tree**: 7 files modified — matches pong's claimed scope exactly (`git status` is clean of any out-of-scope additions; the `session_test.exs M` from earlier sessions is no longer in the diff).

## Five-axis verdict

| Axis | Verdict | Notes |
|---|---|---|
| On task | PASS | Worker now branches on `capabilities[:check_availability]`; `:supported` → calls `adapter.check_availability/1` → `:still_available` silent re-hold (row stays `:active`, expires_at advanced, Session `:re_held`), `:gone` → mark `:expired` + signal `:expired`; `:not_supported` preserves TTL-only path. Contract `features/invariants.feature:2266-2272` satisfied — re-check via adapter, silent re-hold on still-available, expire on gone. GOAL.md **Measurable** items 1 (failing→passing test covering both branches) and 2 (existing baseline still green) achieved; items 3–5 (Haiku judge re-run, tag flip, DASHBOARD regen) are post-audit lead work. |
| Correct | PASS | Re-ran targeted: `mix test test/flowstay/workers/hold_expiry_worker_test.exs` → 6/6 (matches pong: `test_output.txt`). Re-ran full suite: `mix test` → 1186/0 (1 excluded) (matches pong: `full_suite_output.txt`). `recheck_capability/1`'s `with` chain degrades cleanly on missing property / missing-or-non-`:supported` cap. `safe_check_availability/2` guards `function_exported?/3` and folds `:not_implemented` into the defensive `:error` branch → `expire!/2`. `silent_re_hold!/2` uses `Ecto.Changeset.change` directly with the two fields the assertion pins (`status`, `expires_at`) — correct minimal write. Cancel-race coverage preserved (top-level `status: "active"` guard short-circuits if Cart.release_hold won). |
| Right | PASS | The 3 test-side files are mechanical consequences of the lead's resolution, not convenience: (a) `Compliance.behaviour_callbacks/0` filter is a *semantic fix* — without it, `@optional_callbacks` would be meaningless and every adapter would be forced to stub `check_availability/1`; (b) `adapter_test.exs` pin flip mirrors the production-code pin flip exactly (same map literal — verified byte-for-byte); (c) `adapter_compliance_test.exs` pin is a route through the new filter, same 7 mandatory names sorted alphabetically (verified — list unchanged). Grep for `behaviour_callbacks`/`operation_callbacks` shows all call sites are inside `Compliance` itself + the one test that pinned it — semantic change is contained. Worker docstring is thorough and accurate. Naming is sound (`silent_re_hold!/2`, `dispatch_recheck/3`, `safe_check_availability/2`). No half-finished work, no TODO leftovers. The defensive `{:error, _} → expire!/2` fallback is the right call: per the spec it shouldn't fire, but stranding a hold as `:active` past TTL on an upstream blip is worse than a TTL-only expiry. |
| Smart | PASS | The 4-step dispatch (`handle_active_hold` → `recheck_capability` → `dispatch_recheck` → `silent_re_hold!`/`expire!`) reads as deliberate, not over-decomposed: each step has a single concern (status guard, capability lookup, response branching, mutation). Collapsing `recheck_capability/1` + `dispatch_recheck/3` would interleave two `case` branches and obscure the "is this an `:supported` adapter?" decision from the "what did it say?" decision. The `@silent_re_hold_ttl_seconds 600` module attr is named, documented, single source of truth — better than a magic literal. One small simplification opportunity (not a defect): `recheck_capability/1` could `Repo.get(Property, property_id)` only ONCE per call, then memoize for the `dispatch_recheck` caller — currently the adapter module is computed but the property isn't reused. Trivial. |
| Extra mile | PASS | Worker `@moduledoc` rewritten end-to-end (not just appended) to describe the new branch logic with cross-refs to `Cart.re_verify_outcome/1`. Source-side comments cite §7 Stage B + Phase E in three places (adapter.ex, reserv_hotel.ex, worker.ex). Pong's hypothesis log explicitly distinguishes the falsified plan-vs-reality gap (Hypothesis 1) and the confirmed forward-fix (Hypothesis 2) — useful provenance for the lead. **Minor misses (not enough to FAIL this axis)**: (a) the `@stubbed:expiry_recheck_ttl_only_path` tag at `features/invariants.feature:2266` is still in place — GOAL.md **Measurable** lists tag-removal explicitly but pong defers to the lead (defensible reading of GOAL.md DoD); (b) ping's TestAdapter `def check_availability/1` at line 180 is missing `@impl true` (compiler warns — pong could've cleaned this when touching the area, but it's not in pong's listed scope and the test file is ping's territory); (c) DASHBOARD.html regen + Haiku judge re-run are listed but lead-side per the closure pattern. None of these are blockers. |

## Overall verdict

**DONE_WITH_CONCERNS** — all five axes PASS, but pong correctly flagged the forced scope expansion. The lead should explicitly acknowledge the 3 test-side edits as intended consequences of their resolution (not pong drift) before the commit lands.

## Reproduce evidence

**Targeted** (`cd app && mix test test/flowstay/workers/hold_expiry_worker_test.exs`):
```
Finished in 0.2 seconds (0.00s async, 0.2s sync)
6 tests, 0 failures
```

**Full suite** (`cd app && mix test`):
```
Finished in 5.9 seconds (0.6s async, 5.2s sync)
1186 tests, 0 failures (1 excluded)
```

Both reproduce pong's claimed numbers exactly.

## Reasoning

What's good: the worker's new branch is structurally what the contract asks for; the defensive degradations (missing property, missing capability key, `{:error, _}` from adapter, missing `check_availability/1` export) all collapse to the historical TTL-only path, which is the safest possible fallback for a worker whose job is to never strand `:active` rows past TTL. The 7-file diff is exactly the minimum surface area the lead's flagged-conflict resolution requires; the 3 test-side files are not scope drift but mechanical consequences. The Compliance filter is a genuine semantic fix to the macro (the old behaviour made `@optional_callbacks` meaningless).

What could be tightened: pong's concern about scope expansion is the right call to raise — the lead should affirmatively own the 3 test-side edits. The `Property.adapter_module/1` resolve path has only 2 clauses and would raise `FunctionClauseError` (not return nil) on a weird `crs_adapter` string, so `recheck_capability/1`'s `else _ -> :ttl_only` only catches return-value mismatches, not raised exceptions — a `try/rescue` around the lookup would close the gap, but there's no path in production today that would seed an unknown adapter string. The `@impl true` warning on TestAdapter is cosmetic but adds one line of compile-time noise.

## Follow-ups for lead

- **Confirm scope expansion is owned by lead, not pong drift** — the 3 test-side edits (`crs_adapter_compliance.ex`, `adapter_test.exs`, `adapter_compliance_test.exs`) are mechanical consequences of the lead's resolution of the FLAGGED conflict (ReservHotel capability flip `:supported` → `:not_supported`). They should be in the commit message body.
- **Tag flip + DASHBOARD regen** — `@stubbed:expiry_recheck_ttl_only_path` at `features/invariants.feature:2266` still in place; GOAL.md **Measurable** lists removal as a DoD condition. Run `python3 scripts/traceability/build.py` after tag flip to confirm §7.3-007 row goes green.
- **Haiku judge re-run** — GOAL.md item 3 (FAIL → PASS verdict) is post-audit lead work.
- **(Optional, follow-up task)** Wire silent-re-hold's Oban re-scheduling chain — explicitly out-of-scope here but a natural next ticket (when `silent_re_hold!/2` bumps `expires_at`, the existing warn + expiry jobs scheduled at the OLD `expires_at` are now stale; a new `Cart.schedule_hold_jobs/1` invocation at the new timestamp would close the loop). Today this means a silently-re-held hold fires no warn at the new TTL.
- **(Optional, follow-up task)** Add `@impl true` on TestAdapter `check_availability/1` to silence the compile warning at `hold_expiry_worker_test.exs:180`.

## "Is this dumb?"

No. The only thing that gave me pause was whether the Compliance filter change defeated the macro's whole purpose, but the macro is supposed to enforce *mandatory* surface conformance — filtering `@optional_callbacks` is the only correct read of "optional means optional," and a missed optional callback now lives behind `capabilities()[:foo] == :supported` instead of behind a stub-or-warn, which is exactly the contract this scenario establishes.

## Concerns addressed (DONE_WITH_CONCERNS triage)

1. **Scope expansion forced by lead's resolution** — **resolved (acknowledged, escalated)**. Per-file: (a) `crs_adapter_compliance.ex` filter is a semantic fix the macro needed regardless; (b) `adapter_test.exs` pin is a forced consequence of the capability flip in production; (c) `adapter_compliance_test.exs` route through the new filter is the test version of the same fix. Lead should affirm in the commit message that these were intended.
2. **`Compliance.behaviour_callbacks/0` semantic change** — **resolved**. Grep confirms all callers are in `Compliance` itself plus the one pinning test; the macro `__using__` block correctly preserves the "mandatory-only" semantic for adapter conformance enforcement. No silent breakage.
3. **Compliance macro `__using__` also iterates `behaviour_callbacks/0`** — **resolved**. Confirmed correct: mandatory-only is the right semantic for `use Compliance, adapter: X` (forcing every adapter to stub every optional callback would defeat the point).
4. **Cart re-verify downstream wiring NOT proven** — **resolved (escalated as follow-up)**. The worker correctly produces `scene_state[:hold_status] = :re_held` per spec; downstream Re-verify scene reading + routing is `Cart.re_verify_outcome/1` + scene tests elsewhere (per GOAL.md "Out of scope"). Not a blocker; correctly flagged as an integration concern, not an axis FAIL.
