#!/usr/bin/env bash
# .claude/hooks/ensure-scratch.sh
# Idempotent bootstrap for the .scratch/ folder and its README.
# Fires on every SessionStart matcher (startup, clear, compact, resume).
#
# Behavior:
#   - Folder exists, README exists  → silent exit (steady state)
#   - Folder exists, README missing → silently copy template (then exit)
#   - Folder missing                → echo prompt to context, do NOT mkdir
#
# Override the detected repo root by setting SCRATCH_REPO_ROOT.

set -euo pipefail

REPO_ROOT="${SCRATCH_REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
SCRATCH_DIR="$REPO_ROOT/.scratch"
TEMPLATE="$REPO_ROOT/.claude/skills/scratch/templates/README.md"

if [ -d "$SCRATCH_DIR" ]; then
  if [ ! -f "$SCRATCH_DIR/README.md" ] && [ -f "$TEMPLATE" ]; then
    cp "$TEMPLATE" "$SCRATCH_DIR/README.md"
  fi
  exit 0
fi

cat <<EOF
No .scratch/ folder detected in this repo.

The .scratch/ convention is documented in .claude/skills/scratch/SKILL.md.
Default location is $SCRATCH_DIR (repo root). Before creating it, ask the
user where they want .scratch/ to live (e.g. ./tmp/scratch/, or confirm the
default). Once confirmed, create the folder and copy the README template
from $TEMPLATE.
EOF
exit 0
