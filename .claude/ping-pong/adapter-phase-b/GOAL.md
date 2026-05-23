# Goal: Ship the HTTP client + session substrate that real ReservHotel callbacks (Phase C+) depend on

## Specific

Add HTTP + HTML deps to `mix.exs` (`{:req, "~> 0.5"}` + `{:floki, "~> 0.36"}`). Create two new modules under `app/lib/flowstay/crs/reserv_hotel/`:

- **`Flowstay.CRS.ReservHotel.HttpClient`** — Req wrapper with the IBE base URL (`https://www.reservhotel.com`), realistic browser User-Agent (per `memory/feedback_recon_opsec` — no `flowstay`/`test`/`bot` in UA), throttle (min 1s between requests), follow_redirects, error normalization (HTTP 5xx → `{:error, :crs_unavailable}`, HTTP 429 → `{:error, :rate_limited, retry_after}`, network errors → `{:error, :network_error, reason}`).

- **`Flowstay.CRS.ReservHotel.Session`** — manages the `S=` token. `Session.new/0` does a `GET ibe5.main?hotel=1990`, extracts `S=<digits>` from the redirect URL or page state, returns `%Session{token: "289346122", started_at: ~U[...]}`. Session struct is passed to subsequent calls; once the token is captured, downstream callbacks (Phase C+) use it without re-fetching.

## Measurable

- `mix deps.get` succeeds with Req + Floki added
- `mix compile` passes (no new warnings beyond the 4 known from Phase A — `Adapter.Test` + `TravelClick` missing `capabilities/0` + `metadata/0`)
- Full project test suite stays at **1157/0** baseline + N new HttpClient/Session tests
- `Flowstay.CRS.ReservHotel.HttpClient.get/2` returns `{:ok, %Req.Response{}}` for a 200, normalized error tuples for 5xx/429/network
- `Flowstay.CRS.ReservHotel.Session.new/0` returns `{:ok, %Session{token: "<numeric>", ...}}` against a mocked Req response that simulates the real `ibe5.main` redirect pattern
- Mock-driven tests; no real HTTP calls to `reservhotel.com` during `mix test` (per recon_opsec — no bot signals to the real IBE from CI)
- Throttle is implemented (verifiable by a test that measures elapsed time between two HttpClient calls — must be ≥ throttle interval)

## Achievable

Scenarios:

- **S1 — deps + HttpClient module**: add Req + Floki to mix.exs, build `Flowstay.CRS.ReservHotel.HttpClient` with base URL, throttle, UA, error normalization. Mock-driven tests.
- **S2 — Session module**: build `Flowstay.CRS.ReservHotel.Session` that uses HttpClient to fetch `ibe5.main` and extract the `S=` token. Mock-driven tests.

## Relevant

Phase B is the infrastructure substrate that Phases C (real `search_rooms`), D (real `confirm_booking`), E (`check_availability`), F (hold no-ops) all depend on. Without HttpClient + Session, no real wire calls are possible. This phase ships no business behavior; it's the substrate for everything downstream. Per the adapter discussion doc (`docs/discussions/2026-05-21-reservhotel-adapter-implementation.html`), the recon proved we can talk to the IBE with simple HTTPoison/Req — no headless browser, no captcha solver. This phase builds the "simple Req" infrastructure.

## Time-bound

Two dispatched cycles. Each scenario gets at most 2 pong attempts before escalation. Phase capped at ~1 hour of wall-clock; if both scenarios aren't green by then, bubble to user.
