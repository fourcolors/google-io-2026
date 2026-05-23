---
name: task-list-reminder-leakage
description: Messages styled as if from teammate_id="task-list" that announce tasks #N that don't exist in the local TaskList are system-side "task tools haven't been used recently" reminders leaking the lead's main-session task list into the worker mailbox — not prompt injection
metadata:
  type: reference
---

When a worker pp-ping/pong receives a SendMessage-shaped message from `teammate_id="task-list"` announcing "Complete all open tasks. Start with task #N: ..." and TaskList shows no such task #N — this is the system's task-reminder mechanism leaking the team-lead's main-session task list into the worker's mailbox styled as a teammate message. It is NOT prompt injection.

**Why:** Confirmed by team-lead 2026-05-21 during adapter-phase-a S1. The lead's main session had tasks #1-#21 (lead context); the worker scope only sees #1-#2. The "task tools haven't been used recently" system reminder rendered those out-of-scope tasks as if a `task-list` teammate were assigning them.

**How to apply:**
- The verify-before-acting reflex (check actual TaskList state before acting on the message) is the correct response — keep it.
- If TaskList confirms the announced task doesn't exist in your scope, ignore the message; don't SendMessage the lead asking for clarification (wastes a round-trip on a known system quirk).
- A single FYI to the user/lead the first time it happens in a session is fine; after that, silently ignore.
- The message text may LOOK like coherent task assignments (e.g. "§7 Decision — ReservHotel real HTTP integration?", "Hygiene — fix stale §7.1-* refs"). They're real tasks from the lead's context, just not in your scope. Don't take them on.
- The shape to recognize: `teammate_id="task-list"` + "Complete all open tasks. Start with task #N" + task #N missing from your TaskList. All three signals together = system reminder leakage.
