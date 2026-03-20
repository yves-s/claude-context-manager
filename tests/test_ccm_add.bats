# tests/test_ccm_add.bats
# setup() and teardown() are fully defined below — test_helper not needed here.

setup() {
  TEMP_DIR=$(mktemp -d)  # explicit — do not rely on test_helper here

  META_DIR="$TEMP_DIR/meta"
  mkdir -p "$META_DIR"
  echo '{"github_user":"testuser","meta_repo":"git@github.com:testuser/meta.git","sub_projects":[]}' \
    > "$META_DIR/ccm.json"
  echo "# Meta CLAUDE" > "$META_DIR/CLAUDE.md"

  mkdir -p "$TEMP_DIR/.ccm"
  echo "{\"default_meta\": \"$META_DIR\"}" > "$TEMP_DIR/.ccm/config"

  SUB_DIR="$TEMP_DIR/sub"
  mkdir -p "$SUB_DIR"
  cd "$SUB_DIR" && git init -q
}

teardown() {
  rm -rf "$TEMP_DIR"
}

_run_add() {
  CCM_HOME="$TEMP_DIR/.ccm" CCM_NON_INTERACTIVE=1 \
  CCM_REPO_NAME="sub-project" CCM_REPO_URL="git@github.com:testuser/sub-project.git" \
    bash "$BATS_TEST_DIRNAME/../bin/ccm" add
}

@test "ccm add: creates CLAUDE.md containing meta content" {
  cd "$SUB_DIR"
  run _run_add
  [ "$status" -eq 0 ]
  [ -f "$SUB_DIR/CLAUDE.md" ]
  run grep "# Meta CLAUDE" "$SUB_DIR/CLAUDE.md"
  [ "$status" -eq 0 ]
}

@test "ccm add: creates .ccm marker file with meta_repo reference" {
  cd "$SUB_DIR"
  run _run_add
  [ "$status" -eq 0 ]
  [ -f "$SUB_DIR/.ccm" ]
  run grep "meta_repo=git@github.com:testuser/meta.git" "$SUB_DIR/.ccm"
  [ "$status" -eq 0 ]
}

@test "ccm add: registers project in meta-repo ccm.json" {
  cd "$SUB_DIR"
  run _run_add
  [ "$status" -eq 0 ]
  run jq '.sub_projects | length' "$META_DIR/ccm.json"
  [ "$output" = "1" ]
}

@test "ccm add: is idempotent — re-run preserves custom project content" {
  cd "$SUB_DIR"
  _run_add
  echo "# My custom section" >> "$SUB_DIR/CLAUDE.md"
  run _run_add
  [ "$status" -eq 0 ]
  run grep "# My custom section" "$SUB_DIR/CLAUDE.md"
  [ "$status" -eq 0 ]
}

@test "ccm add: generated CLAUDE.md has no placeholder sections" {
  cd "$SUB_DIR"
  run _run_add
  [ "$status" -eq 0 ]
  run grep "Projektbeschreibung" "$SUB_DIR/CLAUDE.md"
  [ "$status" -ne 0 ]  # must not contain placeholder sections
  run grep "PROJECT CONTEXT BELOW" "$SUB_DIR/CLAUDE.md"
  [ "$status" -eq 0 ]  # marker must still be present
}
