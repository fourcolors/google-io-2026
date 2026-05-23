---
name: lead-resolution-surface-gaps
description: When a pp-lead resolves a flagged conflict, the resolution may force scope expansion that ping didn't anticipate — run full suite early to discover the real blast radius before implementation hardens
metadata:
  type: feedback
---

When pp-ping flags a contract conflict and pp-lead resolves it, the resolution often forces additional file edits that the original "in-scope" list didn't enumerate (because nobody could see them without running the suite). The pattern: implement the lead's plan → run full suite → discover N pre-existing tests/pins that contradict the resolution → either revert and escalate, or update the pre-existing pins.

**Why:** Hit this in §7.3-007. Lead said "set ReservHotel `check_availability: :not_supported`." Implementation went smoothly per the lead's plan, then the full suite showed 6 NEW failures in adapter_test.exs + adapter_compliance_test.exs — all pre-existing pins from adapter-phase-a that had pinned `:supported` as forward-looking. None were in the in-scope list. None were predictable from the test files I was told to read.

**How to apply:**
1. **Run the full suite EARLY, not just at the end.** After the targeted test goes green, the full suite is the cheapest discovery tool for "what else does this break." Don't wait until "PR-ready" stage.
2. **When the lead's resolution forces edits to files outside ping's in-scope list, mark `DONE_WITH_CONCERNS` and enumerate the forced-edit files explicitly.** Don't pretend the scope held — the auditor needs to see this so they can confirm the lead intended the broader surface.
3. **Distinguish "forced by resolution" from "design drift."** Mechanical consequences are fine; new design choices are scope creep. The Concerns section should make the distinction clear.
4. **Don't silently switch back to ping's recommendation.** If you disagree with the lead's resolution after seeing the cost, surface it in Concerns or via one more clarifying message — don't quietly implement the alternative.

Related: [[optional-callbacks-compliance-trap]] — the specific trap that bit me in §7.3-007.
