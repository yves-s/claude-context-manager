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
