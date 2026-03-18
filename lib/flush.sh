# lib/flush.sh
# Requires: lib/config.sh and lib/buffer.sh already sourced by caller.

CLAUDE_MEMORY_DIR="${CLAUDE_MEMORY_DIR:-$HOME/.claude/memory}"
CCM_AUTOSAVE_FILE="$CLAUDE_MEMORY_DIR/ccm-autosave.md"

flush_buffer() {
  local dry_run="${CCM_FLUSH_DRY_RUN:-0}"
  local count
  count=$(buffer_count)

  if [[ "$count" -eq 0 ]]; then
    echo "Buffer is empty — nothing to flush."
    return 0
  fi

  if [[ -z "${ANTHROPIC_API_KEY:-}" && "$dry_run" != "1" ]]; then
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

  if [[ -z "$api_response" ]]; then
    echo "❌ No response from Claude API. Buffer preserved."
    return 1
  fi

  local text
  text=$(echo "$api_response" | jq -r '.content[0].text // "{}"' 2>/dev/null)

  if [[ -z "$text" || "$text" == "null" ]]; then
    echo "❌ Unexpected API response format. Buffer preserved."
    return 1
  fi

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
