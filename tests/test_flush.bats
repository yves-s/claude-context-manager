setup() {
  TEMP_DIR=$(mktemp -d)
  export CCM_HOME="$TEMP_DIR/.ccm"
  export CLAUDE_MEMORY_DIR="$TEMP_DIR/.claude/memory"
  mkdir -p "$CCM_HOME" "$CLAUDE_MEMORY_DIR"
}

teardown() {
  rm -rf "$TEMP_DIR"
}

_load_flush() {
  source "$BATS_TEST_DIRNAME/../lib/buffer.sh"
  CLAUDE_MEMORY_DIR="$CLAUDE_MEMORY_DIR" \
    source "$BATS_TEST_DIRNAME/../lib/flush.sh"
}

@test "flush_buffer: exits 0 and prints message when buffer is empty" {
  _load_flush
  run flush_buffer
  [ "$status" -eq 0 ]
  [[ "$output" == *"empty"* ]]
}

@test "flush_buffer: dry run shows summary without calling API" {
  _load_flush
  buffer_append '{"timestamp":"2026-01-01T00:00:00Z","project":"/tmp/proj","tool":"Edit","file":"foo.sh"}'
  export CCM_FLUSH_DRY_RUN=1
  run flush_buffer
  unset CCM_FLUSH_DRY_RUN
  [ "$status" -eq 0 ]
  [[ "$output" == *"DRY RUN"* ]]
}

@test "flush_buffer: dry run does not clear the buffer" {
  _load_flush
  buffer_append '{"timestamp":"2026-01-01T00:00:00Z","project":"/tmp/proj","tool":"Edit","file":"foo.sh"}'
  CCM_FLUSH_DRY_RUN=1 flush_buffer
  run buffer_count
  [ "$output" -eq 1 ]
}

@test "flush_buffer: fails without ANTHROPIC_API_KEY when buffer has entries" {
  _load_flush
  buffer_append '{"timestamp":"2026-01-01T00:00:00Z","project":"/tmp/proj","tool":"Edit","file":"foo.sh"}'
  local _saved_key="${ANTHROPIC_API_KEY:-}"
  unset ANTHROPIC_API_KEY
  run flush_buffer
  if [[ -n "$_saved_key" ]]; then export ANTHROPIC_API_KEY="$_saved_key"; fi
  [ "$status" -ne 0 ]
  [[ "$output" == *"ANTHROPIC_API_KEY"* ]]
}

@test "flush_buffer: memory items are written to autosave file" {
  _load_flush
  buffer_append '{"timestamp":"2026-01-01T00:00:00Z","project":"/tmp/proj","tool":"Edit","file":"foo.sh"}'
  # Override the classify function in current shell scope
  classify_with_claude() {
    echo '{"content":[{"text":"{\"memory\":[\"User prefers small focused files\"],\"meta\":[]}"}]}'
  }
  ANTHROPIC_API_KEY=mock flush_buffer
  [ -f "$CLAUDE_MEMORY_DIR/ccm-autosave.md" ]
  run grep "User prefers small focused files" "$CLAUDE_MEMORY_DIR/ccm-autosave.md"
  [ "$status" -eq 0 ]
}

@test "flush_buffer: clears buffer after successful flush" {
  _load_flush
  buffer_append '{"timestamp":"2026-01-01T00:00:00Z","project":"/tmp/proj","tool":"Edit","file":"foo.sh"}'
  classify_with_claude() {
    echo '{"content":[{"text":"{\"memory\":[],\"meta\":[]}"}]}'
  }
  ANTHROPIC_API_KEY=mock flush_buffer
  run buffer_count
  [ "$output" -eq 0 ]
}
