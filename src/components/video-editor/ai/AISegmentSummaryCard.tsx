// =============================================================================
// AISegmentSummaryCard - Counter-Chips und Dauer-Metriken fuer AI-Suggestions
// Zeigt Keep/Cut-Zaehler, Gesamtdauer pro Kategorie und Keep/Cut-Split
// =============================================================================

import { memo, useMemo } from 'react';
import type { Suggestion } from './types';
import {
  SUGGESTION_CATEGORIES,
  formatDurationMs,
  getSpanDurationMs,
} from './suggestionTaxonomy';
import { computeCategoryStats } from './mappers/suggestionTimelineMapper';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface AISegmentSummaryCardProps {
  suggestions: Suggestion[];
  totalDurationMs: number;
  activeCategory: string | null;
  onCategoryClick: (category: string | null) => void;
}

// -----------------------------------------------------------------------------
// Dauer-Balken
// -----------------------------------------------------------------------------

function DurationBar({
  keepMs,
  cutMs,
  totalMs,
}: {
  keepMs: number;
  cutMs: number;
  totalMs: number;
}) {
  if (totalMs <= 0) return null;
  const keepPercent = Math.round((keepMs / totalMs) * 100);
  const cutPercent = 100 - keepPercent;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
        <span>
          Keep{' '}
          <span className="text-green-400">
            {formatDurationMs(keepMs)}
          </span>{' '}
          ({keepPercent}%)
        </span>
        <span>
          Cut{' '}
          <span className="text-red-400">
            {formatDurationMs(cutMs)}
          </span>{' '}
          ({cutPercent}%)
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden flex">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${keepPercent}%`,
            backgroundColor: SUGGESTION_CATEGORIES.keep.color,
          }}
        />
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${cutPercent}%`,
            backgroundColor: SUGGESTION_CATEGORIES.cut.color,
          }}
        />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Kategorie-Chip
// -----------------------------------------------------------------------------

function CategoryChip({
  label,
  count,
  color,
  colorMuted,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  colorMuted: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-150"
      style={{
        color: isActive ? '#fff' : color,
        backgroundColor: isActive ? color : colorMuted,
        borderWidth: '1px',
        borderColor: isActive ? color : 'transparent',
      }}
    >
      <span className="font-bold">{count}</span>
      <span>{label}</span>
    </button>
  );
}

// -----------------------------------------------------------------------------
// Komponente
// -----------------------------------------------------------------------------

export const AISegmentSummaryCard = memo(function AISegmentSummaryCard({
  suggestions,
  totalDurationMs,
  activeCategory,
  onCategoryClick,
}: AISegmentSummaryCardProps) {
  const stats = useMemo(() => computeCategoryStats(suggestions), [suggestions]);

  // Keep/Cut Dauer berechnen
  const { keepDurationMs, cutDurationMs } = useMemo(() => {
    let keepMs = 0;
    let cutMs = 0;
    for (const s of suggestions) {
      const dur = getSpanDurationMs(s.startMs, s.endMs);
      if (s.category === 'keep') {
        keepMs += dur;
      } else {
        cutMs += dur;
      }
    }
    // Keep = Total minus explizit markierte Cut-Bereiche
    // (Suggestions decken nicht immer 100% ab)
    return {
      keepDurationMs: Math.max(0, totalDurationMs - cutMs),
      cutDurationMs: cutMs,
    };
  }, [suggestions, totalDurationMs]);

  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Kategorie-Chips */}
      <div className="flex flex-wrap gap-1.5">
        {stats.map((stat) => {
          const meta = SUGGESTION_CATEGORIES[stat.category];
          return (
            <CategoryChip
              key={stat.category}
              label={stat.label}
              count={stat.count}
              color={stat.color}
              colorMuted={meta.colorMuted}
              isActive={activeCategory === stat.category}
              onClick={() =>
                onCategoryClick(
                  activeCategory === stat.category ? null : stat.category
                )
              }
            />
          );
        })}
      </div>

      {/* Keep/Cut-Balken */}
      <DurationBar
        keepMs={keepDurationMs}
        cutMs={cutDurationMs}
        totalMs={totalDurationMs}
      />
    </div>
  );
});
