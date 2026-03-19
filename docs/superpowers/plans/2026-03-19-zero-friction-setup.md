# Zero-Friction Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CCM installable and usable by non-technical team members with a single copy-paste command.

**Architecture:** Three independent changes to two files — `install.sh` gets jq auto-install, auto-PATH, and CCM_META clone support; `bin/ccm` gets a new `invite` command and a simplified `cmd_add` without interactive prompts.

**Tech Stack:** Bash, jq, git, curl

---

## File Map

| File | Change |
|------|--------|
| `install.sh` | jq auto-install (brew or static binary), PATH auto-setup, CCM_META clone |
| `bin/ccm` | New `cmd_invite`, `cmd_add` without URL prompt, git-repo check in `cmd_add` |

---

## Task 1: `install.sh` — jq auto-install

**Files:**
- Modify: `install.sh`

Currently `install.sh` exits with an error if `jq` is missing. This task replaces that with auto-install.

- [ ] **Step 1: Read the current install.sh**

```bash
cat install.sh
```

Expected: see the `for dep in git jq` loop at lines 10–15.

- [ ] **Step 2: Replace the jq dependency check with auto-install**

Replace this block in `install.sh`:

```bash
for dep in git jq; do
  if ! command -v "$dep" &>/dev/null; then
    echo "❌ Required: $dep — install with: brew install $dep"
    exit 1
  fi
done
```

With this:

```bash
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
```

- [ ] **Step 3: Verify manually — jq already installed path**

```bash
# Simulate jq already installed: just run install.sh normally
bash install.sh
```

Expected: no mention of jq, installs as before.

- [ ] **Step 4: Verify manually — brew path**

```bash
# Rename jq temporarily to force the brew branch (only on machine with brew)
# Just verify the logic by reading it — no need to break your system
```

- [ ] **Step 5: Commit**

```bash
git add install.sh
git commit -m "feat(install): auto-install jq via brew or static binary"
```

---

## Task 2: `install.sh` — PATH auto-setup

**Files:**
- Modify: `install.sh`

Currently the script prints a manual instruction to add `~/.local/bin` to PATH. This task writes it automatically.

- [ ] **Step 1: Find the current PATH warning block in install.sh**

It's at lines 38–42:
```bash
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  echo "⚠️  Add to your PATH (add to ~/.zshrc or ~/.bashrc):"
  echo "   export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo ""
fi
```

- [ ] **Step 2: Replace the PATH warning with auto-write**

Replace the block above with:

```bash
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  # Detect shell config file
  SHELL_NAME=$(basename "$SHELL")
  case "$SHELL_NAME" in
    zsh)  RC_FILE="$HOME/.zshrc" ;;
    bash) RC_FILE="$HOME/.bashrc" ;;
    *)    RC_FILE="$HOME/.profile" ;;
  esac

  EXPORT_LINE="export PATH=\"\$HOME/.local/bin:\$PATH\""
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
```

- [ ] **Step 3: Verify manually**

```bash
# Temporarily rename ~/.zshrc to force a clean test
# Or just run: bash install.sh and check ~/.zshrc for the new line
grep "\.local/bin" ~/.zshrc
```

Expected: `export PATH="$HOME/.local/bin:$PATH"` appears exactly once.

Run a second time:
```bash
bash install.sh
grep -c "\.local/bin" ~/.zshrc
```

Expected: count is still 1 (deduplication works).

- [ ] **Step 4: Commit**

```bash
git add install.sh
git commit -m "feat(install): auto-write PATH to shell config"
```

---

## Task 3: `install.sh` — CCM_META clone support

**Files:**
- Modify: `install.sh`

When `CCM_META` env var is set, clone the meta-repo and register it in `~/.ccm/config`.

- [ ] **Step 1: Replace the final echo block in install.sh**

Replace lines 36–46 (the `echo "✅ ccm installed"` through `echo "  ccm init"` block) with:

```bash
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
  mkdir -p "$HOME/.ccm"
  if [[ -f "$HOME/.ccm/config" ]]; then
    jq --arg p "$META_CLONE_DIR" '.default_meta = $p' "$HOME/.ccm/config" \
      > "$HOME/.ccm/config.tmp" && mv "$HOME/.ccm/config.tmp" "$HOME/.ccm/config"
  else
    jq -n --arg p "$META_CLONE_DIR" '{default_meta: $p}' > "$HOME/.ccm/config"
  fi
  echo "✅ Meta-Repo verknüpft: $META_CLONE_DIR"
fi

echo "✅ ccm installiert nach $INSTALL_DIR/ccm"
echo ""
if [[ -n "${CCM_META:-}" ]]; then
  echo "Bereit! Führe in deinem Projekt aus:"
  echo "  ccm add"
else
  echo "Erste Schritte:"
  echo "  mkdir my-meta && cd my-meta && git init"
  echo "  ccm init"
fi
```

Remove the old final echo block (lines 36–46 in original).

- [ ] **Step 2: Verify manually — without CCM_META**

```bash
bash install.sh
```

Expected: normal install, no clone, "Erste Schritte: ccm init" output.

- [ ] **Step 3: Verify manually — with CCM_META**

```bash
# Use a real public repo as test
CCM_META=https://github.com/yves-s/claude-context-manager.git bash install.sh
```

Expected: clones to `~/.ccm/meta/`, creates `~/.ccm/config`, shows "ccm add" hint.

Check:
```bash
cat ~/.ccm/config
# Expected: {"default_meta":"/Users/<you>/.ccm/meta"}
```

- [ ] **Step 4: Verify idempotency — run again with same CCM_META**

```bash
CCM_META=https://github.com/yves-s/claude-context-manager.git bash install.sh
```

Expected: "Meta-Repo bereits vorhanden, überspringe Clone" — no error.

- [ ] **Step 5: Commit**

```bash
git add install.sh
git commit -m "feat(install): support CCM_META env var to pre-configure meta-repo"
```

---

## Task 4: `bin/ccm` — `ccm invite` command

**Files:**
- Modify: `bin/ccm`

New command that generates a ready-to-share install one-liner for team members.

- [ ] **Step 1: Add `cmd_invite` function to bin/ccm**

Insert after `cmd_add()` (after line 157) and before `cmd_hooks()`:

```bash
cmd_invite() {
  if [[ ! -f "ccm.json" ]]; then
    echo "❌ Kein Meta-Repo gefunden."
    echo "   Führe 'ccm init' in deinem Meta-Repo aus."
    exit 1
  fi

  GITHUB_USER=$(jq -r '.github_user' ccm.json)
  META_REPO_SSH=$(jq -r '.meta_repo' ccm.json)

  # Convert SSH URL to HTTPS (non-tech users have no SSH keys)
  # git@github.com:org/repo.git → https://github.com/org/repo.git
  META_REPO_HTTPS=$(echo "$META_REPO_SSH" \
    | sed 's|git@github.com:|https://github.com/|')

  INSTALL_URL="https://raw.githubusercontent.com/${CCM_REPO}/main/install.sh"

  echo ""
  echo "👋 Teile diesen Befehl mit deinem Team:"
  echo ""
  echo "  curl -fsSL $INSTALL_URL \\"
  echo "    | CCM_META=$META_REPO_HTTPS bash"
  echo ""
  echo "Jedes Teammitglied führt danach im eigenen Projektordner aus:"
  echo "  ccm add"
  echo ""
}
```

- [ ] **Step 2: Register `invite` in the dispatch table**

Find the `case` block at the bottom of `bin/ccm` (around line 222):

```bash
case "${1:-}" in
  init)    cmd_init ;;
  add)     cmd_add ;;
  flush)   cmd_flush ;;
  hooks)   cmd_hooks "${2:-}" ;;
  version) echo "ccm $CCM_VERSION" ;;
```

Add `invite` line:

```bash
case "${1:-}" in
  init)    cmd_init ;;
  add)     cmd_add ;;
  invite)  cmd_invite ;;
  flush)   cmd_flush ;;
  hooks)   cmd_hooks "${2:-}" ;;
  version) echo "ccm $CCM_VERSION" ;;
```

- [ ] **Step 3: Add `invite` to the help text**

Find the `*)` block:

```bash
  echo "  init     Meta-Repo im aktuellen Verzeichnis einrichten"
  echo "  add      Dieses Projekt als Sub-Repo registrieren"
```

Add after `add`:

```bash
  echo "  invite   Team-Einladungsbefehl generieren"
```

- [ ] **Step 4: Verify manually — error case (not in meta-repo)**

```bash
cd /tmp && ccm invite
```

Expected: `❌ Kein Meta-Repo gefunden.`

- [ ] **Step 5: Verify manually — happy path**

```bash
cd /path/to/your/meta-repo   # must have ccm.json
ccm invite
```

Expected output:
```
👋 Teile diesen Befehl mit deinem Team:

  curl -fsSL https://raw.githubusercontent.com/yves-s/claude-context-manager/main/install.sh \
    | CCM_META=https://github.com/<org>/<meta>.git bash

Jedes Teammitglied führt danach im eigenen Projektordner aus:
  ccm add
```

Verify HTTPS (not SSH) in the output URL.

- [ ] **Step 6: Commit**

```bash
git add bin/ccm
git commit -m "feat(ccm): add invite command to generate team install one-liner"
```

---

## Task 5: `bin/ccm` — simplify `cmd_add`

**Files:**
- Modify: `bin/ccm`

Remove the interactive URL prompt and add a friendly git-repo check.

- [ ] **Step 1: Find the interactive block in cmd_add**

In `bin/ccm` around lines 104–115:

```bash
  if [[ "${CCM_NON_INTERACTIVE:-}" == "1" ]]; then
    REPO_NAME="$CCM_REPO_NAME"
    REPO_URL="$CCM_REPO_URL"
  else
    REPO_NAME=$(basename "$(pwd)")
    GITHUB_USER=$(jq -r '.github_user' "$META_CONFIG")
    REPO_URL="git@github.com:$GITHUB_USER/$REPO_NAME.git"
    echo "🔗 Sub-Projekt registrieren"
    echo "   Meta-Repo: $META_PATH"
    read -rp "   Repo-URL [$REPO_URL]: " _URL
    REPO_URL="${_URL:-$REPO_URL}"
  fi
```

- [ ] **Step 2: Replace with non-interactive version + git-repo check**

```bash
  # Verify we're inside a git repo
  if ! git rev-parse --git-dir &>/dev/null; then
    echo "❌ Kein Git-Repo gefunden."
    echo "   Navigiere zuerst in deinen Projektordner."
    exit 1
  fi

  if [[ "${CCM_NON_INTERACTIVE:-}" == "1" ]]; then
    REPO_NAME="$CCM_REPO_NAME"
    REPO_URL="$CCM_REPO_URL"
  else
    REPO_NAME=$(basename "$(pwd)")
    GITHUB_USER=$(jq -r '.github_user' "$META_CONFIG")
    REPO_URL="git@github.com:$GITHUB_USER/$REPO_NAME.git"
    echo "🔗 Sub-Projekt registrieren"
    echo "   Meta-Repo: $META_PATH"
    echo "   Repo:      $REPO_URL"
  fi
```

- [ ] **Step 3: Verify manually — error case (not in git repo)**

```bash
cd /tmp && ccm add
```

Expected: `❌ Kein Git-Repo gefunden.`

- [ ] **Step 4: Verify manually — happy path**

```bash
cd /path/to/a/git/repo
ccm add
```

Expected: runs without prompting, shows result with Repo-URL in the output. No interactive input required.

- [ ] **Step 5: Commit**

```bash
git add bin/ccm
git commit -m "feat(ccm): remove interactive URL prompt from ccm add, add git-repo check"
```

---

## Final Verification

- [ ] **End-to-end test — full non-tech user flow**

```bash
# Simulate the admin flow
cd ~/some-meta-repo   # must have been ccm init'd
ccm invite
# Copy the output command

# Simulate the employee flow (in a new terminal / clean env)
curl -fsSL https://raw.githubusercontent.com/yves-s/claude-context-manager/main/install.sh \
  | CCM_META=https://github.com/<your-org>/<meta>.git bash

# Open new terminal, then:
cd ~/some-project
git init   # if needed
ccm add
```

Expected: CLAUDE.md created, .ccm created, no questions asked at any point.
