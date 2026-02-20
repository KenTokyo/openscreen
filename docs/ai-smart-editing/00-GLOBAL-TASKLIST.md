# GLOBAL TASKLIST: OpenScreen AI Editing Assistant

> ULTRATHINK - Zentrale Orchestrator-Datei fuer die Planung des KI-gestuetzten Transcript- und Cut-Workflows in OpenScreen.

## Status
- Orchestrator-Status: ABGESCHLOSSEN
- Aktueller Chat: CHAT 3
- Letzte Aktualisierung: 2026-02-20 (Phase 09 implementiert - Rollout, Docs, Migration)
- temp.md: nicht vorhanden
- Master-Status: ALL_PHASES_COMPLETE

## Zielbild
OpenScreen erhaelt ein nicht-destruktives AI-Panel, das aus Audio/Video automatisch Transcript + Segmentvorschlaege erzeugt und diese als Marker oder Cuts in die bestehende Timeline uebernimmt.

Was bedeutet das konkret fuer den User?
Der User kann Problemstellen wie Filler, Retakes und Dead Air in Sekunden sehen, anklicken, pruefen und mit einem klaren Apply-Schritt uebernehmen.

## Angewandte Regeln (aus `shared-docs/refactoring-docs/global-coding-rules.md`)
- Rule 1.1 Struktur: klare Feature-Struktur statt verstreuter Einzelloesungen.
- Rule 1.2 Architektur: explizite Layer (UI, Renderer-State, IPC, Main-Worker, Provider).
- Rule 2.2.1 React Performance: Memoisierung und stabile Callbacks fuer Timeline-nahe UI.
- Rule 2.3.1 Effect Cleanup: alle IPC-Listener sauber deregistrieren.
- Rule 3.4 Component-Based Architecture: keine verschachtelten Komponenten-Definitionen.
- Rule 4.14 Overlay Stacking: neues Panel darf bestehende Dialog-/Popover-Layer nicht brechen.

## Referenz-Artefakte (dieser Chat)
- `docs/ai-smart-editing/00-GLOBAL-TASKLIST.md`
- `docs/ai-smart-editing/tasks/2026-02-20-phase-01-architecture-and-data-contracts.md`
- `docs/ai-smart-editing/tasks/2026-02-20-phase-02-electron-job-pipeline-gemini.md`
- `docs/ai-smart-editing/tasks/2026-02-20-phase-03-ai-panel-and-timeline-navigation.md`
- `docs/ai-smart-editing/tasks/2026-02-20-phase-04-suggestion-engine-and-taxonomy.md`
- `docs/ai-smart-editing/tasks/2026-02-20-phase-05-apply-markers-and-cuts-flow.md`
- `docs/ai-smart-editing/tasks/2026-02-20-phase-06-export-consistency-and-editlist-bridge.md`
- `docs/ai-smart-editing/tasks/2026-02-20-phase-07-settings-keys-and-provider-switching.md`
- `docs/ai-smart-editing/tasks/2026-02-20-phase-08-reliability-progress-and-fallbacks.md`
- `docs/ai-smart-editing/tasks/2026-02-20-phase-09-rollout-docs-and-migration.md`

## Chat-Schnitt und Token-Budget (Implementierung, nicht Planung)
| Chat | Geplante Implementierungsphasen | Token-Budget (ca.) | Ziel |
|---|---|---:|---|
| CHAT 1 | Phase 01-03 | 35k-45k | Architektur festziehen, Job-Pipeline, UI-Navigation |
| CHAT 2 | Phase 04-06 | 40k-50k | Suggestion-Engine, Apply-Flow, Undo/Safety |
| CHAT 3 | Phase 07-09 | 30k-40k | Settings/Security, Telemetrie, Rollout/Doku |

Hinweis:
Maximal 4 Planungen pro Chat werden eingehalten. In diesem Chat wurden genau 4 Planungsdateien erzeugt.

## Master-Phasenuebersicht
| Phase | Datei | Chat | Planungsstatus | Implementierungsstatus | Kommentar |
|---|---|---|---|---|---|
| 01 | `docs/ai-smart-editing/tasks/2026-02-20-phase-01-architecture-and-data-contracts.md` | CHAT 1 | ABGESCHLOSSEN | ✅ ERLEDIGT | Datenvertrag + Mapping-Strategie |
| 02 | `docs/ai-smart-editing/tasks/2026-02-20-phase-02-electron-job-pipeline-gemini.md` | CHAT 1 | ABGESCHLOSSEN | ✅ ERLEDIGT | Main/Worker/IPC Pipeline |
| 03 | `docs/ai-smart-editing/tasks/2026-02-20-phase-03-ai-panel-and-timeline-navigation.md` | CHAT 1 | ABGESCHLOSSEN | ✅ ERLEDIGT | Sidebar, Segmente, Seek-Navigation |
| 04 | `docs/ai-smart-editing/tasks/2026-02-20-phase-04-suggestion-engine-and-taxonomy.md` | CHAT 2 | ABGESCHLOSSEN | ✅ ERLEDIGT | Suggestion-Engine Pipeline + Passes |
| 05 | `docs/ai-smart-editing/tasks/2026-02-20-phase-05-apply-markers-and-cuts-flow.md` | CHAT 2 | ABGESCHLOSSEN | ✅ ERLEDIGT | Apply + Overlap-Check + Undo |
| 06 | `docs/ai-smart-editing/tasks/2026-02-20-phase-06-export-consistency-and-editlist-bridge.md` | CHAT 2 | ABGESCHLOSSEN | ✅ ERLEDIGT | Export-Konsistenz, Normalisierung, Editlist-Summary |
| 07 | `docs/ai-smart-editing/tasks/2026-02-20-phase-07-settings-keys-and-provider-switching.md` | CHAT 3 | ABGESCHLOSSEN | ✅ ERLEDIGT | API-Key-Persistenz, Provider-Abstraktion, Settings-UI |
| 08 | `docs/ai-smart-editing/tasks/2026-02-20-phase-08-reliability-progress-and-fallbacks.md` | CHAT 3 | ABGESCHLOSSEN | ✅ ERLEDIGT | Retry, Timeout, Progress, Fehler-UX, IPC-Haertung |
| 09 | `docs/ai-smart-editing/tasks/2026-02-20-phase-09-rollout-docs-and-migration.md` | CHAT 3 | ABGESCHLOSSEN | ✅ ERLEDIGT | CLAUDE.md AI-Architektur, Feature-Guards, TypeScript-Check |

## Risiko- und Edge-Case-Register (global)
- Lange Videos koennen Job-Laufzeit und Speicherdruck stark erhoehen.
- Gemini-Outputs koennen segmentweise variieren; deterministische Nachnormalisierung ist Pflicht.
- Timeline-Operationen duerfen keine bestehenden Zoom/Trim/Annotation-Daten verlieren.
- User braucht klaren Grund, wenn Apply/Run-Buttons deaktiviert sind.
- Provider-Wechsel (Gemini 2.5/3.x) darf nicht zu brechenden Datenformaten fuehren.

## Verifikation (global)
- Jede Phase muss den Abschnittstitel ULTRATHINK enthalten.
- Jede Phase liefert Zielbild, Risiken/Edge-Cases, Umsetzungsphasen, Verifikation.
- Kein Plan enthaelt produktionsreifen Code.
- Status wird nur dann auf ALL_PHASES_COMPLETE gesetzt, wenn wirklich keine Folgephase offen ist.

## Aktuelle Entscheidung
- Aktueller Endzustand: ALL_PHASES_COMPLETE
- Alle 9 Phasen sind abgeschlossen.
- Keine offenen Phasen mehr.

