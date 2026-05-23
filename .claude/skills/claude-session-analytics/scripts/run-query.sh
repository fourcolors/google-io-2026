#!/usr/bin/env bash
# Usage: run-query.sh "SELECT * FROM sessions LIMIT 5;"
#
# Derives the Claude Code project dir from $PWD, points DuckDB at this
# project's session JSONL files, and runs the given SQL with views from
# state.sql preloaded.
#
# Set CC_FMT=csv to emit CSV instead of the default pretty table.
set -euo pipefail

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_SQL="$SKILL_DIR/state.sql"

# Claude Code mangles the absolute project path: / and _ both become -.
HASH=$(echo "$PROJECT_ROOT" | tr '/_' '-')
JSONL_DIR="$HOME/.claude/projects/$HASH"

if [ ! -d "$JSONL_DIR" ]; then
  echo "error: no Claude Code session dir at $JSONL_DIR" >&2
  echo "       (derived from \$PWD=$PROJECT_ROOT via tr '/_' '-')" >&2
  exit 2
fi

export CC_JSONL_GLOB="$JSONL_DIR/*.jsonl"

if [ "${CC_FMT:-}" = "csv" ]; then
  duckdb -init "$STATE_SQL" -csv -c "$1"
else
  duckdb -init "$STATE_SQL" -c "$1"
fi
