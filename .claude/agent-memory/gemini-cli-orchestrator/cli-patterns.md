---
name: cli-patterns
description: Verified Gemini CLI invocation patterns, model names, and flag behavior as of 2026-05-14
metadata:
  type: feedback
---

# Gemini CLI Patterns (verified 2026-05-14, CLI v0.41.2)

## Latest model
`gemini-2.5-pro` — confirmed working. Use `-m gemini-2.5-pro` explicitly; don't rely on defaults.

## Non-interactive (headless) mode
```zsh
cat <context-file> | gemini -m gemini-2.5-pro -p "$(cat <prompt-file>)" --yolo
```
- `-p` / `--prompt`: run headless with this prompt. Content piped to stdin is appended.
- `--yolo`: auto-approve all tool calls (needed for web search/grounding in review tasks).
- Pipe the doc content via stdin; pass the structured prompt via `-p`.

## Context delivery for large docs
- Extract markdown from HTML before passing to Gemini: HTML is ~156KB but the embedded markdown is ~134KB and much cleaner.
- Python regex on `<script type="text/markdown" id="md-source">` extracts cleanly.
- Write context to `/tmp/` files; pass via stdin `cat doc | gemini -p "$(cat prompt)"`.

## Web grounding
`--yolo` enables tool calls including web search. Gemini will use search to verify API claims.

## Output
- Route to `tee /tmp/gemini-review-raw-output.txt` to capture for reference.
- Response is streamed to stdout; exit 0 on success.

## What worked well
- Structured prompt with explicit sections (Role / Task / Constraints / Doc) produced clean, section-aligned output.
- Telling Gemini to "quote the doc" and "do NOT summarize" significantly improved signal-to-noise.
- `--yolo` is required for web grounding; without it, Gemini cannot verify external API claims.

**Why:** Token efficiency + clean CLI pattern. HTML→markdown extraction saves tokens and avoids parser noise.
**How to apply:** Always extract embedded markdown before passing HTML docs. Use `--yolo` for factual review tasks.
