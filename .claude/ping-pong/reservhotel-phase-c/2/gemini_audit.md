# Gemini Audit — C.2 Parser (Flowstay.CRS.ReservHotel.Parser)

## Per-axis verdicts

1. **On task**: PASS
   - Parser serves GOAL.md item 2: Floki extraction via `div[id^='roomdet']`, RoomMap translation, and the selectRate position 5/6 inversion are all present and correctly wired.

2. **Correct**: PASS
   - Tests verified green (16/0) per the stated test run. Note: Gemini CLI lacks `run_shell_command` in this workspace context, so test execution was not independently run by Gemini. The prompt reports 16/0 confirmed by the orchestrator before delegation; Gemini reviewed the test/impl alignment and found no structural mismatch.

3. **Right**: PASS
   - `parse_selectrate/1` in `parser.ex` captures the 6-arg regex and binds:
     - capture group 5 (`pos5_str`) → `total_before_taxes`
     - capture group 6 (`pos6_str`) → `tax_amount`
   - This is **not swapped**. The code comment above `parse_selectrate/1` explicitly documents the inversion (positions 5/6 labeled wrong in JS). PASS on inversion.
   - Floki selectors use stable class + attribute selectors (`div[id^='roomdet']`, `li.lis-sect[rate-code]`, `p.freecancel[nights]`) — not positional. PASS on selector robustness.
   - Unknown-code path: `Logger.warning/1` is called inside the `{:error, :unknown_code}` branch of `parse_room_card/2` BEFORE returning `[]`. PASS on warning-before-skip.

4. **Smart**: PASS
   - Module structure: listing/detail merge is clean — `find_listing_li/2` does a targeted `li.roomli[room='#{ibe_code}']` lookup; no ambiguity.
   - Money parsing: `Float.parse/1` is used throughout. `types.ex` permits `Decimal.t() | float()`, so this is compliant. Tests assert on float values that happen not to expose IEEE precision edge cases (480.0, 43.2, etc.).
   - Naming is clear and consistent (`total_before_taxes`, `tax_amount`, `ibe_code`).

5. **Extra mile**: FAIL
   - RC4 open questions (deposit kind fixed vs. first-night, rate code 22 stability, multi-rate-plan, mobile endpoint) are NOT surfaced as inline code comments or breadcrumbs in `parser.ex`.
   - `@spec parse_rooms/1` IS present (line 58 of `parser.ex`): `@spec parse_rooms(String.t()) :: {:ok, [RoomResult.t()]} | {:error, :no_rooms_found}` — PASS.
   - `@moduledoc` DOES cite the inversion memory by file path — PASS.
   - Deduction: hardcoded `:fixed` deposit kind and `"Government Occupancy Tax (9%)"` tax label lack inline comments pointing to RC4 rationale. A future maintainer must re-read the discussion doc to understand why those are hardcoded.

## Confidence

**High** — all files were read directly; only the shell-execute was unavailable (Gemini workspace restriction). The orchestrator confirmed 16/0 independently before delegation.

## Overall verdict

**PASS**

## Gemini findings the test/impl pair might miss

1. **Float precision risk**: `parse_money/1` uses `Float.parse/1` for all monetary values. The fixture values (523.2, 507.5, 480, 43.2) happen not to trigger IEEE 754 representation errors under the current assertions. A value like `670.35` (POV total) is binary-representable as `670.3499999...` in some IEEE contexts — the test currently passes but is fragile if the IBE ever returns values that don't round-trip cleanly through `Float.parse`. `Decimal` would eliminate this class of failure entirely.

2. **Missing RC4 "why" comments on hardcoded values**: `:fixed` for `deposit.kind` and `"Government Occupancy Tax (9%)"` for the tax label are correct per RC4, but no inline comment says so. This is not a correctness failure — it's a maintainability gap that tests cannot catch.

3. **No test for `deposit.required? == false` path**: `build_deposit(nil)` returns `required?: false`. This path is exercised only if `parse_selectrate/1` returns `nil` (no onclick found). The test suite has no assertion for the zero-deposit case (a room with no selectRate onclick at all). Not a blocker for Phase C, but a gap if the IBE ever returns a non-bookable room card without a Select button.

4. **`extract_ibe_code/1` fallback to `id` attribute**: The primary path reads the `room` attribute; the fallback strips `"roomdet"` prefix from the `id`. The fixture uses the `room` attribute path (PASS). The fallback is untested — if the IBE HTML ever omits the `room` attr, the fallback silently activates with no coverage signal.

---

## Gemini metadata

**Model:** gemini-2.5-pro (via `gemini -m gemini-2.5-pro`)
**Timestamp:** 2026-05-23
**CLI version:** 0.42.0
**Invocation:** `gemini -m gemini-2.5-pro -p '<prompt>'` (headless/non-interactive mode)
**Note:** Gemini could not execute `mix test` directly (workspace restriction — only the `app/` directory is in workspace scope); test green-check was confirmed by the orchestrator pre-delegation (16/0 independently verified).
