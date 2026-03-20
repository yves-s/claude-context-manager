# CCM Zero-Friction Install — Design

**Datum:** 2026-03-20
**Status:** Approved

## Ziel

CCM soll nach `ccm add` bzw. `ccm init` vollständig fertig sein — ohne manuelle Nachschritte. Commit, Push und Output werden von CCM selbst übernommen.

## Änderungen

### `ccm add`

Nach Erstellen von CLAUDE.md und .ccm:

1. `git add CLAUDE.md .ccm`
2. `git commit -m 'chore: add CCM context'` — wird übersprungen wenn keine Änderungen
3. `git push` — wird übersprungen wenn kein Remote konfiguriert; Fehler wird angezeigt aber bricht nicht ab

**Output (Erfolg):**
```
✅ <repo-name> eingebunden
   Meta-Repo:  <meta-repo-path>
   Commit:     chore: add CCM context
   Push:       → origin/main
```

**Output (kein Remote):**
```
✅ <repo-name> eingebunden
   Meta-Repo:  <meta-repo-path>
   Commit:     chore: add CCM context
   Push:       — kein Remote konfiguriert
```

Kein "Nächste Schritte"-Block.

---

### `ccm init`

Nach Erstellen aller Dateien (CLAUDE.md, context/, ccm.json, .github/workflows/sync.yml):

1. `git add CLAUDE.md ccm.json context/ .github/`
2. `git commit -m 'chore: init CCM meta-repo'`
3. `git push -u origin main` — wird übersprungen wenn kein Remote

**Output (Erfolg):**
```
✅ Meta-Repo eingerichtet
   Projekt:  <project-name>
   Remote:   <remote-url>
   Commit:   chore: init CCM meta-repo
   Push:     → origin/main

Nächstes:  ccm add  (im Sub-Projekt ausführen)
```

**Output (kein Remote):**
```
✅ Meta-Repo eingerichtet
   Projekt:  <project-name>

   Noch kein Remote — nach GitHub-Repo-Erstellung:
   git push -u origin main

Nächstes:  ccm add  (im Sub-Projekt ausführen)
```

---

### `templates/sub/CLAUDE.md`

**Vorher:** 5 Sections mit Platzhalter-Text und kommentierten Beispielen (~42 Zeilen).

**Nachher:** Nur Marker + minimaler Stub (~5 Zeilen):

```markdown
<!-- PROJECT CONTEXT BELOW -->

# {{REPO_NAME}} — Projekt-Kontext

**Repo:** {{REPO_URL}}
```

Begründung: Platzhalter-Sections sind Noise. Claude ergänzt Kontext organisch während der Arbeit.

## Fehlerbehandlung

- Commit schlägt fehl (nichts staged): wird still übersprungen
- Push schlägt fehl (kein Remote): wird mit Hinweis angezeigt, kein Abbruch
- Push schlägt fehl (anderer Fehler, z.B. Auth): Fehlermeldung wird angezeigt, exit 1

## Out of Scope

- Interaktive Projekt-Beschreibung beim Install
- Automatisches GitHub-Repo erstellen via `gh` in `ccm init`
