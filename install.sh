#!/bin/bash
set -euo pipefail

CCM_REPO="${CCM_REPO:-yves-s/claude-context-manager}"
CCM_RAW="${CCM_RAW:-https://raw.githubusercontent.com/$CCM_REPO/main}"
INSTALL_DIR="${CCM_INSTALL_DIR:-$HOME/.local/bin}"

echo "Installing ccm..."

# git is still required (no auto-install)
if ! command -v git &>/dev/null; then
  echo "❌ git ist erforderlich. Installiere es von https://git-scm.com"
  exit 1
fi

# jq: auto-install if missing
if ! command -v jq &>/dev/null; then
  if command -v brew &>/dev/null; then
    echo "→ Installiere jq via brew..."
    brew install jq
  else
    echo "→ Lade jq herunter..."
    JQ_DIR="$HOME/.ccm/bin"
    mkdir -p "$JQ_DIR"
    ARCH=$(uname -m)
    if [[ "$ARCH" == "arm64" ]]; then
      JQ_BINARY="jq-macos-arm64"
    else
      JQ_BINARY="jq-macos-amd64"
    fi
    JQ_URL="https://github.com/jqlang/jq/releases/download/jq-1.7.1/${JQ_BINARY}"
    if ! curl -fsSL "$JQ_URL" -o "$JQ_DIR/jq"; then
      echo "❌ jq konnte nicht heruntergeladen werden."
      echo "   Installiere es manuell: brew install jq"
      exit 1
    fi
    chmod +x "$JQ_DIR/jq"
    # Add to PATH for this script session only
    export PATH="$JQ_DIR:$PATH"
    echo "✅ jq installiert ($JQ_DIR/jq)"
  fi
fi

mkdir -p "$INSTALL_DIR"
curl -fsSL "$CCM_RAW/bin/ccm" -o "$INSTALL_DIR/ccm"
chmod +x "$INSTALL_DIR/ccm"

mkdir -p "$HOME/.ccm/lib"
curl -fsSL "$CCM_RAW/lib/config.sh"  -o "$HOME/.ccm/lib/config.sh"
curl -fsSL "$CCM_RAW/lib/merge.sh"   -o "$HOME/.ccm/lib/merge.sh"
curl -fsSL "$CCM_RAW/lib/buffer.sh"  -o "$HOME/.ccm/lib/buffer.sh"
curl -fsSL "$CCM_RAW/lib/flush.sh"   -o "$HOME/.ccm/lib/flush.sh"

mkdir -p "$HOME/.ccm/hooks"
curl -fsSL "$CCM_RAW/hooks/post-tool-use.sh" -o "$HOME/.ccm/hooks/post-tool-use.sh"
curl -fsSL "$CCM_RAW/hooks/stop.sh"          -o "$HOME/.ccm/hooks/stop.sh"
chmod +x "$HOME/.ccm/hooks/post-tool-use.sh" "$HOME/.ccm/hooks/stop.sh"

mkdir -p "$HOME/.ccm/templates/meta/context" "$HOME/.ccm/templates/sub"
for f in CLAUDE.md ccm.json github-workflow.yml; do
  curl -fsSL "$CCM_RAW/templates/meta/$f" -o "$HOME/.ccm/templates/meta/$f"
done
for f in systems.md credentials.md team.md principles.md; do
  curl -fsSL "$CCM_RAW/templates/meta/context/$f" -o "$HOME/.ccm/templates/meta/context/$f"
done
for f in CLAUDE.md dot-ccm; do
  curl -fsSL "$CCM_RAW/templates/sub/$f" -o "$HOME/.ccm/templates/sub/$f"
done

# Detect shell config file (used by both PATH blocks below)
SHELL_NAME=$(basename "$SHELL")
case "$SHELL_NAME" in
  zsh)  RC_FILE="$HOME/.zshrc" ;;
  bash) RC_FILE="$HOME/.bashrc" ;;
  *)    RC_FILE="$HOME/.profile" ;;
esac

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  EXPORT_LINE='export PATH="$HOME/.local/bin:$PATH"'
  if ! grep -qF "$EXPORT_LINE" "$RC_FILE" 2>/dev/null; then
    echo "" >> "$RC_FILE"
    echo "# ccm" >> "$RC_FILE"
    echo "$EXPORT_LINE" >> "$RC_FILE"
    echo "→ PATH aktualisiert in $RC_FILE"
  fi
  echo ""
  echo "⚠️  Bitte Terminal neu starten um ccm zu nutzen."
  echo ""
fi

# Also persist ~/.ccm/bin to PATH if jq was downloaded there
if [[ -f "$HOME/.ccm/bin/jq" ]] && [[ ":$PATH:" != *":$HOME/.ccm/bin:"* ]]; then
  CCM_BIN_LINE="export PATH=\"\$HOME/.ccm/bin:\$PATH\""
  if ! grep -qF "$CCM_BIN_LINE" "$RC_FILE" 2>/dev/null; then
    echo "" >> "$RC_FILE"
    echo "# ccm" >> "$RC_FILE"
    echo "$CCM_BIN_LINE" >> "$RC_FILE"
    echo "→ PATH aktualisiert in $RC_FILE (ccm/bin)"
  fi
fi

# If CCM_META is set: clone meta-repo and register it
if [[ -n "${CCM_META:-}" ]]; then
  META_CLONE_DIR="$HOME/.ccm/meta"
  if [[ -d "$META_CLONE_DIR/.git" ]]; then
    echo "→ Meta-Repo bereits vorhanden, überspringe Clone"
  else
    echo "→ Clone Meta-Repo nach $META_CLONE_DIR ..."
    if ! git clone "$CCM_META" "$META_CLONE_DIR"; then
      echo "❌ Clone fehlgeschlagen. Prüfe die URL: $CCM_META"
      exit 1
    fi
  fi
  # Register meta-repo path in ~/.ccm/config (inline, no ccm call needed)
  if [[ -f "$HOME/.ccm/config" ]]; then
    jq --arg p "$META_CLONE_DIR" '.default_meta = $p' "$HOME/.ccm/config" \
      > "$HOME/.ccm/config.tmp" && mv "$HOME/.ccm/config.tmp" "$HOME/.ccm/config"
  else
    jq -n --arg p "$META_CLONE_DIR" '{default_meta: $p}' > "$HOME/.ccm/config"
  fi
  echo "✅ Meta-Repo verknüpft: $META_CLONE_DIR"
fi

# Install Claude Code hooks
"$INSTALL_DIR/ccm" hooks install

echo ""
echo "✅ ccm installiert nach $INSTALL_DIR/ccm"
echo ""
if [[ -n "${CCM_META:-}" ]]; then
  echo "Bereit! Führe in deinem Projekt aus:"
  echo "  ccm add"
else
  echo "Erste Schritte:"
  echo "  mkdir my-meta && cd my-meta"
  echo "  ccm init"
fi
