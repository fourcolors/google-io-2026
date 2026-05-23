# Goal: Ship Phase C of the ReservHotel adapter — real `search_rooms/1` via live POST + Floki parser

## ✅ SHIPPED — 2026-05-23

All 4 scenarios PASSed. Phase C complete:
- C.1 — `RoomMap` (8-entry IBE↔FlowStay bidirectional mapping with round-trip property tests via independent oracle) → claude-solo audit PASS all 5 axes
- C.2 — `Parser` (Floki extraction; selectRate position 5/6 inversion correctly handled; nightly_rate extraction; `:per_stay` tax cadence) → consult audit (Claude FAIL + Gemini PASS + Codex FAIL); 3 convergent fixes applied in r2 (nightly_rate + tax cadence + regex robustness) → PASS
- C.3 — `search_rooms/1` wiring + in-memory 5→8 room migration + parity verified across 3 legs (vendor_extras IBE code, tax cadence, deposit kind) → claude-solo audit PASS all 5 axes
- C.4 — Selector-contract assertions (9 contracts, GREEN-on-arrival pattern; round-2 added `li.roomli[room]` after auditor caught coverage gap) → claude-solo audit PASS all 5 axes post-r2

Final suite: **1270 tests, 0 failures (1 excluded)** — +49 tests from Phase B baseline 1221:
- C.1 RoomMap: +10
- C.2 Parser (r1+r2): +19
- C.3 wiring + migration: +11 net (existing reserv_hotel_test.exs grew from 12 → 23 tests)
- C.4 selector contracts (r1+r2): +9

Working tree (uncommitted; awaiting Mr. Cobb's go):
- NEW: `app/lib/flowstay/crs/reserv_hotel/room_map.ex` (47 lines)
- NEW: `app/lib/flowstay/crs/reserv_hotel/parser.ex` (~360 lines)
- NEW: `app/test/flowstay/crs/reserv_hotel/room_map_test.exs` (111 lines)
- NEW: `app/test/flowstay/crs/reserv_hotel/parser_test.exs` (~705 lines including embedded fixture + 19 Parser tests + 9 selector contracts)
- Modified: `app/lib/flowstay/crs/reserv_hotel.ex` (5-room hardcoded → 8-room module-attribute + env-flagged `:live` mode branch)
- Modified: `app/test/flowstay/crs/reserv_hotel_test.exs` (12 tests → 23: preserved + new in-memory assertions + live-mode Req.Test stubs + 3-leg parity)

Memory bullets saved this cycle:
- `feedback_bidirectional_table_oracle` — duplicated mapping oracle in test prevents self-consistent-but-wrong impl from passing round-trip property
- `feedback_consult_model_blindspots` — Gemini accepts schema field names at face value (misses unit/cadence); Codex empirically probes regexes; Claude has same-family bias with pp-pong
- `feedback_floki_substring_selector_literal` — Floki substring selectors match the literal exactly; loosen by dropping trailing punctuation when JS shape varies
- `feedback_defensive_contract_green_on_arrival` — when test asserts vendor surface that fixture already satisfies, no pong cycle needed

Cross-model audit findings (C.2 consult):
- Gemini's blindspot: Smart=PASS on tax cadence semantic bug (`:per_night` × full-stay amount → 3× overcharge). Claude + Codex both caught it.
- Codex's strength: empirically probed selectRate regex via `elixir -e`, verified silent degradation on space/quotes/sign variants. Static-reading auditors (Claude + Gemini) both missed it.

Tech-debt status (unchanged from Phase B):
- `mix compile --warnings-as-errors` still fails on pre-existing TravelClick missing `Adapter.capabilities/0` + `metadata/0` callbacks. NOT a Phase C blocker; Phase C introduced zero new warnings.

---

## Original goal (preserved for reference)


## Specific

Replace `Flowstay.CRS.ReservHotel.search_rooms/1`'s in-memory branch with a real
HTTP call against the ReservHotel IBE. Four new artifacts + one edit:

1. **`Flowstay.CRS.ReservHotel.RoomMap`** (NEW module + test) — config-table
   bidirectional mapping between the 8 observed IBE codes (A1K, C2D, C1K, POV,
   A2D, A2Q, CKT, P6O) and FlowStay stable IDs (`RM-KITCHENETTE`, `RM-STANDARD-2D`,
   `RM-STANDARD-1K`, `RM-OCEAN-2Q`, `RM-DELUXE-1K`, `RM-DELUXE-2Q`,
   `RM-KITCHENETTE-2D`, `RM-APARTMENT-6P`). Functions:
   - `to_flowstay/1` — `"A1K"` → `{:ok, "RM-KITCHENETTE"}` or `{:error, :unknown_code}`
   - `to_ibe/1` — `"RM-KITCHENETTE"` → `{:ok, "A1K"}` or `{:error, :unknown_code}`
   - `all_ibe_codes/0` — list of the 8 known codes (for tests + parser sanity checks)

2. **`Flowstay.CRS.ReservHotel.Parser`** (NEW module + test) — Floki extraction
   of room cards from the `POST ibe5_rooms_v55` response HTML. Public API:
   - `parse_rooms/1` accepts an HTML string, returns `{:ok, [%RoomResult{}]}` or
     `{:error, :no_rooms_found | term}`.
   - Internally: `Floki.parse_document!/1` → `Floki.find("div[id^='roomdet']")` →
     for each room: extract code (`id.substr(7)`), label (`h3.detail-head`),
     description (`div.txt.rd_{code}`), photos (`img.block_pic[src]` list),
     inventory (`span.roomsleft` text via regex `~r/Only (\d+) Room/`),
     nightly rate (`span.fromprice{code}` text → integer), rate plans (per
     `li[rate-code]` element + `strong.raname{rate_code}` text + `selectRate(...)`
     onclick regex with the **inverted-params** memory note baked in), cancellation
     (`p.freecancel[nights]` attr × 24 hours), deposit (`selectRate` param 4),
     **pre-tax subtotal (`selectRate` param 5 — JS calls it `tax` but it's the
     subtotal), tax amount (`selectRate` param 6 — JS calls it `subtotal` but
     it's the tax). Inversion is between positions 5 and 6, NOT 4 and 5. See
     `memory/feedback_reservhotel_selectrate_param_inversion` (corrected
     2026-05-23 after advisor catch).**
   - Maps IBE codes → FlowStay stable IDs via `RoomMap.to_flowstay/1` before
     building each `RoomResult.room_id`. IBE code goes in
     `vendor_extras["reservhotel_room_code"]` per RC1's locked decision.

3. **`Flowstay.CRS.ReservHotel.search_rooms/1`** (EDIT existing module) — replace
   the in-memory list-builder with environment-driven behavior:
   - **In `:in_memory` mode** (default during dev/test of OTHER subsystems):
     **MIGRATE the 5 existing hardcoded rooms to the 8-room space matching the
     IBE codes.** The existing 5 IDs (`RM-DELUXE`, `RM-STANDARD`,
     `RM-KITCHENETTE`, `RM-APARTMENT`, `RM-EFFICIENCY`) don't match the 8 IBE
     codes captured in the probe (A1K, C2D, C1K, POV, A2D, A2Q, CKT, P6O),
     which means the "in-memory ↔ live parity" gain cited in RC1 doesn't
     materialize unless we migrate. **C.3 includes this migration**; existing
     `reserv_hotel_test.exs` assertions get updated to the 8-room space.
     Prices in the in-memory data mirror the prices observed in the live probe
     (A1K=$160, C2D=$185, etc. — see `rc4-rate-plan-parsing-claude.md`).
   - **In `:live` mode**: `Session.start/0` → build POST body via
     `build_v55_form_body/2` (per `.scratch/phase-c-research/ibe5-rooms-v55-post-body.md`)
     → `HttpClient.post("/ibe5_rooms_v55", body)` → `Parser.parse_rooms/1` →
     return `{:ok, [%RoomResult{}]}`. On error, retry once with fresh
     session, then fall back to `HttpClient.normalize_error/1`.
   - Mode controlled by `Application.get_env(:flowstay, :reservhotel_crs_mode,
     :in_memory)`. (Phase G will flip the default; for Phase C the default
     stays `:in_memory`.)

4. **Selector-contract assertions** (extend Parser's test file) — RC3 hybrid
   discipline. Asserts the captured `@rooms_html` fixture contains the load-bearing
   selectors: `div[id^='roomdet']` count ≥ 1, `span.fromprice*` count ≥ 1,
   `p.freecancel[nights]` count ≥ 1, at least one Select button with
   `selectRate(...)` onclick. Documents the vendor surface; future HTML changes
   surface as failures-by-design.

5. **Sanitized HTML fixture** — embedded as `@rooms_html` module attribute in
   `parser_test.exs`. Source: `.scratch/phase-c-research/ibe5-rooms-v55.html`
   (310KB live capture from 2026-05-23 probe). Sanitize per RC2 checklist:
   strip `S=` tokens, cf-ray, transid/member_id/crm_id, r= referrer, 8-12 digit
   numeric JS literals. Verification grep: `grep -En 'S=[0-9]{6,12}|cf-ray|...'`
   must return empty before commit.

## Measurable

- `mix deps.get` — no changes (Req + Floki shipped in Phase B; no new deps).
- `mix compile --warnings-as-errors` — no NEW warnings from Phase C code.
  (Pre-existing TravelClick gap documented out-of-scope.)
- New tests pass (RED→GREEN per ping-pong cycle):
  - `room_map_test.exs` — bidirectional mapping, unknown-code handling
  - `parser_test.exs` — RoomResult shape, all 8 rooms extracted, selectRate
    inversion handled correctly, cancellation/deposit/inventory parsed
  - `reserv_hotel_test.exs` — extend with `:live` mode test (with Req.Test stub
    returning the captured HTML); existing `:in_memory` tests untouched
- Full `mix test` suite remains green (1221 baseline + ~25-30 new tests
  expected; target ~1246-1251 total / 0 failures).
- `Flowstay.CRS.ReservHotel.search_rooms/1` in `:live` mode returns the same
  `RoomResult` shape as `:in_memory` mode (modulo room_id values being
  property-specific). Verified by a contract-shape test comparing the two modes.
- Out-of-scope (do NOT touch in Phase C):
  - Phase B's shipped `HttpClient`, `Session` modules (use them; don't modify)
  - Hold callbacks (`create_hold`, `extend_hold`, `release_hold` stay synthetic /
    not_supported — Phase F territory)
  - `confirm_booking` (Phase D)
  - `check_availability` (Phase E)
  - Live HTTP from the test suite (all tests use captured fixtures + Req.Test stubs)

## Achievable

Decomposed scenarios (in dependency order):

- **C.1 — `RoomMap` module** — config-table + bidirectional lookup + unknown-code
  handling. Trivial scaffolding shape, but the 8-row mapping table itself is the
  load-bearing contract.
  - Files: `app/lib/flowstay/crs/reserv_hotel/room_map.ex` + `app/test/.../room_map_test.exs`
  - Audit: claude-solo

- **C.2 — `Parser` module** — Floki extraction of all 8 rooms from captured HTML.
  Depends on C.1. The selectRate param-inversion is the load-bearing trap.
  - Files: `app/lib/flowstay/crs/reserv_hotel/parser.ex` + `app/test/.../parser_test.exs`
    (test file embeds sanitized `@rooms_html` from `.scratch/phase-c-research/`)
  - Audit: **consult** — parser is load-bearing for Phases D/E too; cross-model
    verification on selectors + selectRate inversion handling

- **C.3 — `search_rooms/1` wiring + in-memory migration to 8-room space** —
  replace in-memory branch with env-flagged live HTTP → Parser → RoomMap →
  RoomResult. ALSO migrate the existing in-memory data from 5 rooms to the
  8-room space (matching the IBE codes captured in the probe) so the
  in-memory ↔ live parity gain RC1 promised actually materializes. First
  time we EDIT `reserv_hotel.ex` since Phase B started. Depends on C.1 + C.2.
  - Files: EDIT `app/lib/flowstay/crs/reserv_hotel.ex` + UPDATE
    `app/test/flowstay/crs/reserv_hotel_test.exs` (assertions move from
    5-room to 8-room space)
  - Audit: claude-solo
  - Reference: `.scratch/phase-c-research/ibe5-rooms-v55-post-body.md` for
    the POST form body shape

- **C.4 — Selector-contract assertions** — RC3 hybrid; defensive presence/absence
  checks on the captured fixture documenting the vendor surface. Depends on C.2.
  Can be parallel to C.3.
  - Files: EXTEND `app/test/.../parser_test.exs` (new describe block)
  - Audit: claude-solo

Task IDs (team `pp-reservhotel-phase-c`) backfilled below after `TaskCreate`.

## Relevant

Phase C unblocks Phase D (real `confirm_booking/3` — the capstone). Without
Phase C, Cofresi voice demo still returns the 5 hardcoded in-memory rooms —
prices wrong by 3-25% vs reality, inventory always-available, room IDs don't
match what the live IBE expects. With Phase C shipped, the voice agent's
search results match what a guest would see on `reservhotel.com` directly.

Same plan-doc as Phase B: `docs/discussions/2026-05-21-reservhotel-adapter-implementation.html`.
RC1/RC3/RC4 decisions locked there 2026-05-23. RC4 in-flight discoveries
(deposit kind, rate code stability, multi-rate-plan) tagged for surface-as-built.

## Time-bound

Estimate per plan: ~1 session for Phase C. Bubble to user if any single scenario
takes 3+ re-dispatches, OR if Phase C as a whole exceeds 6 ping-pong cycles
total (4 scenarios × 1.5 cycles ≈ 6 soft cap; consult mode on C.2 may add
~30s but shouldn't add cycles).

## Audit modes per scenario

- **C.1 — `claude-solo`.** Config-table module; auditor focuses on
  unknown-code handling + bidirectionality consistency (round-trip:
  `to_ibe(to_flowstay(x))` should equal `x` for all 8 codes).

- **C.2 — `consult`.** Parser is load-bearing — wrong selector or wrong
  param position breaks Phase D + Phase E silently. Cross-model verification
  (Claude + Gemini + Codex) per Phase B.3's pattern. Particular focus on:
  - selectRate param inversion (params 4 and 5 are swapped relative to JS names)
  - Floki selector robustness against minor HTML changes
  - RoomMap unknown-code path (what if IBE returns a 9th code we haven't seen?)

- **C.3 — `claude-solo`.** Wiring; auditor focuses on:
  - In-memory mode behavior unchanged (regression check)
  - Live mode return value shape-equivalent to in-memory mode
  - Mode-flag env-var hygiene (default `:in_memory`, never silently routes to live)

- **C.4 — `claude-solo`.** Defensive contract assertions; auditor focuses on:
  - Selectors asserted are the ACTUAL load-bearing ones (not noise)
  - Test fails meaningfully when HTML shape changes (not just "0 expected, 0 got")

## Risks pre-identified

- **HTML drift**: vendor changes are rare for legacy IBE5 but big-bang when they
  happen. RC3's selector-contract assertions are the early-warning. If a future
  HTML change breaks the parser, the contract test fails first (clear signal:
  "selector X no longer present") rather than the parser silently returning
  `{:error, :no_rooms_found}` (ambiguous: vendor change or network failure?).
- **Single-fixture risk**: the captured HTML is one snapshot (June 22-25, 2-adult
  search). Edge cases not covered: sold-out rooms, multi-rate-plan rooms,
  date-range outside availability. RC4's open questions enumerate these;
  Phase C's parser handles them defensively (returns empty list, picks first
  rate plan, etc.) rather than asserting their absence.
- **Naming collision in selectRate**: the JS param labels are inverted (param 4
  is pre-tax subtotal despite being called `tax`; param 5 is tax amount despite
  being called `subtotal`). Memory `feedback_reservhotel_selectrate_param_inversion`
  pins this. C.2's test MUST verify the parser uses position-based mapping, not
  name-based.
