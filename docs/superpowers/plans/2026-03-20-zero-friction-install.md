# Zero-Friction Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ccm add` and `ccm init` commit and push automatically — no manual follow-up steps required.

**Architecture:** Add auto-commit + auto-push logic directly in `cmd_add` and `cmd_init` in `bin/ccm`. A `CCM_SKIP_PUSH=1` env var allows tests to skip the push. Output is replaced with a concise status block; the "Nächste Schritte" section is removed entirely. The sub-project CLAUDE.md template is stripped to a minimal stub.

**Tech Stack:** Bash, git, bats-core (tests)

---

## File Map

- Modify: `bin/ccm` — `cmd_add` and `cmd_init` output + commit/push logic
- Modify: `templates/sub/CLAUDE.md` — strip to minimal stub
- Create: `tests/test_ccm_add.bats` — new test file for `ccm add`
- Modify: `tests/test_ccm_init.bats` — add commit/push behavior tests

---

## Task 1: Strip `templates/sub/CLAUDE.md`

**Files:**
- Modify: `templates/sub/CLAUDE.md`

- [ ] **Step 1.1: Write failing test**

Add to `tests/test_ccm_add.bats` (create file):

```bash
# tests/test_ccm_add.bats
load 'test_helper'

_setup_meta() {
  mkdir -p "$TEMP_DIR/meta"
  cd "$TEMP_DIR/meta" && git init -q
  CCM_HOME="$TEMP_DIR/.ccm" CCM_NON_INTERACTIVE=1 \
    CCM_GITHUB_USER=testuser CCM_PROJECT_NAME=testmeta \
    CCM_SKIP_PUSH=1 \
    bash "$BATS_TEST_DIRNAME/../bin/ccm" init
}

@test "ccm add: generated CLAUDE.md has no placeholder sections" {
  _setup_meta
  mkdir -p "$TEMP_DIR/sub"
  cd "$TEMP_DIR/sub" && git init -q
  CCM_HOME="$TEMP_DIR/.ccm" CCM_SKIP_PUSH=1 \
    run bash "$BATS_TEST_DIRNAME/../bin/ccm" add
  [ "$status" -eq 0 ]
  run grep "Projektbeschreibung" "$TEMP_DIR/sub/CLAUDE.md"
  [ "$status" -ne 0 ]  # must not contain placeholder sections
  run grep "PROJECT CONTEXT BELOW" "$TEMP_DIR/sub/CLAUDE.md"
  [ "$status" -eq 0 ]  # marker must still be present
}
```

- [ ] **Step 1.2: Run test to verify it fails**

```bash
cd /Users/yves/Developer/claude-context-manager
bats tests/test_ccm_add.bats
```

Expected: FAIL — `ccm add` not yet honoring `CCM_SKIP_PUSH`, and template not yet stripped.
(The test may fail for multiple reasons at this point — that's fine.)

- [ ] **Step 1.3: Strip the template**

Replace `templates/sub/CLAUDE.md` with:

```markdown
<!-- PROJECT CONTEXT BELOW -->

# {{REPO_NAME}} — Projekt-Kontext

**Repo:** {{REPO_URL}}
```

- [ ] **Step 1.4: Commit (partial — test still failing, template done)**

```bash
git add templates/sub/CLAUDE.md tests/test_ccm_add.bats
git commit -m "chore: strip sub CLAUDE.md template to minimal stub, add ccm add tests"
```

---

## Task 2: Add `CCM_SKIP_PUSH` support + auto-commit in `cmd_add`

**Files:**
- Modify: `bin/ccm` — `cmd_add` function

- [ ] **Step 2.1: Extend test for auto-commit behavior**

Add to `tests/test_ccm_add.bats`:

```bash
@test "ccm add: auto-commits CLAUDE.md and .ccm" {
  _setup_meta
  mkdir -p "$TEMP_DIR/sub"
  cd "$TEMP_DIR/sub" && git init -q
  CCM_HOME="$TEMP_DIR/.ccm" CCM_SKIP_PUSH=1 \
    run bash "$BATS_TEST_DIRNAME/../bin/ccm" add
  [ "$status" -eq 0 ]
  run git log --oneline
  [[ "$output" == *"chore: add CCM context"* ]]
}

@test "ccm add: output has no Naechste Schritte block" {
  _setup_meta
  mkdir -p "$TEMP_DIR/sub"
  cd "$TEMP_DIR/sub" && git init -q
  CCM_HOME="$TEMP_DIR/.ccm" CCM_SKIP_PUSH=1 \
    run bash "$BATS_TEST_DIRNAME/../bin/ccm" add
  [ "$status" -eq 0 ]
  run echo "$output"
  [[ "$output" != *"Nächste Schritte"* ]]
  [[ "$output" != *"git add"* ]]
}

@test "ccm add: skips commit on re-run (idempotent)" {
  _setup_meta
  mkdir -p "$TEMP_DIR/sub"
  cd "$TEMP_DIR/sub" && git init -q
  CCM_HOME="$TEMP_DIR/.ccm" CCM_SKIP_PUSH=1 \
    bash "$BATS_TEST_DIRNAME/../bin/ccm" add
  CCM_HOME="$TEMP_DIR/.ccm" CCM_SKIP_PUSH=1 \
    run bash "$BATS_TEST_DIRNAME/../bin/ccm" add
  [ "$status" -eq 0 ]
  run git log --oneline
  # Only one CCM commit, not two
  count=$(echo "$output" | grep -c "chore: add CCM context" || true)
  [ "$count" -eq 1 ]
}
```

- [ ] **Step 2.2: Run tests to confirm they fail**

```bash
bats tests/test_ccm_add.bats
```

Expected: FAIL — `cmd_add` doesn't commit yet and still shows "Nächste Schritte".

- [ ] **Step 2.3: Replace `cmd_add` output + add commit logic in `bin/ccm`**

Find the current output block in `cmd_add` (lines ~172–179) and replace the entire echo section at the end of `cmd_add` with:

```bash
  # Auto-commit CCM files only (do not touch pre-existing staged changes)
  git add CLAUDE.md .ccm
  if git diff --cached --quiet; then
    CCM_COMMIT_STATUS="— keine Änderungen"
    CCM_PUSH_STATUS="— übersprungen"
  else
    git commit -m 'chore: add CCM context'
    CCM_COMMIT_STATUS="chore: add CCM context"

    if ! git remote get-url origin &>/dev/null 2>&1; then
      CCM_PUSH_STATUS="— kein Remote konfiguriert"
    elif [[ "${CCM_SKIP_PUSH:-}" == "1" ]]; then
      CCM_PUSH_STATUS="— übersprungen (test)"
    else
      CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
      PUSH_OUTPUT=$(git push 2>&1) || {
        echo ""
        echo "❌ Push fehlgeschlagen:"
        echo "$PUSH_OUTPUT"
        exit 1
      }
      CCM_PUSH_STATUS="→ $CURRENT_BRANCH"
    fi
  fi

  echo ""
  echo "✅ $REPO_NAME eingebunden"
  echo "   Meta-Repo:  $META_PATH"
  echo "   Commit:     $CCM_COMMIT_STATUS"
  echo "   Push:       $CCM_PUSH_STATUS"
```

Also remove the old output block (the existing `echo "✅ $REPO_NAME registriert"` and "Nächste Schritte" lines).

- [ ] **Step 2.4: Run tests to verify they pass**

```bash
bats tests/test_ccm_add.bats
```

Expected: All tests PASS.

- [ ] **Step 2.5: Commit**

```bash
git add bin/ccm tests/test_ccm_add.bats
git commit -m "feat: ccm add auto-commits and shows status output"
```

---

## Task 3: Auto-push in `cmd_add`

**Files:**
- Modify: `tests/test_ccm_add.bats`
- No new changes to `bin/ccm` needed (push logic already added in Task 2)

- [ ] **Step 3.1: Write push test with local bare remote**

Add to `tests/test_ccm_add.bats`:

```bash
@test "ccm add: auto-pushes when remote is configured" {
  _setup_meta

  # Bare repo acts as remote
  git init --bare "$TEMP_DIR/remote.git" -q

  mkdir -p "$TEMP_DIR/sub"
  cd "$TEMP_DIR/sub" && git init -q
  git remote add origin "$TEMP_DIR/remote.git"
  # Initial commit needed before push can set upstream
  git commit --allow-empty -m "initial"
  git push -u origin HEAD

  CCM_HOME="$TEMP_DIR/.ccm" \
    run bash "$BATS_TEST_DIRNAME/../bin/ccm" add
  [ "$status" -eq 0 ]

  # CCM commit must exist in the remote
  run git -C "$TEMP_DIR/remote.git" log --oneline
  [[ "$output" == *"chore: add CCM context"* ]]
}

@test "ccm add: output shows branch name on successful push" {
  _setup_meta
  git init --bare "$TEMP_DIR/remote.git" -q
  mkdir -p "$TEMP_DIR/sub"
  cd "$TEMP_DIR/sub" && git init -q
  git remote add origin "$TEMP_DIR/remote.git"
  git commit --allow-empty -m "initial"
  git push -u origin HEAD

  CCM_HOME="$TEMP_DIR/.ccm" \
    run bash "$BATS_TEST_DIRNAME/../bin/ccm" add
  [ "$status" -eq 0 ]
  [[ "$output" == *"Push:       →"* ]]
}
```

- [ ] **Step 3.2: Run tests to verify they pass**

```bash
bats tests/test_ccm_add.bats
```

Expected: All tests PASS (push logic was already added in Task 2).

- [ ] **Step 3.3: Commit**

```bash
git add tests/test_ccm_add.bats
git commit -m "test: add ccm add push tests with local bare remote"
```

---

## Task 4: Auto-commit + new output in `cmd_init`

**Files:**
- Modify: `bin/ccm` — `cmd_init` function
- Modify: `tests/test_ccm_init.bats`

- [ ] **Step 4.1: Write failing tests**

Add to `tests/test_ccm_init.bats`:

```bash
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
```

- [ ] **Step 4.2: Run tests to confirm they fail**

```bash
bats tests/test_ccm_init.bats
```

Expected: The three new tests FAIL. Existing tests should still PASS.

- [ ] **Step 4.3: Replace `cmd_init` output block + add commit logic in `bin/ccm`**

Replace the existing echo block at the end of `cmd_init` (lines ~91–103 in current `bin/ccm`):

```bash
  # Auto-commit CCM files
  git add CLAUDE.md ccm.json context/ .github/
  if git diff --cached --quiet; then
    CCM_COMMIT_STATUS="— keine Änderungen"
    CCM_PUSH_STATUS="— übersprungen"
    CCM_DID_COMMIT=0
  else
    git commit -m 'chore: init CCM meta-repo'
    CCM_COMMIT_STATUS="chore: init CCM meta-repo"
    CCM_DID_COMMIT=1

    REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)
    if [[ -z "$REMOTE_URL" ]]; then
      CCM_PUSH_STATUS="— kein Remote konfiguriert"
    elif [[ "${CCM_SKIP_PUSH:-}" == "1" ]]; then
      CCM_PUSH_STATUS="— übersprungen (test)"
    else
      PUSH_OUTPUT=$(git push -u origin main 2>&1) || {
        echo ""
        echo "❌ Push fehlgeschlagen:"
        echo "$PUSH_OUTPUT"
        exit 1
      }
      CCM_PUSH_STATUS="→ origin/main"
    fi
  fi

  echo ""
  echo "✅ Meta-Repo eingerichtet"
  echo "   Projekt:  $PROJECT_NAME"
  [[ -n "${REMOTE_URL:-}" ]] && echo "   Remote:   $REMOTE_URL"
  echo "   Commit:   $CCM_COMMIT_STATUS"
  echo "   Push:     $CCM_PUSH_STATUS"
  echo ""
  echo "Nächstes:  ccm add  (im Sub-Projekt ausführen)"
```

- [ ] **Step 4.4: Run all tests**

```bash
bats tests/
```

Expected: All tests PASS (both new and existing).

- [ ] **Step 4.5: Commit**

```bash
git add bin/ccm tests/test_ccm_init.bats
git commit -m "feat: ccm init auto-commits and shows status output"
```

---

## Task 5: Auto-push in `cmd_init`

**Files:**
- Modify: `tests/test_ccm_init.bats`

- [ ] **Step 5.1: Write push test for `ccm init`**

Add to `tests/test_ccm_init.bats`:

```bash
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
```

Note: `ccm init` normally runs `git remote add origin <url>`, but since a remote is already set it will skip that step (the guard `if ! git remote get-url origin` is already in the code). This test pre-adds the bare repo so push succeeds.

- [ ] **Step 5.2: Run tests**

```bash
bats tests/test_ccm_init.bats
```

Expected: All tests PASS.

- [ ] **Step 5.3: Run full test suite**

```bash
bats tests/
```

Expected: All tests PASS.

- [ ] **Step 5.4: Commit**

```bash
git add tests/test_ccm_init.bats
git commit -m "test: add ccm init push test with local bare remote"
```

---

## Done

After all tasks:
- `ccm add` auto-commits `CLAUDE.md` + `.ccm`, auto-pushes, shows clean status output
- `ccm init` auto-commits all generated files, auto-pushes to `origin main`, shows clean status output
- No "Nächste Schritte" block in either command
- `templates/sub/CLAUDE.md` is a minimal 4-line stub
- All existing + new tests pass
