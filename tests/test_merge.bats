load 'test_helper'

@test "merge: replaces meta section, keeps project content below marker" {
  echo "# New Meta" > "$TEMP_DIR/meta.md"
  printf "# Old Meta\n\n---\n\n<!-- PROJECT CONTEXT BELOW -->\n\n# My Project" \
    > "$TEMP_DIR/sub.md"

  run bash "$BATS_TEST_DIRNAME/../lib/merge.sh" \
    "$TEMP_DIR/meta.md" "$TEMP_DIR/sub.md" "<!-- PROJECT CONTEXT BELOW -->"
  [ "$status" -eq 0 ]

  # New meta content is present
  run grep "# New Meta" "$TEMP_DIR/sub.md"
  [ "$status" -eq 0 ]

  # Old meta content is gone
  run grep "# Old Meta" "$TEMP_DIR/sub.md"
  [ "$status" -ne 0 ]

  # Project content is preserved
  run grep "# My Project" "$TEMP_DIR/sub.md"
  [ "$status" -eq 0 ]

  # Marker appears exactly once
  run bash -c "grep -c '<!-- PROJECT CONTEXT BELOW -->' '$TEMP_DIR/sub.md'"
  [ "$output" = "1" ]

  # Verify ordering: meta before marker before project
  META_LINE=$(grep -n "# New Meta" "$TEMP_DIR/sub.md" | cut -d: -f1)
  MARKER_LINE=$(grep -n "<!-- PROJECT CONTEXT BELOW -->" "$TEMP_DIR/sub.md" | cut -d: -f1)
  PROJECT_LINE=$(grep -n "# My Project" "$TEMP_DIR/sub.md" | cut -d: -f1)
  [ "$META_LINE" -lt "$MARKER_LINE" ]
  [ "$MARKER_LINE" -lt "$PROJECT_LINE" ]
}

@test "merge: adds marker if missing in sub file, wraps original content" {
  echo "# New Meta" > "$TEMP_DIR/meta.md"
  echo "# Existing content" > "$TEMP_DIR/sub.md"

  run bash "$BATS_TEST_DIRNAME/../lib/merge.sh" \
    "$TEMP_DIR/meta.md" "$TEMP_DIR/sub.md" "<!-- PROJECT CONTEXT BELOW -->"
  [ "$status" -eq 0 ]

  run grep "<!-- PROJECT CONTEXT BELOW -->" "$TEMP_DIR/sub.md"
  [ "$status" -eq 0 ]

  run grep "# Existing content" "$TEMP_DIR/sub.md"
  [ "$status" -eq 0 ]

  MARKER_LINE=$(grep -n "<!-- PROJECT CONTEXT BELOW -->" "$TEMP_DIR/sub.md" | cut -d: -f1)
  CONTENT_LINE=$(grep -n "# Existing content" "$TEMP_DIR/sub.md" | cut -d: -f1)
  [ "$MARKER_LINE" -lt "$CONTENT_LINE" ]
}
