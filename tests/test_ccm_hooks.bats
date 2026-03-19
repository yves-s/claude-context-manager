#!/usr/bin/env bats

setup() {
  TEMP_DIR=$(mktemp -d)
  export CCM_HOME="$TEMP_DIR/.ccm"
  export CLAUDE_SETTINGS_FILE="$TEMP_DIR/.claude/settings.json"
  mkdir -p "$CCM_HOME" "$(dirname "$CLAUDE_SETTINGS_FILE")"
}

teardown() {
  rm -rf "$TEMP_DIR"
}

_run_hooks_install() {
  CCM_HOME="$CCM_HOME" CLAUDE_SETTINGS_FILE="$CLAUDE_SETTINGS_FILE" \
    bash "$BATS_TEST_DIRNAME/../bin/ccm" hooks install
}

@test "ccm hooks install: copies hook files to CCM_HOME/hooks/" {
  run _run_hooks_install
  [ "$status" -eq 0 ]
  [ -f "$CCM_HOME/hooks/post-tool-use.sh" ]
  [ -f "$CCM_HOME/hooks/stop.sh" ]
}

@test "ccm hooks install: hook files are executable" {
  _run_hooks_install
  [ -x "$CCM_HOME/hooks/post-tool-use.sh" ]
  [ -x "$CCM_HOME/hooks/stop.sh" ]
}

@test "ccm hooks install: creates settings.json with PostToolUse hook" {
  _run_hooks_install
  [ -f "$CLAUDE_SETTINGS_FILE" ]
  run jq -r '.hooks.PostToolUse[0].matcher' "$CLAUDE_SETTINGS_FILE"
  [ "$output" = "Edit|Write|NotebookEdit" ]
}

@test "ccm hooks install: creates settings.json with Stop hook" {
  _run_hooks_install
  run jq -r '.hooks.Stop[0].hooks[0].type' "$CLAUDE_SETTINGS_FILE"
  [ "$output" = "command" ]
}

@test "ccm hooks install: is idempotent — re-run does not duplicate hooks" {
  _run_hooks_install
  _run_hooks_install
  run jq '.hooks.PostToolUse | length' "$CLAUDE_SETTINGS_FILE"
  [ "$output" = "1" ]
  run jq '.hooks.Stop | length' "$CLAUDE_SETTINGS_FILE"
  [ "$output" = "1" ]
}

@test "ccm hooks install: preserves existing settings.json keys" {
  echo '{"theme":"dark","model":"claude-opus-4-6"}' > "$CLAUDE_SETTINGS_FILE"
  _run_hooks_install
  run jq -r '.theme' "$CLAUDE_SETTINGS_FILE"
  [ "$output" = "dark" ]
  run jq -r '.model' "$CLAUDE_SETTINGS_FILE"
  [ "$output" = "claude-opus-4-6" ]
}
