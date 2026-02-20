// =============================================================================
// Suggestion Engine - Pipeline-Orchestrator
// Kombiniert LLM-Suggestions mit regelbasierten Passes und bereinigt das Ergebnis
// =============================================================================

import type { Transcript, Suggestion, SuggestionsResult } from '../types';
import { fillerDetectionPass } from './fillerDetectionPass';
import { deadAirDetectionPass } from './deadAirDetectionPass';
import { retakeDetectionPass } from './retakeDetectionPass';
import { mergeDedupPass } from './mergeDedup';

// -----------------------------------------------------------------------------
// Konfiguration
// -----------------------------------------------------------------------------

export interface SuggestionEngineConfig {
  /** Regelbasierte Filler-Erkennung aktivieren */
  enableFillerDetection: boolean;
  /** Dead-Air-Erkennung aktivieren */
  enableDeadAirDetection: boolean;
  /** Retake-Erkennung aktivieren */
  enableRetakeDetection: boolean;
  /** Benutzerdefinierte Fuellwortliste (optional) */
  customFillerWords?: string[];
  /** Minimale Dead-Air-Dauer in ms (optional, Default aus Taxonomie) */
  deadAirMinMs?: number;
}

export const DEFAULT_ENGINE_CONFIG: SuggestionEngineConfig = {
  enableFillerDetection: true,
  enableDeadAirDetection: true,
  enableRetakeDetection: true,
};

// -----------------------------------------------------------------------------
// Pipeline
// -----------------------------------------------------------------------------

/**
 * Fuehrt die Suggestion-Engine-Pipeline aus.
 *
 * Pipeline:
 * 1. Nimmt die LLM-generierten Suggestions als Basis
 * 2. Fuehrt regelbasierte Passes aus (Filler, Dead-Air, Retake)
 * 3. Kombiniert alle Suggestions
 * 4. Bereinigt Ueberlappungen und sortiert
 *
 * @param transcript - Das Transcript mit Segmenten und optional Woertern
 * @param llmSuggestions - Bereits vom LLM erzeugte Suggestions
 * @param config - Engine-Konfiguration
 * @returns Bereinigte und sortierte Suggestions
 */
export function runSuggestionEngine(
  transcript: Transcript,
  llmSuggestions: Suggestion[],
  config: Partial<SuggestionEngineConfig> = {}
): Suggestion[] {
  const fullConfig: SuggestionEngineConfig = {
    ...DEFAULT_ENGINE_CONFIG,
    ...config,
  };

  // Start mit LLM-Suggestions als Basis
  const allSuggestions: Suggestion[] = [...llmSuggestions];

  // Pass 1: Filler-Detection
  if (fullConfig.enableFillerDetection) {
    const fillerSuggestions = fillerDetectionPass(
      transcript,
      allSuggestions,
      fullConfig.customFillerWords
    );
    allSuggestions.push(...fillerSuggestions);
  }

  // Pass 2: Dead-Air-Detection
  if (fullConfig.enableDeadAirDetection) {
    const deadAirSuggestions = deadAirDetectionPass(
      transcript,
      allSuggestions,
      fullConfig.deadAirMinMs
    );
    allSuggestions.push(...deadAirSuggestions);
  }

  // Pass 3: Retake-Detection
  if (fullConfig.enableRetakeDetection) {
    const retakeSuggestions = retakeDetectionPass(
      transcript,
      allSuggestions
    );
    allSuggestions.push(...retakeSuggestions);
  }

  // Final: Merge/Dedup + Sort
  return mergeDedupPass(allSuggestions);
}

/**
 * Convenience-Funktion: Verarbeitet ein vollstaendiges SuggestionsResult.
 * Gibt ein neues SuggestionsResult mit angereicherten Suggestions zurueck.
 */
export function enrichSuggestionsResult(
  transcript: Transcript,
  suggestionsResult: SuggestionsResult,
  config?: Partial<SuggestionEngineConfig>
): SuggestionsResult {
  const enriched = runSuggestionEngine(
    transcript,
    suggestionsResult.suggestions,
    config
  );

  return {
    ...suggestionsResult,
    suggestions: enriched,
  };
}
