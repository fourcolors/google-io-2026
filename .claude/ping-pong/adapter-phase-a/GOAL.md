# Goal: Evolve `Flowstay.CRS.Adapter` behaviour to be self-documenting for new adapters

## Specific

Extend the `Flowstay.CRS.Adapter` Elixir behaviour at `app/lib/flowstay/crs/adapter.ex` with two new `@callback` declarations — `capabilities/0` returning a map per-callback-key, `metadata/0` returning hotel identity / endpoints / TTL defaults — so any new adapter has a self-guiding contract. Provide a `Flowstay.CRS.Adapter.Compliance` test macro that adapter authors can `use` to get behaviour-conformance tests for free. Update the `Flowstay.CRS.ReservHotel` adapter to implement both new callbacks. Correct the `adapter.ex` docstring's misleading location claim about `Flowstay.CRS.Adapter.Test` (the module IS real — at `app/test/support/crs_adapter_test_impl.ex` — but the docstring says it "lives next to this module," which is misleading; fix the location claim only, keep the reference).

## Measurable

At work-id close:

- `mix test test/flowstay/crs/` passes with 0 failures (10 existing + new capability/metadata/compliance tests).
- Full project test suite stays at **1142/0** (no regressions in unrelated files).
- The misleading location claim in `adapter.ex`'s docstring is corrected. The reference to `Flowstay.CRS.Adapter.Test` stays (module is real — `app/test/support/crs_adapter_test_impl.ex`, used by 3 tests in `app/test/flowstay/crs/adapter_test.exs:38-58`), but the docstring's phrase "lives next to this module" is either removed or updated to accurately point at `test/support/`. Asserted by `grep -n "lives next to this module" app/lib/flowstay/crs/adapter.ex` returning no matches.
- `Flowstay.CRS.ReservHotel.capabilities()` returns the expected map:
  ```
  %{
    search_rooms:    :supported,
    create_hold:     :synthetic,
    extend_hold:     :not_supported,
    release_hold:    :not_supported,
    confirm_booking: :supported,
    check_availability: :supported,
    quick_availability: :supported
  }
  ```
- `Flowstay.CRS.ReservHotel.metadata()` is callable via the behaviour callback and returns at minimum `:hotel_id`, `:ibe5_url`, `:ibe4_url` keys (plus any optional metadata it already exposes).
- `Flowstay.CRS.Adapter.Compliance` macro lets an adapter test file write `use Flowstay.CRS.Adapter.Compliance, adapter: Flowstay.CRS.ReservHotel` and get conformance tests generated. The macro fails clearly when a callback is missing or returns the wrong shape.

## Achievable

Scenarios (TaskCreate IDs filled in once created):

- **S1 — Behaviour evolution**: Add `capabilities/0` + `metadata/0` callbacks to `Flowstay.CRS.Adapter`. Implement both on `Flowstay.CRS.ReservHotel`. Fix the `Adapter.Test` docstring reference inline. (Task TBD)
- **S2 — Compliance macro**: Build `Flowstay.CRS.Adapter.Compliance` test macro. Use it in `reserv_hotel_test.exs` to replace the hand-rolled "behaviour conformance" describe block. (Task TBD)

## Relevant

Phase A is the foundation of the adapter implementation thread (`docs/discussions/2026-05-21-reservhotel-adapter-implementation.html`). The `capabilities/0` callback is Sterling Cobb's "whenever we're creating a new adapter, it knows exactly which functions it needs to map to" requirement — orchestrators (Cart, Oban workers, voice agent) plan around adapter capabilities upfront instead of discovering via `{:error, :not_supported}` branches at call time. Phases B–G (HTTP client, real search_rooms, real confirm_booking, etc.) build on this contract. The Compliance macro is also the artifact that a future TravelClick / Synxis / Inntopia adapter will use to verify its contract — invest now, harvest across the rest of phase work.

## Time-bound

Two dispatched cycles, one per scenario. Each scenario gets at most 2 pong attempts before the lead escalates with the design question. Full work session capped at this Claude session — if the second scenario isn't green by EoS, the lead bubbles to the user with current state.
