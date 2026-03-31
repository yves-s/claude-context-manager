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

## Unternehmenswissen (Knowledge Base)

Siehe `knowledge/` für das zentrale Unternehmenswissen:

- `knowledge/brand/` — Styleguide, Tonalität, Farben & Schriften
- `knowledge/marketing/` — Winning Ads, Campaign-Insights
- `knowledge/customers/` — Kundenbewertungen, Personas
- `knowledge/assets/` — Original-Dateien (PDFs, Bilder)
- `knowledge/_inbox/` — Neue Dateien hier ablegen → Claude verarbeitet & strukturiert sie

### Workflow für neue Wissensinhalte
1. Datei in `knowledge/_inbox/` ablegen **oder** Inhalt direkt in den Chat einfügen
2. Claude liest, analysiert und extrahiert das Kernwissen
3. Strukturiertes Markdown wird in den richtigen Ordner geschrieben
4. Original-Datei wird nach `knowledge/assets/` verschoben

### Session-Start: Inbox prüfen
Bei jeder neuen Session: Prüfe ob `knowledge/_inbox/` Dateien enthält.
Wenn ja, weise proaktiv darauf hin und biete an, sie zu verarbeiten.

---

## Auto-Sync Regeln

### Claude aktualisiert das Meta-Repo eigenständig wenn:
- Neues Tool oder System wird eingeführt
- Architekturentscheidung die mehrere Sub-Projekte betrifft
- API-Zugänge ändern sich
- Neues Team-Mitglied oder Rollenänderung
- Tooling-Präferenz ändert sich
- Neue Marken- oder Marketing-Erkenntnisse im Gespräch entstehen → `knowledge/` aktualisieren

### Claude aktualisiert NICHT für:
- Themenspezifische Code-Entscheidungen
- Temporäre Workarounds
- Zwischenstände ohne Entscheidung
