# Claude consult audit — C.2 ReservHotel.Parser

**Audit sha**: `e6c04e1aeff496e2853a69cb7bd5958408d32307` (working tree, no commit)
**Auditor**: pp-auditor (Claude, consult mode)
**Re-runs from `app/`**:
- `mix test test/flowstay/crs/reserv_hotel/parser_test.exs` → **16 tests, 0 failures** (seed 758600) ✓
- `mix test test/flowstay/crs/reserv_hotel/room_map_test.exs` → 10 tests, 0 failures (sibling, C.1 unaffected) ✓
- `mix test` → **1247 tests, 0 failures (1 excluded)** ✓ matches lead's expected 1231 + 16

---

## On task — PASS

GOAL.md item 2 calls for: Floki extraction of all 8 rooms from `POST ibe5_rooms_v55` HTML, IBE→FlowStay code translation via RoomMap, selectRate position-5/6 inversion handled. The impl:

- Iterates `div[id^="roomdet"]` (cannot statically hardcode the 2-room fixture; the unknown-code path test #10 exercises this property)
- Translates IBE → FlowStay via `RoomMap.to_flowstay/1` at L77-89
- Preserves raw IBE code in `vendor_extras["reservhotel_room_code"]` per RC1's locked decision
- Handles the position-5/6 inversion — verified by reading the impl code (see Right axis), not just trusting the test

Out-of-scope respected: no edits to `reserv_hotel.ex` (C.3), `session.ex`/`http_client.ex` (B.2/B.3), no Req.Test stubs, no `search_rooms/1` wiring. Single new file: `lib/flowstay/crs/reserv_hotel/parser.ex` (348 lines). No test-file edits beyond ping's spec.

---

## Correct — PASS

- Re-ran `mix test test/flowstay/crs/reserv_hotel/parser_test.exs` independently: exit 0, 16/16 pass. Matches pong's claim verbatim.
- Sibling test `room_map_test.exs` (C.1, shared seam): 10/10 still pass. No regression.
- Full `mix test`: 1247/0 — exactly 1231 baseline + 16 C.2 new tests. No invisible suite damage.
- The 4 pre-existing TravelClick `capabilities/0` + `metadata/0` warnings are pre-existing (Phase B documented out-of-scope per GOAL.md L77), not introduced by C.2.

---

## Right — PASS (with two minor hygiene notes)

**Load-bearing inversion check — VERIFIED IN CODE, not just by test:**

`parse_selectrate/1` at L229-248 binds the regex captures positionally:

```elixir
[_full, _room, _rate, total_str, deposit_str, pos5_str, pos6_str] ->
  %{
    total: parse_money(total_str),                  # pos 3
    deposit: parse_money(deposit_str),              # pos 4
    total_before_taxes: parse_money(pos5_str),      # pos 5 → SUBTOTAL ✓
    tax_amount: parse_money(pos6_str)               # pos 6 → TAX ✓
  }
```

Variable names match comments at L225-228; pos5 → `total_before_taxes`, pos6 → `tax_amount`. NOT swapped. Hand-math verified independently against source HTML (`.scratch/phase-c-research/ibe5-rooms-v55.html` L2718-4030, all 8 selectRate signatures present): 480 + 43.2 = 523.2 ✓; 615 + 55.35 = 670.35 ✓; ratios 43.2/480 = 0.09 ✓ across all 8 rooms. The hypothetical "test fixture rigged to pass a swapped impl" cannot hold — the algebraic identity `total == subtotal + tax` cross-validates for both rooms (asserted at parser_test.exs L414-416 + L429-430).

**Floki selector robustness — PASS.** All selectors are attribute-based or class-substring, no positional fragility:

| Selector | Source corroboration |
|---|---|
| `div[id^="roomdet"]` | all 8 cards present (HTML L2602, 2785, 2972, 3164, 3349, 3537, 3725, 3914) |
| `class*='rd_'` | `rd_A1K`, `rd_POV`, etc. — all 8 present |
| `[onclick*='selectRate(']` | all 8 onclick attrs present (L2718-4030) |
| `li.lis-sect[rate-code]` | 8 occurrences (`raname22` × 8 + `lis-sect` × 8 confirmed via grep) |
| `p.freecancel[nights]` | preserved end-to-end in fixture; `nights="3"` for all 3-night searches |
| `li.roomli[room='...']` | 8 occurrences, attribute join key |
| `.roomsleft` text + `~r/Only \d+ Room/i` regex | div, NOT span — ping called this trap out and pong honored it (caught at parser.ex L170-176) |
| `room="X"` attribute on `roomdet` div | join key for listing↔detail merge, present everywhere |

No `nth-child`, no hardcoded color classes, no fragile structural selectors.

**RoomMap unknown-code path — PASS.** L82-84 emits `Logger.warning/1` BEFORE returning `[]` on the flat_map. `ExUnit.CaptureLog.with_log/1` at the test site picks it up (verified by 16/16 green including assertion #10).

**No `inspect/1` leakage.** The single `inspect(ibe_code)` at L83 is the IBE code string (4 chars max) — not a full `Plug.Conn` or `Req.Response` blob. Matches Phase B's no-leakage discipline.

**Hygiene notes (do not flip the axis to FAIL, but worth flagging):**

- **L340-343 `capitalize_word/1` is over-engineered**: `case String.downcase(word) do; downcased -> String.capitalize(downcased); end` is equivalent to `String.capitalize(word)` (the function already lowercases internally). The whole helper could be inlined as `Enum.map_join(" ", &String.capitalize/1)` at L337, dropping 7 lines. Minor smell, not a blocker.
- **Moduledoc/impl drift (L16)**: moduledoc claims the left-rail listing carries "the `.fromprice{code}` nightly rate" but `build_pricing/1` sets `nightly_rate: nil` (L265) — the `fromprice` selector is never queried in code. Either the doc claim should be deleted OR the impl should extract it (see Extra mile axis — leaning toward extracting it).

---

## Smart — FAIL

**Two concrete concerns, one is structural:**

### 1. Tax `cadence: :per_night` is semantically wrong (LOAD-BEARING)

`build_pricing/1` L268-275 stores `amount: parsed.tax_amount` (the **stay-total** tax from selectRate pos 6 — $43.20 for A1K's 3-night stay) and tags it `cadence: :per_night`. Downstream consumers reading this Tax struct will see:

```
amount: 43.20, cadence: :per_night
```

and reasonably multiply: `43.20 × 3 nights = $129.60 stay-total tax`. The actual stay-total tax is $43.20, not $129.60. Per-night A1K tax is $14.40, not $43.20.

RC4 L84 says: "Tax amount = selectRate param 6; rate = computed (9%) … No explicit tax rate field; derive: param6/param5". And L84 for cadence: "Total tax / nights = per-night amount; set `:per_night`". The intent is: compute per-night by dividing by nights, THEN tag `:per_night`. Pong did the tag without the division. Two correct alternatives:

  - (a) Store `amount: parsed.tax_amount`, `cadence: :per_stay` — matches the raw IBE semantics, no math required, no assumption about nights.
  - (b) Store `amount: parsed.tax_amount / nights`, `cadence: :per_night` — requires knowing the night count (not currently extracted by the parser; would need to come in via the form body / search context).

The current impl is the worst combination: stay-total amount + per-night tag.

This is the kind of "looks like it works but is actually fake working" bug Sterling's CLAUDE.md warns about. The test passes because nothing in the test inspects `cadence` semantics or multiplies amount × nights. Phase D/E will hit this.

### 2. The "9% hardcoded" RC4 gap is not surfaced inline

The brief explicitly called out: "If the reporting was too clean (e.g., didn't flag the 9% tax rate hardcoded as derivation, not from IBE) — call it out." Pong's status was PASS / no concerns. But:

- L271 hardcodes `label: "Government Occupancy Tax (9%)"` with no comment explaining the rate is DERIVED (43.2/480 = 0.09) and NOT pulled from any IBE field.
- L270 hardcodes `code: :occupancy_tax` and L274 hardcodes `applies_to: :room_only` — both are RC4 documented-assumptions.

A single 2-line comment near L268 noting "rate is hardcoded 9% from RC4 derivation; verify per-call ratio matches before relying on it" would have made the assumption auditable. Pong shipped it as if these were canonical IBE fields.

---

## Extra mile — FAIL

**Concrete misses pong could have caught in 5 minutes:**

1. **`nightly_rate` is left `nil` despite being trivially extractable.** RC4 L75 names `span.fromprice{room_code}` as the source, and the in-memory adapter (`reserv_hotel.ex` L264) populates it. The fixture even contains `<span class="custom-price frompriceA1K">160</span>` (L118 of fixture). One-liner:

   ```elixir
   defp extract_nightly_rate(listing, ibe_code) do
     listing
     |> Floki.find(".fromprice#{ibe_code}")
     |> Floki.text() |> String.trim() |> Integer.parse()
     |> case do
       {n, _} -> n * 1.0
       :error -> nil
     end
   end
   ```
   Sterling explicitly named "in-memory ↔ live parity" as RC1's goal — leaving `nightly_rate: nil` in live mode while in-memory mode populates it is a parity gap on day one of Phase C. The moduledoc even CLAIMS this is extracted.

2. **RC4 in-flight discoveries (rate code stability, multi-rate-plan, mobile endpoint) not surfaced anywhere in the code.** No comments, no `Logger.debug` breadcrumbs, no `# TODO(rc4-Q3)`. Brief named this as an extra-mile axis explicitly. A 5-line block comment above `parse_selectrate/1` noting the four open RC4 questions would have shipped the institutional knowledge with the code.

3. **No `@spec` on private helpers despite the module being load-bearing for Phases D/E.** Only `parse_rooms/1` has one. The private extraction helpers carry the inversion contract — adding `@spec`s on `parse_selectrate/1` and `build_pricing/1` would make the position-binding contract enforceable by Dialyzer.

4. **No moduledoc cross-ref to the RC4 doc.** Only the memory file is named. RC4 (`.scratch/phase-c-research/rc4-rate-plan-parsing-claude.md`) is the canonical reasoning trail for every hardcoded value in `build_pricing/1` and `build_deposit/1` and could be cited in 1 line.

5. **`bookable_v1?: parsed != nil` diverges from in-memory convention (hardcoded `true`) without justification.** This may be the better choice (defensive: if selectRate didn't parse, the rate isn't bookable), but it's a contract change worth a comment.

None of these are blockers individually. Together they're the "did we look one step further" miss the brief flagged.

---

## Concerns addressed (DONE_WITH_CONCERNS)

N/A — pong reported PASS / no concerns. The Smart + Extra-mile findings above are concerns pong should have raised. Their cleanliness was the lead's predicted tell.

---

## LLM compliance

N/A — deterministic HTML parser, no LLM seam.

---

## Per-axis verdict summary

| Axis | Verdict | Reason |
|---|---|---|
| On task | **PASS** | All GOAL.md item 2 requirements met; out-of-scope respected; single-file delivery |
| Correct | **PASS** | 16/16 re-run, 10/10 sibling, 1247/0 full suite — matches lead's expected counts exactly |
| Right | **PASS** | Inversion verified IN CODE not just via test; selectors stable; warning emits correctly; minor hygiene smells noted (capitalize_word over-engineering, moduledoc drift) but not blocking |
| Smart | **FAIL** | Tax `cadence: :per_night` + stay-total amount is a semantic bug Phase D/E will hit; 9% derivation hardcoded with no comment trail |
| Extra mile | **FAIL** | nightly_rate left nil despite trivially extractable + in-memory convention; RC4 in-flight discoveries not surfaced; @specs missing on private helpers |

## Overall — **FAIL**

Recommend lead route this back to pong (or ping for clarifying the tax-cadence contract) with the two concrete asks:

1. **Smart fix**: change `cadence: :per_night` → `:per_stay` (since the parser doesn't know nights) OR plumb nights through and divide. Add the 9% derivation comment.
2. **Extra-mile fix**: extract `nightly_rate` from `.fromprice{code}` to deliver on RC1's in-memory↔live parity goal. Optionally surface RC4 questions inline.

The Correct + Right + On-task axes are clean — this is a quality-vs-completeness gate, not a redo.
