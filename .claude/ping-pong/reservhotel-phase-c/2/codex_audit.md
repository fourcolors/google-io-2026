# Codex Audit — C.2 Parser (Task #2)

## Per-Axis Verdicts

**1. On task — FAIL**
GOAL.md item 2 requires nightly rate from `span.fromprice{code}`. Full live-capture parsing of `ibe5-rooms-v55.html` returned all 8 rooms with `nightly_rate=nil`. The `fromprice` span is never read into `RatePlanPricing.nightly_rate`. This violates both the GOAL and `Types.minimum_contract/0` (which requires `nightly_rate` or `nightly_breakdown`). The parser hardcodes `nightly_rate: nil` at `parser.ex:253` and `parser.ex:265` in both pricing paths.

Verification command Codex ran:
```
rooms=8 ids=["RM-KITCHENETTE", "RM-STANDARD-2D", "RM-STANDARD-1K", "RM-OCEAN-2Q",
             "RM-DELUXE-1K", "RM-DELUXE-2Q", "RM-KITCHENETTE-2D", "RM-APARTMENT-6P"]
nightly=[nil, nil, nil, nil, nil, nil, nil, nil]
```

**2. Correct — PASS**
`mix test test/flowstay/crs/reserv_hotel/parser_test.exs` passed: 16 tests, 0 failures. (Only pre-existing TravelClick behaviour warnings, documented out-of-scope.)

**3. Right (Adversarial) — FAIL**
The load-bearing `selectRate` extraction is brittle and silently degrades to nil pricing / non-bookable plans when the JS shape shifts.

Codex ran a standalone `elixir -e` regex probe against the actual regex at `parser.ex:56` (`@selectrate_regex`):
```
current           = true    ✓
space_before_paren = false  ← BREAKS
double_quotes     = false   ← BREAKS
leading_plus      = false   ← BREAKS
leading_minus     = false   ← BREAKS
```
Failure mode: regex returns `nil` → `build_pricing(nil)` → `bookable_v1?: false` — but `parse_rooms/1` still returns `{:ok, rooms}`. Silent degradation, no error surfaced.

Position 5/6 inversion is correct. An appended 11th param does not break the 6-capture regex. A new param inserted *before* position 5 would silently corrupt money semantics — this is a future risk, not a current bug.

Label selector: `h3.detail-head` primary, fallback `h4.hotel-heading` (`parser.ex:132`). If vendor upgrades to `h4.detail-head`, the parser returns `""`, not an error.

Money empty-field: Uses `Float.parse/1` (not `String.to_float/1`) so `""` does not crash. BUT `[\d.]+` accepts malformed dotted values — `Float.parse("523..2")` returns `{523.0, "..2"}` (parsed as 523.0, silently). And if `deposit` becomes `nil`, the `parsed.deposit > 0` guard at `parser.ex:317` can behave incorrectly.

**4. Smart — FAIL**
Unknown room codes are skipped with `Logger.warning/1` only (`parser.ex:81`). Callers receive `{:ok, known_rooms}` with no structured signal that the vendor catalog changed. If all rooms are unknown, callers get `{:error, :no_rooms_found}` — losing the real cause. A `{:ok, rooms, [unknown: ["XXX"]]}` return or similar would let callers decide whether to alert.

**5. Extra mile — FAIL**
Multi-rate-plan is untested. RC4's open questions note that today's probe shows exactly 1 rate plan per room (code `22`) but asks whether Cofresi ever surfaces multiple plans. Current parser uses `flat_map` over `li[rate-code]` elements which would correctly accumulate multiple plans — but there is no test verifying this, and the fixture only proves the single-rate case.

Rate code stability is not tested. If rate code `22` changes seasonally, the booking form's `rate=22` param would break silently.

Tax cadence: parser sets tax `amount` to the full-stay tax from `selectRate` param 6 but marks `cadence: :per_night` (`parser.ex:269`). That is internally inconsistent unless the amount is divided by nights first.

## Overall: FAIL

Despite green tests, the parser fails Phase C acceptance on two hard GOAL requirements:
1. `nightly_rate` is always nil — violates GOAL.md item 2 and the CRS minimum contract.
2. `selectRate` regex is not robust — silently degrades on 4 plausible JS mutations.

Confidence: **high**. Codex ran the actual Elixir compiled beam against the full 310KB live HTML and probed the regex directly.

## Adversarial Findings (ranked by severity)

| # | Finding | Severity | File:Line |
|---|---------|----------|-----------|
| 1 | `nightly_rate` always `nil` — GOAL.md L25, `Types.minimum_contract/0` both require it | **BLOCKER** | `parser.ex:253,265` |
| 2 | `selectRate` regex silently degrades on space-before-paren, double-quotes, leading ± | **HIGH** | `parser.ex:56` |
| 3 | Tax cadence `cadence: :per_night` on a full-stay tax amount is schema-inconsistent | **MEDIUM** | `parser.ex:269` |
| 4 | Label selector fallback returns `""` on vendor h3→h4 change, no error raised | **MEDIUM** | `parser.ex:132` |
| 5 | Unknown code observability is log-only; callers get no structured unknown list | **LOW** (within scope, accepted pattern) | `parser.ex:81` |
| 6 | `Float.parse("523..2")` returns `{523.0, "..2"}` — malformed multi-dot not rejected | **LOW** | `parser.ex:325` |

Findings #3–6 are within the "audit, don't refactor" scope per the task brief. Findings #1 and #2 require pong action before this task can be ACCEPTED.

## Codex metadata

- CLI version: codex-cli 0.128.0
- Model: gpt-5.5
- Sandbox: read-only
- Working dir: `/Users/fourcolors/Projects/1_active/flow-industry/flowstay/app`
- Session: 019e546a-9ce7-7d82-b378-ac1e63c8f58e
- Tokens used: 124,153
- Command: `codex exec -s read-only -C /Users/fourcolors/Projects/1_active/flow-industry/flowstay/app --ephemeral '<prompt>'`
- Codex actually ran: `mix test test/flowstay/crs/reserv_hotel/parser_test.exs`, regex probe via `elixir -e`, full parser run via `elixir -pa _build/test/lib/*/ebin -e '...'`
