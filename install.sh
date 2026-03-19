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
curl -fsSL "$CCM_RAW/lib/config.sh" -o "$HOME/.ccm/lib/config.sh"
curl -fsSL "$CCM_RAW/lib/merge.sh" -o "$HOME/.ccm/lib/merge.sh"

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

echo "✅ ccm installed to $INSTALL_DIR/ccm"
echo ""

# Detect shell config file (used by both PATH blocks below)
SHELL_NAME=$(basename "$SHELL")
case "$SHELL_NAME" in
  zsh)  RC_FILE="$HOME/.zshrc" ;;
  bash) RC_FILE="$HOME/.bashrc" ;;
  *)    RC_FILE="$HOME/.profile" ;;
esac

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  EXPORT_LINE="export PATH=\"$INSTALL_DIR:\$PATH\""
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
if [[ -d "$HOME/.ccm/bin" ]] && [[ ":$PATH:" != *":$HOME/.ccm/bin:"* ]]; then
  CCM_BIN_LINE="export PATH=\"\$HOME/.ccm/bin:\$PATH\""
  if ! grep -qF "$CCM_BIN_LINE" "$RC_FILE" 2>/dev/null; then
    echo "" >> "$RC_FILE"
    echo "# ccm" >> "$RC_FILE"
    echo "$CCM_BIN_LINE" >> "$RC_FILE"
  fi
fi
echo "Get started:"
echo "  mkdir my-project-meta && cd my-project-meta && git init"
echo "  ccm init"
