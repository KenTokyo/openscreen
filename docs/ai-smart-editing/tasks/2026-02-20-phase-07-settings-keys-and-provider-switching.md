# Phase 07: Settings, API-Key-Persistenz und Provider-Switching

## ULTRATHINK

### 1. Zielbild

Der User kann seinen Gemini-API-Key persistent speichern (ueberlebt App-Neustart), die AI-Analyse-Konfiguration anpassen und spaeter zwischen AI-Providern wechseln. Die Architektur nutzt Electrons `safeStorage` fuer verschluesselte Key-Speicherung und eine JSON-basierte Settings-Datei fuer restliche Preferences.

Konkretes Ergebnis:
- API-Key wird verschluesselt im `userData`-Verzeichnis gespeichert
- Settings-JSON-Datei fuer Analyse-Konfiguration (Sprache, MinConfidence, etc.)
- Provider-Abstraktion: Interface `AIProvider` mit Gemini als erste Implementierung
- Settings-UI im AI-Panel: Key-Verwaltung, Provider-Auswahl (vorbereitet), Analyse-Config
- IPC-Channels fuer Settings CRUD (Load, Save, Delete-Key)

### 2. Risiken / Edge-Cases

| Risiko | Mitigation |
|---|---|
| `safeStorage` nicht verfuegbar (alte OS-Version) | Fallback auf Klartext-JSON mit Warnung |
| API-Key im Renderer-Speicher sichtbar | Key nie an Renderer zurueckgeben, nur `hasKey`-Status |
| Settings-Datei korrupt (manuelles Editieren) | Validierung + Fallback auf Defaults |
| Provider-Wechsel bei laufendem Job | Job-Status pruefen, Wechsel nur wenn kein Job laeuft |
| Migration bestehender In-Memory-Keys | Beim ersten Start: wenn In-Memory-Key vorhanden, in Settings uebernehmen |
| Race-Condition bei parallelem Settings-Schreiben | Sequentielles Schreiben (kein Caching im Main Process) |

### 3. Umsetzungsphasen

#### Phase 7.1: AI-Settings-Types
- `AIProviderType`: `'gemini'` (erweiterbar)
- `AIProviderConfig`: `{ type, apiKey (nur Main-seitig), model? }`
- `AISettings`: `{ activeProvider, providers: Record<AIProviderType, AIProviderConfig>, analysisDefaults: AIAnalysisConfig }`
- IPC-Channel-Konstanten fuer Settings

#### Phase 7.2: Settings-Persistenz (Electron Main)
- `electron/ai/storage/aiSettingsStore.ts`
- Speicherort: `userData/ai-settings.json`
- API-Key: Electron `safeStorage.encryptString()` → Base64 in JSON
- Load/Save/Delete mit Validierung
- Defaults fuer Erststart

#### Phase 7.3: IPC-Handler fuer Settings
- `ai-settings-load` → Vollstaendige Settings laden (ohne Key-Klartext)
- `ai-settings-save` → Settings speichern
- `ai-settings-set-api-key` → Key verschluesselt speichern (ersetzt `ai-set-api-key`)
- `ai-settings-delete-api-key` → Key loeschen
- `ai-settings-get-api-key-status` → `{ hasKey: boolean }` (ersetzt `ai-get-api-key-status`)
- Migration: In-Memory `storedApiKey` als Fallback beibehalten fuer Rueckwaertskompatibilitaet

#### Phase 7.4: Preload-Bridge + Types Update
- Neue Bridge-Methoden fuer Settings
- Type-Definitionen in `electron-env.d.ts` und `vite-env.d.ts` aktualisieren

#### Phase 7.5: Provider-Abstraktionsschicht
- Interface `AIProvider` mit `analyze()`-Methode
- `GeminiProvider` als erste Implementierung (Wrapper um bestehenden Adapter)
- `getProvider(type: AIProviderType)` Factory-Funktion
- Job-Manager nutzt Provider statt direkten Gemini-Call

#### Phase 7.6: Settings-UI im AI-Panel
- Settings-Bereich im AI-Panel (ausklappbar/Tab)
- API-Key-Verwaltung: Status-Anzeige, Aendern, Loeschen
- Analyse-Defaults: Sprache, MinConfidence
- Provider-Auswahl: Vorbereitet als Dropdown (nur Gemini aktiv)

### 4. Verifikation

- [ ] TypeScript-Check: 0 Fehler
- [ ] API-Key ueberlebt App-Neustart (verschluesselt gespeichert)
- [ ] Settings-Datei wird korrekt geschrieben/gelesen
- [ ] Bestehende AI-Analyse funktioniert weiterhin
- [ ] Key wird nie an Renderer als Klartext gesendet
- [ ] Fallback bei fehlender safeStorage funktioniert
- [ ] Migration von In-Memory-Key ist rueckwaertskompatibel
