#!/usr/bin/env bash
# UserPromptSubmit gate: make Claude ask which model and which mode to use
# before it starts working on the prompt.
#
# A hook cannot switch the session's model — there is no hook output field for
# it, and /model is a user-only action. So this injects context telling Claude
# to open an in-TUI AskUserQuestion picker and then honor the answer by either
# working itself, delegating to a subagent on the chosen model, or entering
# plan mode.
#
# Turn it off for a session:  export CLAUDE_SKIP_MODEL_GATE=1
set -uo pipefail

[ -n "${CLAUDE_SKIP_MODEL_GATE:-}" ] && exit 0

context=$(
  cat <<'EOF'
Task routing gate (.claude/hooks/ask-model-mode.sh).

Before anything else for this prompt — no file reads, no searches, no edits —
call AskUserQuestion exactly once with these two questions:

Question 1: header "Model", question "Which model should handle this task?",
multiSelect false, options:
  - "Keep current model" / "Stay on this session's model — deepest reasoning, no handoff."
  - "Sonnet 5" / "Faster; fine for most edits and well-scoped changes."
  - "Haiku 4.5" / "Cheapest; trivial or mechanical work only."
  - "Fable 5" / "Route this task to Fable 5."

Question 2: header "Mode", question "Which mode should I work in?",
multiSelect false, options:
  - "Execute directly" / "Investigate and make the changes now."
  - "Plan first" / "Research and present a plan for approval before editing."
  - "Review only" / "Investigate and report findings; change nothing."

Then honor the answers:
  - Model "Keep current model": do the work yourself.
  - Any other model: do the work by delegating to a subagent via the Agent tool
    with model set to "sonnet" | "haiku" | "fable" to match, run_in_background
    false, and a prompt self-contained enough for a cold start. Relay its
    result. You cannot move the session itself — if that is what they want,
    tell them to run /model.
  - Mode "Plan first": call EnterPlanMode (load it via ToolSearch first if its
    schema is not loaded) before investigating; do not edit until approved.
  - Mode "Execute directly": proceed normally.
  - Mode "Review only": investigate and report; make no edits.

Ask once per prompt. Do not re-ask after the answers return, and do not ask
again later in the same turn. If this prompt already names both a model and a
mode, skip the question and honor what it says.
EOF
)

jq -n --arg ctx "$context" '{
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: $ctx
  }
}'
