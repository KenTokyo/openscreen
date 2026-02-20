// =============================================================================
// Suggestion-Timeline-Mapper
// Uebersetzt AI-Suggestions in konkrete Timeline-Aktionen (Marker/Trim/Skip)
// =============================================================================

import type {
  Suggestion,
  SuggestionCategory,
  SuggestionTimelineMapping,
  SuggestionTimelineMappingResult,
  TimelineAction,
} from '../types';

import {
  SUGGESTION_CATEGORIES,
  DURATION_THRESHOLDS,
  CONFIDENCE_THRESHOLDS,
  getSpanDurationMs,
} from '../suggestionTaxonomy';

// -----------------------------------------------------------------------------
// Mapping-Konfiguration
// -----------------------------------------------------------------------------

export interface MappingConfig {
  /** Modus: 'markers-only' setzt nur Marker, 'proposed-cuts' setzt auch Trims */
  mode: 'markers-only' | 'proposed-cuts';
  /** Minimale Confidence fuer sichtbare Mappings */
  minConfidence: number;
  /** Padding links/rechts um Cuts (ms) */
  cutPaddingMs: number;
  /** Minimale Cut-Dauer (ms), darunter wird zu Marker degradiert */
  minCutDurationMs: number;
  /** Kategorien die uebersprungen werden sollen */
  excludeCategories: SuggestionCategory[];
}

export const DEFAULT_MAPPING_CONFIG: MappingConfig = {
  mode: 'markers-only',
  minConfidence: CONFIDENCE_THRESHOLDS.DISPLAY_MIN,
  cutPaddingMs: DURATION_THRESHOLDS.CUT_PADDING_MS,
  minCutDurationMs: DURATION_THRESHOLDS.MIN_CUT_DURATION_MS,
  excludeCategories: [],
};

// -----------------------------------------------------------------------------
// Einzelne Suggestion mappen
// -----------------------------------------------------------------------------

/**
 * Bestimmt die Timeline-Aktion fuer eine einzelne Suggestion.
 *
 * Regeln:
 * 1. 'keep'-Kategorie → immer 'skip' (kein Eingriff)
 * 2. Confidence unter Schwellenwert → 'skip'
 * 3. Modus 'markers-only' → alles wird zu 'add-marker'
 * 4. Modus 'proposed-cuts':
 *    - Wenn actionHint 'cut' und Dauer >= minCutDurationMs → 'add-trim'
 *    - Wenn actionHint 'mark' → 'add-marker'
 *    - Wenn Dauer zu kurz fuer Cut → 'add-marker' (Degradierung)
 */
function resolveAction(
  suggestion: Suggestion,
  config: MappingConfig
): TimelineAction {
  // Keep-Segmente immer ueberspringen
  if (suggestion.category === 'keep') {
    return 'skip';
  }

  // Unter Confidence-Schwelle ignorieren
  if (suggestion.confidence < config.minConfidence) {
    return 'skip';
  }

  // Markers-only Modus: alles wird Marker
  if (config.mode === 'markers-only') {
    return 'add-marker';
  }

  // Proposed-cuts Modus
  const durationMs = getSpanDurationMs(suggestion.startMs, suggestion.endMs);

  if (suggestion.actionHint === 'cut') {
    // Pruefen ob Dauer ausreichend fuer Cut (nach Padding-Abzug)
    const effectiveDuration = durationMs - 2 * config.cutPaddingMs;
    if (effectiveDuration >= config.minCutDurationMs) {
      return 'add-trim';
    }
    // Zu kurz fuer Cut → Degradierung zu Marker
    return 'add-marker';
  }

  if (suggestion.actionHint === 'mark') {
    return 'add-marker';
  }

  // Fallback: keep oder unbekannter Hint
  return 'skip';
}

/**
 * Wendet Padding auf Cut-Zeitfenster an.
 * Stellt sicher, dass Start >= 0 und End <= videoDurationMs.
 */
function applyPadding(
  startMs: number,
  endMs: number,
  paddingMs: number,
  videoDurationMs: number
): { startMs: number; endMs: number } {
  return {
    startMs: Math.max(0, startMs + paddingMs),
    endMs: Math.min(videoDurationMs, endMs - paddingMs),
  };
}

// -----------------------------------------------------------------------------
// Ueberlappungs-Bereinigung
// -----------------------------------------------------------------------------

/**
 * Bereinigt ueberlappende Mappings desselben Typs.
 * Verschmilzt Eintraege deren Zeitfenster sich ueberlappen.
 */
function mergeOverlappingMappings(
  mappings: SuggestionTimelineMapping[]
): SuggestionTimelineMapping[] {
  if (mappings.length <= 1) return mappings;

  // Nach Startzeit sortieren
  const sorted = [...mappings].sort((a, b) => a.startMs - b.startMs);
  const merged: SuggestionTimelineMapping[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    // Gleiche Aktion und ueberlappend/angrenzend?
    if (current.action === last.action && current.startMs <= last.endMs) {
      // Verschmelzen
      merged[merged.length - 1] = {
        ...last,
        endMs: Math.max(last.endMs, current.endMs),
        label: `${last.label} + ${current.label}`,
      };
    } else {
      merged.push(current);
    }
  }

  return merged;
}

// -----------------------------------------------------------------------------
// Validierung
// -----------------------------------------------------------------------------

/**
 * Validiert Suggestions vor dem Mapping.
 * Filtert ungueltige Eintraege (negative Dauer, fehlende IDs).
 */
function validateSuggestions(suggestions: Suggestion[]): Suggestion[] {
  return suggestions.filter((s) => {
    if (!s.id || !s.category) return false;
    if (s.startMs < 0 || s.endMs < 0) return false;
    if (s.endMs <= s.startMs) return false;
    if (s.confidence < 0 || s.confidence > 1) return false;
    return true;
  });
}

// -----------------------------------------------------------------------------
// Hauptfunktion: Suggestions zu Timeline-Mappings
// -----------------------------------------------------------------------------

/**
 * Wandelt eine Liste von AI-Suggestions in Timeline-Mappings um.
 *
 * Was bedeutet das konkret fuer den User?
 * Jede Suggestion wird in eine konkrete Aktion uebersetzt:
 * - Marker setzen (sichtbar in Timeline, kein Schnitt)
 * - Trim vorschlagen (Cut-Region in Timeline, reversibel)
 * - Ueberspringen (keine Aktion, z.B. bei "keep")
 *
 * @param suggestions - AI-generierte Vorschlaege
 * @param videoDurationMs - Gesamtdauer des Videos in ms
 * @param config - Mapping-Konfiguration
 * @returns Strukturiertes Ergebnis mit Mappings und Statistiken
 */
export function mapSuggestionsToTimeline(
  suggestions: Suggestion[],
  videoDurationMs: number,
  config: Partial<MappingConfig> = {}
): SuggestionTimelineMappingResult {
  const fullConfig: MappingConfig = { ...DEFAULT_MAPPING_CONFIG, ...config };

  // Validieren und filtern
  const validSuggestions = validateSuggestions(suggestions);

  // Ausgeschlossene Kategorien filtern
  const filtered = validSuggestions.filter(
    (s) => !fullConfig.excludeCategories.includes(s.category)
  );

  // Einzeln mappen
  const rawMappings: SuggestionTimelineMapping[] = [];

  for (const suggestion of filtered) {
    const action = resolveAction(suggestion, fullConfig);

    if (action === 'skip') continue;

    let { startMs, endMs } = suggestion;

    // Padding fuer Trims anwenden
    if (action === 'add-trim') {
      const padded = applyPadding(
        startMs,
        endMs,
        fullConfig.cutPaddingMs,
        videoDurationMs
      );
      startMs = padded.startMs;
      endMs = padded.endMs;

      // Nach Padding ungueltig? → zu Marker degradieren
      if (endMs <= startMs) {
        rawMappings.push({
          suggestionId: suggestion.id,
          action: 'add-marker',
          startMs: suggestion.startMs,
          endMs: suggestion.endMs,
          label: suggestion.label,
          category: suggestion.category,
        });
        continue;
      }
    }

    rawMappings.push({
      suggestionId: suggestion.id,
      action,
      startMs,
      endMs,
      label: suggestion.label,
      category: suggestion.category,
    });
  }

  // Trims und Marker getrennt bereinigen
  const trimMappings = mergeOverlappingMappings(
    rawMappings.filter((m) => m.action === 'add-trim')
  );
  const markerMappings = rawMappings.filter((m) => m.action === 'add-marker');

  const allMappings = [...trimMappings, ...markerMappings].sort(
    (a, b) => a.startMs - b.startMs
  );

  // Statistiken berechnen
  const totalCutDurationMs = trimMappings.reduce(
    (sum, m) => sum + getSpanDurationMs(m.startMs, m.endMs),
    0
  );
  const totalKeepDurationMs = videoDurationMs - totalCutDurationMs;

  return {
    mappings: allMappings,
    totalKeepDurationMs: Math.max(0, totalKeepDurationMs),
    totalCutDurationMs,
    totalMarkerCount: markerMappings.length,
    totalTrimCount: trimMappings.length,
  };
}

// -----------------------------------------------------------------------------
// Segment-Statistiken berechnen
// -----------------------------------------------------------------------------

export interface CategoryStats {
  category: SuggestionCategory;
  count: number;
  totalDurationMs: number;
  label: string;
  color: string;
}

/**
 * Berechnet Statistiken pro Kategorie fuer die Summary-Card.
 *
 * @param suggestions - AI-Suggestions
 * @returns Sortierte Liste von Kategorie-Statistiken
 */
export function computeCategoryStats(
  suggestions: Suggestion[]
): CategoryStats[] {
  const statsMap = new Map<SuggestionCategory, CategoryStats>();

  for (const suggestion of suggestions) {
    const existing = statsMap.get(suggestion.category);
    const meta = SUGGESTION_CATEGORIES[suggestion.category];
    const duration = getSpanDurationMs(suggestion.startMs, suggestion.endMs);

    if (existing) {
      existing.count += 1;
      existing.totalDurationMs += duration;
    } else {
      statsMap.set(suggestion.category, {
        category: suggestion.category,
        count: 1,
        totalDurationMs: duration,
        label: meta.labelPlural,
        color: meta.color,
      });
    }
  }

  // Sortieren nach der definierten sortOrder
  return Array.from(statsMap.values()).sort(
    (a, b) =>
      SUGGESTION_CATEGORIES[a.category].sortOrder -
      SUGGESTION_CATEGORIES[b.category].sortOrder
  );
}
