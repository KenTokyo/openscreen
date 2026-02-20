# Phase 04: Suggestion-Engine und Taxonomie-Feinschliff

> ULTRATHINK - Lokale Nachverarbeitungs-Engine fuer deterministische Suggestion-Erzeugung und -Bereinigung.

## Status
- Phase: 04 von 09
- Chat-Zuordnung: CHAT 2
- Planungsstatus: ABGESCHLOSSEN
- Implementierungsstatus: ABGESCHLOSSEN
- Referenziert von: `docs/ai-smart-editing/00-GLOBAL-TASKLIST.md`
- Nachfolgephase: Phase 05

## Zielbild
Nach dem Gemini-API-Call werden die Rohdaten durch eine lokale Pipeline nachverarbeitet:
1. **Filler-Detection**: Regelbasierte Erkennung von Fuellwoertern aus Transcript-Woertern
2. **Dead-Air-Detection**: Luecken zwischen Transcript-Segmenten als Stille-Vorschlaege
3. **Retake-Detection**: Aehnliche aufeinander folgende Segmente als Wiederholungen
4. **Confidence-Normalisierung**: LLM-Confidence mit lokalen Signalen gewichten
5. **Merge/Dedup**: Ueberlappende Suggestions gleicher Kategorie zusammenfuehren
6. **Sortierung/Priorisierung**: Nach gewichtetem Score sortieren

Was bedeutet das konkret fuer den User?
Praezisere, vollstaendigere Vorschlaege mit weniger Rauschen. Fuellwoerter und Stille werden auch dann gefunden, wenn Gemini sie uebersieht.

## Architektur

### Pipeline-Design
```
GeminiRaw → normalize → [fillerPass, deadAirPass, retakePass] → mergeDedup → sort → Suggestion[]
```

Jeder Pass ist eine pure Function:
```
(transcript: Transcript, existingSuggestions: Suggestion[]) => Suggestion[]
```

Die Engine kombiniert die Ergebnisse aller Passes, dedupliziert und sortiert.

### Dateien
| Datei | Zweck | Zeilen |
|---|---|---:|
| `src/components/video-editor/ai/engine/suggestionEngine.ts` | Pipeline-Orchestrator | ~80 |
| `src/components/video-editor/ai/engine/fillerDetectionPass.ts` | Regelbasierte Filler-Erkennung | ~80 |
| `src/components/video-editor/ai/engine/deadAirDetectionPass.ts` | Luecken-Erkennung | ~60 |
| `src/components/video-editor/ai/engine/retakeDetectionPass.ts` | Wiederholungs-Heuristik | ~80 |
| `src/components/video-editor/ai/engine/mergeDedup.ts` | Ueberlappungen zusammenfuehren | ~70 |

## Angewandte Regeln
- Rule 1.2 Architektur: klare Layer (Engine als pure Functions)
- Rule 3.4 Component-Based: jeder Pass isoliert und testbar
- Provider-Agnostik: Engine arbeitet nur mit normierten Types

## Risiken und Edge-Cases
- Fuellwoerter in Fachbegriffen: "also" als Konjunktion → Context-Check (vorher/nachher Wort)
- Sehr kurze Videos: Dead-Air-Schwelle koennte zu aggressiv sein → min. 2 Segmente noetig
- Fehlende Word-Level-Timestamps: Filler-Pass braucht Words → graceful fallback auf Segment-Text
- Retake-Heuristik bei repetitivem Content: Tutorials, Aufzaehlungen → Similarity-Schwelle hoch genug
- Gemini liefert bereits gute Suggestions: Engine darf nicht verschlechtern → additive Logik

## Umsetzungsphasen
1. Engine-Kern mit Pipeline-Architektur
2. Filler-Detection Pass
3. Dead-Air-Detection Pass
4. Retake-Detection Pass
5. Merge/Dedup Pass
6. Integration in GeminiTranscriptionAdapter-Nachverarbeitung
7. TypeScript-Check

## Verifikation
- Engine produziert deterministische Ergebnisse fuer gleiche Eingabe
- Filler-Detection findet "aeh" / "uhm" zuverlaessig
- Dead-Air erkennt Pausen >= DEAD_AIR_MIN_MS
- Retake erkennt wiederholte Saetze mit hoher Aehnlichkeit
- Merge/Dedup verschmilzt zeitlich ueberlappende gleiche Kategorien
- TypeScript-Check: 0 Fehler
- Kein bestehender Code wird gebrochen
