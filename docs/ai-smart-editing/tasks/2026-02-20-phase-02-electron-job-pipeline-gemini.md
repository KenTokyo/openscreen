# Phase 02: Electron Job-Pipeline und Gemini Provider-Bridge

> ULTRATHINK - Diese Phase plant die robuste Main-Process-Pipeline fuer AI-Jobs mit Fortschritt, Abbruch und sauberem IPC.

## Status
- Phase: 02 von 09
- Chat-Zuordnung: CHAT 1
- Planungsstatus: ABGESCHLOSSEN
- Implementierungsstatus: ERLEDIGT
- Referenziert von: `docs/ai-smart-editing/00-GLOBAL-TASKLIST.md`
- Nachfolgephase: NEXT_PHASE_READY (Phase 03)

## Zielbild
AI-Analyse wird als eigener Job im Electron Main Process ausgefuehrt.
Der Renderer bekommt nur Status-Events und finalisierte JSON-Ergebnisse.
So bleibt die UI fluessig und die Pipeline ist spaeter auch fuer andere Provider wiederverwendbar.

Was bedeutet das konkret fuer den User?
Der User kann einen AI-Run starten, den Fortschritt live sehen und bei Bedarf abbrechen, ohne dass die App haengt.

## Kontextanalyse
- Bestehende IPC-Handler liegen in `electron/ipc/handlers.ts`.
- Preload-Bridge in `electron/preload.ts` ist bereits etabliert.
- Aktuelle Editor-Architektur ist state-stark in `VideoEditor.tsx`; heavy Compute muss aus dem Renderer raus.
- API-Tutorial (`GEMINI-API-TUTORIAL.md`) enthaelt GenerateContent-Patterns und Modell-/Config-Hinweise, aber kein fertiges Desktop-Job-Queue-Design.

## Angewandte Regeln
- Rule 1.2 Architektur
- Rule 1.5 Logging & Errors
- Rule 2.3.1 Effect Cleanup
- Rule 4.1 Context Analysis Before Changes
- Rule 4.10 Single Source of Truth

## Komponenten und Dateianschnitt (Plan)
| Komponente | Geplanter Pfad | Zweck | Geschaetzte Groesse |
|---|---|---|---:|
| AIJobManager | `electron/ai/jobs/aiJobManager.ts` | Job-Lifecycle, Queue, Cancel, Status-Events | 260-380 Zeilen |
| GeminiTranscriptionAdapter | `electron/ai/providers/geminiTranscriptionAdapter.ts` | Provider-spezifischer Call und Antwort-Normalisierung | 240-360 Zeilen |
| AIArtifactStore | `electron/ai/storage/aiArtifactStore.ts` | Persistenz fuer transcript/suggestions/status pro Video | 180-260 Zeilen |
| AIIPCHandlers | `electron/ipc/aiHandlers.ts` | Neue IPC-Endpunkte fuer start/status/cancel/results | 180-260 Zeilen |

## Geplante IPC-Schnittstellen (fachlich)
- `ai-start-analysis(videoPath, config)`:
Erzeugt Job-ID und startet Pipeline.
- `ai-cancel-analysis(jobId)`:
Setzt Cancel-Flag und beendet laufenden Schritt.
- `ai-get-job-status(jobId)`:
Liefert Snapshot fuer cold start/reconnect.
- `ai-get-artifacts(jobId)`:
Liefert transcript + suggestions fuer Renderer.
- Event-Channel `ai-job-progress`:
Push fuer Step-Wechsel, Prozent, Fehlerhinweise.

## Sicherheits- und Stabilitaetsstrategie
- API-Key bleibt nur im Main Process.
- Kein direkter extern API-Aufruf aus Renderer.
- Eingabepfade werden validiert (existiert, lesbar, erwarteter Typ).
- Groesse/Laufzeit-Limits verhindern Hanger bei extremen Dateien.
- Persistente Job-Artefakte erlauben UI-Wiederaufnahme nach Window-Reload.

## Risiken und Edge-Cases
- Rate Limits oder 429 bei schnellen Wiederholungen.
- Netzwerk-Ausfall waehrend Job-Lauf.
- Teilantworten (Transcript da, Suggestions fehlen).
- Job wird abgebrochen, aber UI zeigt weiter "running".
- Sehr grosse Videos verursachen zu hohe Kosten oder Timeout.
- Modellwechsel (2.5 vs 3.x) veraendert Antwortqualitaet/Struktur.

## Umsetzungsphasen innerhalb Phase 02
1. Job-Engine entwerfen:
State-Machine + Queue + Cancel + Logging.
2. Provider-Adapter definieren:
Gemini Request-Builder + Response-Normalisierung.
3. IPC anbinden:
Start/Cancel/Status/Result Endpunkte + Event Push.
4. Artefakt-Speicherung:
Versionierte JSON-Dateien je Job.
5. Recovery-Verhalten:
Rehydrate von Status nach Fenster-Neustart.

## Verifikation
- Kein Blockieren des Renderers durch AI-Analyse.
- Jeder Job hat eindeutige ID und nachvollziehbaren Statusverlauf.
- Cancel ist technisch und visuell konsistent.
- Fehler werden user-verstaendlich und debugbar geliefert.
- Folgephase 03 kann direkt auf stabile IPC-Vertraege aufsetzen.

## Ergebnis fuer Chat 1
- Diese Planungsphase ist abgeschlossen.
- Implementierung ist noch offen.
- Naechster Schritt: Phase 03 (AI Panel + Segmentnavigation in der Timeline).

