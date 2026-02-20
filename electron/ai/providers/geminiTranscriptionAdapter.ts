// =============================================================================
// Gemini Transcription Adapter
// Provider-spezifischer Call an Gemini API + Normalisierung der Antwort
// in die provider-agnostischen Transcript- und Suggestions-Typen
// =============================================================================

import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import fs from 'node:fs/promises'
import path from 'node:path'
import { v4 as uuidv4 } from 'uuid'
import type {
  Transcript,
  TranscriptSegment,
  SuggestionsResult,
  Suggestion,
  SuggestionCategory,
  SuggestionActionHint,
  AIAnalysisConfig,
} from '../../../src/components/video-editor/ai/types'
import {
  getDefaultActionHint,
} from '../../../src/components/video-editor/ai/suggestionTaxonomy'

// -----------------------------------------------------------------------------
// Gemini-spezifische Typen (nur intern, nie nach aussen exponiert)
// -----------------------------------------------------------------------------

interface GeminiSegmentRaw {
  text: string
  start_ms: number
  end_ms: number
  confidence: number
  speaker?: string
}

interface GeminiTranscriptRaw {
  language: string
  segments: GeminiSegmentRaw[]
}

interface GeminiSuggestionRaw {
  label: string
  category: string
  start_ms: number
  end_ms: number
  confidence: number
  reason_short: string
  reason_detail: string
  action_hint?: string
  segment_indices: number[]
}

interface GeminiAnalysisRaw {
  transcript: GeminiTranscriptRaw
  suggestions: GeminiSuggestionRaw[]
}

// -----------------------------------------------------------------------------
// Konfiguration
// -----------------------------------------------------------------------------

const SUPPORTED_MIME_TYPES: Record<string, string> = {
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
}

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024 // 500 MB

// Gemini-Modell fuer Audio/Video-Analyse
const GEMINI_MODEL = 'gemini-3-flash-preview'

// -----------------------------------------------------------------------------
// Prompt
// -----------------------------------------------------------------------------

function buildAnalysisPrompt(config: AIAnalysisConfig): string {
  const languageHint = config.language
    ? `The audio is in "${config.language}". `
    : 'Auto-detect the spoken language. '

  const categoriesHint = config.suggestionCategories
    ? `Only generate suggestions for these categories: ${config.suggestionCategories.join(', ')}. `
    : ''

  const fillerHint = config.fillerWordList
    ? `Use this custom filler word list: ${config.fillerWordList.join(', ')}. `
    : ''

  const confidenceHint = config.minConfidence
    ? `Only include suggestions with confidence >= ${config.minConfidence}. `
    : ''

  return `You are a professional video editor assistant. Analyze this video's audio track and produce:

1. A transcript with timestamps (start_ms, end_ms) for each segment (sentence or clause).
2. Editing suggestions identifying problems like filler words, dead air, retakes, unclear speech, and sections to cut.

${languageHint}${categoriesHint}${fillerHint}${confidenceHint}

Rules:
- Timestamps are in milliseconds from the start of the video.
- Each segment should be a natural sentence or clause boundary.
- Confidence is a float 0.0-1.0 indicating how sure you are.
- For suggestions, segment_indices references the 0-based index into the transcript segments array.
- Categories must be one of: keep, cut, filler, dead-air, retake, unclear.
- action_hint must be one of: keep, mark, cut.
- Be conservative: only suggest cuts for clearly problematic content.
- Provide a concise reason_short (one line) and a detailed reason_detail.

Respond with ONLY valid JSON matching this structure (no markdown, no wrapping):
{
  "transcript": {
    "language": "en",
    "segments": [
      { "text": "...", "start_ms": 0, "end_ms": 1500, "confidence": 0.95, "speaker": "Speaker 1" }
    ]
  },
  "suggestions": [
    {
      "label": "Filler: uhm",
      "category": "filler",
      "start_ms": 1200,
      "end_ms": 1500,
      "confidence": 0.85,
      "reason_short": "Filler word detected",
      "reason_detail": "The speaker uses 'uhm' as a filler between sentences.",
      "action_hint": "mark",
      "segment_indices": [0]
    }
  ]
}`
}

// -----------------------------------------------------------------------------
// Validierung und Normalisierung
// -----------------------------------------------------------------------------

const VALID_CATEGORIES: SuggestionCategory[] = [
  'keep', 'cut', 'filler', 'dead-air', 'retake', 'unclear',
]
const VALID_ACTION_HINTS: SuggestionActionHint[] = ['keep', 'mark', 'cut']

function normalizeCategory(raw: string): SuggestionCategory {
  const cleaned = raw.toLowerCase().trim()
  if (VALID_CATEGORIES.includes(cleaned as SuggestionCategory)) {
    return cleaned as SuggestionCategory
  }
  return 'unclear'
}

function normalizeActionHint(
  raw: string | undefined,
  category: SuggestionCategory
): SuggestionActionHint {
  if (raw) {
    const cleaned = raw.toLowerCase().trim()
    if (VALID_ACTION_HINTS.includes(cleaned as SuggestionActionHint)) {
      return cleaned as SuggestionActionHint
    }
  }
  return getDefaultActionHint(category)
}

function normalizeSegments(
  raw: GeminiSegmentRaw[]
): TranscriptSegment[] {
  return raw
    .filter((s) => s.text && s.start_ms >= 0 && s.end_ms > s.start_ms)
    .map((s) => ({
      id: uuidv4(),
      text: s.text.trim(),
      startMs: Math.round(s.start_ms),
      endMs: Math.round(s.end_ms),
      confidence: Math.max(0, Math.min(1, s.confidence ?? 0.5)),
      speakerLabel: s.speaker || undefined,
    }))
}

function normalizeSuggestions(
  raw: GeminiSuggestionRaw[],
  segments: TranscriptSegment[]
): Suggestion[] {
  return raw
    .filter((s) => s.start_ms >= 0 && s.end_ms > s.start_ms)
    .map((s) => {
      const category = normalizeCategory(s.category)
      const actionHint = normalizeActionHint(s.action_hint, category)

      // Source-Refs aus segment_indices ableiten
      const sourceRefs = (s.segment_indices || [])
        .filter((idx) => idx >= 0 && idx < segments.length)
        .map((idx) => ({ segmentId: segments[idx].id }))

      return {
        id: uuidv4(),
        label: s.label || `${category}`,
        category,
        startMs: Math.round(s.start_ms),
        endMs: Math.round(s.end_ms),
        confidence: Math.max(0, Math.min(1, s.confidence ?? 0.5)),
        reasonShort: s.reason_short || '',
        reasonDetail: s.reason_detail || '',
        actionHint,
        sourceRefs,
      }
    })
}

// -----------------------------------------------------------------------------
// Fehlerklassifikation
// -----------------------------------------------------------------------------

export interface GeminiAdapterError {
  errorClass: 'network' | 'auth' | 'rate-limit' | 'timeout' | 'invalid-input' | 'provider-error' | 'internal'
  message: string
  retryable: boolean
}

function classifyError(error: unknown): GeminiAdapterError {
  const message = error instanceof Error ? error.message : String(error)
  const lowerMsg = message.toLowerCase()

  if (lowerMsg.includes('api key') || lowerMsg.includes('401') || lowerMsg.includes('403')) {
    return { errorClass: 'auth', message, retryable: false }
  }
  if (lowerMsg.includes('429') || lowerMsg.includes('rate limit') || lowerMsg.includes('quota')) {
    return { errorClass: 'rate-limit', message, retryable: true }
  }
  if (lowerMsg.includes('timeout') || lowerMsg.includes('deadline')) {
    return { errorClass: 'timeout', message, retryable: true }
  }
  if (lowerMsg.includes('network') || lowerMsg.includes('econnrefused') || lowerMsg.includes('fetch failed')) {
    return { errorClass: 'network', message, retryable: true }
  }
  if (lowerMsg.includes('invalid') || lowerMsg.includes('unsupported')) {
    return { errorClass: 'invalid-input', message, retryable: false }
  }

  return { errorClass: 'provider-error', message, retryable: true }
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export interface GeminiAnalysisResult {
  transcript: Transcript
  suggestions: SuggestionsResult
}

/**
 * Fuehrt eine Gemini-Analyse eines Videos durch.
 *
 * @param videoPath - Absoluter Pfad zur Video-Datei
 * @param apiKey - Gemini API Key
 * @param config - Analyse-Konfiguration
 * @param signal - AbortSignal fuer Cancel
 * @returns Normalisiertes Transcript + Suggestions
 * @throws GeminiAdapterError bei Fehlern
 */
export async function analyzeVideoWithGemini(
  videoPath: string,
  apiKey: string,
  config: AIAnalysisConfig,
  signal?: AbortSignal
): Promise<GeminiAnalysisResult> {
  // 1. Eingabe validieren
  const ext = path.extname(videoPath).toLowerCase()
  const mimeType = SUPPORTED_MIME_TYPES[ext]
  if (!mimeType) {
    throw {
      errorClass: 'invalid-input',
      message: `Unsupported video format: ${ext}`,
      retryable: false,
    } as GeminiAdapterError
  }

  const stat = await fs.stat(videoPath)
  if (stat.size > MAX_FILE_SIZE_BYTES) {
    throw {
      errorClass: 'invalid-input',
      message: `File too large: ${Math.round(stat.size / 1024 / 1024)}MB (max ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB)`,
      retryable: false,
    } as GeminiAdapterError
  }

  // 2. Cancel pruefen
  if (signal?.aborted) {
    throw { errorClass: 'internal', message: 'Cancelled', retryable: false } as GeminiAdapterError
  }

  // 3. Video-Datei lesen
  const videoData = await fs.readFile(videoPath)
  const base64Data = videoData.toString('base64')

  // 4. Cancel pruefen
  if (signal?.aborted) {
    throw { errorClass: 'internal', message: 'Cancelled', retryable: false } as GeminiAdapterError
  }

  // 5. Gemini API Call
  try {
    const ai = new GoogleGenAI({ apiKey })

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: buildAnalysisPrompt(config),
            },
          ],
        },
      ],
      config: {
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
        responseMimeType: 'application/json',
      },
    })

    // 6. Cancel pruefen
    if (signal?.aborted) {
      throw { errorClass: 'internal', message: 'Cancelled', retryable: false } as GeminiAdapterError
    }

    // 7. Response parsen
    const responseText = response.text
    if (!responseText) {
      throw {
        errorClass: 'provider-error',
        message: 'Empty response from Gemini',
        retryable: true,
      } as GeminiAdapterError
    }

    let parsed: GeminiAnalysisRaw
    try {
      parsed = JSON.parse(responseText) as GeminiAnalysisRaw
    } catch {
      throw {
        errorClass: 'provider-error',
        message: `Failed to parse Gemini response as JSON: ${responseText.slice(0, 200)}`,
        retryable: true,
      } as GeminiAdapterError
    }

    // 8. Validierung der Struktur
    if (!parsed.transcript?.segments || !Array.isArray(parsed.transcript.segments)) {
      throw {
        errorClass: 'provider-error',
        message: 'Gemini response missing transcript.segments array',
        retryable: true,
      } as GeminiAdapterError
    }

    if (!Array.isArray(parsed.suggestions)) {
      parsed.suggestions = []
    }

    // 9. Normalisierung
    const segments = normalizeSegments(parsed.transcript.segments)

    const videoDurationMs = segments.length > 0
      ? Math.max(...segments.map((s) => s.endMs))
      : 0

    const transcript: Transcript = {
      videoPath,
      language: parsed.transcript.language || 'en',
      durationMs: videoDurationMs,
      segments,
      createdAt: new Date().toISOString(),
    }

    const suggestions = normalizeSuggestions(parsed.suggestions, segments)

    const suggestionsResult: SuggestionsResult = {
      videoPath,
      totalDurationMs: videoDurationMs,
      suggestions,
      createdAt: new Date().toISOString(),
    }

    return { transcript, suggestions: suggestionsResult }
  } catch (error) {
    // Bereits klassifizierte Fehler durchreichen
    if (
      typeof error === 'object' &&
      error !== null &&
      'errorClass' in error
    ) {
      throw error
    }
    throw classifyError(error)
  }
}
