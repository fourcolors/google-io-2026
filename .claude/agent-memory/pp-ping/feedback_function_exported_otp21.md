---
name: function-exported-otp21-load-order
description: In Elixir tests on OTP 21+, `function_exported?/3` does NOT auto-load modules — pair it with `Code.ensure_loaded!` or the assertion races test-runner load order under `async: true`
metadata:
  type: feedback
---

When specing a test that uses `function_exported?(Module, :fun, arity)` to assert a function is defined, always pair it with `Code.ensure_loaded!(Module)` on the line above. On OTP 21+, `function_exported?/3` no longer auto-loads modules; under `async: true` + random seed order, the assertion can fire before the module has been loaded by the test runner.

**Why:** Caught during adapter-phase-a S1 (2026-05-21). Pong implemented the function correctly (verified via `mix run -e 'Module.function()'`), but the test failed because `function_exported?` returned false when the assertion ran before any other test in the file had touched `ReservHotel`. Pong refused to patch `test_helper.exs` or `application.ex` to eager-load (correctly — that would mask the bug for future test authors). Fix belongs at the test seam.

**How to apply:**
```elixir
test "Module exports fun/0" do
  Code.ensure_loaded!(Module)       # required on OTP 21+
  assert function_exported?(Module, :fun, 0)
end
```
- The `Code.ensure_loaded!` line is load-bearing for correctness, not just nice-to-have.
- Calling the function (e.g., `Module.fun()`) ALSO forces a load as a side effect, so if the test does that anyway, `function_exported?` can be redundant. Use `function_exported?` only when you want a nicer error message before the call, and pair with `ensure_loaded!`.
- Latent bug to watch for: existing tests using `function_exported?` without `ensure_loaded!` (saw it in `reserv_hotel_test.exs:18-22` and `travel_click_test.exs:16-20`) pass today only because the test-runner load graph happens to touch those modules earlier in the run. Don't fix them preemptively, but flag if they start failing under random seed.
- Linked memory: [[verify-fake-module-claims-before-specing-removal]] (similar discipline: verify before specing).
