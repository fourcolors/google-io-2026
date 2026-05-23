---
name: codex-exec-flags
description: Codex CLI 0.128.0 exec flag patterns that work for non-interactive audit invocations
metadata:
  type: feedback
---

Confirmed working invocation shape for adversarial audit tasks (codex-cli 0.128.0, model gpt-5.5):

`codex exec -s workspace-write -C <working-dir> --output-last-message <outfile> --ephemeral "$(cat /tmp/prompt.txt)"`

**Why workspace-write, not read-only:** mix test compiles to `_build/` and uses `deps/` — read-only sandbox blocks compilation. Use workspace-write but constrain scope in the prompt itself ("do NOT modify lib/ or test/").

**Why --ephemeral:** prevents session state from persisting between audit invocations; keeps audits isolated and reproducible.

**Why --output-last-message:** captures the model's final response cleanly to a file without parsing JSONL or the full stdout stream; essential for writing the audit file with a metadata footer.

**Prompt delivery:** pipe via `$(cat /tmp/prompt.txt)` rather than inline heredoc to avoid shell-quoting hell with nested quotes and Elixir sigils in the prompt.

**Model:** default (gpt-5.5 as of 2026-05-23); do not pin unless task requires a specific model — defaults to the latest available.

**Reasoning effort:** xhigh (default for exec mode); produces thorough adversarial reasoning with no extra flags needed.

**How to apply:** use this exact shape for all future non-interactive codex audit invocations in this project. Verify flags against `codex exec --help` if CLI version changes.
