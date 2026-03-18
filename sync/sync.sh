#!/bin/bash
set -euo pipefail

# sync.sh — Push Meta-CLAUDE.md in alle registrierten Sub-Repos
# Usage: ./sync/sync.sh [--dry-run]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG="$SCRIPT_DIR/config.json"
META_CLAUDE="$ROOT_DIR/CLAUDE.md"
MERGE_SCRIPT="$SCRIPT_DIR/merge.sh"
DRY_RUN=false
TEMP_DIR=$(mktemp -d)

trap "rm -rf $TEMP_DIR" EXIT

if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "🔍 Dry-run Modus — keine Änderungen werden geschrieben"
fi

# Prüfe ob jq installiert ist
if ! command -v jq &> /dev/null; then
    echo "❌ jq ist erforderlich. Installiere mit: brew install jq / apt install jq"
    exit 1
fi

# Prüfe Config
GITHUB_USER=$(jq -r '.github_user' "$CONFIG")
if [[ -z "$GITHUB_USER" || "$GITHUB_USER" == "null" ]]; then
    echo "❌ github_user ist nicht konfiguriert. Führe zuerst ./templates/init-meta.sh aus."
    exit 1
fi

# Lese Sub-Projekte
SUB_COUNT=$(jq '.sub_projects | length' "$CONFIG")
if [[ "$SUB_COUNT" == "0" ]]; then
    echo "ℹ️  Keine Sub-Projekte registriert. Füge eins hinzu mit: ./templates/init-sub.sh <repo-name>"
    exit 0
fi

echo "📦 Synce Meta-CLAUDE.md in $SUB_COUNT Sub-Projekt(e)..."
echo ""

for i in $(seq 0 $((SUB_COUNT - 1))); do
    REPO=$(jq -r ".sub_projects[$i].repo" "$CONFIG")
    MARKER=$(jq -r ".sub_projects[$i].marker" "$CONFIG")
    REPO_NAME=$(basename "$REPO")

    echo "→ $REPO_NAME"

    # Klone Sub-Repo
    SUB_DIR="$TEMP_DIR/$REPO_NAME"
    if ! git clone --depth 1 "https://$REPO.git" "$SUB_DIR" 2>/dev/null; then
        echo "  ⚠️  Konnte $REPO nicht klonen — überspringe"
        continue
    fi

    SUB_CLAUDE="$SUB_DIR/CLAUDE.md"

    if [[ ! -f "$SUB_CLAUDE" ]]; then
        echo "  ⚠️  Keine CLAUDE.md gefunden in $REPO_NAME — überspringe"
        continue
    fi

    # Merge: Meta-Teil ersetzen, Projekt-Teil behalten
    bash "$MERGE_SCRIPT" "$META_CLAUDE" "$SUB_CLAUDE" "$MARKER"

    if $DRY_RUN; then
        echo "  📄 Würde aktualisieren:"
        head -5 "$SUB_CLAUDE"
        echo "  ..."
    else
        cd "$SUB_DIR"
        if git diff --quiet CLAUDE.md; then
            echo "  ✅ Bereits aktuell"
        else
            git add CLAUDE.md
            git commit -m "chore: sync CLAUDE.md from meta-repo"
            git push
            echo "  ✅ Gesynced und gepusht"
        fi
        cd "$ROOT_DIR"
    fi
    echo ""
done

echo "🎉 Sync abgeschlossen."
