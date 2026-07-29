#!/usr/bin/env bash
# PostToolUse hook for Edit|Write.
# Formats the touched file with the repo's prettier, then lints it. A lint
# failure exits 2 so the message goes straight back to Claude — this is what
# surfaces the CLAUDE.md 50-line `max-lines` rule at write time instead of at
# the next `npm run lint`.
set -uo pipefail

file=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')
[ -n "$file" ] || exit 0
[ -f "$file" ] || exit 0

root=$(git -C "$(dirname "$file")" rev-parse --show-toplevel 2>/dev/null) || exit 0
[ -x "$root/node_modules/.bin/prettier" ] || exit 0

"$root/node_modules/.bin/prettier" --write --ignore-unknown "$file" >/dev/null 2>&1 || true

case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs) ;;
  *) exit 0 ;;
esac

[ -x "$root/node_modules/.bin/eslint" ] || exit 0
if ! out=$("$root/node_modules/.bin/eslint" "$file" 2>&1); then
  printf '%s\n' "$out" >&2
  exit 2
fi

exit 0
