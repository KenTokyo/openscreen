// =============================================================================
// Filler-Detection Pass
// Regelbasierte Erkennung von Fuellwoertern aus Transcript-Woertern/Segmenten
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import type { Transcript, Suggestion } from '../types';
import {
  getFillerWordsForLanguage,
  DURATION_THRESHOLDS,
} from '../suggestionTaxonomy';

/**
 * Erkennt Fuellwoerter im Transcript und erzeugt Suggestions.
 *
 * Strategie:
 * 1. Wenn Word-Level-Timestamps vorhanden: Jedes Wort einzeln pruefen
 * 2. Fallback: Segment-Text nach Fuellwoertern durchsuchen
 *
 * Bereits vorhandene Filler-Suggestions (aus LLM) werden nicht dupliziert.
 */
export function fillerDetectionPass(
  transcript: Transcript,
  existingSuggestions: Suggestion[],
  customFillerWords?: string[]
): Suggestion[] {
  const fillerWords = customFillerWords ?? getFillerWordsForLanguage(transcript.language);
  const fillerSet = new Set(fillerWords.map((w) => w.toLowerCase()));
  const newSuggestions: Suggestion[] = [];

  // Bestehende Filler-Zeitbereiche sammeln (um Duplikate zu vermeiden)
  const existingFillerRanges = existingSuggestions
    .filter((s) => s.category === 'filler')
    .map((s) => ({ startMs: s.startMs, endMs: s.endMs }));

  for (const segment of transcript.segments) {
    // Strategie 1: Word-Level wenn verfuegbar
    if (segment.words && segment.words.length > 0) {
      for (const word of segment.words) {
        const cleanWord = word.text.toLowerCase().replace(/[.,!?;:'"]/g, '').trim();

        if (!fillerSet.has(cleanWord)) continue;

        const durationMs = word.endMs - word.startMs;
        if (durationMs < DURATION_THRESHOLDS.FILLER_MIN_MS) continue;

        // Pruefen ob bereits eine Filler-Suggestion diesen Bereich abdeckt
        if (isOverlappingExisting(word.startMs, word.endMs, existingFillerRanges)) continue;

        newSuggestions.push({
          id: uuidv4(),
          label: `Filler: ${word.text}`,
          category: 'filler',
          startMs: word.startMs,
          endMs: word.endMs,
          confidence: 0.85,
          reasonShort: `Fuellwort "${word.text}" erkannt`,
          reasonDetail: `Das Wort "${word.text}" wurde als Fuellwort klassifiziert. Es traegt nicht zum Inhalt bei und kann entfernt werden.`,
          actionHint: 'mark',
          sourceRefs: [{ segmentId: segment.id, wordIds: [word.id] }],
        });
      }
    } else {
      // Strategie 2: Segment-Text durchsuchen (keine praezisen Wort-Timestamps)
      const words = segment.text.split(/\s+/);
      for (const rawWord of words) {
        const cleanWord = rawWord.toLowerCase().replace(/[.,!?;:'"]/g, '').trim();
        if (!fillerSet.has(cleanWord)) continue;

        // Gesamtes Segment als Filler-Bereich (weniger praezise)
        if (isOverlappingExisting(segment.startMs, segment.endMs, existingFillerRanges)) continue;

        newSuggestions.push({
          id: uuidv4(),
          label: `Filler: ${rawWord}`,
          category: 'filler',
          startMs: segment.startMs,
          endMs: segment.endMs,
          confidence: 0.6, // Niedrigere Confidence ohne Wort-Timestamps
          reasonShort: `Fuellwort "${rawWord}" im Segment erkannt`,
          reasonDetail: `Das Wort "${rawWord}" wurde im Segment-Text gefunden. Ohne Wort-Timestamps ist der genaue Zeitpunkt ungenau.`,
          actionHint: 'mark',
          sourceRefs: [{ segmentId: segment.id }],
        });

        // Nur eine Filler-Suggestion pro Segment im Fallback-Modus
        break;
      }
    }
  }

  return newSuggestions;
}

// -----------------------------------------------------------------------------
// Hilfsfunktionen
// -----------------------------------------------------------------------------

function isOverlappingExisting(
  startMs: number,
  endMs: number,
  existingRanges: Array<{ startMs: number; endMs: number }>
): boolean {
  for (const range of existingRanges) {
    // Ueberlappung: neuer Bereich liegt innerhalb oder ueberlappt existierenden
    if (startMs < range.endMs && endMs > range.startMs) {
      return true;
    }
  }
  return false;
}
