// =============================================================================
// Dead-Air-Detection Pass
// Erkennt Luecken/Stille zwischen Transcript-Segmenten
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import type { Transcript, Suggestion } from '../types';
import { DURATION_THRESHOLDS } from '../suggestionTaxonomy';

/**
 * Erkennt Stille-Pausen (Dead Air) zwischen Transcript-Segmenten.
 *
 * Strategie:
 * - Sortiert Segmente nach Startzeit
 * - Misst Luecken zwischen aufeinander folgenden Segmenten
 * - Luecken >= DEAD_AIR_MIN_MS werden als Dead-Air-Suggestion erzeugt
 *
 * Bereits vorhandene Dead-Air-Suggestions werden nicht dupliziert.
 */
export function deadAirDetectionPass(
  transcript: Transcript,
  existingSuggestions: Suggestion[],
  minDurationMs?: number
): Suggestion[] {
  const threshold = minDurationMs ?? DURATION_THRESHOLDS.DEAD_AIR_MIN_MS;
  const segments = [...transcript.segments].sort((a, b) => a.startMs - b.startMs);

  if (segments.length < 2) return [];

  // Bestehende Dead-Air-Bereiche
  const existingDeadAirRanges = existingSuggestions
    .filter((s) => s.category === 'dead-air')
    .map((s) => ({ startMs: s.startMs, endMs: s.endMs }));

  const newSuggestions: Suggestion[] = [];

  for (let i = 0; i < segments.length - 1; i++) {
    const current = segments[i];
    const next = segments[i + 1];

    const gapStartMs = current.endMs;
    const gapEndMs = next.startMs;
    const gapDurationMs = gapEndMs - gapStartMs;

    if (gapDurationMs < threshold) continue;

    // Duplikat-Check
    if (isOverlapping(gapStartMs, gapEndMs, existingDeadAirRanges)) continue;

    // Confidence skaliert mit Dauer (laengere Stille = sicherer)
    const confidence = Math.min(0.95, 0.7 + (gapDurationMs / 10000) * 0.25);

    const durationSec = (gapDurationMs / 1000).toFixed(1);

    newSuggestions.push({
      id: uuidv4(),
      label: `Dead Air: ${durationSec}s`,
      category: 'dead-air',
      startMs: gapStartMs,
      endMs: gapEndMs,
      confidence,
      reasonShort: `${durationSec}s Stille zwischen Segmenten`,
      reasonDetail: `Zwischen den Segmenten "${current.text.slice(0, 30)}..." und "${next.text.slice(0, 30)}..." liegt eine Pause von ${durationSec} Sekunden.`,
      actionHint: 'cut',
      sourceRefs: [
        { segmentId: current.id },
        { segmentId: next.id },
      ],
    });
  }

  return newSuggestions;
}

// -----------------------------------------------------------------------------
// Hilfsfunktionen
// -----------------------------------------------------------------------------

function isOverlapping(
  startMs: number,
  endMs: number,
  existingRanges: Array<{ startMs: number; endMs: number }>
): boolean {
  for (const range of existingRanges) {
    if (startMs < range.endMs && endMs > range.startMs) {
      return true;
    }
  }
  return false;
}
