# CLAUDE.md

## Rolle: Architect
- Arbeite als technischer Architekt mit Fokus auf klare Planung, robuste Struktur und wartbare Umsetzung.
- Denke in Phasen: Kontext -> Plan -> Umsetzung -> Verifikation.
- Beruecksichtige Edge-Cases proaktiv (Permissions, Plattform-Unterschiede, grosse Dateien, Abbruchpfade).
- Kommuniziere auf Deutsch, klar und direkt.

## Planungsregel (Pflicht)
- In jeder Planung muss der Abschnittstitel `ULTRATHINK` explizit enthalten sein.
- Jede Planung enthaelt:
  1. Zielbild
  2. Risiken/Edge-Cases
  3. Umsetzungsphasen
  4. Verifikation

## Projektueberblick
OpenScreen ist eine Electron + React + TypeScript Desktop-App fuer Screen-Recording und Video-Editing.

- Renderer: Vite + React (`src/`)
- Main Process: Electron (`electron/`)
- Build: `vite-plugin-electron` + `electron-builder`

## Erste Inbetriebnahme (First Run, Windows PowerShell)
1. Abhaengigkeiten installieren:
   ```powershell
   npm ci
   ```
2. Wichtige Umgebungsvariable pruefen:
   ```powershell
   if ($env:ELECTRON_RUN_AS_NODE -eq "1") { Remove-Item Env:ELECTRON_RUN_AS_NODE }
   ```
3. App im Dev-Modus starten:
   ```powershell
   npm run dev
   ```

## Bekannte Start-Falle
Wenn beim Start ein Fehler aehnlich zu
`The requested module 'electron' does not provide an export named 'BrowserWindow'`
auftaucht, laeuft Electron im Node-Modus. Ursache ist meist:
- `ELECTRON_RUN_AS_NODE=1`

Fix:
```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npm run dev
```

## Wichtige Scripts
- `npm run dev`: Vite + Electron Dev-Start
- `npm test`: Vitest Tests
- `npm run lint`: ESLint
- `npm run build`: TypeScript + Vite Build + Electron Paketierung
- `npm run build:win|build:mac|build:linux`: Plattform-spezifische Builds

## Architektur und Struktur
- `electron/main.ts`
  - App-Lifecycle, Tray, Fenster-Erstellung, IPC-Registrierung
- `electron/windows.ts`
  - Fensterdefinitionen (`hud-overlay`, `editor`, `source-selector`)
- `electron/preload.ts`
  - Sicheres Bridge-API (`window.electronAPI`) fuer Renderer
- `electron/ipc/handlers.ts`
  - Main-seitige IPC-Handler (Sources, Speichern, Picker, Export)
- `src/App.tsx`
  - Routing nach `windowType` Query-Parameter
- `src/components/launch/*`
  - Aufnahme-Overlay + Source-Auswahl
- `src/components/video-editor/*`
  - Editor-UI, Timeline, Playback, Annotationen, Export-Dialoge
- `src/lib/exporter/*`
  - Rendering/Export-Logik, inkl. Tests

## AI Smart Editing (Feature)
Nicht-destruktives AI-Panel im Editor: erzeugt Transcript + Suggestions aus Video-Audio via Gemini API.

### Architektur-Layer
```
Renderer (React)               Main Process (Electron)
─────────────────               ────────────────────────
AIPanelSection.tsx              aiHandlers.ts (IPC)
  ├─ AISettingsSection.tsx        ├─ aiJobManager.ts (State-Machine, Retry, Timeout)
  ├─ AISegmentSummaryCard.tsx     ├─ aiProvider.ts (Provider-Registry)
  ├─ AISegmentList.tsx            ├─ geminiProvider.ts → geminiTranscriptionAdapter.ts
  ├─ useAISegmentNavigation.ts    ├─ aiSettingsStore.ts (verschluesselter Key via safeStorage)
  └─ suggestionEngine.ts         └─ aiArtifactStore.ts (userData/ai-artifacts/)
       ├─ fillerDetectionPass.ts
       ├─ deadAirDetectionPass.ts
       ├─ retakeDetectionPass.ts
       └─ mergeDedup.ts
```

### Dateistruktur
- `electron/ai/jobs/aiJobManager.ts` - Job-Lifecycle, Retry (max 2), Timeout (skaliert mit Dateigroesse)
- `electron/ai/providers/aiProvider.ts` - Provider-Interface + Registry
- `electron/ai/providers/geminiProvider.ts` - Gemini-Implementation
- `electron/ai/providers/geminiTranscriptionAdapter.ts` - API-Call, Normalisierung, Fehlerklassifikation
- `electron/ai/storage/aiSettingsStore.ts` - API-Key (safeStorage), Provider-Config, Analyse-Defaults
- `electron/ai/storage/aiArtifactStore.ts` - Transcript/Suggestions/JobStatus JSON in userData
- `electron/ipc/aiHandlers.ts` - IPC-Endpunkte (Start, Cancel, Status, Artifacts, Settings)
- `src/components/video-editor/ai/types.ts` - Datenvertraege (Transcript, Suggestion, Job, IPC)
- `src/components/video-editor/ai/suggestionTaxonomy.ts` - Kategorie-Registry, Farben, Fuellwoerter
- `src/components/video-editor/ai/engine/` - Suggestion-Pipeline (LLM + regelbasierte Passes)
- `src/components/video-editor/ai/mappers/suggestionTimelineMapper.ts` - Suggestion → Timeline-Aktion
- `src/lib/exporter/trimNormalizer.ts` - TrimRegion-Normalisierung vor Export

### IPC-Channels
- `AI_IPC_CHANNELS`: `ai-start-analysis`, `ai-cancel-analysis`, `ai-get-job-status`, `ai-get-artifacts`, `ai-job-progress`
- `AI_SETTINGS_IPC_CHANNELS`: `ai-settings-load`, `ai-settings-save`, `ai-settings-set-api-key`, `ai-settings-delete-api-key`, `ai-settings-get-api-key-status`

### Datenfluss
1. User klickt "AI-Analyse starten" → `AIPanelSection` → `window.electronAPI.aiStartAnalysis()`
2. Preload Bridge → IPC → `aiHandlers.ts` → `aiJobManager.startAnalysis()`
3. JobManager: Retry-Loop (max 2) mit Timeout (120s + 60s/100MB) → Provider → Gemini API
4. Ergebnis: Transcript + Suggestions → `suggestionEngine.enrichSuggestionsResult()` → Persistierung
5. Progress-Events via `BrowserWindow.webContents.send()` → Renderer
6. User reviewt Suggestions → "Als Cuts anwenden" → `mapSuggestionsToTimeline()` → TrimRegions

### Planung
- Vollstaendige Phasendokumentation: `docs/ai-smart-editing/`
- Datenvertrag-Spezifikation: `docs/ai-smart-editing/specs/transcript-suggestions-contract.md`

## Laufzeitfluss (kurz)
1. Electron startet `hud-overlay`.
2. Renderer liest `windowType` und zeigt passendes UI.
3. Aktionen laufen ueber `window.electronAPI` -> IPC -> Main Process.
4. Videos werden in `app.getPath('userData')/recordings` gespeichert.

## Build-Ausgabe
- Electron Builder schreibt Artefakte nach:
  - `release/<version>/...`
- `electron-builder.json5` steuert Targets und Extra-Resources.

## Arbeitsprinzipien fuer Aenderungen
- Erst bestehende Funktionen/Komponenten wiederverwenden, dann erweitern.
- Kleine, nachvollziehbare Aenderungen mit kurzer Verifikation.
- Bei Main/IPC-Aenderungen immer Renderer- und Main-Seite gemeinsam pruefen.
- Keine stillen Architekturwechsel ohne dokumentierte Entscheidung.
