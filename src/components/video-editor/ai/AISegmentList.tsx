// =============================================================================
// AISegmentList - Scrollbare, filterbare Liste von AI-Segmentkarten
// Unterstuetzt Kategorie-Filter und Auto-Scroll zum aktiven Segment
// =============================================================================

import { memo, useEffect, useMemo, useRef } from 'react';
import type { Suggestion, SuggestionCategory } from './types';
import { CONFIDENCE_THRESHOLDS } from './suggestionTaxonomy';
import { AISegmentListItem } from './AISegmentListItem';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface AISegmentListProps {
  suggestions: Suggestion[];
  activeSegmentId: string | null;
  currentPlayheadSegmentId: string | null;
  categoryFilter: SuggestionCategory | null;
  onSegmentClick: (suggestion: Suggestion) => void;
}

// -----------------------------------------------------------------------------
// Komponente
// -----------------------------------------------------------------------------

export const AISegmentList = memo(function AISegmentList({
  suggestions,
  activeSegmentId,
  currentPlayheadSegmentId,
  categoryFilter,
  onSegmentClick,
}: AISegmentListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Filtern und sortieren
  const filteredSuggestions = useMemo(() => {
    let filtered = suggestions.filter(
      (s) => s.confidence >= CONFIDENCE_THRESHOLDS.DISPLAY_MIN
    );

    if (categoryFilter) {
      filtered = filtered.filter((s) => s.category === categoryFilter);
    }

    return filtered.sort((a, b) => a.startMs - b.startMs);
  }, [suggestions, categoryFilter]);

  // Effektives aktives Segment: Klick hat Prioritaet, sonst Playhead
  const effectiveActiveId = activeSegmentId ?? currentPlayheadSegmentId;

  // Auto-Scroll zum aktiven Segment
  useEffect(() => {
    if (!effectiveActiveId || !listRef.current) return;

    // Kurze Verzoegerung fuer Render-Abschluss
    const timer = setTimeout(() => {
      const activeElement = listRef.current?.querySelector(
        `[data-segment-id="${effectiveActiveId}"]`
      );
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [effectiveActiveId]);

  // Leere Liste
  if (filteredSuggestions.length === 0) {
    const message = categoryFilter
      ? `Keine Segmente der Kategorie "${categoryFilter}" gefunden.`
      : 'Keine Segmente vorhanden.';

    return (
      <div className="flex items-center justify-center py-8 px-4">
        <p className="text-[11px] text-slate-500 text-center">{message}</p>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="flex flex-col gap-1 overflow-y-auto custom-scrollbar pr-0.5"
      style={{ maxHeight: 'calc(100% - 4px)' }}
    >
      {filteredSuggestions.map((suggestion) => (
        <div key={suggestion.id} data-segment-id={suggestion.id}>
          <AISegmentListItem
            suggestion={suggestion}
            isActive={effectiveActiveId === suggestion.id}
            onClick={onSegmentClick}
          />
        </div>
      ))}
    </div>
  );
});
