setup() {
  TEMP_DIR=$(mktemp -d)
  export CCM_HOME="$TEMP_DIR/.ccm"
  mkdir -p "$CCM_HOME"
}

teardown() {
  rm -rf "$TEMP_DIR"
}

_load_buffer() {
  source "$BATS_TEST_DIRNAME/../lib/buffer.sh"
}

@test "buffer_append: creates file and adds a JSON line" {
  _load_buffer
  buffer_append '{"tool":"Edit","file":"foo.sh"}'
  [ -f "$CCM_HOME/buffer.jsonl" ]
  run grep '"Edit"' "$CCM_HOME/buffer.jsonl"
  [ "$status" -eq 0 ]
}

@test "buffer_append: appends multiple entries" {
  _load_buffer
  buffer_append '{"a":1}'
  buffer_append '{"b":2}'
  run bash -c "wc -l < '$CCM_HOME/buffer.jsonl' | tr -d ' '"
  [ "$output" = "2" ]
}

@test "buffer_read: returns nothing when no file exists" {
  _load_buffer
  run buffer_read
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "buffer_read: returns all entries" {
  _load_buffer
  buffer_append '{"a":1}'
  buffer_append '{"b":2}'
  run buffer_read
  [ "$status" -eq 0 ]
  [[ "$output" == *'"a":1'* ]]
  [[ "$output" == *'"b":2'* ]]
}

@test "buffer_clear: empties the file" {
  _load_buffer
  buffer_append '{"a":1}'
  buffer_clear
  run buffer_count
  [ "$output" -eq 0 ]
}

@test "buffer_count: returns 0 for missing buffer" {
  _load_buffer
  run buffer_count
  [ "$output" -eq 0 ]
}

@test "buffer_count: returns correct line count" {
  _load_buffer
  buffer_append '{"a":1}'
  buffer_append '{"b":2}'
  buffer_append '{"c":3}'
  run buffer_count
  [ "$output" -eq 3 ]
}
