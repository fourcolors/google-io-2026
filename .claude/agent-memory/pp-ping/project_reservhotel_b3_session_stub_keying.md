---
name: reservhotel-b3-session-stub-keying
description: For ReservHotel Phase B+ scenarios, Req.Test.stub is keyed to HttpClient (not the caller module like Session) because the wrapper owns the Req.new wiring — pinned via config/test.exs:35
metadata:
  type: project
---

# ReservHotel Phase B+ stub-key convention

**Fact:** `Req.Test.stub(Flowstay.CRS.ReservHotel.HttpClient, fn conn -> ... end)` is the keyed shape for ALL ReservHotel scenarios from B.2 onward — INCLUDING scenarios that test higher-level callers like `Session`, `search_rooms`, `confirm_booking`. The stub is NOT re-keyed per caller.

**Why:** `app/config/test.exs:35` sets `config :flowstay, :reservhotel_http_plug, {Req.Test, Flowstay.CRS.ReservHotel.HttpClient}`. The `HttpClient.build_req_opts/2` reads this and wires it onto every `Req.new(...)` call as `plug:`. So the test plug receives requests at the HttpClient module key — regardless of which higher-level module (Session, RoomSearch, etc.) initiated the call.

**How to apply:**
- When writing a pp-ping test for a Phase C/D/E module that internally calls `HttpClient.get/2` or `HttpClient.post/3`, key your stub on `Flowstay.CRS.ReservHotel.HttpClient`.
- Pin this in the test's `@moduledoc` so cross-model auditors (consult mode) don't suggest re-keying.
- The pattern transfers to any Elixir project that wraps Req with an env-driven plug: the stub key matches the env config, not the caller.

Related: [[feedback_function_exported_otp21]], [[dynamic-struct-for-clean-red]].
