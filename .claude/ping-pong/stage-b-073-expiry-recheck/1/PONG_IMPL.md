# Pong (impl) — §7.3-007 expiry-recheck

**Status**: `DONE_WITH_CONCERNS` (see Concerns section — the lead's resolution forced 3 test files outside the original in-scope list)

**Diff sha (working tree, uncommitted)**: parent `e75c60f116ac9e24a41a684934ece30a0a69c790`

## RED → GREEN

- **RED confirmation** (before impl): `mix test test/flowstay/workers/hold_expiry_worker_test.exs` → 6 tests, 1 failure (the `still_available` branch, exactly as pp-ping predicted). Other failing case (`gone branch`) passed incidentally because the pre-impl worker always marks `:expired`.
- **GREEN after impl** (targeted): `mix test test/flowstay/workers/hold_expiry_worker_test.exs --trace` → **6 tests, 0 failures**. See `test_output.txt`.
- **GREEN full suite**: `mix test` → **1186 tests, 0 failures (1 excluded)**. Was 1184 baseline + 2 new from pp-ping. See `full_suite_output.txt`.

## Files changed (7 total)

### Production (in scope per Ping spec)

1. **`app/lib/flowstay/crs/adapter.ex`** (+19 lines)
   - Added `@callback check_availability(hold :: term()) :: {:ok, :still_available | :gone} | {:error, term()}`
   - Declared `@optional_callbacks check_availability: 1` — adapters that can't recheck advertise `capabilities[:check_availability] != :supported` instead of stubbing.
   - Moduledoc updated to document the optional-recheck contract.

2. **`app/lib/flowstay/crs/reserv_hotel.ex`** (+8 -1 lines)
   - `capabilities/0` map: `check_availability: :supported` → `check_availability: :not_supported` (per lead's flagged-conflict resolution: in-memory ReservHotel has no `ibe5_check_availability` HTTP call yet — flips back to `:supported` in adapter-phase E).
   - Comment cites §7 Stage B + Phase E for the future upgrade.
   - No stub `check_availability/1` added — worker only dispatches when capability is `:supported`, and `function_exported?/3` guard handles the unimplemented case defensively.

3. **`app/lib/flowstay/workers/hold_expiry_worker.ex`** (+117 -39 lines)
   - Moduledoc rewritten to describe the new branch logic.
   - `perform/1` unchanged shape, delegates active-hold case to `handle_active_hold/2`.
   - `handle_active_hold/2` resolves capability via `recheck_capability/1`:
     - When `{:supported, adapter}`: calls `safe_check_availability/2`, branches on `{:ok, :still_available}` → `silent_re_hold!/2`, `{:ok, :gone}` → `expire!/2`, `{:error, _}` → defensive `expire!/2` (never strand a hold past TTL).
     - When `:ttl_only`: existing `expire!/2` path.
   - `silent_re_hold!/2` updates row to `status: "active"` + new `expires_at` (now + 10 min, module attribute `@silent_re_hold_ttl_seconds 600`) and signals `Session.update_scene_state(call_id, :hold_status, :re_held)`.
   - `expire!/2` preserves the historical TTL-only behaviour (marks `:expired`, signals `:expired`).
   - `recheck_capability/1` defensive: missing property / missing capabilities map / lookup error all degrade to `:ttl_only`.

### Test support (forced consequences of the lead's resolution — see Concerns)

4. **`app/test/support/crs_adapter_compliance.ex`** (+12 -4 lines)
   - `behaviour_callbacks/0` now filters `@optional_callbacks` out of `behaviour_info(:callbacks)`. Without this, the compliance probe forced every adapter to export every optional callback — defeating the whole point of `@optional_callbacks`.
   - `operation_callbacks/0` doc updated to note optional callbacks are excluded.

5. **`app/test/flowstay/crs/adapter_test.exs`** (+10 -1 lines)
   - The pinning map at line 95-112 changed `check_availability: :supported` → `check_availability: :not_supported`. Comment cites the lead's §7.3-007 resolution and notes the value flips back when Phase E ships the real HTTP impl.

6. **`app/test/flowstay/crs/adapter_compliance_test.exs`** (+14 -4 lines)
   - "7 expected callbacks" sanity pin now calls `Compliance.behaviour_callbacks/0` (which filters optional) instead of `Adapter.behaviour_info(:callbacks)` directly. Test name + comment updated to reflect "7 MANDATORY callbacks" semantic. The pinned list is unchanged (still the 7 mandatory names sorted alphabetically). Optional callbacks evolve more freely via `capabilities()[:foo] == :supported`.

### Not touched by pong

- `app/test/flowstay/workers/hold_expiry_worker_test.exs` (+180 lines in working tree) — that's **pp-ping's test**. Pong did NOT modify it.
- `app/lib/flowstay/cart.ex`, `app/lib/flowstay/scenes/**`, `app/lib/flowstay/mcp/**`, `app/lib/flowstay/identity/property.ex` — all explicitly out-of-scope per Ping spec line 15-19. Confirmed `git diff --stat` lists none of them.
- `features/invariants.feature` — tag flip (`@stubbed:expiry_recheck_ttl_only_path` removal) is the lead's post-audit job per GOAL.md.

## Acceptance evidence (mapping test assertions → impl)

### Test 1: `still_available branch: silently re-holds`
| Assertion (line) | Impl line satisfying it |
|---|---|
| AC1: `refute reloaded.status == "expired"` (238) | `silent_re_hold!/2` sets `status: "active"` |
| AC2: `assert reloaded.status == "active"` (242) | same |
| AC3: `DateTime.compare(reloaded.expires_at, original_expires_at) == :gt` (247) | `new_expires_at = DateTime.add(DateTime.utc_now(), 600, :second)` — original was `+600s` from earlier insert, so the new value is strictly later |
| AC4: `assert hold_status == :re_held` (252) | `Session.update_scene_state(call_id, :hold_status, :re_held)` |

### Test 2: `gone branch: marks row :expired AND signals :expired`
| Assertion (line) | Impl line satisfying it |
|---|---|
| AC1: `assert reloaded.status == "expired"` (277) | `dispatch_recheck/3` on `{:ok, :gone}` calls `expire!/2` which sets `status: "expired"` |
| AC2: `assert hold_status == :expired` (282) | `expire!/2` calls `Session.update_scene_state(call_id, :hold_status, :expired)` |

### Existing 4 TTL-only tests (regression pin)

All 4 still pass **without modification**:
- `perform/1 — active hold expires (TTL-only path) marks row :expired AND signals :expired to Session` (line 64) — passes via the `:ttl_only` branch (real ReservHotel adapter's `check_availability: :not_supported`).
- `released hold → no-op`, `already-expired hold → no-op`, `unknown hold id → no-op` (lines 77, 88, 98) — defensive no-op paths preserved (unchanged).

Trace output confirms (from `test_output.txt`):
```
6 tests, 0 failures
```

## Judgment calls

1. **Silent re-hold TTL = 10 minutes** (`@silent_re_hold_ttl_seconds 600`). The test only pins "advanced past the original"; Pong picked 10 min as a sensible default — slightly tighter than `Cart.add_room_to_cart`'s 15 min band so a re-held room re-checks sooner under sustained negotiation pressure. Documented in code.
2. **Capability resolution path** uses `Repo.get(InventoryHold, hold_id)` → `Repo.get(Property, hold.property_id)` → `Property.adapter_module(property)`. The brief said to "preload property from hold's `property_id`"; a direct `Repo.get` is simpler than a preload and equally correct (no association traversal needed).
3. **Defensive `{:error, _}` fallback in `dispatch_recheck`**: per the spec, the worker only enters this branch when capability is `:supported`, so `{:error, :not_implemented}` shouldn't fire in practice — but I added it as a safety net so a transient adapter error (or accidentally-missing function) never strands a hold past its TTL.
4. **No stub `check_availability/1` on `ReservHotel`**: the lead said this was optional. Skipped because (a) the worker uses `function_exported?/3` guard, (b) `@optional_callbacks` means the compiler does not warn, (c) adding a stub would be misleading — it would suggest the adapter has an in-process answer when in fact the right semantic is "Cofresi can't actually re-check yet."
5. **No Oban re-scheduling on silent re-hold**: GOAL.md "Out of scope" explicitly excludes this. The new `expires_at` is durable on the row; a follow-up task can wire the re-warn/re-expiry chain.

## Out-of-scope respect

Confirmed via `git diff --stat`:
- ✅ `app/lib/flowstay/cart.ex` — not touched
- ✅ `app/lib/flowstay/scenes/**` — not touched
- ✅ `app/lib/flowstay/mcp/**` — not touched
- ✅ `app/lib/flowstay/identity/property.ex` — not touched
- ✅ `features/invariants.feature` — not touched
- ✅ `app/test/flowstay/workers/hold_expiry_worker_test.exs` — pp-ping's test, not touched by pong (180 lines added by ping pre-session)

## Hypothesis log

**Hypothesis 1** (used): after implementing the worker branch + ReservHotel capability flip, run the full suite to verify zero regressions. Result: **falsified** — 6 failures appeared (all in `crs/adapter*` test files), all consequences of the lead's resolution (the prior `adapter-phase-a` pins assumed `check_availability: :supported` and the Compliance module didn't filter optional callbacks). Diagnosis: the lead's plan didn't account for prior pre-existing pins.

**Hypothesis 2** (used): updating the 3 test-side files (Compliance module + 2 test files) to reflect the new optional-callback semantic + capability flip will green the suite without changing the behavioural contract. Result: **confirmed** — all 1186 tests pass, all 6 prior failures resolved.

No third hypothesis needed — 2/2 used.

## Concerns (DONE_WITH_CONCERNS)

- **Scope expansion forced by lead's resolution**: the lead's resolution of the FLAGGED conflict (set ReservHotel `check_availability: :not_supported`) forced updates to **3 files outside the original Ping in-scope list**:
  - `app/test/support/crs_adapter_compliance.ex` — filter optional callbacks in `behaviour_callbacks/0` (otherwise the compliance probe defeats `@optional_callbacks`).
  - `app/test/flowstay/crs/adapter_test.exs` — capability map pin updated.
  - `app/test/flowstay/crs/adapter_compliance_test.exs` — "7 callbacks" pin updated to call the new Compliance filter.
  
  These are direct, mechanical consequences of the lead's resolution — not new design choices — but the auditor should confirm the lead intended this surface area before approval. The alternative path (Ping's recommended Option A: keep `:supported` and make `check_availability/1` return `{:ok, :gone}` by default on real ReservHotel) would have avoided all 3 test-file edits but contradicts the lead's explicit instruction.

- **`Compliance.behaviour_callbacks/0` semantic change**: I changed it from "all callbacks (incl. optional)" to "mandatory callbacks only." This is a fix to the macro's semantic IMO (optional callbacks shouldn't force adapters to stub), but it's a behavioural change to a test-support module. If any other adapter author was relying on the old broad behaviour, this is a silent breaking change. Recommend the auditor grep for other call sites (I did — only the two test files in this commit and the macro's own `__using__` block reference it).

- **Compliance macro `__using__` block also iterates `behaviour_callbacks/0`**: this is correct (it's the same semantic — only require mandatory callbacks to be exported), but worth confirming the auditor agrees that's the intended macro behaviour.

- **Cart re-verify wiring is downstream, NOT proven by this pong**: the test verifies the worker emits `:re_held` into `scene_state[:hold_status]`, but it does NOT verify that the Re-verify scene reads that and routes correctly. That's covered by `Cart.re_verify_outcome/1` + scene tests elsewhere (per GOAL.md "Out of scope"). Auditor: this is the right scope but worth noting that "agent observes silent re-hold" is one step removed.

## Files written to cache

- `.claude/ping-pong/stage-b-073-expiry-recheck/1/test_output.txt` — raw `mix test test/flowstay/workers/hold_expiry_worker_test.exs --trace` output (6 tests, 0 failures).
- `.claude/ping-pong/stage-b-073-expiry-recheck/1/full_suite_output.txt` — raw `mix test` output (1186 tests, 0 failures, 1 excluded).
- `.claude/ping-pong/stage-b-073-expiry-recheck/1/PONG_IMPL.md` — this file.
