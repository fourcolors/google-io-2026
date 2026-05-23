# Goal: Session owns placement_idempotency_key derivation so production callers of Cart.add_room_to_cart get idempotency for free

## Specific

Add `Flowstay.Session.placement_idempotency_key/2` — a public function that returns the canonical `placement_idempotency_key` string for a given `(call_id, room_id)`, formatted from the session's current `scene_version`. The function reads `scene_version` from the Session GenServer's canonical state and formats per the §7.1-010..011 convention pinned in `app/test/flowstay/cart_test.exs:96` (literal example: `"call_abc:scene_v3:RM-DELUXE"`).

This moves key-derivation from "every caller must build it" → "Session is the canonical owner; callers ask Session." Cart.add_room_to_cart/2's signature is unchanged — it still takes `:placement_idempotency_key` in attrs. A.3 is purely about who computes it.

Out of scope (deferred to A.4 or later):
- Replacing `MCPRuntime.add_room_to_cart`'s in-memory hold envelope with a real call to `Flowstay.Cart.add_room_to_cart/2` (that's a meatier change — separate scope).
- Wiring `Property.crs_adapter` resolution into the live path.
- Anything Stage B (Oban).

## Measurable

`mix test` stays at 1162/0 plus the new tests added by this work. The new tests live in `app/test/flowstay/session_test.exs` (or wherever existing Session unit tests already live — pp-ping discovers and matches the project convention) and pin:

1. **Function exists**: `Flowstay.Session.placement_idempotency_key/2` is exported with the right arity.
2. **Same scene → same key** (idempotence under repeat): for a session at `scene_version: V`, two calls with the same `room_id` return the same key.
3. **scene_version bump → new key** (different attempts): after `Session.advance_scene/2` or any mutation that bumps `scene_version`, the same `room_id` returns a different key.
4. **Different room_id, same scene → different key** (per-room granularity).
5. **Distinct call_ids → distinct keys** (no cross-session collision possible).

The key format MUST be compatible with the convention pinned in `app/test/flowstay/cart_test.exs:96`. The exact separator/prefix is the implementer's call, but two real-world properties hold: the key includes call_id, includes scene_version, includes room_id; and round-tripping through `Cart.add_room_to_cart/2` with the returned key triggers the existing idempotency path (covered indirectly via the §7.1-010..011 test that's already green).

## Achievable

Single scenario, dispatched mode:

- **S1** — `Flowstay.Session.placement_idempotency_key/2` returns the canonical key from session state. (TaskCreate emits the ID.)

This is one scenario because the function is small, pure-formatting on top of one Session GenServer call, and the five test assertions all live in one test file.

## Relevant

Closes the last "in-flight" item of Stage A before A.4 (flip stubbed §7.1 scenarios) and Stage B (Oban). Once A.3 lands, any future caller of `Cart.add_room_to_cart/2` (planned in A.4 / B / MCP runtime cleanup) can ask Session for the key instead of constructing the string themselves — eliminating the class of bug where two call sites format the key differently and quietly defeat idempotency.

Per the §7 thread doc: "Production sessions will get idempotency for free without each caller hand-computing the key."

## Time-bound

1 cycle. If the first cycle doesn't produce a clean PASS across all five auditor axes, escalate — the work is small enough that re-dispatching twice would be a sign the scope was wrong, not the implementation.

auditor_mode: **claude-solo** (deterministic Elixir; no LLM-compliance, AI persona, vendor integration, auth/PII, money, or destructive DB ops — fully covered by the standard pp-auditor five-axis review).
