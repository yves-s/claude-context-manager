# CCM v2: Rolling Buffer & Auto-Flush Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a continuous rolling buffer to CCM that captures Claude Code session activity via hooks and flushes it — via Claude API classification — to personal memory or the meta-repo.

**Architecture:** Claude Code's `PostToolUse` and `Stop` hooks write lightweight JSONL entries to `~/.ccm/buffer.jsonl` after every file operation and session end. `ccm flush` reads the buffer, calls Claude Haiku to classify entries as `memory` / `meta` / `discard`, routes accordingly, then clears the buffer. A new `ccm hooks install` command wires the hooks into `~/.claude/settings.json`.

**Tech Stack:** bash, jq (already required), Claude Haiku API (`ANTHROPIC_API_KEY`), bats-core (tests)

---

## File Structure

**New files:**
- `lib/buffer.sh` — buffer read/write/clear/count primitives
- `lib/flush.sh` — classify via Claude API, route to memory output / print meta suggestions
- `hooks/post-tool-use.sh` — PostToolUse hook: appends file-op entries to buffer
- `hooks/stop.sh` — Stop hook: appends session-end marker to buffer
- `tests/test_buffer.bats` — unit tests for buffer primitives
- `tests/test_hooks.bats` — tests for both hook scripts
- `tests/test_flush.bats` — tests for flush logic (dry-run mode, no real API)
- `tests/test_ccm_hooks.bats` — integration tests for `ccm hooks install`

**Modified files:**
- `bin/ccm` — add `HOOKS_DIR` to path resolution, `flush` and `hooks` subcommands, source new libs
- `install.sh` — download hooks + new lib files to `~/.ccm/`

**Key path resolution rules:**
- Hook scripts use `BASH_SOURCE`-relative paths to find `lib/buffer.sh` — no `CCM_HOME` needed for lib loading
- Dev mode (repo): hooks at `hooks/`, lib at `lib/` — `../lib/buffer.sh` resolves correctly
- Installed mode (`~/.ccm/hooks/`): `../lib/buffer.sh` = `~/.ccm/lib/buffer.sh` — also correct
- `CCM_HOME` env var only controls the buffer file location (via `buffer.sh`), not lib loading
- `bin/ccm` gets a new `HOOKS_DIR` var parallel to `LIB_DIR` and `TEMPLATES_DIR`

---

## Task 1: Buffer library

**Files:**
- Create: `lib/buffer.sh`
- Create: `tests/test_buffer.bats`

- [ ] **Step 1: Write the failing tests**

```bash
# tests/test_buffer.bats
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/yves/Developer/claude-context-manager
bats tests/test_buffer.bats
```
Expected: all 7 tests FAIL

- [ ] **Step 3: Implement `lib/buffer.sh`**

```bash
# lib/buffer.sh
CCM_HOME="${CCM_HOME:-$HOME/.ccm}"
CCM_BUFFER="${CCM_BUFFER:-$CCM_HOME/buffer.jsonl}"

buffer_append() {
  local entry="$1"
  mkdir -p "$(dirname "$CCM_BUFFER")"
  echo "$entry" >> "$CCM_BUFFER"
}

buffer_read() {
  [[ -f "$CCM_BUFFER" ]] && cat "$CCM_BUFFER"
  return 0
}

buffer_clear() {
  [[ -f "$CCM_BUFFER" ]] && > "$CCM_BUFFER"
  return 0
}

buffer_count() {
  if [[ ! -f "$CCM_BUFFER" ]] || [[ ! -s "$CCM_BUFFER" ]]; then
    echo "0"
    return 0
  fi
  wc -l < "$CCM_BUFFER" | tr -d ' '
}
```

Note: `buffer_read` emits nothing (not even an empty line) when the file is missing. This ensures any `wc -l` consumer downstream gets 0, not 1.

- [ ] **Step 4: Run tests to verify they pass**

```bash
bats tests/test_buffer.bats
```
Expected: 7 tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/buffer.sh tests/test_buffer.bats
git commit -m "feat: add buffer library for rolling session capture"
```

---

## Task 2: PostToolUse hook

**Files:**
- Create: `hooks/post-tool-use.sh`
- Create: `tests/test_hooks.bats`

The hook receives a JSON object via stdin from Claude Code:
```json
{
  "session_id": "abc123",
  "tool_name": "Edit",
  "tool_input": {"file_path": "/path/to/file"},
  "tool_response": {"type": "text", "text": "Updated successfully."}
}
```
Only `Edit`, `Write`, and `NotebookEdit` are relevant — all others exit silently (exit 0).

The hook resolves `lib/buffer.sh` relative to its own location via `BASH_SOURCE`. This works in dev mode (repo `hooks/` + `lib/`) and installed mode (`~/.ccm/hooks/` + `~/.ccm/lib/`). Buffer location is controlled by `CCM_HOME` env var passed at invocation time.

- [ ] **Step 1: Write the failing tests**

```bash
# tests/test_hooks.bats
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bats tests/test_hooks.bats
```
Expected: all 7 tests FAIL

- [ ] **Step 3: Implement `hooks/post-tool-use.sh`**

```bash
#!/bin/bash
# CCM PostToolUse hook — appends file-operation entries to the rolling buffer.
# Claude Code passes event JSON via stdin.
# Resolves lib/buffer.sh relative to this script (works dev + installed mode).

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')

# Only capture file-modifying tools
case "$TOOL_NAME" in
  Edit|Write|NotebookEdit) ;;
  *) exit 0 ;;
esac

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')
PROJECT=$(pwd)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/buffer.sh
source "$HOOK_DIR/../lib/buffer.sh"

ENTRY=$(jq -cn \
  --arg ts "$TIMESTAMP" \
  --arg project "$PROJECT" \
  --arg tool "$TOOL_NAME" \
  --arg file "$FILE_PATH" \
  '{timestamp: $ts, project: $project, tool: $tool, file: $file}')

buffer_append "$ENTRY"
```

```bash
chmod +x hooks/post-tool-use.sh
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bats tests/test_hooks.bats
```
Expected: 7 tests pass

- [ ] **Step 5: Commit**

```bash
git add hooks/post-tool-use.sh tests/test_hooks.bats
git commit -m "feat: add PostToolUse hook for buffer capture"
```

---

## Task 3: Stop hook

**Files:**
- Create: `hooks/stop.sh`
- Modify: `tests/test_hooks.bats` (append new tests)

The Stop hook receives `{"session_id": "...", "stop_hook_active": true}` via stdin. It appends a `session_end` marker.

- [ ] **Step 1: Write the failing tests** (append to `tests/test_hooks.bats`)

```bash
# Append to tests/test_hooks.bats

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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bats tests/test_hooks.bats
```
Expected: 4 new tests FAIL, 7 existing pass

- [ ] **Step 3: Implement `hooks/stop.sh`**

```bash
#!/bin/bash
# CCM Stop hook — appends session-end marker to rolling buffer.
# Claude Code fires this at the end of each agent turn.

PROJECT=$(pwd)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../lib/buffer.sh
source "$HOOK_DIR/../lib/buffer.sh"

ENTRY=$(jq -cn \
  --arg ts "$TIMESTAMP" \
  --arg project "$PROJECT" \
  '{timestamp: $ts, project: $project, type: "session_end"}')

buffer_append "$ENTRY"
```

```bash
chmod +x hooks/stop.sh
```

- [ ] **Step 4: Run full hooks test suite**

```bash
bats tests/test_hooks.bats
```
Expected: all 11 tests pass

- [ ] **Step 5: Commit**

```bash
git add hooks/stop.sh tests/test_hooks.bats
git commit -m "feat: add Stop hook for session-end marker"
```

---

## Task 4: Flush library

**Files:**
- Create: `lib/flush.sh`
- Create: `tests/test_flush.bats`

`flush_buffer` groups buffer entries by project, calls Claude Haiku to classify, writes memory items to `~/.claude/memory/ccm-autosave.md`, and prints meta-repo suggestions. `CCM_FLUSH_DRY_RUN=1` skips the API call (used in tests).

`flush.sh` does NOT source `config.sh` or `buffer.sh` — callers (tests, `bin/ccm`) are responsible for sourcing those first. This avoids resetting `CCM_BUFFER` overrides at load time.

- [ ] **Step 1: Write the failing tests**

```bash
# tests/test_flush.bats
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
  run CCM_FLUSH_DRY_RUN=1 flush_buffer
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
  run env -u ANTHROPIC_API_KEY flush_buffer
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bats tests/test_flush.bats
```
Expected: all 6 tests FAIL

- [ ] **Step 3: Implement `lib/flush.sh`**

Note: no `source` calls at the top — callers provide the loaded functions.

```bash
# lib/flush.sh
# Requires: lib/config.sh and lib/buffer.sh already sourced by caller.

CLAUDE_MEMORY_DIR="${CLAUDE_MEMORY_DIR:-$HOME/.claude/memory}"
CCM_AUTOSAVE_FILE="$CLAUDE_MEMORY_DIR/ccm-autosave.md"

flush_buffer() {
  local dry_run="${CCM_FLUSH_DRY_RUN:-0}"
  local api_key="${ANTHROPIC_API_KEY:-}"
  local count
  count=$(buffer_count)

  if [[ "$count" -eq 0 ]]; then
    echo "Buffer is empty — nothing to flush."
    return 0
  fi

  if [[ -z "$api_key" && "$dry_run" != "1" ]]; then
    echo "❌ ANTHROPIC_API_KEY not set. Set it or use CCM_FLUSH_DRY_RUN=1 for testing."
    return 1
  fi

  echo "Processing $count buffer entries..."

  local summary
  summary=$(buffer_read | jq -rs '
    group_by(.project) |
    map({
      project: .[0].project,
      files_edited: [.[] | select(.tool != null) | .file] | unique,
      sessions: [.[] | select(.type == "session_end")] | length
    })
  ')

  if [[ "$dry_run" == "1" ]]; then
    echo "DRY RUN — session summary:"
    echo "$summary" | jq .
    return 0
  fi

  local api_response
  api_response=$(classify_with_claude "$summary")

  local text
  text=$(echo "$api_response" | jq -r '.content[0].text // "{}"')

  local memory_items meta_items
  memory_items=$(echo "$text" | jq -r '.memory[]?' 2>/dev/null || true)
  meta_items=$(echo "$text" | jq -r '.meta[]?' 2>/dev/null || true)

  _route_memory "$memory_items"
  _route_meta "$meta_items"

  buffer_clear
  echo "✅ Buffer flushed."
}

classify_with_claude() {
  local summary="$1"
  curl -s "https://api.anthropic.com/v1/messages" \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d "$(jq -n --arg s "$summary" '{
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: ("Review this Claude Code session activity.\n\nSession:\n" + $s + "\n\nExtract knowledge worth keeping. Return JSON only — no prose:\n{\"memory\": [\"personal insight or preference\"], \"meta\": [\"architectural or team-relevant decision\"]}\n\nMax 3 items per array. Return empty arrays if nothing is worth saving.")
      }]
    }')"
}

_route_memory() {
  local items="$1"
  [[ -z "$items" ]] && return
  mkdir -p "$CLAUDE_MEMORY_DIR"
  local date_header
  date_header=$(date -u +"%Y-%m-%d")
  {
    echo ""
    echo "## $date_header"
    echo "$items" | while IFS= read -r item; do
      echo "- $item"
    done
  } >> "$CCM_AUTOSAVE_FILE"
  echo "→ Saved to memory: $CCM_AUTOSAVE_FILE"
}

_route_meta() {
  local items="$1"
  [[ -z "$items" ]] && return
  echo "→ Meta-repo candidates (add manually to your meta-repo):"
  echo "$items" | while IFS= read -r item; do
    echo "  • $item"
  done
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bats tests/test_flush.bats
```
Expected: 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/flush.sh tests/test_flush.bats
git commit -m "feat: add flush library with Claude Haiku classification"
```

---

## Task 5: `ccm flush` command

**Files:**
- Modify: `bin/ccm`
- Create: `tests/test_ccm_flush.bats`

Three changes to `bin/ccm`:
1. Add `HOOKS_DIR` to the path-resolution block (dev: `repo/hooks/`, installed: `~/.ccm/hooks/`)
2. Source `lib/buffer.sh` and `lib/flush.sh` after `lib/config.sh`
3. Add `cmd_flush` function and `flush` case

- [ ] **Step 1: Write the failing tests**

```bash
# tests/test_ccm_flush.bats
setup() {
  TEMP_DIR=$(mktemp -d)
  export CCM_HOME="$TEMP_DIR/.ccm"
  mkdir -p "$CCM_HOME"
}

teardown() {
  rm -rf "$TEMP_DIR"
}

@test "ccm flush: exits 0 with empty buffer" {
  run CCM_HOME="$CCM_HOME" bash "$BATS_TEST_DIRNAME/../bin/ccm" flush
  [ "$status" -eq 0 ]
  [[ "$output" == *"empty"* ]]
}

@test "ccm flush: dry run shows summary" {
  # Pre-populate buffer by sourcing buffer.sh directly
  CCM_HOME="$CCM_HOME" bash -c "
    source '$BATS_TEST_DIRNAME/../lib/buffer.sh'
    buffer_append '{\"timestamp\":\"2026-01-01T00:00:00Z\",\"project\":\"/tmp/p\",\"tool\":\"Edit\",\"file\":\"a.sh\"}'
  "
  run CCM_FLUSH_DRY_RUN=1 CCM_HOME="$CCM_HOME" \
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bats tests/test_ccm_flush.bats
```
Expected: all 3 tests FAIL

- [ ] **Step 3: Modify `bin/ccm`**

**3a — extend path resolution block** (the existing `if/else` near top of file):

```bash
if [[ -f "$SCRIPT_DIR/../lib/config.sh" ]]; then
  # Development mode: running from repo bin/
  LIB_DIR="$(dirname "$SCRIPT_DIR")/lib"
  TEMPLATES_DIR="$(dirname "$SCRIPT_DIR")/templates"
  HOOKS_DIR="$(dirname "$SCRIPT_DIR")/hooks"
else
  # Installed mode: binary in ~/.local/bin, assets in ~/.ccm/
  LIB_DIR="$HOME/.ccm/lib"
  TEMPLATES_DIR="$HOME/.ccm/templates"
  HOOKS_DIR="$HOME/.ccm/hooks"
fi
```

**3b — source new libs** (after existing `source "$LIB_DIR/config.sh"`):

```bash
# shellcheck source=../lib/buffer.sh
source "$LIB_DIR/buffer.sh"
# shellcheck source=../lib/flush.sh
source "$LIB_DIR/flush.sh"
```

**3c — add function**:

```bash
cmd_flush() {
  flush_buffer
}
```

**3d — extend case block**:

```bash
case "${1:-}" in
  init)    cmd_init ;;
  add)     cmd_add ;;
  flush)   cmd_flush ;;
  hooks)   cmd_hooks "${2:-}" ;;
  version) echo "ccm $CCM_VERSION" ;;
  *)
    echo "Usage: ccm <command>"
    echo ""
    echo "Commands:"
    echo "  init     Meta-Repo im aktuellen Verzeichnis einrichten"
    echo "  add      Dieses Projekt als Sub-Repo registrieren"
    echo "  flush    Buffer klassifizieren und in Memory/Meta-Repo schreiben"
    echo "  hooks    Hook-Management (install)"
    echo "  version  Version anzeigen"
    ;;
esac
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bats tests/test_ccm_flush.bats
```
Expected: 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add bin/ccm tests/test_ccm_flush.bats
git commit -m "feat: add ccm flush subcommand"
```

---

## Task 6: `ccm hooks install`

**Files:**
- Modify: `bin/ccm` (add `cmd_hooks` + `_hooks_install`)
- Create: `tests/test_ccm_hooks.bats`

`ccm hooks install` copies hooks from `HOOKS_DIR` to `~/.ccm/hooks/` (or `$CCM_HOME/hooks/` when overridden) and merges hook config into `~/.claude/settings.json`. Idempotent — re-running replaces existing CCM entries rather than duplicating them.

Settings format Claude Code expects:
```json
{
  "hooks": {
    "PostToolUse": [{"matcher": "Edit|Write|NotebookEdit", "hooks": [{"type": "command", "command": "/path/hook"}]}],
    "Stop": [{"hooks": [{"type": "command", "command": "/path/hook"}]}]
  }
}
```

- [ ] **Step 1: Write the failing tests**

```bash
# tests/test_ccm_hooks.bats
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bats tests/test_ccm_hooks.bats
```
Expected: all 6 tests FAIL

- [ ] **Step 3: Add `cmd_hooks` and `_hooks_install` to `bin/ccm`**

```bash
cmd_hooks() {
  local subcmd="${1:-}"
  case "$subcmd" in
    install) _hooks_install ;;
    *)
      echo "Usage: ccm hooks <subcommand>"
      echo ""
      echo "Subcommands:"
      echo "  install  Hooks in Claude Code Settings registrieren"
      ;;
  esac
}

_hooks_install() {
  local hook_dir="${CCM_HOME:-$HOME/.ccm}/hooks"
  local settings_file="${CLAUDE_SETTINGS_FILE:-$HOME/.claude/settings.json}"

  # Copy hook scripts from HOOKS_DIR (repo or ~/.ccm/hooks in installed mode)
  mkdir -p "$hook_dir"
  cp "$HOOKS_DIR/post-tool-use.sh" "$hook_dir/post-tool-use.sh"
  cp "$HOOKS_DIR/stop.sh"          "$hook_dir/stop.sh"
  chmod +x "$hook_dir/post-tool-use.sh" "$hook_dir/stop.sh"

  local post_hook="$hook_dir/post-tool-use.sh"
  local stop_hook="$hook_dir/stop.sh"

  # Merge hooks into settings.json (idempotent: remove existing CCM entries first)
  mkdir -p "$(dirname "$settings_file")"

  if [[ -f "$settings_file" ]]; then
    jq \
      --arg post "$post_hook" \
      --arg stop "$stop_hook" \
      '
      .hooks.PostToolUse = (
        (.hooks.PostToolUse // []) |
        map(select(.hooks[0].command != $post)) +
        [{"matcher": "Edit|Write|NotebookEdit", "hooks": [{"type": "command", "command": $post}]}]
      ) |
      .hooks.Stop = (
        (.hooks.Stop // []) |
        map(select(.hooks[0].command != $stop)) +
        [{"hooks": [{"type": "command", "command": $stop}]}]
      )
      ' "$settings_file" > "$settings_file.tmp" && mv "$settings_file.tmp" "$settings_file"
  else
    jq -n \
      --arg post "$post_hook" \
      --arg stop "$stop_hook" \
      '{hooks: {
        PostToolUse: [{"matcher": "Edit|Write|NotebookEdit", "hooks": [{"type": "command", "command": $post}]}],
        Stop: [{"hooks": [{"type": "command", "command": $stop}]}]
      }}' > "$settings_file"
  fi

  echo ""
  echo "✅ CCM Hooks installiert"
  echo "   Hooks:    $hook_dir"
  echo "   Settings: $settings_file"
  echo ""
  echo "Starte Claude Code neu um die Hooks zu aktivieren."
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bats tests/test_ccm_hooks.bats
```
Expected: 6 tests pass

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
bats tests/
```
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add bin/ccm tests/test_ccm_hooks.bats
git commit -m "feat: add ccm hooks install subcommand"
```

---

## Task 7: Update install.sh, README, and version bump

**Files:**
- Modify: `bin/ccm` — bump version
- Modify: `install.sh` — download `buffer.sh`, `flush.sh`, both hooks
- Modify: `README.md` — add Rolling Buffer section

`install.sh` must download the new files so installed mode has `~/.ccm/lib/buffer.sh`, `~/.ccm/lib/flush.sh`, and `~/.ccm/hooks/*.sh` available. This is what makes `ccm hooks install` work in installed mode (hooks copy themselves from `~/.ccm/hooks/` to `~/.ccm/hooks/` — a same-destination copy that is effectively a no-op, but idempotent).

- [ ] **Step 1: Bump version in `bin/ccm`**

Change line 4:
```bash
CCM_VERSION="0.2.0"
```

- [ ] **Step 2: Update `install.sh`** — add after the existing lib downloads block

```bash
# New lib files (v2)
curl -fsSL "$CCM_RAW/lib/buffer.sh" -o "$HOME/.ccm/lib/buffer.sh"
curl -fsSL "$CCM_RAW/lib/flush.sh"  -o "$HOME/.ccm/lib/flush.sh"

# Hooks
mkdir -p "$HOME/.ccm/hooks"
curl -fsSL "$CCM_RAW/hooks/post-tool-use.sh" -o "$HOME/.ccm/hooks/post-tool-use.sh"
curl -fsSL "$CCM_RAW/hooks/stop.sh"          -o "$HOME/.ccm/hooks/stop.sh"
chmod +x "$HOME/.ccm/hooks/post-tool-use.sh" "$HOME/.ccm/hooks/stop.sh"
```

- [ ] **Step 3: Update `README.md`** — add section after existing setup docs

```markdown
## Rolling Buffer (CCM v2)

CCM automatically captures session activity as you work and can flush insights
to your personal memory and meta-repo on demand.

### Activate hooks

```bash
ccm hooks install
```

Installs two Claude Code hooks. Restart Claude Code to activate them.

### Flush the buffer

Run at any point — during or after a session:

```bash
ccm flush                       # Classify and route buffer entries
CCM_FLUSH_DRY_RUN=1 ccm flush  # Preview without calling the API
```

Requires `ANTHROPIC_API_KEY` to be set.

**What happens:**
- **Memory items** → saved to `~/.claude/memory/ccm-autosave.md`
- **Meta-repo candidates** → printed for your manual review
- Buffer is cleared after a successful flush
```

- [ ] **Step 4: Run full test suite**

```bash
bats tests/
```
Expected: all tests pass

- [ ] **Step 5: Commit and push**

```bash
git add bin/ccm install.sh README.md
git commit -m "feat: ccm v2 complete — rolling buffer, hooks, flush, v0.2.0"
GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519_private" git push
```
