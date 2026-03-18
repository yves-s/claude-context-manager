# tests/test_config.bats
load 'test_helper'

@test "config: get_meta_repo returns path from ~/.ccm/config" {
  mkdir -p "$TEMP_DIR/.ccm"
  echo '{"default_meta": "/some/path"}' > "$TEMP_DIR/.ccm/config"

  CCM_HOME="$TEMP_DIR/.ccm" \
    run bash -c "source $BATS_TEST_DIRNAME/../lib/config.sh && get_meta_repo"
  [ "$status" -eq 0 ]
  [ "$output" = "/some/path" ]
}

@test "config: set_meta_repo writes to existing ~/.ccm/config" {
  mkdir -p "$TEMP_DIR/.ccm"
  CCM_HOME="$TEMP_DIR/.ccm" \
    run bash -c "source $BATS_TEST_DIRNAME/../lib/config.sh && set_meta_repo /new/path"
  [ "$status" -eq 0 ]

  run jq -r '.default_meta' "$TEMP_DIR/.ccm/config"
  [ "$output" = "/new/path" ]
}

@test "config: set_meta_repo creates ~/.ccm/ if it does not exist" {
  # Do NOT pre-create $TEMP_DIR/.ccm — bootstrap case
  CCM_HOME="$TEMP_DIR/.ccm" \
    run bash -c "source $BATS_TEST_DIRNAME/../lib/config.sh && set_meta_repo /bootstrap/path"
  [ "$status" -eq 0 ]
  [ -f "$TEMP_DIR/.ccm/config" ]

  run jq -r '.default_meta' "$TEMP_DIR/.ccm/config"
  [ "$output" = "/bootstrap/path" ]
}
