# CCM Zero-Friction Install — Design

**Datum:** 2026-03-20
**Status:** Approved

## Ziel

CCM soll nach `ccm add` bzw. `ccm init` vollständig fertig sein — ohne manuelle Nachschritte. Commit, Push und Output werden von CCM selbst übernommen.

## Änderungen

### `ccm add`

Nach Erstellen von CLAUDE.md und .ccm:

1. `git add CLAUDE.md .ccm` — nur diese beiden Dateien, keine bereits gestageten Änderungen anderer Dateien werden berührt
2. `git commit -m 'chore: add CCM context'` — wird übersprungen wenn keine Änderungen (z.B. Re-Run)
3. `git push` — plain `git push` ohne Branch-Argument (folgt dem konfigurierten Upstream); wird übersprungen wenn kein Remote konfiguriert

**Output (Erfolg):**
```
✅ <repo-name> eingebunden
   Meta-Repo:  <meta-repo-path>
   Commit:     chore: add CCM context
   Push:       → <current-branch>
```

`<current-branch>` wird zur Laufzeit aus `git rev-parse --abbrev-ref HEAD` gelesen.

**Output (kein Remote):**
```
✅ <repo-name> eingebunden
   Meta-Repo:  <meta-repo-path>
   Commit:     chore: add CCM context
   Push:       — kein Remote konfiguriert
```

**Output (Commit übersprungen, weil keine Änderungen):**
```
✅ <repo-name> eingebunden
   Meta-Repo:  <meta-repo-path>
   Commit:     — keine Änderungen
   Push:       — übersprungen
```

Kein "Nächste Schritte"-Block.

---

### `ccm init`

`cmd_init` fügt bereits via `git remote add origin <url>` einen Remote hinzu (sofern noch keiner existiert). Daher ist nach einem erfolgreichen `ccm init`-Durchlauf immer ein Remote gesetzt. Die "kein Remote"-Ausgabe tritt nur auf, wenn `git remote get-url origin` nach dem Init-Prozess fehlschlägt (z.B. weil ein bestehender Remote schon gesetzt war und der neue nicht hinzugefügt wurde).

Nach Erstellen aller Dateien (CLAUDE.md, context/, ccm.json, .github/workflows/sync.yml):

1. `git add CLAUDE.md ccm.json context/ .github/`
2. `git commit -m 'chore: init CCM meta-repo'` — wird übersprungen wenn keine Änderungen (Re-Run)
3. `git push -u origin main` — nur wenn Remote gesetzt ist und Commit stattgefunden hat; wird übersprungen wenn Commit übersprungen wurde

**Output (Erfolg):**
```
✅ Meta-Repo eingerichtet
   Projekt:  <project-name>
   Remote:   <remote-url>
   Commit:   chore: init CCM meta-repo
   Push:     → origin/main

Nächstes:  ccm add  (im Sub-Projekt ausführen)
```

**Output (kein Remote / Push übersprungen):**
```
✅ Meta-Repo eingerichtet
   Projekt:  <project-name>
   Commit:   chore: init CCM meta-repo
   Push:     — kein Remote konfiguriert

Nächstes:  ccm add  (im Sub-Projekt ausführen)
```

---

### `templates/sub/CLAUDE.md`

**Vorher:** 5 Sections mit Platzhalter-Text und kommentierten Beispielen (~42 Zeilen), inklusive Guide-Kommentar.

**Nachher:** Nur Marker + minimaler Stub (kein Guide-Kommentar, keine leeren Sections):

```markdown
<!-- PROJECT CONTEXT BELOW -->

# {{REPO_NAME}} — Projekt-Kontext

**Repo:** {{REPO_URL}}
```

Begründung: Platzhalter-Sections sind Noise. Claude ergänzt Kontext organisch während der Arbeit.

---

## Fehlerbehandlung

Das Script läuft mit `set -euo pipefail`. Git-Aufrufe werden daher mit `|| true` oder explizitem Exit-Code-Check abgesichert, damit CCM eigene Fehlermeldungen ausgeben kann anstatt stumm abzubrechen.

| Situation | Verhalten |
|---|---|
| Commit: nichts zu commiten | Silent skip, Ausgabe zeigt `— keine Änderungen` |
| Push: kein Remote konfiguriert | Hinweis in Output, kein Abbruch |
| Push: Auth-Fehler oder anderer Fehler | Git stderr wird durchgereicht, dann `exit 1` |
| Push nach übersprungenen Commit (`ccm init`) | Push wird ebenfalls übersprungen |

Implementierungshinweis: `git push` per `git push 2>&1` aufrufen um stderr zu erfassen und im CCM-Format auszugeben, bevor `exit 1` erfolgt.

---

## Out of Scope

- Interaktive Projekt-Beschreibung beim Install
- Automatisches GitHub-Repo erstellen via `gh` in `ccm init`
- `.gitignore` für `context/credentials.md` (separates Ticket)
