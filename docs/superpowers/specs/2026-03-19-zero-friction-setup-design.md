# Design: Zero-Friction Setup für Non-Tech User

**Datum:** 2026-03-19
**Status:** Pre-implementation spec — approved for implementation

## Kontext

CCM soll von Unternehmen eingesetzt werden, damit Wissen zentralisiert vorgehalten wird und alle Mitarbeiter automatisch darauf zugreifen. Aktuell ist die Installation zu komplex für non-technical Personen (manuelles jq-Install, PATH-Setup, GitHub-Wissen vorausgesetzt).

## Zielgruppe

| Rolle | Was sie tun | Technisches Niveau |
|-------|-------------|-------------------|
| Admin | `ccm init` + `ccm invite` — einmalig | Tech |
| Entwickler | `ccm add` im eigenen Repo | Tech |
| Non-Tech Mitarbeiter | Einen Befehl kopieren + `ccm add` | Kein Vorwissen |

## Änderungen

### 1. `install.sh` — drei Erweiterungen

**jq auto-install:**
- Prüft ob `jq` vorhanden ist
- Falls nicht: `brew install jq` wenn brew verfügbar, sonst statisches jq-Binary von GitHub Releases herunterladen nach `~/.ccm/bin/jq`
  - Architektur-Detection: `uname -m` → `arm64` → `jq-macos-arm64`, sonst `jq-macos-amd64`
  - Gepinnte Version: `jq-1.7.1` (stabil, kein `latest`)
  - Bei Download-Fehler: klarer Hinweis mit manueller Installationsanleitung, kein stiller Fehler
- **Reihenfolge kritisch:** jq wird zuerst installiert und `~/.ccm/bin` per `export PATH="$HOME/.ccm/bin:$PATH"` zum PATH der **aktuellen Script-Session** hinzugefügt (temporär, nur für diesen Install-Lauf), bevor irgendwelche jq-Aufrufe stattfinden. Dieser temporäre PATH-Eintrag wird **nicht** in Shell-Config geschrieben — nur `~/.local/bin` (für ccm) wird dauerhaft eingetragen.

**PATH auto-setup:**
- Prüft ob `~/.local/bin` im `$PATH` ist
- Falls nicht: schreibt `export PATH="$HOME/.local/bin:$PATH"` in die richtige Shell-Config
  - Shell-Detection: `basename "$SHELL"` → `zsh` → `~/.zshrc`, `bash` → `~/.bashrc`, sonst `~/.profile`
  - Dedupliziert: schreibt nur wenn der Export-Zeile noch nicht vorhanden ist
- Zeigt am Ende: *"Bitte Terminal neu starten um ccm zu nutzen."*
- **Wichtig:** Das Install-Script selbst nutzt nach dem Schreiben kein `ccm` mehr — alles läuft innerhalb des Scripts ohne PATH-Reload

**`CCM_META` env var:**
- Wenn `CCM_META=<git-url>` beim Install übergeben wird → klont das Meta-Repo nach `~/.ccm/meta/`
- **URL-Format: HTTPS** (`https://github.com/org/meta.git`) — nicht SSH, da non-tech User keine SSH-Keys haben
- `ccm invite` generiert daher HTTPS-URLs, nicht SSH
- Registriert den lokalen Pfad in `~/.ccm/config` via `set_meta_repo` (inline, kein separater ccm-Aufruf)
- Danach ist `ccm add` sofort nutzbar ohne jede Frage

### 2. Neuer Befehl: `ccm invite`

Wird im Meta-Repo ausgeführt. Voraussetzung: `ccm.json` im aktuellen Verzeichnis vorhanden (sonst: klarer Fehler "Kein Meta-Repo gefunden — führe ccm init aus").

Liest aus `ccm.json`: `github_user`, `meta_repo` (das SSH-URL-Feld), konvertiert zu HTTPS-URL für den Invite-Link. Liest `CCM_REPO` für die Install-Script-URL (Standard: `yves-s/claude-context-manager`).

**Output:**
```
👋 Teile diesen Befehl mit deinem Team:

  curl -fsSL https://raw.githubusercontent.com/yves-s/claude-context-manager/main/install.sh \
    | CCM_META=https://github.com/<org>/<meta>.git bash

Jedes Teammitglied führt danach im eigenen Projekt aus:
  ccm add
```

Keine Eingaben, keine Fragen — der Befehl ist vollständig aus `ccm.json` generiert.

### 3. `ccm add` — URL-Bestätigung entfernen

Aktuell fragt `cmd_add` nach Bestätigung der Repo-URL, obwohl diese bereits aus `ccm.json` (github_user) + Ordnername inferiert wird. Diese interaktive Frage entfällt. Der Befehl läuft ohne Eingabe durch.

**Fehlerfall falschesVerzeichnis:** Falls `pwd` kein Git-Repo ist, zeigt `ccm add` einen klaren Hinweis: "Kein Git-Repo gefunden. Navigiere zuerst in deinen Projektordner." (kein kryptischer git-Fehler).

## Mitarbeiter-Flow nach dieser Änderung

```
1. Admin schickt: curl -fsSL .../install.sh | CCM_META=https://github.com/org/meta.git bash
2. Mitarbeiter: Terminal öffnen, Befehl einfügen, Enter drücken
3. Mitarbeiter: Terminal neu starten
4. Mitarbeiter: Im Projektordner: ccm add
```

**4 Schritte. Keine einzige Frage. Kein Vorwissen nötig.**

## Nicht im Scope

- GitHub Actions / PAT Setup → bleibt "Advanced"
- Mac App / Web App → separater Spec
- Team Management UI → separater Spec
- Windows Support → nicht adressiert

## Dateien die sich ändern

| Datei | Änderung |
|-------|---------|
| `install.sh` | jq auto-install, PATH auto-setup, CCM_META support |
| `bin/ccm` | Neuer `invite` Befehl, `cmd_add` ohne URL-Frage, Git-Repo-Check |
| `lib/config.sh` | ggf. Anpassung falls inline set_meta_repo ohne jq-Binary-PATH nötig |
