# CLAUDE.md — Meta-Kontext

> Diese Datei ist die zentrale Wissensquelle für alle Claude-Umgebungen.
> Sie wird automatisch in alle Sub-Repos gesynced.
> Änderungen hier propagieren an alle verknüpften Projekte.

## Projektübersicht

<!-- Wird während init-meta.sh ausgefüllt -->
**Projekt:** [PROJEKT_NAME]
**GitHub:** [GITHUB_USER_OR_ORG]
**Meta-Repo:** [META_REPO_URL]

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

Notion ist die **Source of Truth für alles Dynamische**. Nicht nur Tasks, sondern:
- Konfigurationslogs (was ist erledigt, was offen)
- Recherche-Ergebnisse und Entscheidungen
- Fragen an Stakeholder (mit Antwort-Feldern)
- Technische Specs, Field-Mappings, API-Verhalten
- Team-Kommunikation (async über Kommentare/geteilte Seiten)

**Warum Notion?** Es ist die einzige Schicht, die von Nicht-Claude-Nutzern (Stakeholder, Buchhalter, externe Partner) gelesen und bearbeitet werden kann.

**Zugriff:**
- Claude Web/Desktop: Nativer Notion-Zugriff via MCP
- Claude Code: Notion MCP Server in `.mcp.json` konfigurieren

**Regel:** Lies Notion für aktuellen Projektstatus. Speichere hier nie Notion-Inhalte als Kopie — immer live abrufen.

---

## Auto-Sync Regeln

### Claude aktualisiert das Meta-Repo eigenständig wenn:
- Neues Tool oder System wird eingeführt
- Architekturentscheidung die mehrere Sub-Projekte betrifft
- API-Zugänge ändern sich (den Verweis aktualisieren, nicht den Key!)
- Neues Team-Mitglied oder Rollenänderung
- Tooling-Präferenz ändert sich (z.B. "wir nutzen jetzt X statt Y")

### Claude aktualisiert Notion eigenständig wenn:
- Konfiguration geändert wurde
- Entscheidung mit Stakeholder getroffen wurde
- Offener Punkt erledigt oder neuer Punkt entstanden ist
- Recherche-Ergebnis vorliegt das für das Team relevant ist

### Claude aktualisiert NICHT für:
- Themenspezifische Code-Entscheidungen (bleiben im Sub-Repo)
- Temporäre Workarounds
- Zwischenstände ohne Entscheidung

### Wie Claude synced (je nach Umgebung):
- **Claude Code:** Git commit + push auf Meta-Repo, oder Notion MCP für dynamische Updates
- **Claude Web/Desktop:** Notion direkt aktualisieren. Für Meta-Repo-Änderungen → Änderung vorschlagen, User pushed
- **Hooks (optional):** Post-Session-Hook prüft ob CLAUDE.md geändert wurde → automatischer PR ans Meta-Repo

---

## Sub-Projekte

Registrierte Sub-Projekte werden in `sync/config.json` verwaltet.
Jedes Sub-Repo hat eine eigene CLAUDE.md die aus zwei Teilen besteht:
1. **Meta-Kontext** (oben) — automatisch gesynced von diesem Repo
2. **Projekt-Kontext** (unten, ab `<!-- PROJECT CONTEXT BELOW -->`) — projektspezifisch, bleibt beim Sync erhalten
