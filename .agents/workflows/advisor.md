---
description: Get an independent, fresh-context review of the current plan or diff from a reviewer subagent that did not write the work. Use before committing to an approach and before declaring work done.
---

# /advisor

When the user types `/advisor` (optionally `/advisor <what to focus on>`), spawn an
independent reviewer and bring back its verdict. The discipline behind *when* to do this
automatically lives in `@.agents/rules/advisor.md`; this workflow is the on-demand handle.

> Fidelity note: Antigravity subagents run the **same model** as the parent from a **clean
> context** — so this is an *independent fresh-context* reviewer, not a stronger one. The
> value is the lack of anchoring, recovered by feeding it the transcript + the concrete artifact.

## Steps

1. **Make the deliverable durable first** if this is a "before done" review — write the file,
   save the result, or commit the change so a verdict mid-review can't strand unsaved work.

2. **Gather the artifact** to review:
   - For an approach review: the plan / interpretation you're about to commit to.
   - For a "done" review: `git diff <range>` of the change, plus how you verified it
     (test output, command run).

3. `define_subagent` an **advisor** (use the built-in `self` subagent) with this brief:
   > "You are an independent reviewer. You did not write this work and should not assume it
   > is correct. Read the transcript of `<this agent's id>` and the artifact below. Judge it
   > on: is it on-task, is it correct, is it the *smart* approach, did it miss anything?
   > Return the single highest-value thing to change, or PASS. Be specific; cite the artifact."
   Append the artifact from step 2.

4. `invoke_subagent` and wait for the verdict.

5. **Act on it.** Weight it seriously. If primary-source evidence contradicts a specific
   claim, or a step fails empirically, adapt rather than comply blindly. If your evidence and
   the advisor's verdict conflict, send **one** reconcile message before choosing a branch.

6. Report the verdict (and what you'll do about it) back to the user.
