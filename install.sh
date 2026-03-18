#!/bin/bash
set -euo pipefail

CCM_REPO="${CCM_REPO:-yves-s/claude-context-manager}"
CCM_RAW="${CCM_RAW:-https://raw.githubusercontent.com/$CCM_REPO/main}"
INSTALL_DIR="${CCM_INSTALL_DIR:-/usr/local/bin}"

echo "Installing ccm..."

for dep in git jq; do
  if ! command -v "$dep" &>/dev/null; then
    echo "❌ Required: $dep — install with: brew install $dep"
    exit 1
  fi
done

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
echo "Get started:"
echo "  mkdir my-project-meta && cd my-project-meta && git init"
echo "  ccm init"
