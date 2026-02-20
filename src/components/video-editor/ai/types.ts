// =============================================================================
// AI Editing Types - Datenvertraege fuer Transcript, Suggestions und Job-Status
// =============================================================================

// -----------------------------------------------------------------------------
// Transcript Types
// -----------------------------------------------------------------------------

/** Einzelnes Wort mit Zeitstempel fuer praezises Scrubbing */
export interface TranscriptWord {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence: number; // 0.0 - 1.0
}

/** Segment = zusammenhaengender Abschnitt (Satz/Absatz) */
export interface TranscriptSegment {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence: number; // 0.0 - 1.0
  words?: TranscriptWord[];
  speakerLabel?: string; // optional, z.B. "Speaker 1"
}

/** Vollstaendiges Transcript-Artefakt */
export interface Transcript {
  videoPath: string;
  language: string; // ISO 639-1, z.B. "de", "en"
  durationMs: number;
  segments: TranscriptSegment[];
  createdAt: string; // ISO 8601
}

// -----------------------------------------------------------------------------
// Suggestion Types
// -----------------------------------------------------------------------------

/**
 * Normierte Kategorien fuer Suggestions.
 * Jede Kategorie hat klare User-Semantik und Apply-Strategie.
 */
export type SuggestionCategory =
  | 'keep'      // Guter Content, behalten
  | 'cut'       // Entfernen (z.B. Versprecher, Wiederholung)
  | 'filler'    // Fuellwoerter (aeh, aeehm, halt, quasi...)
  | 'dead-air'  // Stille/Pause laenger als Schwellenwert
  | 'retake'    // Wiederholter Anlauf - vorherige Version loeschen
  | 'unclear';  // Unsicher - User soll pruefen

/**
 * Welche Timeline-Aktion der User ausfuehren soll.
 * Non-destructive-first: Default ist 'mark', nicht 'cut'.
 */
export type SuggestionActionHint =
  | 'keep'   // Bereich beibehalten (keine Aktion noetig)
  | 'mark'   // Als Marker in Timeline setzen (sichtbar, aber kein Schnitt)
  | 'cut';   // Als Trim/Cut vorschlagen

/** Verweis auf ein Transcript-Segment oder -Wort */
export interface SuggestionSourceRef {
  segmentId: string;
  wordIds?: string[]; // optional: einzelne Woerter innerhalb des Segments
}

/** Einzelner AI-Vorschlag mit Begruendung */
export interface Suggestion {
  id: string;
  label: string;          // Kurzbeschreibung, z.B. "Filler: aeehm"
  category: SuggestionCategory;
  startMs: number;
  endMs: number;
  confidence: number;     // 0.0 - 1.0
  reasonShort: string;    // Einzeiler fuer Segmentliste
  reasonDetail: string;   // Ausfuehrliche Begruendung fuer Detail-View
  actionHint: SuggestionActionHint;
  sourceRefs: SuggestionSourceRef[];
}

/** Vollstaendiges Suggestions-Artefakt */
export interface SuggestionsResult {
  videoPath: string;
  totalDurationMs: number;
  suggestions: Suggestion[];
  createdAt: string; // ISO 8601
}

// -----------------------------------------------------------------------------
// Job-Lifecycle Types
// -----------------------------------------------------------------------------

/** Job-Status Statemachine */
export type AIJobPhase =
  | 'queued'         // Job angelegt, wartet
  | 'preparing'      // Audio-Extraktion, Preprocessing
  | 'transcribing'   // Transcript wird erzeugt
  | 'analyzing'      // Suggestions werden generiert
  | 'done'           // Erfolgreich abgeschlossen
  | 'failed'         // Fehler aufgetreten
  | 'cancelled';     // Vom User abgebrochen

/** Fehlerklassen fuer User-verstaendliche Recovery-Hinweise */
export type AIJobErrorClass =
  | 'network'         // Netzwerkproblem
  | 'auth'            // API-Key ungueltig
  | 'rate-limit'      // Rate Limit erreicht
  | 'timeout'         // Timeout bei Provider
  | 'invalid-input'   // Ungueltige Eingabedatei
  | 'provider-error'  // Allgemeiner Provider-Fehler
  | 'internal';       // Interner Fehler

/** Fehlerdetails */
export interface AIJobError {
  errorClass: AIJobErrorClass;
  message: string;          // Technische Fehlermeldung
  userHint: string;         // User-verstaendlicher Hinweis
  retryable: boolean;       // Kann der Job erneut gestartet werden?
}

/** Job-Fortschritt fuer Live-Updates */
export interface AIJobProgress {
  phase: AIJobPhase;
  percent: number;          // 0-100
  stepText: string;         // z.B. "Audio wird extrahiert..."
}

/** Vollstaendiger Job-Status Snapshot */
export interface AIJobStatus {
  jobId: string;
  videoPath: string;
  phase: AIJobPhase;
  progress: AIJobProgress;
  error?: AIJobError;
  startedAt: string;        // ISO 8601
  completedAt?: string;     // ISO 8601
}

// -----------------------------------------------------------------------------
// Job-Start Configuration
// -----------------------------------------------------------------------------

/** Konfiguration beim Start einer AI-Analyse */
export interface AIAnalysisConfig {
  language?: string;           // ISO 639-1, default: auto-detect
  maxDurationMs?: number;      // Limit fuer Analyse-Laenge
  suggestionCategories?: SuggestionCategory[]; // Nur bestimmte Kategorien
  minConfidence?: number;      // Mindest-Confidence fuer Suggestions (0.0 - 1.0)
  fillerWordList?: string[];   // Benutzerdefinierte Fuellwortliste
}

/** Standard-Konfiguration */
export const DEFAULT_AI_ANALYSIS_CONFIG: AIAnalysisConfig = {
  language: undefined,  // auto-detect
  maxDurationMs: undefined,
  suggestionCategories: undefined, // alle Kategorien
  minConfidence: 0.5,
  fillerWordList: undefined,
};

// -----------------------------------------------------------------------------
// AI Provider & Settings Types
// -----------------------------------------------------------------------------

/** Unterstuetzte AI-Provider (erweiterbar) */
export type AIProviderType = 'gemini';

/** Provider-spezifische Konfiguration (Renderer-seitig, OHNE Klartext-Key) */
export interface AIProviderConfig {
  type: AIProviderType;
  hasApiKey: boolean;
  model?: string;
}

/** Persistierte AI-Settings (Renderer-seitig, OHNE Klartext-Keys) */
export interface AISettings {
  activeProvider: AIProviderType;
  providers: Partial<Record<AIProviderType, AIProviderConfig>>;
  analysisDefaults: AIAnalysisConfig;
}

/** Standard-Settings */
export const DEFAULT_AI_SETTINGS: AISettings = {
  activeProvider: 'gemini',
  providers: {
    gemini: { type: 'gemini', hasApiKey: false },
  },
  analysisDefaults: { ...DEFAULT_AI_ANALYSIS_CONFIG },
};

/** Provider-Metadaten fuer UI (Label, Beschreibung, etc.) */
export const AI_PROVIDER_META: Record<AIProviderType, { label: string; description: string }> = {
  gemini: { label: 'Google Gemini', description: 'Gemini 3 Flash Preview - Video-Analyse mit Transcript + Suggestions' },
};

// -----------------------------------------------------------------------------
// IPC Channel Names (Konstanten)
// -----------------------------------------------------------------------------

export const AI_IPC_CHANNELS = {
  START_ANALYSIS: 'ai-start-analysis',
  CANCEL_ANALYSIS: 'ai-cancel-analysis',
  GET_JOB_STATUS: 'ai-get-job-status',
  GET_ARTIFACTS: 'ai-get-artifacts',
  JOB_PROGRESS: 'ai-job-progress',
} as const;

export const AI_SETTINGS_IPC_CHANNELS = {
  LOAD: 'ai-settings-load',
  SAVE: 'ai-settings-save',
  SET_API_KEY: 'ai-settings-set-api-key',
  DELETE_API_KEY: 'ai-settings-delete-api-key',
  GET_API_KEY_STATUS: 'ai-settings-get-api-key-status',
} as const;

// -----------------------------------------------------------------------------
// IPC Request/Response Types
// -----------------------------------------------------------------------------

/** Request: Analyse starten */
export interface AIStartAnalysisRequest {
  videoPath: string;
  config: AIAnalysisConfig;
}

/** Response: Analyse gestartet */
export interface AIStartAnalysisResponse {
  success: boolean;
  jobId?: string;
  error?: string;
}

/** Response: Artefakte abrufen */
export interface AIGetArtifactsResponse {
  success: boolean;
  transcript?: Transcript;
  suggestions?: SuggestionsResult;
  error?: string;
}

// -----------------------------------------------------------------------------
// Timeline-Mapping Types
// -----------------------------------------------------------------------------

/** Ergebnis eines Suggestion-zu-Timeline-Mappings */
export type TimelineAction =
  | 'add-marker'    // Marker in Timeline setzen
  | 'add-trim'      // TrimRegion erzeugen
  | 'skip';         // Keine Aktion (z.B. keep-Segment)

/** Einzelnes Mapping-Ergebnis */
export interface SuggestionTimelineMapping {
  suggestionId: string;
  action: TimelineAction;
  startMs: number;
  endMs: number;
  label: string;
  category: SuggestionCategory;
}

/** Gesamtergebnis der Suggestion-zu-Timeline-Abbildung */
export interface SuggestionTimelineMappingResult {
  mappings: SuggestionTimelineMapping[];
  totalKeepDurationMs: number;
  totalCutDurationMs: number;
  totalMarkerCount: number;
  totalTrimCount: number;
}
