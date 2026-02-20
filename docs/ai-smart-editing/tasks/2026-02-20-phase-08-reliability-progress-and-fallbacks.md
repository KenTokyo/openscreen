# Phase 08: Reliability, Progress and Fallbacks

## ULTRATHINK

### 1. Zielbild

Die AI-Analyse-Pipeline wird robuster und benutzerfreundlicher:

- **Automatischer Retry** mit Exponential Backoff fuer transiente Fehler (Rate-Limit, Timeout, Netzwerk)
- **Timeout-Schutz** als Wrapper um den Gemini-API-Call mit konfigurierbarer Dauer
- **Granularere Progress-Events** mit Phasen-Unterteilung (Datei lesen, Upload, API-Antwort, Nachverarbeitung)
- **Verbesserte Fehler-UX** im Renderer: Retry-Countdown, Auto-Retry-Indikator, klare Fehlerzustaende
- **IPC-Handler-Haertung** mit fehlenden try/catch-Bloecken

### 2. Risiken / Edge-Cases

| Risiko | Mitigation |
|---|---|
| Endlos-Retry bei persistentem Fehler | Max-Retries = 2, nur fuer retryable Errors |
| Timeout zu kurz fuer grosse Videos | Skalierender Timeout basierend auf Dateigroesse (120s Basis + 60s pro 100MB) |
| Retry waehrend Cancel | Abort-Signal wird vor jedem Retry geprueft |
| Memory-Druck bei mehrfachem Retry (Video im Speicher) | Video wird nur einmal gelesen und wiederverwendet |
| Race-Condition: neuer Job startet waehrend Retry | runningJobId-Lock bleibt bestehen waehrend gesamtem Retry-Zyklus |
| Renderer zeigt veralteten Retry-Status | Jeder Retry-Versuch broadcastet eigene Progress-Events |

### 3. Umsetzungsphasen

#### 3.1 Retry-Logik im aiJobManager
- `MAX_RETRIES = 2`, Delay: 2s, 8s (Exponential Backoff mit Faktor 4)
- Nur fuer `retryable: true` Errors
- Abort-Check vor jedem Retry
- Neue Progress-Phase: `retrying` (wird als Sub-State der aktuellen Phase kommuniziert)

#### 3.2 Timeout-Schutz
- `withTimeout(promise, ms, signal)` Utility
- Basis-Timeout: 120s + 60s pro 100MB Dateigroesse
- Timeout-Error wird als `timeout` klassifiziert → retryable

#### 3.3 Granularere Progress
- Phase-Splitting: `preparing` → "Datei wird gelesen" (5%) → "Daten werden vorbereitet" (10%)
- Phase-Splitting: `transcribing` → "API-Anfrage wird gesendet" (15%) → "Warte auf Antwort..." (20-75%)
- Phase-Splitting: `analyzing` → "Ergebnisse werden verarbeitet" (80%) → "Speichern..." (90%)
- Retry-Indikator: "Erneuter Versuch (1/2)..."

#### 3.4 Renderer Fehler-UX
- Retry-Countdown-Anzeige wenn Auto-Retry laeuft
- Fehler-Card mit Retry-Zaehler und manuellem Retry-Button
- Abbrechen waehrend Retry moeglich

#### 3.5 IPC-Handler-Haertung
- try/catch fuer Artifact-Loading und has-Artifacts Handler (bereits teilweise vorhanden)
- Konsistente Error-Response-Struktur

### 4. Verifikation

- TypeScript-Check: 0 Fehler
- Retry-Logik: retryable Errors loesen maximal 2 Retries aus
- Timeout: Videos > 200MB bekommen proportional mehr Zeit
- Abort-Signal unterbricht Retry-Wartezeit
- Progress-Events zeigen Retry-Versuch deutlich an
- Keine bestehende Funktionalitaet wird gebrochen (Phase 01-07 intakt)
