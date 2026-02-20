// =============================================================================
// useAISegmentNavigation - Kapselt Seek-Logik und Active-Segment-Tracking
// Verbindet AI-Segmentklick mit Video-Playhead und Timeline-Selektion
// =============================================================================

import { useCallback, useMemo, useState } from 'react';
import type { Suggestion } from '../types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AISegmentNavigationOptions {
  /** Seek-Handler: Setzt den Video-Playhead (Zeit in Sekunden) */
  onSeek: (timeSec: number) => void;
  /** Alle verfuegbaren Suggestions */
  suggestions: Suggestion[];
  /** Aktuelle Playback-Zeit in Sekunden */
  currentTimeSec: number;
}

export interface AISegmentNavigationResult {
  /** Aktuell aktives (angeklicktes) Segment-ID */
  activeSegmentId: string | null;
  /** Segment das gerade unter dem Playhead liegt */
  currentPlayheadSegmentId: string | null;
  /** Handler: Segment anklicken → Seek + Active setzen */
  handleSegmentClick: (suggestion: Suggestion) => void;
  /** Handler: Active-Segment manuell zuruecksetzen */
  clearActiveSegment: () => void;
  /** Handler: Zum naechsten Segment springen */
  seekToNextSegment: () => void;
  /** Handler: Zum vorherigen Segment springen */
  seekToPrevSegment: () => void;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useAISegmentNavigation({
  onSeek,
  suggestions,
  currentTimeSec,
}: AISegmentNavigationOptions): AISegmentNavigationResult {
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  // Sortierte Suggestions nach Startzeit (fuer Navigation)
  const sortedSuggestions = useMemo(
    () => [...suggestions].sort((a, b) => a.startMs - b.startMs),
    [suggestions]
  );

  // Welches Segment liegt aktuell unter dem Playhead?
  const currentPlayheadSegmentId = useMemo(() => {
    const currentMs = currentTimeSec * 1000;
    for (const s of sortedSuggestions) {
      if (currentMs >= s.startMs && currentMs < s.endMs) {
        return s.id;
      }
    }
    return null;
  }, [sortedSuggestions, currentTimeSec]);

  // Segment anklicken → Seek zum Start des Segments
  const handleSegmentClick = useCallback(
    (suggestion: Suggestion) => {
      setActiveSegmentId(suggestion.id);
      onSeek(suggestion.startMs / 1000);
    },
    [onSeek]
  );

  const clearActiveSegment = useCallback(() => {
    setActiveSegmentId(null);
  }, []);

  // Naechstes Segment nach aktuellem Playhead finden und anspringen
  const seekToNextSegment = useCallback(() => {
    if (sortedSuggestions.length === 0) return;

    const currentMs = currentTimeSec * 1000;

    // Finde das naechste Segment, das nach dem aktuellen Playhead startet
    const next = sortedSuggestions.find((s) => s.startMs > currentMs + 50);

    if (next) {
      setActiveSegmentId(next.id);
      onSeek(next.startMs / 1000);
    }
  }, [sortedSuggestions, currentTimeSec, onSeek]);

  // Vorheriges Segment finden und anspringen
  const seekToPrevSegment = useCallback(() => {
    if (sortedSuggestions.length === 0) return;

    const currentMs = currentTimeSec * 1000;

    // Finde das letzte Segment, das vor dem aktuellen Playhead startet
    // (mit kleinem Offset, damit man nicht im selben bleibt)
    let prev: Suggestion | undefined;
    for (const s of sortedSuggestions) {
      if (s.startMs < currentMs - 200) {
        prev = s;
      } else {
        break;
      }
    }

    if (prev) {
      setActiveSegmentId(prev.id);
      onSeek(prev.startMs / 1000);
    }
  }, [sortedSuggestions, currentTimeSec, onSeek]);

  return {
    activeSegmentId,
    currentPlayheadSegmentId,
    handleSegmentClick,
    clearActiveSegment,
    seekToNextSegment,
    seekToPrevSegment,
  };
}
