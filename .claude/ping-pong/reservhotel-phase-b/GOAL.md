# Goal: Ship Phase B of the ReservHotel adapter — HTTP infrastructure that real callbacks (Phase C/D/E) build on

## ✅ SHIPPED — 2026-05-23

All 3 scenarios PASSed. Phase B complete:
- B.2 — `HttpClient` + deps + test plug routing → claude-solo audit PASS all 5 axes
- B.3 — `Session` module + S= parser → consult audit (Claude PASS, Gemini FAIL, Codex FAIL); synthesized via convergence math → re-pong applied 2 surgical fixes (whitespace trim + List.last per memory) → PASS
- B.4 — `HttpClient.normalize_error/1` → claude-solo audit PASS all 5 axes

Final suite: **1221 tests, 0 failures (1 excluded)** — +23 tests from baseline 1198.

Working tree (uncommitted; awaiting Mr. Cobb's go):
- NEW: `app/lib/flowstay/crs/reserv_hotel/http_client.ex` (149 lines)
- NEW: `app/lib/flowstay/crs/reserv_hotel/session.ex` (50 lines)
- NEW: `app/test/flowstay/crs/reserv_hotel/http_client_test.exs` (250 lines, 22 tests)
- NEW: `app/test/flowstay/crs/reserv_hotel/session_test.exs` (210 lines, 7 tests)
- Modified: `app/mix.exs` (+2 deps: Req 0.5, Floki 0.36)
- Modified: `app/mix.lock` (+6 packages: Req, Floki, Finch, Mint, NimbleOptions, NimblePool)
- Modified: `app/config/test.exs` (+4 lines: Req.Test plug routing)

Tech-debt flagged for future cleanup (NOT a Phase B blocker):
- `mix compile --warnings-as-errors` fails on bare `main` due to TravelClick missing `Adapter.capabilities/0` + `metadata/0` callbacks. Pre-existing; confirmed via `git stash` test. Independent of Phase B.

Memory bullets saved this cycle:
- `project_reservhotel_s_token_mechanic` — S= mechanic (body-embedded, not 302)
- `feedback_consult_synthesis_convergence_math` — 3/3 fix, 2/3+source fix, 1/3 advisory

---

## Original goal (preserved for reference)


## Specific

Stand up the HTTP substrate for `Flowstay.CRS.ReservHotel` so Phases C-G can
make real calls to `reservhotel.com`. Three new modules + dep additions:

1. **`mix.exs`** — add `{:req, "~> 0.5"}` and `{:floki, "~> 0.36"}`; `mix deps.get`
   succeeds. (Done solo-lead before B.2; asserted in B.2's setup.)
2. **`Flowstay.CRS.ReservHotel.HttpClient`** — thin wrapper over Req. Owns:
   base URL config (`https://www.reservhotel.com/win/owa/`), real-Chrome
   User-Agent string (per RQ3 / `memory/feedback_recon_opsec`), **per-call**
   redirect handling (default `redirect: true`; B.3's `Session.start/0` opts
   out with `redirect: false` if the mechanic ever requires it — but per recon
   below, `ibe5.main` returns 200 directly, so opt-out is unused initially),
   throttling discipline (config-driven min-interval between calls; default 5s
   per `memory/recon_opsec`; tests assert the throttle *actually delays*, not
   just that the config is read), response logging (debug-level; never logs
   card data or the `S=` token).
3. **`Flowstay.CRS.ReservHotel.Session`** — struct + functions for the IBE wizard's
   APEX session token. `Session.start/0` → `GET ibe5.main?hotel=1990` (200 HTML
   response), parse with Floki, extract `<input type="hidden" name="S"
   value="...">` (the populated one — recon shows there are TWO `name="S"`
   inputs on the page, one empty and one with the real token; the parser must
   pick the non-empty one). `Session.token/1` returns the captured token.
   Per-booking only; **no pooling** (per RQ2: ~15-30 min practical TTL).
4. **Error normalization** — a single helper (location TBD by pong, likely
   `HttpClient.normalize_error/1`) that maps raw Req responses → adapter-friendly
   tuples: HTTP 5xx → `{:error, :crs_unavailable}`; sold-out HTML pattern →
   `{:error, :room_unavailable}`; HTTP 429 → `{:error, :rate_limited, retry_after_seconds}`.

Phase B does NOT yet wire the real callbacks into `reserv_hotel.ex` —
those land in Phase C (`search_rooms`) and Phase D (`confirm_booking`).
Phase B is pure infrastructure, fully mock-tested. **No live HTTP calls
from the test suite.**

## Recon evidence (captured 2026-05-23, this session)

Three HEAD/GET probes against `reservhotel.com` (no booking, no payment
submission, throttled 5s, real Chrome UA per recon opsec):

| Probe | Result |
|---|---|
| `HEAD ibe5.main?hotel=1990` | 200 (no `Location` header) |
| `HEAD ibe5_rooms_multiroom.main?...` (no `S=`) | 200 (no `Location`; rejection-on-missing-S is NOT a 302) |
| `GET ibe5.main?hotel=1990` (body) | 200 HTML, contains TWO `<input type="hidden" name="S" ...>` — one `value=""` and one `value="289566642"` (the real token) |

**Conclusion:** the `S=` token is **body-embedded**, not a redirect. Earlier
GOAL.md draft was wrong (assumed 302+`Location`). Caught by advisor + verified
by primary-source probe. Saved to memory below for future sessions.

## Measurable

- `mix deps.get` succeeds with Req + Floki present.
- `mix compile --warnings-as-errors` introduces **no new** warnings from
  Phase B code. (Pre-existing failure exists on `main` due to TravelClick
  missing `capabilities/0` + `metadata/0` Adapter callbacks; auditor B.2
  verified this is unrelated tech debt outside Phase B scope. Logged for
  separate cleanup; do NOT expand Phase B to fix it.)
- New test files for `HttpClient`, `Session`, and error normalization all
  pass (RED→GREEN per ping-pong).
- `mix test` overall remains green (no regressions in the existing
  `reserv_hotel_test.exs` or anywhere else).
- No code in `app/lib/flowstay/crs/reserv_hotel.ex` is modified —
  Phase B only adds three new modules.
- Mock-test the `S=` capture using a fake Req adapter (Req supports `plug:`
  for in-process mocking — pong's job to discover the cleanest pattern;
  hint: `Req.Test.stub/2` is the canonical project-agnostic shape).
- Throttling: the `B.2` test asserts the throttle actually inserts the
  configured delay between consecutive calls. Tests use a small delay
  (e.g., 50ms) to keep the suite fast while still being deterministic.
- Out-of-scope (Phase C+ territory): real Floki HTML parsing of room
  results, real `POST` form bodies, any change to the adapter's existing
  in-memory return values.

## Achievable

Decomposed scenarios (in dependency order). **B.1 dropped as a standalone
scenario** per advisor — trivial scaffolding folded into B.2's prerequisite
setup (assert Req+Floki loadable).

- **B.2 — `HttpClient` module + deps** (`Flowstay.CRS.ReservHotel.HttpClient` with
  Req config, Chrome UA, per-call redirect control, throttling that actually
  delays). Deps added to `mix.exs` as prerequisite (solo-lead).
- **B.3 — `Session` module** (`Flowstay.CRS.ReservHotel.Session.start/0` and
  `Session.token/1`; parses `<input name="S" value="...">` from the `ibe5.main`
  HTML body via Floki; ignores the empty-value sibling). Depends on B.2.
- **B.4 — Error normalization** (`HttpClient.normalize_error/1` or equivalent;
  HTTP 5xx / sold-out HTML / 429 → normalized error tuples;
  exhaustive handling: network timeouts → `:crs_unavailable`; 4xx other than 429
  → `:bad_request` or pass-through; pong picks the precise vocabulary, auditor
  challenges completeness). Depends on B.2.

Task IDs (team `pp-reservhotel-phase-b`):
- B.2 → task **#1**
- B.3 → task **#2** (blocked by #1)
- B.4 → task **#3** (blocked by #1)

## Relevant

Phase B unblocks all of Phase C (live `search_rooms`), Phase D (live
`confirm_booking` — the capstone), Phase E (live `check_availability`),
and Phase G (production switch). Without it, Cofresi cannot book a real
room via the voice agent — every adapter call still returns hard-coded
in-memory data. This is the first chunk of the FU-3 work captured in
the project task list (#5), and it lands on the path to closing the
`@stubbed:reservhotel_in_memory` gap that the feature catalog still flags.

The plan + research lives at
`docs/discussions/2026-05-21-reservhotel-adapter-implementation.html`.
All 6 empirical RQs answered. Gateway-agnostic per the
`feedback_reservhotel_gateway_agnostic` memory — do NOT chase PSP
identity in any scenario here.

## Time-bound

Estimate per plan: ~1 session for Phase B. Bubble to user if any single
scenario takes 3+ re-dispatches, OR if Phase B as a whole exceeds 5
ping-pong cycles total (3 scenarios × ~1.5 cycles ≈ 5 is the soft cap).
After that, surface the blockage with current state cited against this
GOAL.md.

## Audit modes per scenario

- **B.2 — `claude-solo`**. Config + Req wrapper; auditor focuses on UA
  fidelity, per-call redirect API, no card/token leakage in logs, and
  the throttle-actually-delays test.
- **B.3 — `consult`** (pp-auditor + Gemini + Codex). Per advisor:
  the `S=` parser is the single load-bearing extraction for every
  downstream phase. Getting it wrong breaks Phase C+D+E silently.
  Cross-model verification is ~1.5 min insurance against a parser
  blindspot (e.g., the empty-sibling pitfall, fragile CSS selector).
- **B.4 — `claude-solo`**. Pure function over Req response; auditor
  focuses on exhaustiveness — what about 4xx other than 429? what about
  network timeouts? Single-axis to challenge.

`panel` mode is held in reserve for Phase D (real confirm POST) and
Phase G (production switch).
