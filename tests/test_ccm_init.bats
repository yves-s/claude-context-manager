# tests/test_ccm_init.bats
load 'test_helper'

_run_init() {
  CCM_GITHUB_USER="testuser" CCM_PROJECT_NAME="${1:-testproject}" \
  CCM_NOTION="false" CCM_HOME="$TEMP_DIR/.ccm" CCM_NON_INTERACTIVE=1 \
  CCM_SKIP_PUSH=1 \
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

@test "ccm init: auto-commits generated files" {
  cd "$TEMP_DIR" && git init -q
  CCM_HOME="$TEMP_DIR/.ccm" CCM_NON_INTERACTIVE=1 \
    CCM_GITHUB_USER=testuser CCM_PROJECT_NAME=testproject \
    CCM_SKIP_PUSH=1 \
    run bash "$BATS_TEST_DIRNAME/../bin/ccm" init
  [ "$status" -eq 0 ]
  run git -C "$TEMP_DIR" log --oneline
  [[ "$output" == *"chore: init CCM meta-repo"* ]]
}

@test "ccm init: output has no Naechste Schritte block" {
  cd "$TEMP_DIR" && git init -q
  CCM_HOME="$TEMP_DIR/.ccm" CCM_NON_INTERACTIVE=1 \
    CCM_GITHUB_USER=testuser CCM_PROJECT_NAME=testproject \
    CCM_SKIP_PUSH=1 \
    run bash "$BATS_TEST_DIRNAME/../bin/ccm" init
  [ "$status" -eq 0 ]
  [[ "$output" != *"Nächste Schritte"* ]]
  [[ "$output" != *"git push"* ]]
}

@test "ccm init: skips commit on re-run" {
  cd "$TEMP_DIR" && git init -q
  CCM_HOME="$TEMP_DIR/.ccm" CCM_NON_INTERACTIVE=1 \
    CCM_GITHUB_USER=testuser CCM_PROJECT_NAME=testproject \
    CCM_SKIP_PUSH=1 \
    bash "$BATS_TEST_DIRNAME/../bin/ccm" init
  CCM_HOME="$TEMP_DIR/.ccm" CCM_NON_INTERACTIVE=1 \
    CCM_GITHUB_USER=testuser CCM_PROJECT_NAME=testproject \
    CCM_SKIP_PUSH=1 \
    run bash "$BATS_TEST_DIRNAME/../bin/ccm" init
  [ "$status" -eq 0 ]
  count=$(git -C "$TEMP_DIR" log --oneline | grep -c "chore: init CCM meta-repo" || true)
  [ "$count" -eq 1 ]
}

@test "ccm init: auto-pushes when remote is reachable" {
  cd "$TEMP_DIR" && git init -q

  # Set up bare repo as remote before init so init can push to it
  git init --bare "$TEMP_DIR/remote.git" -q
  git -C "$TEMP_DIR" remote add origin "$TEMP_DIR/remote.git"
  # Ensure local branch is named 'main' (ccm init pushes to origin/main)
  git -C "$TEMP_DIR" checkout -b main 2>/dev/null || true

  CCM_HOME="$TEMP_DIR/.ccm" CCM_NON_INTERACTIVE=1 \
    CCM_GITHUB_USER=testuser CCM_PROJECT_NAME=testproject \
    run bash "$BATS_TEST_DIRNAME/../bin/ccm" init
  [ "$status" -eq 0 ]

  run git -C "$TEMP_DIR/remote.git" log --oneline
  [[ "$output" == *"chore: init CCM meta-repo"* ]]
}
