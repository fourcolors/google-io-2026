#!/usr/bin/env bash
# new-page.sh <slug> [--theme <name>]
# Create .scratch/<slug>.html + .scratch/<slug>.json from the _shell.html template and chosen theme.

set -euo pipefail

SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR=".scratch"
mkdir -p "$OUT_DIR" "$OUT_DIR/.stash"

slug="${1:-}"
[[ -n "$slug" ]] || { echo "usage: new-page.sh <slug> [--theme <name>]" >&2; exit 1; }
shift

theme="warm-paper"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --theme) theme="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

shell_path="$SKILL_DIR/snippets/_shell.html"
theme_path="$SKILL_DIR/themes/${theme}.css"

[[ -f "$shell_path" ]] || { echo "missing shell: $shell_path" >&2; exit 1; }
[[ -f "$theme_path" ]] || { echo "missing theme: $theme_path" >&2; exit 1; }

out_html="$OUT_DIR/$slug.html"
out_json="$OUT_DIR/$slug.json"

# Substitute {{THEME_CSS}} and {{TITLE}} in shell. Read theme into a file
# so awk doesn't choke on multi-line values via -v.
tmp=$(mktemp)
{
  awk -v slug="$slug" '
    /\{\{THEME_CSS\}\}/ { while ((getline line < theme) > 0) print line; close(theme); next }
    { gsub(/\{\{TITLE\}\}/, slug); print }
  ' theme="$theme_path" "$shell_path"
} > "$tmp"
mv "$tmp" "$out_html"

# Initialize manifest
jq -n --arg slug "$slug" --arg theme "$theme" --arg now "$(date -u +%FT%TZ)" \
  '{slug: $slug, theme: $theme, sections: [], created: $now, updated: $now}' > "$out_json"

echo "Created: $out_html"
echo "         $out_json (theme: $theme)"
