#!/usr/bin/env bash
# PreToolUse guard for Edit|Write.
# Reads the hook payload on stdin and denies writes to paths this repo treats
# as immutable or secret. Everything else falls through untouched.
set -uo pipefail

file=$(jq -r '.tool_input.file_path // empty')
[ -n "$file" ] || exit 0

deny() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

base=$(basename "$file")

# Secrets: .env.example is the documented template, everything else is real.
case "$base" in
  .env.example) ;;
  .env | .env.*)
    deny "Blocked by .claude/hooks/guard-paths.sh: $base holds real secrets (SUPABASE_SERVICE_ROLE_KEY, OpenAI keys). Edit it yourself and document any new variable in .env.example instead."
    ;;
esac

# Historical migrations: committed means applied. Add a new one instead.
case "$file" in
  *supabase/migrations/*.sql)
    if git -C "$(dirname "$file")" ls-files --error-unmatch -- "$file" >/dev/null 2>&1; then
      deny "Blocked by .claude/hooks/guard-paths.sh: $base is a committed migration. CLAUDE.md: never edit a historical migration — add a new one with a later timestamp. (Uncommitted migrations stay editable.)"
    fi
    ;;
esac

exit 0
