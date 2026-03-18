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
