# Claude Context Manager

Ein leichtgewichtiges Framework, das **Claude-Projekte über mehrere Repos und Umgebungen hinweg synchron hält** — ohne manuellen Aufwand.

## Das Problem

Wer mit Claude arbeitet, nutzt oft mehrere Umgebungen parallel:
- **Claude Web/Desktop** — Planung, Recherche, Dokumentation
- **Claude Code (VS Code/Terminal)** — Implementierung
- **Notion** — Team-Kollaboration, lebender Projektstatus, Stakeholder-Kommunikation

Jede Umgebung hat ihren eigenen Kontext. Es gibt keinen nativen Sync zwischen diesen Welten. Wissen geht verloren, Entscheidungen widersprechen sich, manueller Sync passiert nie.

## Die Lösung

Ein **Meta-Repo** als zentrale Wissensbasis mit automatischem Sync zu Sub-Projekt-Repos. Notion als dynamische Arbeitsumgebung. Claude entscheidet eigenständig, welche Informationen relevant sind und synced sie.

### Drei Schichten

| Schicht | Zweck | Sync |
|---------|-------|------|
| **Notion** | Dynamischer Arbeitsstatus, Stakeholder-Kommunikation, Specs | Live gelesen, nie gesynced |
| **Meta-Repo** | CLAUDE.md, Systemlandschaft, Leitprinzipien | Source of Truth |
| **Sub-Repos** | Themenspezifischer Code + eigene CLAUDE.md | Bidirektional mit Meta |

## Setup

### 1. Meta-Repo konfigurieren

```bash
git clone <dieses-repo> my-project-meta
cd my-project-meta
./templates/init-meta.sh
```

Das Init-Script fragt nach:
- GitHub-Username oder Organisation
- Projekt-Name
- Ob Notion-Integration aktiviert werden soll

### 2. Context-Dateien anpassen

Bearbeite die Dateien in `context/`:
- `systems.md` — Welche Systeme/APIs nutzt du?
- `credentials.md` — Wo liegen API-Keys? (nur Verweise, keine Secrets!)
- `team.md` — Wer ist beteiligt?
- `principles.md` — Tooling-Präferenzen, Leitprinzipien

### 3. Sub-Projekt hinzufügen

```bash
./templates/init-sub.sh <repo-name>
```

Das Script:
- Erstellt eine CLAUDE.md im Sub-Repo (erbt vom Meta)
- Registriert das Sub-Repo in `sync/config.json`
- Richtet den Sync-Marker ein

### 4. Claude Web/Desktop Projekt einrichten

- Erstelle ein Projekt in Claude Web/Desktop
- Verknüpfe das Meta-Repo über die GitHub-Integration als Projektdatei
- Claude hat damit automatisch Zugriff auf die Meta-CLAUDE.md und alle Context-Dateien

### 5. Notion MCP einrichten (empfohlen)

Claude Code braucht den Notion MCP Server für vollen Kontext-Zugriff:

```bash
# In deinem Sub-Repo oder Meta-Repo:
# .mcp.json erstellen/erweitern — siehe Notion MCP Dokumentation
```

Ohne Notion-Zugriff in Claude Code fehlt die halbe Kontext-Brücke.

## Sync-Verhalten

### Meta → Sub (automatisch)
GitHub Action pusht Änderungen an der Meta-CLAUDE.md in alle registrierten Sub-Repos.

### Sub → Meta (PR-basiert)
Claude erkennt meta-relevante Änderungen und erstellt PRs ans Meta-Repo. Der User reviewed kurz.

### Notion (live, kein Sync)
Notion wird bei Bedarf live gelesen. Die CLAUDE.md enthält nur den Verweis, nie den Inhalt.

## Projektstruktur

```
claude-context-manager/
├── CLAUDE.md              ← Meta-Anweisungen (gesynced in Sub-Repos)
├── context/
│   ├── systems.md         ← Systemlandschaft
│   ├── credentials.md     ← API-Key-Verweise (keine Secrets!)
│   ├── team.md            ← Rollen, Ansprechpartner
│   └── principles.md      ← Leitprinzipien, Tooling-Präferenzen
├── sync/
│   ├── config.json        ← Sub-Repo-Registrierung
│   ├── sync.sh            ← CLI-Sync Meta→Sub
│   └── merge.sh           ← Merge-Logik
├── .github/workflows/
│   └── sync-to-subs.yml   ← GitHub Action für Auto-Sync
└── templates/
    ├── init-meta.sh        ← Meta-Repo initialisieren
    ├── init-sub.sh         ← Neues Sub-Projekt aufsetzen
    └── sub-repo-CLAUDE.md  ← Template für Sub-Repo CLAUDE.md
```
