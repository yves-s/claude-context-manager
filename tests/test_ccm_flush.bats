setup() {
  TEMP_DIR=$(mktemp -d)
  export CCM_HOME="$TEMP_DIR/.ccm"
  mkdir -p "$CCM_HOME"
}

teardown() {
  rm -rf "$TEMP_DIR"
}

@test "ccm flush: exits 0 with empty buffer" {
  run env CCM_HOME="$CCM_HOME" bash "$BATS_TEST_DIRNAME/../bin/ccm" flush
  [ "$status" -eq 0 ]
  [[ "$output" == *"empty"* ]]
}

@test "ccm flush: dry run shows summary" {
  # Pre-populate buffer by sourcing buffer.sh directly
  CCM_HOME="$CCM_HOME" bash -c "
    source '$BATS_TEST_DIRNAME/../lib/buffer.sh'
    buffer_append '{\"timestamp\":\"2026-01-01T00:00:00Z\",\"project\":\"/tmp/p\",\"tool\":\"Edit\",\"file\":\"a.sh\"}'
  "
  run env CCM_FLUSH_DRY_RUN=1 CCM_HOME="$CCM_HOME" \
    bash "$BATS_TEST_DIRNAME/../bin/ccm" flush
  [ "$status" -eq 0 ]
  [[ "$output" == *"DRY RUN"* ]]
}

@test "ccm flush: fails without ANTHROPIC_API_KEY when buffer has entries" {
  CCM_HOME="$CCM_HOME" bash -c "
    source '$BATS_TEST_DIRNAME/../lib/buffer.sh'
    buffer_append '{\"timestamp\":\"2026-01-01T00:00:00Z\",\"project\":\"/tmp/p\",\"tool\":\"Edit\",\"file\":\"a.sh\"}'
  "
  run env -u ANTHROPIC_API_KEY CCM_HOME="$CCM_HOME" \
    bash "$BATS_TEST_DIRNAME/../bin/ccm" flush
  [ "$status" -ne 0 ]
}
