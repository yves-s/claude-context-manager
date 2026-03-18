# tests/test_ccm_init.bats
load 'test_helper'

_run_init() {
  CCM_GITHUB_USER="testuser" CCM_PROJECT_NAME="${1:-testproject}" \
  CCM_NOTION="false" CCM_HOME="$TEMP_DIR/.ccm" CCM_NON_INTERACTIVE=1 \
    bash "$BATS_TEST_DIRNAME/../bin/ccm" init
}

@test "ccm init: creates ccm.json from template" {
  cd "$TEMP_DIR" && git init -q
  run _run_init
  [ "$status" -eq 0 ]
  [ -f "$TEMP_DIR/ccm.json" ]
  run jq -r '.github_user' "$TEMP_DIR/ccm.json"
  [ "$output" = "testuser" ]
}

@test "ccm init: creates CLAUDE.md with filled placeholders" {
  cd "$TEMP_DIR" && git init -q
  run _run_init "My Project"
  [ "$status" -eq 0 ]
  [ -f "$TEMP_DIR/CLAUDE.md" ]
  run grep "My Project" "$TEMP_DIR/CLAUDE.md"
  [ "$status" -eq 0 ]
  run grep "{{PROJECT_NAME}}" "$TEMP_DIR/CLAUDE.md"
  [ "$status" -ne 0 ]  # placeholder must be gone
}

@test "ccm init: creates .github/workflows/sync.yml" {
  cd "$TEMP_DIR" && git init -q
  run _run_init
  [ "$status" -eq 0 ]
  [ -f "$TEMP_DIR/.github/workflows/sync.yml" ]
}

@test "ccm init: writes ~/.ccm/config with meta-repo path" {
  cd "$TEMP_DIR" && git init -q
  run _run_init
  [ "$status" -eq 0 ]
  run jq -r '.default_meta' "$TEMP_DIR/.ccm/config"
  [ "$output" = "$TEMP_DIR" ]
}

@test "ccm init: is idempotent — second run does not corrupt files" {
  cd "$TEMP_DIR" && git init -q
  _run_init
  echo "# My custom context" >> "$TEMP_DIR/context/principles.md"
  run _run_init
  [ "$status" -eq 0 ]
  # context/ should not be overwritten (idempotency guard)
  run grep "# My custom context" "$TEMP_DIR/context/principles.md"
  [ "$status" -eq 0 ]
}
