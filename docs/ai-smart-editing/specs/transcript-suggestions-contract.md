# Contract-Spezifikation: Transcript & Suggestions

> ULTRATHINK - Menschlich lesbare Dokumentation der JSON-Datenvertraege zwischen AI-Provider, Main Process und Renderer.

## Uebersicht

Dieses Dokument beschreibt die drei zentralen Daten-Artefakte:
1. **Transcript** - Das automatische Transkript des Videos
2. **Suggestions** - KI-Vorschlaege fuer Schnitt/Bearbeitung
3. **Job-Status** - Lifecycle eines Analyse-Jobs

Alle Typen sind in `src/components/video-editor/ai/types.ts` definiert.

## 1. Transcript

### Zweck
Das Transcript enthaelt den erkannten Text mit praezisen Zeitstempeln. Es ist die Grundlage fuer alle Suggestions.

### Struktur

```
Transcript
├── videoPath: string          (Pfad zum analysierten Video)
├── language: string           (ISO 639-1, z.B. "de", "en")
├── durationMs: number         (Gesamtlaenge in Millisekunden)
├── segments: TranscriptSegment[]
│   ├── id: string             (eindeutig, z.B. "seg-001")
│   ├── text: string           (Text des Segments)
│   ├── startMs: number        (Startzeit in ms)
│   ├── endMs: number          (Endzeit in ms)
│   ├── confidence: number     (0.0 - 1.0)
│   ├── words?: TranscriptWord[] (optional, fuer praezises Scrubbing)
│   │   ├── id: string
│   │   ├── text: string
│   │   ├── startMs: number
│   │   ├── endMs: number
│   │   └── confidence: number
│   └── speakerLabel?: string  (optional, z.B. "Speaker 1")
└── createdAt: string          (ISO 8601)
```

### Validierungsregeln
- `segments` muessen monoton aufsteigend sortiert sein (nach startMs)
- `endMs > startMs` fuer jedes Segment und Wort
- `confidence` muss im Bereich [0.0, 1.0] liegen
- `durationMs` muss >= letztem Segment-Ende sein
- Keine lueckenlosen Anforderungen: Pausen zwischen Segmenten sind normal

## 2. Suggestions

### Zweck
Suggestions sind KI-Vorschlaege, die dem User helfen, problematische Stellen zu finden. Sie sind IMMER non-destructive (erst Apply macht Aenderungen).

### Kategorien

| Kategorie | Farbe | Default-Aktion | Beschreibung |
|-----------|-------|-----------------|--------------|
| keep | Gruen (#22c55e) | keep | Guter Content, behalten |
| cut | Rot (#ef4444) | cut | Entfernen (Versprecher, Wiederholung) |
| filler | Amber (#f59e0b) | mark | Fuellwoerter (aeh, halt, quasi...) |
| dead-air | Indigo (#6366f1) | cut | Laengere Stille ohne Inhalt |
| retake | Violet (#8b5cf6) | cut | Wiederholter Anlauf |
| unclear | Slate (#94a3b8) | mark | Unsicher, User soll pruefen |

### Struktur

```
SuggestionsResult
├── videoPath: string
├── totalDurationMs: number
├── suggestions: Suggestion[]
│   ├── id: string             (eindeutig, z.B. "sug-001")
│   ├── label: string          (Kurzbeschreibung, z.B. "Filler: aeehm")
│   ├── category: SuggestionCategory
│   ├── startMs: number
│   ├── endMs: number
│   ├── confidence: number     (0.0 - 1.0)
│   ├── reasonShort: string    (Einzeiler fuer Segmentliste)
│   ├── reasonDetail: string   (ausfuehrlich fuer Detail-View)
│   ├── actionHint: SuggestionActionHint  (keep | mark | cut)
│   └── sourceRefs: SuggestionSourceRef[]
│       ├── segmentId: string
│       └── wordIds?: string[]
└── createdAt: string
```

### Validierungsregeln
- `endMs > startMs` fuer jede Suggestion
- `confidence` im Bereich [0.0, 1.0]
- `sourceRefs` muessen auf existierende Transcript-IDs verweisen
- Suggestions duerfen sich zeitlich ueberlappen (verschiedene Kategorien)
- Gleiche Kategorie: Ueberlappungen werden beim Mapping zusammengefuehrt

## 3. Job-Status

### Zweck
Der Job-Status bildet den Lifecycle einer AI-Analyse ab. Er wird per IPC-Events an den Renderer gesendet.

### Status-Statemachine

```
queued → preparing → transcribing → analyzing → done
                                              ↗
              (jederzeit) → cancelled / failed
```

### Struktur

```
AIJobStatus
├── jobId: string
├── videoPath: string
├── phase: AIJobPhase
├── progress: AIJobProgress
│   ├── phase: AIJobPhase
│   ├── percent: number (0-100)
│   └── stepText: string
├── error?: AIJobError
│   ├── errorClass: AIJobErrorClass
│   ├── message: string
│   ├── userHint: string
│   └── retryable: boolean
├── startedAt: string
└── completedAt?: string
```

### Fehlerklassen

| Klasse | User-Hinweis | Retryable |
|--------|-------------|-----------|
| network | Netzwerkverbindung pruefen | Ja |
| auth | API-Key in Einstellungen pruefen | Nein |
| rate-limit | Kurz warten, dann erneut versuchen | Ja |
| timeout | Video kuerzen oder spaeter versuchen | Ja |
| invalid-input | Dateiformat nicht unterstuetzt | Nein |
| provider-error | Provider-Problem, spaeter versuchen | Ja |
| internal | App neustarten | Nein |

## 4. Timeline-Mapping

### Zweck
Uebersetzt Suggestions in konkrete Timeline-Aktionen. Die Logik liegt in `src/components/video-editor/ai/mappers/suggestionTimelineMapper.ts`.

### Mapping-Modi

**markers-only (Default):** Alle Suggestions werden zu Timeline-Markern. Kein automatischer Schnitt.

**proposed-cuts:** Suggestions mit `actionHint: 'cut'` werden zu TrimRegions. Alles andere wird Marker.

### Mapping-Regeln
1. `keep` → immer `skip` (keine Timeline-Aktion)
2. Confidence < Schwellenwert → `skip`
3. markers-only Modus → alles `add-marker`
4. proposed-cuts Modus:
   - `actionHint: 'cut'` + Dauer >= Min → `add-trim`
   - `actionHint: 'cut'` + Dauer < Min → `add-marker` (Degradierung)
   - `actionHint: 'mark'` → `add-marker`

### Padding
Trims erhalten configurable Padding (Default: 100ms) links und rechts, damit keine Atemgeraeusche abgeschnitten werden.

## 5. IPC-Kanaele

| Kanal | Richtung | Zweck |
|-------|----------|-------|
| ai-start-analysis | Renderer → Main | Analyse starten |
| ai-cancel-analysis | Renderer → Main | Analyse abbrechen |
| ai-get-job-status | Renderer → Main | Status-Snapshot holen |
| ai-get-artifacts | Renderer → Main | Transcript + Suggestions holen |
| ai-job-progress | Main → Renderer | Live-Updates (Push) |

## 6. Provider-Agnostik

Die Core-Types (Transcript, Suggestion, JobStatus) enthalten KEINE provider-spezifischen Felder. Provider-Adapter (z.B. Gemini) normalisieren ihre Antworten in dieses Format. So bleibt ein Provider-Wechsel (Gemini 2.5 → 3 → alternatives LLM) ohne Datenformat-Bruch moeglich.
