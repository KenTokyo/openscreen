# Phase 05: Apply-Markers-and-Cuts-Flow

> ULTRATHINK - Sichere Uebernahme von AI-Suggestions als Timeline-Trims mit Undo-Funktion.

## Status
- Phase: 05 von 09
- Chat-Zuordnung: CHAT 2
- Planungsstatus: ABGESCHLOSSEN
- Implementierungsstatus: ABGESCHLOSSEN
- Referenziert von: `docs/ai-smart-editing/00-GLOBAL-TASKLIST.md`
- Nachfolgephase: Phase 06

## Zielbild
Der User klickt "Als Cuts anwenden" im AI-Panel. Ein informativer Toast zeigt, was passiert ist (X Trims eingefuegt, Y uebersprungen wegen Overlap). Ein "Rueckgaengig"-Button erscheint, der alle AI-generierten Trims mit einem Klick entfernt. Re-Apply ist moeglich (erst Undo, dann neu Apply).

Was bedeutet das konkret fuer den User?
Der User kann AI-Vorschlaege mit einem Klick als Schnitte in die Timeline uebernehmen, sofort sehen was passiert ist, und bei Bedarf alles mit einem Klick rueckgaengig machen.

## Architektur

### State-Design
```
VideoEditor.tsx:
  lastAIApplyIds: string[]  // IDs der zuletzt durch AI-Apply erzeugten Trims
```

### Overlap-Pruefung
Vor Einfuegen jeder AI-TrimRegion wird geprueft ob sie mit bestehenden Trims ueberlappt.
Bei Overlap: Trim wird uebersprungen, Count der uebersprungenen wird gemerkt.

### Undo-Strategie
Statt State-Snapshot werden die IDs der AI-Trims gespeichert.
Undo entfernt genau diese IDs aus `trimRegions`.
Vorteil: Manuelle Aenderungen nach Apply bleiben erhalten.

### Dateien (Aenderungen)
| Datei | Aenderung | Zeilen |
|---|---|---:|
| `src/components/video-editor/VideoEditor.tsx` | State + Apply + Undo Logik | ~60 |
| `src/components/video-editor/ai/AIPanelSection.tsx` | Undo-Button + UI-Logik | ~30 |

## Angewandte Regeln
- Rule 1.2 Architektur: klare State-Verwaltung in VideoEditor
- Rule 2.2.1 React Performance: useCallback fuer alle Handler
- Rule 2.3.1 Effect Cleanup: kein neuer Effect noetig
- Non-destructive-first: Undo jederzeit moeglich

## Risiken und Edge-Cases
- Duplikate bei erneutem Apply: Geloest durch lastAIApplyIds-Check
- Ueberlappende Trims: Geloest durch Overlap-Pruefung vor Einfuegen
- Leeres Ergebnis: Toast-Info "Keine Schnitte notwendig"
- Undo nach manuellem Editing: Nur AI-IDs entfernt, manuelle bleiben
- Sehr viele Trims: Count in Toast angezeigt

## Umsetzungsphasen
1. VideoEditor: `lastAIApplyIds` State + erweiterte Apply-Logik mit Overlap-Check
2. VideoEditor: `handleUndoAIApply` Funktion
3. AIPanelSection: Props-Erweiterung (onUndoAIApply, hasAppliedSuggestions)
4. AIPanelSection: UI fuer Undo-Button + differenzierte Action-Buttons
5. TypeScript-Check

## Verifikation
- Apply erzeugt korrekte TrimRegions mit Overlap-Schutz
- Undo entfernt nur AI-erzeugte Trims
- Manuelle Trims bleiben bei Undo erhalten
- Toast-Meldungen sind informativ (Count Trims, uebersprungene)
- Re-Apply funktioniert (vorherige AI-Trims werden ersetzt)
- TypeScript-Check: 0 Fehler
- Kein bestehender Code wird gebrochen
