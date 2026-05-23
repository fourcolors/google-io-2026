#!/usr/bin/env bash
# Test harness for ensure-scratch.sh
# Exercises four states via temp-dir fake repos.
# Set SCRATCH_REPO_ROOT to override the hook's repo-root detection.

set -euo pipefail

HOOK="$(cd "$(dirname "$0")" && pwd)/ensure-scratch.sh"
PASS=0
FAIL=0

TMPDIRS=()
cleanup() { [ "${#TMPDIRS[@]}" -gt 0 ] && rm -rf "${TMPDIRS[@]}"; }
trap cleanup EXIT

if [ ! -x "$HOOK" ]; then
  echo "[red phase] hook not found at $HOOK — harness expected to fail until hook exists"
  exit 1
fi

assert_eq() {
  # $1 = label, $2 = expected, $3 = actual
  if [ "$2" = "$3" ]; then
    echo "  ✓ $1"
    PASS=$((PASS+1))
  else
    echo "  ✗ $1"
    echo "    expected: $2"
    echo "    actual:   $3"
    FAIL=$((FAIL+1))
  fi
}

assert_contains() {
  # $1 = label, $2 = needle, $3 = haystack
  if printf '%s\n' "$3" | grep -qF "$2"; then
    echo "  ✓ $1"
    PASS=$((PASS+1))
  else
    echo "  ✗ $1"
    echo "    expected to contain: $2"
    echo "    actual:              $3"
    FAIL=$((FAIL+1))
  fi
}

make_fake_repo() {
  # Creates a fake repo with the template in place.
  # Echoes the tempdir path.
  local dir
  dir="$(mktemp -d)"
  mkdir -p "$dir/.claude/skills/scratch/templates"
  cat > "$dir/.claude/skills/scratch/templates/README.md" <<EOF
# .scratch/

Template content for testing.
EOF
  echo "$dir"
}

# ── Case 1: steady state (folder + README exist) ──
echo "Case 1: steady state — folder and README both exist"
DIR="$(make_fake_repo)"
TMPDIRS+=("$DIR")
mkdir -p "$DIR/.scratch"
echo "existing readme" > "$DIR/.scratch/README.md"
OUTPUT="$(SCRATCH_REPO_ROOT="$DIR" bash "$HOOK" 2>&1)"
assert_eq "produces no output" "" "$OUTPUT"
assert_eq "README content unchanged" "existing readme" "$(cat "$DIR/.scratch/README.md")"

# ── Case 2: folder exists, README missing ──
echo "Case 2: folder exists but README is missing"
DIR="$(make_fake_repo)"
TMPDIRS+=("$DIR")
mkdir -p "$DIR/.scratch"
OUTPUT="$(SCRATCH_REPO_ROOT="$DIR" bash "$HOOK" 2>&1)"
assert_eq "produces no output" "" "$OUTPUT"
assert_eq "README was copied from template" "yes" "$([ -f "$DIR/.scratch/README.md" ] && echo yes || echo no)"
assert_contains "README contains template content" "Template content for testing" "$(cat "$DIR/.scratch/README.md")"

# ── Case 3: folder missing (first run) ──
echo "Case 3: folder missing — first-run interactive prompt"
DIR="$(make_fake_repo)"
TMPDIRS+=("$DIR")
OUTPUT="$(SCRATCH_REPO_ROOT="$DIR" bash "$HOOK" 2>&1)"
assert_contains "echoes 'No .scratch/' prompt" "No .scratch/ folder detected" "$OUTPUT"
assert_contains "names the default path" "$DIR/.scratch" "$OUTPUT"
assert_eq "does NOT create the folder" "no" "$([ -d "$DIR/.scratch" ] && echo yes || echo no)"

# ── Case 4: folder exists, README missing, template ALSO missing ──
echo "Case 4: README missing + template missing — graceful skip"
DIR="$(mktemp -d)"
TMPDIRS+=("$DIR")
mkdir -p "$DIR/.scratch"
OUTPUT="$(SCRATCH_REPO_ROOT="$DIR" bash "$HOOK" 2>&1)"
assert_eq "produces no output" "" "$OUTPUT"
assert_eq "no README created (template absent)" "no" "$([ -f "$DIR/.scratch/README.md" ] && echo yes || echo no)"

# ── Summary ──
echo ""
echo "─────────────────────"
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
