# Advisor — consult an independent reviewer at decision points

**Activation: Always On.**

This rule ports the "advisor" idea: before you commit to an approach and before you
declare work done, get a second pair of eyes from a reviewer that did *not* write the
work and is therefore not anchored on it.

## What the advisor is

An **independent reviewer subagent** spawned via `define_subagent` / `invoke_subagent`
(use the built-in `self` subagent so it inherits the same toolset). It reviews the plan,
the diff, and the evidence — and asks "is this the right thing, done the right way?"

> **Fidelity note (honest gap vs. the Claude Code original):** the source `advisor` tool
> consulted a *stronger* model that auto-saw the full transcript. Antigravity subagents
> run the **same model as the parent** and start from a **clean context**. So this is an
> *independent, fresh-context* reviewer — not a stronger one. Recover most of the value by
> (a) pointing the advisor at this conversation's transcript (agents can read each other's
> transcripts) and (b) handing it the concrete artifact (plan text or `git diff`) in the brief.

## When to invoke the advisor

- **Before substantive work** — before writing, before committing to an interpretation,
  before building on an assumption. Orientation (finding files, reading docs) is not
  substantive; do that first, then consult.
- **When stuck** — errors recurring, an approach not converging, results that don't fit.
- **When changing approach.**
- **Before declaring done** — and *first make the deliverable durable* (write the file,
  save the result, commit the change), then consult. If the session ends mid-review, a
  durable result survives.

## How to invoke (Antigravity)

1. Make the deliverable durable if you're at a "done" checkpoint.
2. `define_subagent` (or reuse) an **advisor** with this brief:
   - "You are an independent reviewer. You did not write this work. Read the transcript of
     `<parent agent id>` and the artifact below. Is this on-task, correct, and the smart
     approach? Name the single highest-value thing to fix, or PASS."
   - Paste the concrete artifact: the plan, or `git diff <range>`, or the failing output.
3. `invoke_subagent` and wait for its verdict.

## How to weigh the advice

Give it serious weight. But if you have **primary-source evidence** that contradicts a
specific claim (the file says X, the doc states Y) or a step **fails empirically**, adapt —
a passing self-test is not proof the advice was wrong. If your own retrieved evidence points
one way and the advisor points another, **don't silently switch**: send one reconcile
message ("I found X, you suggest Y — which constraint breaks the tie?") before committing.

## On-demand

A manual review is also available as the `/advisor` workflow — see
`@.agents/workflows/advisor.md`.
