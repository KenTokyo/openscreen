# Phase 06: Export-Consistency-and-Editlist-Bridge

> ULTRATHINK - Garantierte Konsistenz zwischen AI-Trims und Export-Pipeline, plus Editlist-Summary fuer den User.

## Status
- Phase: 06 von 09
- Chat-Zuordnung: CHAT 2
- Planungsstatus: ABGESCHLOSSEN
- Implementierungsstatus: ABGESCHLOSSEN
- Referenziert von: `docs/ai-smart-editing/00-GLOBAL-TASKLIST.md`
- Nachfolgephase: Phase 07

## Zielbild
Der Export-Flow beruecksichtigt AI-generierte Trims zuverlaessig und konsistent. Vor dem Export sieht der User eine Zusammenfassung (effektive Dauer, Anzahl Schnitte), damit er weiss was exportiert wird. Die TrimRegions werden vor dem Export normalisiert (sortiert, Overlaps bereinigt, Range-geclampt), um Edge-Cases im StreamingDecoder zu vermeiden.

Was bedeutet das konkret fuer den User?
Der User sieht im Export-Bereich klar, wie lang sein Video nach allen Schnitten sein wird. Beim Export werden alle Trims (manuell + AI) zuverlaessig angewendet - keine Ueberraschungen durch ueberlappende oder ausser-Range-Trims.

## Architektur

### Ist-Zustand (nach Phase 05)
- AI-Trims werden als regulaere `TrimRegion[]` gespeichert
- Export-Flow uebergibt `trimRegions` direkt an `VideoExporter`/`GifExporter`
- `StreamingDecoder.computeSegments()` erstellt Editlist aus TrimRegions
- `StreamingDecoder.getEffectiveDuration()` berechnet gekuerzte Dauer
- **Keine Validierung** vor Export (Overlaps, Range-Grenzen)
- **Keine Anzeige** der effektiven Dauer im UI vor Export-Start

### Soll-Zustand (Phase 06)
1. **TrimRegion-Normalisierung**: Utility-Funktion die vor Export sortiert, Overlaps merged, und auf Videodauer clampt
2. **Editlist-Summary im SettingsPanel**: Anzeige von effektiver Dauer und Trim-Count neben dem Export-Button
3. **Export-Dialog-Erweiterung**: Effektive Dauer im Export-Dialog anzeigen
4. **Normalisierung vor Export**: `handleExport` ruft Normalisierung auf bevor trimRegions an Exporter uebergeben werden

### Neue Datei
| Datei | Zweck | Zeilen |
|---|---|---:|
| `src/lib/exporter/trimNormalizer.ts` | sortTrimRegions, mergeOverlapping, clampToRange | ~60 |

### Geaenderte Dateien
| Datei | Aenderung | Zeilen |
|---|---|---:|
| `src/components/video-editor/VideoEditor.tsx` | Normalisierung in handleExport, effectiveDuration Berechnung, Props | ~25 |
| `src/components/video-editor/SettingsPanel.tsx` | Editlist-Summary (Dauer + Trim-Count) | ~20 |
| `src/components/video-editor/ExportDialog.tsx` | Effektive Dauer Anzeige | ~10 |

## Angewandte Regeln
- Rule 1.1 Struktur: Normalisierung als eigenstaendige Utility, nicht inline
- Rule 1.2 Architektur: klare Trennung zwischen Normalisierung (Utility) und UI (Components)
- Rule 2.2.1 React Performance: useMemo fuer effektive Dauer Berechnung
- Defensive Programmierung: Normalisierung faengt Edge-Cases ab bevor sie den Decoder erreichen

## Risiken und Edge-Cases
- Leere trimRegions: Normalisierung gibt leeres Array zurueck, Export laeuft ohne Trims
- Vollstaendig getrimmtes Video: effectiveDuration <= 0 → Export-Button deaktiviert, Toast-Warnung
- Ueberlappende Trims durch schnelle manuelle + AI-Kombination: Merge in Normalisierung
- Trims ausserhalb der Videodauer: clamp auf [0, videoDurationMs]
- Floating-Point-Praezision: Runden auf ganze Millisekunden vor Segment-Berechnung

## Umsetzungsphasen
1. `trimNormalizer.ts` erstellen mit normalizeTrimRegions-Funktion
2. VideoEditor: effectiveDuration mit useMemo berechnen
3. VideoEditor: handleExport um Normalisierung erweitern
4. SettingsPanel: Editlist-Summary (Dauer + Trim-Count) anzeigen
5. ExportDialog: Effektive Dauer anzeigen
6. Edge-Case: Export-Button deaktivieren wenn effectiveDuration <= 0
7. TypeScript-Check

## Verifikation
- Normalisierung sortiert, merged Overlaps, clampt Range korrekt
- Effektive Dauer wird im SettingsPanel korrekt angezeigt
- Export-Dialog zeigt effektive Dauer
- Export-Button ist deaktiviert bei vollstaendig getrimmtem Video
- TypeScript-Check: 0 Fehler
- Kein bestehender Export-Code wird gebrochen
