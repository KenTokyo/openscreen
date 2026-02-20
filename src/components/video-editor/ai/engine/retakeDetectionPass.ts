// =============================================================================
// Retake-Detection Pass
// Erkennt wiederholte Anlaeufe durch Text-Aehnlichkeit aufeinander folgender Segmente
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import type { Transcript, Suggestion } from '../types';

/**
 * Schwellenwert fuer Textaehnlichkeit (0.0 - 1.0).
 * Hoch genug um false positives bei repetitivem Content zu vermeiden.
 */
const SIMILARITY_THRESHOLD = 0.6;

/**
 * Maximale Anzahl Woerter fuer den Vergleich.
 * Begrenzt den Rechenaufwand bei langen Segmenten.
 */
const MAX_COMPARE_WORDS = 50;

/**
 * Erkennt Retakes (wiederholte Anlaeufe) durch Vergleich aufeinander folgender Segmente.
 *
 * Strategie:
 * - Vergleicht jedes Segment mit den naechsten 1-2 Segmenten
 * - Bei hoher Textaehnlichkeit: das fruehere Segment als Retake markieren
 * - Bereits vorhandene Retake-Suggestions werden nicht dupliziert
 */
export function retakeDetectionPass(
  transcript: Transcript,
  existingSuggestions: Suggestion[]
): Suggestion[] {
  const segments = [...transcript.segments].sort((a, b) => a.startMs - b.startMs);

  if (segments.length < 2) return [];

  // Bestehende Retake-Bereiche
  const existingRetakeRanges = existingSuggestions
    .filter((s) => s.category === 'retake')
    .map((s) => ({ startMs: s.startMs, endMs: s.endMs }));

  const newSuggestions: Suggestion[] = [];

  // Lookahead: Vergleiche Segment i mit i+1 und i+2
  const lookAhead = 2;

  for (let i = 0; i < segments.length; i++) {
    const current = segments[i];
    const currentWords = normalizeText(current.text);

    if (currentWords.length < 3) continue; // Zu kurz fuer sinnvollen Vergleich

    for (let j = 1; j <= lookAhead && i + j < segments.length; j++) {
      const next = segments[i + j];
      const nextWords = normalizeText(next.text);

      if (nextWords.length < 3) continue;

      const similarity = computeSimilarity(currentWords, nextWords);

      if (similarity < SIMILARITY_THRESHOLD) continue;

      // Duplikat-Check
      if (isOverlapping(current.startMs, current.endMs, existingRetakeRanges)) continue;

      const similarityPercent = Math.round(similarity * 100);

      newSuggestions.push({
        id: uuidv4(),
        label: `Retake: ${similarityPercent}% aehnlich`,
        category: 'retake',
        startMs: current.startMs,
        endMs: current.endMs,
        confidence: Math.min(0.9, 0.5 + similarity * 0.4),
        reasonShort: `Wiederholter Anlauf (${similarityPercent}% Aehnlichkeit)`,
        reasonDetail: `Dieses Segment ist zu ${similarityPercent}% aehnlich zum folgenden Segment. Es scheint ein verworfener Anlauf zu sein, der wiederholt wurde.`,
        actionHint: 'cut',
        sourceRefs: [
          { segmentId: current.id },
          { segmentId: next.id },
        ],
      });

      // Nur eine Retake-Suggestion pro Segment
      break;
    }
  }

  return newSuggestions;
}

// -----------------------------------------------------------------------------
// Hilfsfunktionen
// -----------------------------------------------------------------------------

/**
 * Normalisiert Text fuer den Vergleich:
 * Lowercase, Satzzeichen entfernen, in Woerter aufteilen, auf max Laenge begrenzen.
 */
function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"()\[\]{}]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, MAX_COMPARE_WORDS);
}

/**
 * Berechnet Jaccard-Aehnlichkeit zwischen zwei Wortlisten.
 * Jaccard = |A ∩ B| / |A ∪ B|
 * Einfach, effizient und ausreichend fuer Retake-Erkennung.
 */
function computeSimilarity(wordsA: string[], wordsB: string[]): number {
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;

  return intersection / union;
}

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
