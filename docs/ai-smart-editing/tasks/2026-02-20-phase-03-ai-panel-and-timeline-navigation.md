# Phase 03: AI Panel, Segmentliste und Timeline-Navigation

> ULTRATHINK - Diese Phase plant das sichtbare User-Feature: rechte AI-Sidebar mit Segmenttypen, Zeitcodes und direkter Navigation.

## Status
- Phase: 03 von 09
- Chat-Zuordnung: CHAT 1
- Planungsstatus: ABGESCHLOSSEN
- Implementierungsstatus: ABGESCHLOSSEN
- Referenziert von: `docs/ai-smart-editing/00-GLOBAL-TASKLIST.md`
- Nachfolgephase: NEXT_PHASE_READY (Phase 04)

## Zielbild
In der Editor-Ansicht erscheint ein eigenes AI-Panel, das:
- Segmentzaehler pro Kategorie zeigt.
- Segmentliste mit Zeitfenstern und kurzer Begruendung zeigt.
- Bei Klick sofort den Playhead zur relevanten Stelle springt.
- Erst danach eine explizite Apply-Aktion anbietet.

Was bedeutet das konkret fuer den User?
Der User findet problematische Stellen ohne Suchen und entscheidet selbst, was wirklich geschnitten wird.

## Screenshot-Analyse (bereitgestellte Referenz)
Die Referenz zeigt ein klares UX-Muster, das wir uebernehmen:
- Rechte Sidebar "Segments".
- Counter-Chips fuer Keep, Cut, Dead Air, Retake.
- Summen fuer Gesamtdauer Keep/Cut.
- Liste aus Segmentkarten mit:
- farbiger Typ-Markierung,
- Start-End-Zeit,
- Dauer,
- kurzer inhaltlicher Beschreibung.
- Klick auf Segment navigiert die Haupt-Preview exakt zur Stelle.

## Angewandte Regeln
- Rule 2.2.1 React Performance
- Rule 2.3.2 Accurate Dependency Arrays
- Rule 3.4 Component-Based Architecture
- Rule 4.7 Mobile-First Space Efficiency
- Rule 4.14 Overlay Stacking & Clipping

## Komponenten und Dateianschnitt (Plan)
| Komponente | Geplanter Pfad | Zweck | Geschaetzte Groesse |
|---|---|---|---:|
| AIPanelSection | `src/components/video-editor/ai/AIPanelSection.tsx` | Panel-Container inkl. Header, Job-Status, Actions | 220-320 Zeilen |
| AISegmentSummaryCard | `src/components/video-editor/ai/AISegmentSummaryCard.tsx` | Keep/Cut/DeadAir/Retake Counter + Duration-Metriken | 140-220 Zeilen |
| AISegmentList | `src/components/video-editor/ai/AISegmentList.tsx` | Scrollbare Segmentkartenliste mit Filter/Sortierung | 220-320 Zeilen |
| AISegmentListItem | `src/components/video-editor/ai/AISegmentListItem.tsx` | Einzelkarte mit Farbe, Text, Zeit und Confidence | 120-180 Zeilen |
| useAISegmentNavigation | `src/components/video-editor/ai/hooks/useAISegmentNavigation.ts` | Kapselt Seek-Logik fuer Preview + Timeline Selection | 120-180 Zeilen |

## Integrationspunkte im bestehenden Code
- `src/components/video-editor/VideoEditor.tsx`:
AI-Panel-State, Job-Start/Cancel, Seek-Handler.
- `src/components/video-editor/SettingsPanel.tsx`:
Entweder neuer Tab "AI" oder eigene Panel-Sektion.
- `src/components/video-editor/timeline/TimelineEditor.tsx`:
Optionales Hervorheben von aktivem AI-Segment im sichtbaren Bereich.

## UX-Verhalten (nicht-destruktiv zuerst)
- Default-Mode: "Markers only".
- Sekundaerer Mode: "Proposed cuts".
- Jede Aktion ist reversibel (Undo in Folgephase 05 konkretisiert).
- Disabled Buttons zeigen immer Grundtext (z. B. "kein Ergebnis vorhanden").

## Risiken und Edge-Cases
- Sehr viele Segmente fuehren zu unlesbarer Liste.
- Segmentklick ausserhalb aktueller Range kann desorientieren.
- Gleichzeitige manuelle Timeline-Edits und AI-Seeks koennen springen.
- Falsche Confidence-Interpretation kann zu aggressiven Cuts fuehren.
- Unklare Segmenttexte duerfen User nicht in die Irre fuehren.

## Umsetzungsphasen innerhalb Phase 03
1. Panel-Grundstruktur:
Section + Header + Status.
2. Summary und Liste:
Counter, Dauer-Metriken, segmentierte Karten.
3. Navigation:
Klick-zu-Seek + visuelles Active-Segment.
4. Nicht-destruktive Actions:
Apply als Marker/Cuts nur als Vorschlag.
5. Accessibility und Skalierung:
Keyboard-Fokus, Scroll-Verhalten, lange Listen.

## Verifikation
- Segmentklick positioniert den Playhead reproduzierbar.
- Liste bleibt bei vielen Eintraegen performant und bedienbar.
- Counter und Summen passen zu den geladenen Suggestions.
- Apply-Buttons sind nur aktiv, wenn valide Ergebnisse vorliegen.
- Folgephase 04 kann auf dieser UI-Transparenz die Regel-Engine aufsetzen.

## Ergebnis fuer Chat 1
- Diese Planungsphase ist abgeschlossen.
- Implementierung ist noch offen.
- Naechster Schritt: Phase 04 (Suggestion-Engine und Taxonomie-Feinschliff).

