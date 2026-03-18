# CLAUDE.md — Meta-Kontext

> Diese Datei ist die zentrale Wissensquelle für alle Claude-Umgebungen.
> Sie wird automatisch in alle Sub-Repos gesynced.
> Änderungen hier propagieren an alle verknüpften Projekte.

## Projektübersicht

**Projekt:** {{PROJECT_NAME}}
**GitHub:** {{GITHUB_USER}}
**Meta-Repo:** {{META_REPO_URL}}

## Systemlandschaft

Siehe `context/systems.md` für die vollständige Systemlandschaft.

## Leitprinzipien

Siehe `context/principles.md` für Tooling-Präferenzen und Leitprinzipien.

## Team & Rollen

Siehe `context/team.md` für Ansprechpartner und Verantwortlichkeiten.

## Credentials

Siehe `context/credentials.md` für API-Key-Verweise.
**Keine Secrets in Dateien speichern** — nur Verweise auf 1Password, Vault, oder Umgebungsvariablen.

---

## Notion — Dynamische Arbeitsumgebung

Notion ist die **Source of Truth für alles Dynamische**.

**Regel:** Lies Notion für aktuellen Projektstatus. Speichere hier nie Notion-Inhalte als Kopie — immer live abrufen.

---

## Auto-Sync Regeln

### Claude aktualisiert das Meta-Repo eigenständig wenn:
- Neues Tool oder System wird eingeführt
- Architekturentscheidung die mehrere Sub-Projekte betrifft
- API-Zugänge ändern sich
- Neues Team-Mitglied oder Rollenänderung
- Tooling-Präferenz ändert sich

### Claude aktualisiert NICHT für:
- Themenspezifische Code-Entscheidungen
- Temporäre Workarounds
- Zwischenstände ohne Entscheidung
