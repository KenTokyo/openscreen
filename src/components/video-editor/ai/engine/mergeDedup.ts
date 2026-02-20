// =============================================================================
// Merge/Dedup Pass
// Bereinigt ueberlappende Suggestions gleicher Kategorie und sortiert nach Score
// =============================================================================

import type { Suggestion, SuggestionCategory } from '../types';
import { getSpanDurationMs } from '../suggestionTaxonomy';

/**
 * Bereinigt und sortiert Suggestions:
 * 1. Entfernt exakte Duplikate (gleiche Start/End/Kategorie)
 * 2. Verschmilzt ueberlappende Suggestions gleicher Kategorie
 * 3. Sortiert nach gewichtetem Score (Confidence * Dauer-Gewicht)
 */
export function mergeDedupPass(suggestions: Suggestion[]): Suggestion[] {
  if (suggestions.length <= 1) return suggestions;

  // Gruppieren nach Kategorie
  const byCategory = new Map<SuggestionCategory, Suggestion[]>();
  for (const s of suggestions) {
    const group = byCategory.get(s.category) ?? [];
    group.push(s);
    byCategory.set(s.category, group);
  }

  const merged: Suggestion[] = [];

  for (const [, group] of byCategory) {
    const mergedGroup = mergeOverlapping(group);
    merged.push(...mergedGroup);
  }

  // Sortierung: nach Startzeit primaer, Score sekundaer
  merged.sort((a, b) => {
    const timeDiff = a.startMs - b.startMs;
    if (timeDiff !== 0) return timeDiff;
    return computeScore(b) - computeScore(a);
  });

  return merged;
}

// -----------------------------------------------------------------------------
// Ueberlappungs-Bereinigung pro Kategorie
// -----------------------------------------------------------------------------

function mergeOverlapping(suggestions: Suggestion[]): Suggestion[] {
  if (suggestions.length <= 1) return suggestions;

  // Nach Startzeit sortieren
  const sorted = [...suggestions].sort((a, b) => a.startMs - b.startMs);
  const result: Suggestion[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = result[result.length - 1];

    // Ueberlappend oder direkt angrenzend (innerhalb 50ms)?
    if (current.startMs <= last.endMs + 50) {
      // Verschmelzen: hoechste Confidence behalten, Zeitfenster vereinen
      result[result.length - 1] = {
        ...last,
        endMs: Math.max(last.endMs, current.endMs),
        confidence: Math.max(last.confidence, current.confidence),
        label: last.label, // Behalte ersten Label
        reasonShort: last.reasonShort,
        reasonDetail: combineReasons(last.reasonDetail, current.reasonDetail),
        sourceRefs: [...last.sourceRefs, ...current.sourceRefs],
      };
    } else {
      result.push(current);
    }
  }

  return result;
}

// -----------------------------------------------------------------------------
// Score-Berechnung
// -----------------------------------------------------------------------------

/** Gewichte fuer den Score */
const CATEGORY_WEIGHTS: Record<SuggestionCategory, number> = {
  cut: 1.0,
  retake: 0.9,
  'dead-air': 0.8,
  filler: 0.6,
  unclear: 0.4,
  keep: 0.1,
};

/**
 * Berechnet einen gewichteten Score fuer Sortierung/Priorisierung.
 * Score = Confidence * Kategorie-Gewicht * Dauer-Faktor
 */
function computeScore(suggestion: Suggestion): number {
  const categoryWeight = CATEGORY_WEIGHTS[suggestion.category] ?? 0.5;
  const durationMs = getSpanDurationMs(suggestion.startMs, suggestion.endMs);
  // Dauer-Faktor: laengere Probleme sind wichtiger (log-Skala)
  const durationFactor = Math.min(2.0, 1.0 + Math.log10(Math.max(1, durationMs / 1000)));
  return suggestion.confidence * categoryWeight * durationFactor;
}

// -----------------------------------------------------------------------------
// Hilfsfunktionen
// -----------------------------------------------------------------------------

function combineReasons(a: string, b: string): string {
  if (a === b) return a;
  if (!b) return a;
  return `${a} | ${b}`;
}
