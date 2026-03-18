#!/bin/bash
set -euo pipefail

# init-meta.sh — Initialisiert das Meta-Repo mit deiner Konfiguration
# Usage: ./templates/init-meta.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG="$ROOT_DIR/sync/config.json"
CLAUDE_MD="$ROOT_DIR/CLAUDE.md"

echo "🚀 Claude Context Manager — Setup"
echo "=================================="
echo ""

# GitHub User/Org
read -p "GitHub Username oder Organisation: " GITHUB_USER
if [[ -z "$GITHUB_USER" ]]; then
    echo "❌ GitHub User ist erforderlich."
    exit 1
fi

# Projekt-Name
read -p "Projektname (für README/CLAUDE.md): " PROJECT_NAME
PROJECT_NAME="${PROJECT_NAME:-Mein Projekt}"

# Repo-Name (aktuelles Verzeichnis)
REPO_NAME=$(basename "$ROOT_DIR")
META_REPO_URL="github.com/$GITHUB_USER/$REPO_NAME"

# Notion
read -p "Notion-Integration aktivieren? (y/n): " NOTION_ENABLED
if [[ "$NOTION_ENABLED" == "y" || "$NOTION_ENABLED" == "Y" ]]; then
    NOTION_BOOL=true
    echo ""
    echo "📝 Notion MCP Setup-Hinweis:"
    echo "   Für Claude Code: Notion MCP Server in .mcp.json konfigurieren"
    echo "   Für Claude Web/Desktop: Notion-Integration in den Projekteinstellungen aktivieren"
    echo ""
else
    NOTION_BOOL=false
fi

# Config aktualisieren
if command -v jq &> /dev/null; then
    jq --arg user "$GITHUB_USER" \
       --arg repo "$META_REPO_URL" \
       --argjson notion "$NOTION_BOOL" \
       '.github_user = $user | .meta_repo = $repo | .notion.enabled = $notion' \
       "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
else
    echo "⚠️  jq nicht installiert — config.json muss manuell bearbeitet werden"
fi

# CLAUDE.md Platzhalter ersetzen
sed -i.bak "s|\[PROJEKT_NAME\]|$PROJECT_NAME|g" "$CLAUDE_MD"
sed -i.bak "s|\[GITHUB_USER_OR_ORG\]|$GITHUB_USER|g" "$CLAUDE_MD"
sed -i.bak "s|\[META_REPO_URL\]|https://$META_REPO_URL|g" "$CLAUDE_MD"
rm -f "$CLAUDE_MD.bak"

echo ""
echo "✅ Meta-Repo konfiguriert:"
echo "   GitHub:  $GITHUB_USER"
echo "   Projekt: $PROJECT_NAME"
echo "   Repo:    $META_REPO_URL"
echo "   Notion:  $NOTION_BOOL"
echo ""
echo "Nächste Schritte:"
echo "  1. Bearbeite die Dateien in context/ (systems.md, team.md, etc.)"
echo "  2. Füge ein Sub-Projekt hinzu: ./templates/init-sub.sh <repo-name>"
echo "  3. Richte ein Claude Web/Desktop Projekt ein und verknüpfe dieses Repo"
if [[ "$NOTION_BOOL" == "true" ]]; then
    echo "  4. Konfiguriere den Notion MCP Server für Claude Code"
fi
