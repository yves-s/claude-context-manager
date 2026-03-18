#!/bin/bash
set -euo pipefail

# init-sub.sh — Registriert ein neues Sub-Projekt und erstellt dessen CLAUDE.md
# Usage: ./templates/init-sub.sh <repo-name> [--local <path>]
#
# Optionen:
#   <repo-name>       Name des Sub-Repos (z.B. "easybill-migration")
#   --local <path>    Pfad zum lokalen Checkout des Sub-Repos
#                     Wenn nicht angegeben, wird nur in config.json registriert

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG="$ROOT_DIR/sync/config.json"
TEMPLATE="$SCRIPT_DIR/sub-repo-CLAUDE.md"
META_CLAUDE="$ROOT_DIR/CLAUDE.md"
MARKER="<!-- PROJECT CONTEXT BELOW -->"

if [[ -z "${1:-}" ]]; then
    echo "Usage: ./templates/init-sub.sh <repo-name> [--local <path>]"
    echo ""
    echo "Beispiel:"
    echo "  ./templates/init-sub.sh easybill-migration"
    echo "  ./templates/init-sub.sh easybill-migration --local ../easybill-migration"
    exit 1
fi

REPO_NAME="$1"
LOCAL_PATH=""

if [[ "${2:-}" == "--local" && -n "${3:-}" ]]; then
    LOCAL_PATH="$3"
fi

# Prüfe Config
if ! command -v jq &> /dev/null; then
    echo "❌ jq ist erforderlich. Installiere mit: brew install jq / apt install jq"
    exit 1
fi

GITHUB_USER=$(jq -r '.github_user' "$CONFIG")
if [[ -z "$GITHUB_USER" || "$GITHUB_USER" == "null" ]]; then
    echo "❌ github_user nicht konfiguriert. Führe zuerst ./templates/init-meta.sh aus."
    exit 1
fi

REPO_URL="github.com/$GITHUB_USER/$REPO_NAME"

# Prüfe ob schon registriert
EXISTING=$(jq -r --arg repo "$REPO_URL" '.sub_projects[] | select(.repo == $repo) | .repo' "$CONFIG")
if [[ -n "$EXISTING" ]]; then
    echo "⚠️  $REPO_NAME ist bereits registriert in config.json"
    exit 1
fi

# In config.json registrieren
jq --arg repo "$REPO_URL" --arg marker "$MARKER" \
   '.sub_projects += [{"repo": $repo, "sync_files": ["CLAUDE.md"], "merge_strategy": "prepend_meta", "marker": $marker}]' \
   "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"

echo "✅ $REPO_NAME registriert in config.json"

# CLAUDE.md erstellen wenn lokaler Pfad angegeben
if [[ -n "$LOCAL_PATH" ]]; then
    if [[ ! -d "$LOCAL_PATH" ]]; then
        echo "❌ Verzeichnis nicht gefunden: $LOCAL_PATH"
        exit 1
    fi

    TARGET="$LOCAL_PATH/CLAUDE.md"

    if [[ -f "$TARGET" ]]; then
        echo "⚠️  CLAUDE.md existiert bereits in $LOCAL_PATH"
        read -p "   Bestehenden Projekt-Kontext behalten und Meta-Teil voranstellen? (y/n): " KEEP
        if [[ "$KEEP" == "y" || "$KEEP" == "Y" ]]; then
            EXISTING_CONTENT=$(cat "$TARGET")
            {
                cat "$META_CLAUDE"
                echo ""
                echo "---"
                echo ""
                echo "$MARKER"
                echo ""
                echo "$EXISTING_CONTENT"
            } > "$TARGET"
            echo "✅ Meta-Teil vorangestellt, bestehender Inhalt erhalten"
        else
            echo "   Übersprungen — CLAUDE.md bleibt unverändert"
        fi
    else
        # Neue CLAUDE.md aus Template + Meta erstellen
        {
            cat "$META_CLAUDE"
            echo ""
            echo "---"
            echo ""
            sed "s|{{REPO_NAME}}|$REPO_NAME|g; s|{{REPO_URL}}|$REPO_URL|g" "$TEMPLATE"
        } > "$TARGET"
        echo "✅ CLAUDE.md erstellt in $LOCAL_PATH"
    fi
fi

echo ""
echo "Nächste Schritte:"
echo "  1. Sub-Repo CLAUDE.md anpassen (Projekt-spezifischer Kontext)"
if [[ -z "$LOCAL_PATH" ]]; then
    echo "  2. CLAUDE.md im Sub-Repo erstellen:"
    echo "     ./templates/init-sub.sh $REPO_NAME --local <pfad-zum-repo>"
fi
echo "  3. Sync testen: ./sync/sync.sh --dry-run"
