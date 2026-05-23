# Ping (spec) — §7.3-007 expiry-recheck

**Test path**: `app/test/flowstay/workers/hold_expiry_worker_test.exs:107-265`

**New test cases**:
1. `§7.3-007 — expiry-recheck branches on adapter capability › still_available branch: silently re-holds (row stays :active with bumped expires_at; Session signals :re_held)` (line 207)
2. `§7.3-007 — expiry-recheck branches on adapter capability › gone branch: marks row :expired AND signals :expired (capability-supported recheck says room is gone)` (line 252)

**Seam type**: deterministic

**Audit mode**: `claude-solo` (per GOAL.md)

**Capacity gates**: none required (pure in-process, DB-backed via DataCase + Oban.Testing — same as existing 4 tests)

**Out-of-scope** (full list at top of new describe block in the test file, line ~108):
- `app/lib/flowstay/cart.ex` (`re_verify_outcome/1` already exists)
- `app/lib/flowstay/scenes/**` (scene navigation is downstream)
- `app/lib/flowstay/mcp/**` (MCPRuntime is downstream)
- `app/lib/flowstay/identity/property.ex` (adapter_module/1 already provides resolution + override)

**In scope for pong**:
- `app/lib/flowstay/crs/adapter.ex` — add `check_availability/1` as `@optional_callback`
- `app/lib/flowstay/crs/reserv_hotel.ex` — implement `check_availability/1`
- `app/lib/flowstay/workers/hold_expiry_worker.ex` — capability branch + silent-re-hold path

## Confirmed RED

Ran `mix test test/flowstay/workers/hold_expiry_worker_test.exs`:
- 6 tests, 1 failure
- The failing test is the `still_available` branch:
  ```
  expected row to stay active on still_available, got status="expired"
  test/flowstay/workers/hold_expiry_worker_test.exs:238: (test)
  ```
- The `gone` branch passes incidentally because the current TTL-only worker produces `(row=:expired, session=:expired)` — which is the same outcome required by `:gone`. After pong's branch implementation, the gone branch must pass via the new code path, not the bypass. This is a **regression pin** in the sense of `feedback_regression_pin_scenarios.md` — it pins that pong doesn't break TTL semantics while adding the branch.

## Judgment calls (decisions ping made; flag if you want different)

1. **Session signal atom on `:still_available` = `:re_held`** (past-tense parallels the existing `:expired`; mirrors `Cart.re_verify_outcome(:still_available) → :silent_re_hold` semantically).
2. **Row "kept" representation** = `status: "active"` (unchanged) + `expires_at` advanced past the original timestamp. The test pins "advanced" via `DateTime.compare(reloaded.expires_at, original) == :gt` — pong picks the new TTL duration (15 min mirroring `Cart.add_room_to_cart`? a fresh TTL relative to recheck time? not pinned).
3. **TestAdapter wiring** uses the established `Application.put_env(:flowstay, :crs_adapter_override, TestAdapter)` mechanism per `Property.adapter_module/1:91-96`. No new wiring convention introduced.
4. **TestAdapter declares the FULL behaviour** (5 mandatory callbacks + `capabilities/0` + `metadata/0`) — unlike `cart_test.exs`'s `StubCRS` which cheats. Reason: the worker WILL inspect `capabilities[:check_availability]`, so the stub must provide it.

## ⚠ FLAGGED contract conflict for pong/auditor

GOAL.md says ReservHotel's `check_availability/1` returns `{:ok, :still_available}` **by default**. The existing 4 tests in this file use `crs_adapter: "reserv_hotel"` (no override). After pong's change, the existing test `"perform/1 — active hold expires (TTL-only path) > marks row :expired AND signals :expired to Session"` will resolve to real ReservHotel, hit the `:still_available` branch, and fail (because it asserts `:expired`).

Pong must resolve this. Options (pong picks):
- **(A)** Make ReservHotel's `check_availability/1` default to `:gone` (contradicts GOAL.md wording but keeps existing tests green semantically — TTL-only behavior is preserved on real adapter).
- **(B)** Make ReservHotel's default per-test-configurable (e.g., its own persistent_term), default `:still_available` for production, but the existing 4 tests opt into `:gone` via setup.
- **(C)** Update the existing 4 tests to use the override mechanism + the new TestAdapter (now they describe TTL-only via stub, not via real ReservHotel). Brief said "DO NOT delete or modify the existing 4 tests" so option (C) is excluded.
- **(D)** Most likely intent of GOAL.md: ReservHotel ships with `check_availability/1` per-test-configurable via Application env / persistent_term, with `{:ok, :still_available}` as the default in production but the existing TTL-only tests are updated to configure it to `:gone` (which technically modifies the existing tests' setup — brief restriction may need clarification with the lead).

I lean (A) — the "still_available by default" wording in GOAL.md likely refers to the stub-default semantics for tests, not the production module's runtime default. The production worker today on real Cofresi gets TTL-only behavior; that's correct (we have no real `ibe5_check_availability` call yet). When Phase E lands the real HTTP call, the default becomes "ask the upstream" anyway.

**Recommendation**: pong proceeds with (A) — set ReservHotel's `check_availability/1` to default `{:ok, :gone}`, and let the test override via TestAdapter when it wants `:still_available`. This keeps the existing 4 tests green without modification and matches the "ReservHotel currently has no real check_availability" production reality.

## Narrative context

The §7.3-007 contract was specified at `features/invariants.feature:2266-2272`. Today's `HoldExpiryWorker` short-circuits past the spec — it always marks `:expired`, ignoring any adapter capability. The `@stubbed:expiry_recheck_ttl_only_path` tag (line 2266) flags this gap honestly.

The seam pong needs to land is small:
1. Add `@optional_callback check_availability/1` on `Flowstay.CRS.Adapter`
2. Add `check_availability/1` to `Flowstay.CRS.ReservHotel` (in-memory; configurable; per the flagged conflict, default `:gone`)
3. Branch in `HoldExpiryWorker.perform/1`:
   - Resolve adapter via `Property.adapter_module(property)` (preload property from hold's `property_id`)
   - Inspect `adapter.capabilities()[:check_availability]`
   - If `:supported` → call `adapter.check_availability(hold)` → branch on `{:ok, :still_available}` (silent re-hold: stay active, bump expires_at, signal `:re_held`) vs `{:ok, :gone}` (existing path: mark expired, signal `:expired`)
   - If not `:supported` → existing TTL-only path

Test infrastructure (`Flowstay.DataCase`, `Oban.Testing`, `seed_world/0`, `insert_hold/2`) is reused from the existing 4 tests in this file — no new helpers introduced.
