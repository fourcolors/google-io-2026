# Goal — Stage B §7.3-007 expiry-recheck completion

**SMART:**

- **Specific:** Implement the expiry-recheck path so `HoldExpiryWorker` branches on adapter capability:
  - If `adapter.capabilities[:check_availability] == :supported` → call `adapter.check_availability(hold)` → branch on `:still_available` (silent re-hold) vs `:gone` (mark `:expired` + signal `:expired`).
  - If not supported → existing TTL-only path (mark `:expired` + signal `:expired`).
  Add `check_availability/1` as an optional `@callback` on `Flowstay.CRS.Adapter`. Implement on `Flowstay.CRS.ReservHotel` (in-memory: returns `{:ok, :still_available}` by default, configurable per test).

- **Measurable:**
  - New failing test in `app/test/flowstay/workers/hold_expiry_worker_test.exs` covering BOTH branches (still_available → silent re-hold; gone → expired+signal).
  - All existing tests still green (1184/0 baseline).
  - Haiku judge re-runs §7.3-007 → verdict flips FAIL → PASS.
  - `@stubbed:expiry_recheck_ttl_only_path` tag removed from `features/invariants.feature` line 2266.
  - `features/DASHBOARD.html` shows §7.3-007 row GREEN after build.py regen.

- **Achievable:** Small seam — one callback, one adapter impl, one branch in the existing worker. Test infrastructure (DataCase + Oban.Testing + seed helpers) already exists from B.2 work.

- **Relevant:** §7.3-007 is the lone Stage B FAIL. Closes the §7 thread's "Stage B until complete" condition. Substrate for ReservHotel HTTP adapter Phase E (real `check_availability` against `ibe5_check_availability` endpoint).

- **Time-bound:** This session.

## Predictability check

High predictability. The contract is fully specified in `features/invariants.feature:2266-2272`. The implementation seam is one optional `@callback`, one adapter impl, one `case` branch in the worker. The "silent re-hold" semantics map cleanly to `Cart.re_verify_outcome/1` which already exists.

## Auditor mode

`claude-solo` — small seam, single scenario, project-specific lint backstop only. Cross-model audit is overkill here; the value comes from pp-auditor's "is this dumb?" check on the specific change.

## Out of scope (deliberately)

- ReservHotel HTTP adapter Phase E (real `ibe5_check_availability` POST) — that's a separate task in the adapter thread.
- Silent re-hold's Oban re-scheduling chain (re-hold should also re-schedule the warn + expiry jobs at the new expires_at) — deferred to a follow-up if not naturally covered by re-using Cart's add path.
- Re-verify scene FSM transition — already shipped (`Cart.re_verify_outcome/1`); worker just produces the right outcome atom; scene navigation is downstream.

## Definition of done

- pp-pong's GREEN test exercises both branches via a stubbed adapter.
- pp-auditor returns PASS on all five axes (on task, correct, right, smart, extra mile).
- Haiku judge re-verdict is PASS with citations to the new test + the branch logic.
- Suite is 1184+N / 0.
- `features/DASHBOARD.html` regenerated, §7.3-007 row green.
- Commit lands on main with a clean conventional-commit message naming §7.3-007 + the closing of the FAIL.
