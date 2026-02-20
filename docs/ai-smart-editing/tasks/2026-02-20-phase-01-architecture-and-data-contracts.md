# Phase 01: Architektur und Datenvertraege fuer AI Editing

> ULTRATHINK - Diese Phase definiert die tragfaehige Architektur und die JSON-Vertraege, bevor technische Umsetzung startet.

## Status
- Phase: 01 von 09
- Chat-Zuordnung: CHAT 1
- Planungsstatus: ABGESCHLOSSEN
- Implementierungsstatus: ✅ ERLEDIGT
- Referenziert von: `docs/ai-smart-editing/00-GLOBAL-TASKLIST.md`
- Nachfolgephase: NEXT_PHASE_READY (Phase 02)

## Implementierungsergebnis

**Durchgefuehrt am:** 2026-02-20
**TypeScript-Check:** 0 Fehler

### Erstellte Dateien
| Datei | Zeilen | Zweck |
|---|---:|---|
| `src/components/video-editor/ai/types.ts` | ~190 | Alle Typen: Transcript, Suggestion, Job-Status, IPC, Mapping |
| `src/components/video-editor/ai/suggestionTaxonomy.ts` | ~175 | Kategorie-Registry, Fuellwort-Listen, Schwellenwerte, Hilfsfunktionen |
| `src/components/video-editor/ai/mappers/suggestionTimelineMapper.ts` | ~240 | Mapping-Engine: Suggestions → Timeline-Aktionen + Statistiken |
| `docs/ai-smart-editing/specs/transcript-suggestions-contract.md` | ~165 | Menschlich lesbarer Contract mit Validierungsregeln |

### Entscheidungen
- **Non-destructive-first:** Default-Modus ist `markers-only`, nicht `proposed-cuts`
- **Padding-Strategie:** 100ms links/rechts um Cuts (Atemschutz)
- **Degradierung:** Zu kurze Cuts werden automatisch zu Markern
- **Provider-agnostisch:** Keine Gemini-spezifischen Felder in Core-Types
- **Overlap-Handling:** Ueberlappende Trims werden zusammengefuehrt
- **ms-basierte Zeitachse:** Konsistent mit bestehendem `ZoomRegion`/`TrimRegion` Pattern

## Zielbild
Wir trennen sauber zwischen:
- Analyse-Job (Transcript + Suggestions erzeugen),
- Review-UI (User bewertet),
- Apply-Flow (User entscheidet Marker vs. Cut).

So bleibt das System nicht-destruktiv und austauschbar, egal ob Gemini 2.5 Flash, Gemini 3 Flash oder spaeter ein anderer Provider genutzt wird.

Was bedeutet das konkret fuer den User?
Der User bekommt verstaendliche KI-Vorschlaege, aber behaelt volle Kontrolle, bevor etwas an der Timeline veraendert wird.

## Kontextanalyse
- Projekt-Basis: Electron Main + Preload + React Renderer mit `VideoEditor.tsx` und `TimelineEditor.tsx`.
- Timeline-Domaene existiert bereits ueber `ZoomRegion`, `TrimRegion`, `AnnotationRegion` in `src/components/video-editor/types.ts`.
- Screenshot-Zielbild zeigt: Segmenttypen, Counter-Chips, Zeitcodes, klickbare Segmentliste mit Navigation.
- `GEMINI-API-TUTORIAL.md` liefert allgemeine Gemini 3 API-Muster, aber keine fertige timestamp-spezifische End-to-End-Contract-Definition fuer Video-Cuts.

## Angewandte Regeln
- Rule 1.1 Struktur
- Rule 1.2 Architektur
- Rule 1.5 Logging & Errors
- Rule 3.1 Naming Conventions
- Rule 4.10 Single Source of Truth

## Komponenten und Dateianschnitt (Plan)
| Komponente | Geplanter Pfad | Zweck | Geschaetzte Groesse |
|---|---|---|---:|
| AIEditingTypes | `src/components/video-editor/ai/types.ts` | Einheitliche Typen fuer Transcript, Suggestion, Job-Status | 220-320 Zeilen |
| AISuggestionTaxonomy | `src/components/video-editor/ai/suggestionTaxonomy.ts` | Normierte Kategorien (keep/cut/dead-air/retake/filler/unclear) | 120-180 Zeilen |
| SuggestionTimelineMapper | `src/components/video-editor/ai/mappers/suggestionTimelineMapper.ts` | Mapping von Suggestion-Fenstern auf Timeline-Aktionen | 220-300 Zeilen |
| AIContractSpecDoc | `docs/ai-smart-editing/specs/transcript-suggestions-contract.md` | Menschlich lesbarer Contract inkl. Feldbedeutung | 180-260 Zeilen |

## Geplanter Datenvertrag (fachlich)
### transcript.json
- Enthaltene Einheiten:
- Segmente mit Start/Ende in Millisekunden.
- Optional Word-Items fuer praezises Scrubbing.
- Confidence auf Segmentebene.
- Speaker/Channel optional, falls spaeter noetig.

### suggestions.json
- Jede Suggestion enthaelt:
- `id`, `label`, `category`, `startMs`, `endMs`.
- `confidence`, `reasonShort`, `reasonDetail`.
- `actionHint`: `keep`, `mark`, `cut`.
- `sourceRefs`: Verweis auf Segment/Word IDs.

### status.json
- Job-Lifecycle: queued, preparing, transcribing, analyzing, done, failed, cancelled.
- Fortschrittswert 0-100 mit step-Text.
- Fehlerklasse und User-verstaendliche Recovery-Hinweise.

## Risiken und Edge-Cases
- Sehr kurze Filler-Woerter erzeugen zu viele Mikro-Schnitte.
- Segmentgrenzen koennen an Satzgrenzen vorbei schneiden.
- Unterschiedliche Provider liefern unterschiedliche Confidence-Skalen.
- Ueberlappende Vorschlaege muessen vor Apply normalisiert werden.
- Nicht-ASCII oder Mehrsprachigkeit im Transcript darf Parser nicht brechen.

## Umsetzungsphasen innerhalb Phase 01
1. Domain-Grenzen finalisieren:
Renderer-State, IPC-Transport, Job-Output strikt trennen.
2. Contract spezifizieren:
Pflichtfelder, optionale Felder, Defaultwerte.
3. Mapping-Regeln definieren:
Wann Marker, wann Cut, wann nur Warning.
4. Validierungsregeln dokumentieren:
Monotone Zeitachsen, keine negativen Dauern, keine ungeloesten Referenzen.

## Verifikation
- Alle benoetigten Felder fuer Transcript + Suggestions sind definiert.
- Jede Kategorie hat klare User-Semantik und Apply-Strategie.
- Non-destructive-first ist im Contract abgebildet.
- Folgephase 02 kann ohne Architektur-Blocker starten.

## Ergebnis fuer Chat 1
- Diese Planungsphase ist abgeschlossen.
- Implementierung ist noch offen.
- Naechster Schritt: Phase 02 (Electron Job Pipeline + Gemini-Provider-Anbindung).

