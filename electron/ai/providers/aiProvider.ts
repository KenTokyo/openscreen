// =============================================================================
// AI Provider Interface - Abstraktion fuer verschiedene AI-Backends
// =============================================================================

import type {
  Transcript,
  SuggestionsResult,
  AIAnalysisConfig,
} from '../../../src/components/video-editor/ai/types'

// -----------------------------------------------------------------------------
// Provider Interface
// -----------------------------------------------------------------------------

export interface AIProviderAnalysisResult {
  transcript: Transcript
  suggestions: SuggestionsResult
}

export interface AIProvider {
  /** Provider-ID */
  readonly type: string
  /** Fuehrt Analyse durch und gibt normalisiertes Ergebnis zurueck */
  analyze(
    videoPath: string,
    apiKey: string,
    config: AIAnalysisConfig,
    signal?: AbortSignal
  ): Promise<AIProviderAnalysisResult>
}

// -----------------------------------------------------------------------------
// Provider Registry
// -----------------------------------------------------------------------------

import { GeminiProvider } from './geminiProvider'

const providers: Record<string, AIProvider> = {
  gemini: new GeminiProvider(),
}

/**
 * Gibt den Provider fuer den angegebenen Typ zurueck.
 * Wirft einen Fehler wenn der Provider nicht registriert ist.
 */
export function getProvider(type: string): AIProvider {
  const provider = providers[type]
  if (!provider) {
    throw new Error(`Unbekannter AI-Provider: "${type}". Verfuegbar: ${Object.keys(providers).join(', ')}`)
  }
  return provider
}
