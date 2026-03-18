# Claude Context Manager (ccm)

Ein leichtgewichtiges CLI, das **Claude-Projekte über mehrere Repos hinweg synchron hält**.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/yves-s/claude-context-manager/main/install.sh | bash
```

Voraussetzungen: `git`, `jq` (`brew install git jq`)

## Setup

```bash
# 1. Meta-Repo erstellen (einmalig pro Workspace)
mkdir my-project-meta && cd my-project-meta && git init
ccm init

# 2. Sub-Projekt registrieren (pro Projekt)
cd ~/my-other-project
ccm add
```

## Wie es funktioniert

| Schicht | Zweck | Sync |
|---------|-------|------|
| Meta-Repo | CLAUDE.md, Systemlandschaft, Leitprinzipien | Source of Truth |
| Sub-Repos | Eigene CLAUDE.md (erbt vom Meta) | Automatisch via GitHub Action |
| Notion | Dynamischer Arbeitsstatus | Live gelesen, nie gesynced |

Wenn du auf das Meta-Repo pushst, synct eine GitHub Action die `CLAUDE.md` automatisch in alle registrierten Sub-Repos — der projektspezifische Bereich unterhalb von `<!-- PROJECT CONTEXT BELOW -->` bleibt erhalten.

## GitHub Action — PAT erforderlich für Sub-Repo Pushes

Der eingebaute `GITHUB_TOKEN` hat nur Schreibzugriff auf das eigene Repo. Um CLAUDE.md in andere Repos zu pushen, benötigst du ein Personal Access Token (PAT) mit `repo` Scope:

1. Erstelle ein PAT unter GitHub → Settings → Developer settings → Personal access tokens
2. Füge es als Secret `CCM_TOKEN` im Meta-Repo hinzu (Settings → Secrets → Actions)
3. Passe `.github/workflows/sync.yml` an: ersetze `secrets: inherit` mit `secrets: { GH_TOKEN: ${{ secrets.CCM_TOKEN }} }`
