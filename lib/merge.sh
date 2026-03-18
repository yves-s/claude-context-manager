#!/bin/bash
set -euo pipefail

# merge.sh — Merged Meta-CLAUDE.md in eine Sub-Repo-CLAUDE.md
# Bewahrt alles unterhalb des Markers.
#
# Usage: ./sync/merge.sh <meta-claude> <sub-claude> <marker>

META_FILE="$1"
SUB_FILE="$2"
MARKER="${3:-<!-- PROJECT CONTEXT BELOW -->}"

if [[ ! -f "$META_FILE" ]]; then
    echo "❌ Meta-CLAUDE.md nicht gefunden: $META_FILE"
    exit 1
fi

if [[ ! -f "$SUB_FILE" ]]; then
    echo "❌ Sub-CLAUDE.md nicht gefunden: $SUB_FILE"
    exit 1
fi

# Extrahiere den projektspezifischen Teil (ab Marker)
if grep -q "$MARKER" "$SUB_FILE"; then
    PROJECT_CONTENT=$(sed -n "/$MARKER/,\$p" "$SUB_FILE")
else
    echo "⚠️  Marker '$MARKER' nicht gefunden in $SUB_FILE"
    echo "    Füge gesamten bestehenden Inhalt als Projekt-Kontext an."
    PROJECT_CONTENT="$MARKER"$'\n\n'"$(cat "$SUB_FILE")"
fi

# Baue neue CLAUDE.md: Meta-Teil + Marker + Projekt-Teil
{
    cat "$META_FILE"
    echo ""
    echo "---"
    echo ""
    echo "$PROJECT_CONTENT"
} > "$SUB_FILE"

echo "  ✅ Merge abgeschlossen: Meta-Teil aktualisiert, Projekt-Kontext erhalten"
