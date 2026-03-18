setup() {
  TEMP_DIR=$(mktemp -d)
  export CCM_HOME="$TEMP_DIR/.ccm"
  mkdir -p "$CCM_HOME"
}

teardown() {
  rm -rf "$TEMP_DIR"
}

# Note: CCM_HOME is set on the bash subprocess, not on echo.
_run_post_tool_use() {
  local json="$1"
  echo "$json" | CCM_HOME="$CCM_HOME" bash "$BATS_TEST_DIRNAME/../hooks/post-tool-use.sh"
}

@test "post-tool-use: ignores Bash tool" {
  _run_post_tool_use '{"tool_name":"Bash","tool_input":{"command":"ls"}}'
  run test -f "$CCM_HOME/buffer.jsonl"
  [ "$status" -ne 0 ]
}

@test "post-tool-use: ignores Read tool" {
  _run_post_tool_use '{"tool_name":"Read","tool_input":{"file_path":"foo.sh"}}'
  run test -f "$CCM_HOME/buffer.jsonl"
  [ "$status" -ne 0 ]
}

@test "post-tool-use: appends entry for Edit tool" {
  _run_post_tool_use '{"tool_name":"Edit","tool_input":{"file_path":"/tmp/foo.sh"}}'
  [ -f "$CCM_HOME/buffer.jsonl" ]
  run jq -r '.tool' "$CCM_HOME/buffer.jsonl"
  [ "$output" = "Edit" ]
}

@test "post-tool-use: appends entry for Write tool" {
  _run_post_tool_use '{"tool_name":"Write","tool_input":{"file_path":"/tmp/bar.sh"}}'
  [ -f "$CCM_HOME/buffer.jsonl" ]
  run jq -r '.tool' "$CCM_HOME/buffer.jsonl"
  [ "$output" = "Write" ]
}

@test "post-tool-use: appends entry for NotebookEdit tool with notebook_path" {
  _run_post_tool_use '{"tool_name":"NotebookEdit","tool_input":{"notebook_path":"/tmp/nb.ipynb"}}'
  [ -f "$CCM_HOME/buffer.jsonl" ]
  run jq -r '.tool' "$CCM_HOME/buffer.jsonl"
  [ "$output" = "NotebookEdit" ]
  run jq -r '.file' "$CCM_HOME/buffer.jsonl"
  [ "$output" = "/tmp/nb.ipynb" ]
}

@test "post-tool-use: entry contains file path" {
  _run_post_tool_use '{"tool_name":"Edit","tool_input":{"file_path":"/tmp/myfile.sh"}}'
  run jq -r '.file' "$CCM_HOME/buffer.jsonl"
  [ "$output" = "/tmp/myfile.sh" ]
}

@test "post-tool-use: entry contains timestamp" {
  _run_post_tool_use '{"tool_name":"Edit","tool_input":{"file_path":"/tmp/f.sh"}}'
  run jq -r '.timestamp' "$CCM_HOME/buffer.jsonl"
  [[ "$output" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2} ]]
}

@test "post-tool-use: entry contains project path" {
  _run_post_tool_use '{"tool_name":"Edit","tool_input":{"file_path":"/tmp/f.sh"}}'
  run jq -r '.project' "$CCM_HOME/buffer.jsonl"
  [ -n "$output" ]
}

# Note: same pattern — CCM_HOME on bash subprocess, not on echo.
_run_stop() {
  echo '{"stop_hook_active":true}' \
    | CCM_HOME="$CCM_HOME" bash "$BATS_TEST_DIRNAME/../hooks/stop.sh"
}

@test "stop: appends session_end entry to buffer" {
  _run_stop
  [ -f "$CCM_HOME/buffer.jsonl" ]
  run jq -r '.type' "$CCM_HOME/buffer.jsonl"
  [ "$output" = "session_end" ]
}

@test "stop: entry contains timestamp" {
  _run_stop
  run jq -r '.timestamp' "$CCM_HOME/buffer.jsonl"
  [[ "$output" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2} ]]
}

@test "stop: entry contains project path" {
  _run_stop
  run jq -r '.project' "$CCM_HOME/buffer.jsonl"
  [ -n "$output" ]
}

@test "stop: multiple invocations accumulate in buffer" {
  _run_stop
  _run_stop
  run grep -c '"session_end"' "$CCM_HOME/buffer.jsonl"
  [ "$output" = "2" ]
}
