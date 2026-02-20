// =============================================================================
// AISegmentListItem - Einzelne Segmentkarte in der AI-Segmentliste
// Zeigt Kategorie-Farbe, Zeitfenster, Dauer, Confidence und Kurzbegruendung
// =============================================================================

import { memo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { Suggestion, SuggestionCategory } from './types';
import {
  SUGGESTION_CATEGORIES,
  formatTimeRange,
  formatDurationMs,
  getSpanDurationMs,
  CONFIDENCE_THRESHOLDS,
} from './suggestionTaxonomy';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface AISegmentListItemProps {
  suggestion: Suggestion;
  isActive: boolean;
  onClick: (suggestion: Suggestion) => void;
}

// -----------------------------------------------------------------------------
// Confidence Badge
// -----------------------------------------------------------------------------

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);
  const isReliable = confidence >= CONFIDENCE_THRESHOLDS.RELIABLE;

  return (
    <span
      className={cn(
        'text-[9px] font-mono px-1.5 py-0.5 rounded-full',
        isReliable
          ? 'bg-white/10 text-slate-300'
          : 'bg-amber-500/10 text-amber-400'
      )}
    >
      {percent}%
    </span>
  );
}

// -----------------------------------------------------------------------------
// Kategorie-Icon (Text-basiert, kein Lucide-Import fuer Performance)
// -----------------------------------------------------------------------------

const CATEGORY_ICONS: Record<SuggestionCategory, string> = {
  keep: '✓',
  cut: '✂',
  filler: '…',
  'dead-air': '◌',
  retake: '↻',
  unclear: '?',
};

// -----------------------------------------------------------------------------
// Komponente
// -----------------------------------------------------------------------------

export const AISegmentListItem = memo(function AISegmentListItem({
  suggestion,
  isActive,
  onClick,
}: AISegmentListItemProps) {
  const meta = SUGGESTION_CATEGORIES[suggestion.category];
  const durationMs = getSpanDurationMs(suggestion.startMs, suggestion.endMs);

  const handleClick = useCallback(() => {
    onClick(suggestion);
  }, [onClick, suggestion]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick(suggestion);
      }
    },
    [onClick, suggestion]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative flex flex-col gap-1 px-3 py-2 rounded-lg border cursor-pointer',
        'transition-all duration-150 ease-out',
        isActive
          ? 'border-white/20 bg-white/[0.06] shadow-sm'
          : 'border-transparent bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10'
      )}
    >
      {/* Farbiger linker Rand */}
      <div
        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
        style={{ backgroundColor: meta.color }}
      />

      {/* Obere Zeile: Kategorie-Tag + Confidence */}
      <div className="flex items-center justify-between gap-2 pl-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{
              color: meta.color,
              backgroundColor: meta.colorMuted,
            }}
          >
            {CATEGORY_ICONS[suggestion.category]} {meta.label}
          </span>
        </div>
        <ConfidenceBadge confidence={suggestion.confidence} />
      </div>

      {/* Mittlere Zeile: Zeitfenster + Dauer */}
      <div className="flex items-center gap-2 pl-2 text-[10px] font-mono text-slate-500">
        <span>{formatTimeRange(suggestion.startMs, suggestion.endMs)}</span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-400">{formatDurationMs(durationMs)}</span>
      </div>

      {/* Untere Zeile: Kurzbegruendung */}
      <p className="text-[11px] text-slate-400 pl-2 leading-snug line-clamp-2">
        {suggestion.reasonShort}
      </p>
    </div>
  );
});
