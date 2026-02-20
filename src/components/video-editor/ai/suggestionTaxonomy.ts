// =============================================================================
// Suggestion-Taxonomie - Normierte Kategorien, Farben, Labels und Defaults
// =============================================================================

import type { SuggestionCategory, SuggestionActionHint } from './types';

// -----------------------------------------------------------------------------
// Kategorie-Metadaten
// -----------------------------------------------------------------------------

export interface CategoryMeta {
  key: SuggestionCategory;
  label: string;                 // User-sichtbarer Name
  labelPlural: string;           // Mehrzahl
  description: string;           // Tooltip/Detail-Erklaerung
  color: string;                 // Primaerfarbe (Hex)
  colorMuted: string;            // Gedaempfte Version fuer Hintergrund
  defaultActionHint: SuggestionActionHint;
  icon: string;                  // Lucide Icon Name
  sortOrder: number;             // Reihenfolge in der UI
}

/**
 * Zentrale Kategorie-Registry.
 * Alle UI-Komponenten und Mapper verwenden diese als Single Source of Truth.
 */
export const SUGGESTION_CATEGORIES: Record<SuggestionCategory, CategoryMeta> = {
  keep: {
    key: 'keep',
    label: 'Keep',
    labelPlural: 'Keep',
    description: 'Guter Content - bleibt erhalten',
    color: '#22c55e',       // green-500
    colorMuted: '#22c55e1a', // green-500/10
    defaultActionHint: 'keep',
    icon: 'check-circle',
    sortOrder: 1,
  },
  cut: {
    key: 'cut',
    label: 'Cut',
    labelPlural: 'Cuts',
    description: 'Entfernen - Versprecher, Wiederholung, unbrauchbar',
    color: '#ef4444',       // red-500
    colorMuted: '#ef44441a', // red-500/10
    defaultActionHint: 'cut',
    icon: 'scissors',
    sortOrder: 2,
  },
  filler: {
    key: 'filler',
    label: 'Filler',
    labelPlural: 'Fillers',
    description: 'Fuellwoerter wie "aeh", "aeehm", "halt", "quasi"',
    color: '#f59e0b',       // amber-500
    colorMuted: '#f59e0b1a', // amber-500/10
    defaultActionHint: 'mark',
    icon: 'message-circle-warning',
    sortOrder: 3,
  },
  'dead-air': {
    key: 'dead-air',
    label: 'Dead Air',
    labelPlural: 'Dead Air',
    description: 'Laengere Stille oder Pause ohne Inhalt',
    color: '#6366f1',       // indigo-500
    colorMuted: '#6366f11a', // indigo-500/10
    defaultActionHint: 'cut',
    icon: 'volume-x',
    sortOrder: 4,
  },
  retake: {
    key: 'retake',
    label: 'Retake',
    labelPlural: 'Retakes',
    description: 'Wiederholter Anlauf - vorherige Version entfernen',
    color: '#8b5cf6',       // violet-500
    colorMuted: '#8b5cf61a', // violet-500/10
    defaultActionHint: 'cut',
    icon: 'rotate-ccw',
    sortOrder: 5,
  },
  unclear: {
    key: 'unclear',
    label: 'Unclear',
    labelPlural: 'Unclear',
    description: 'Unsichere Stelle - bitte manuell pruefen',
    color: '#94a3b8',       // slate-400
    colorMuted: '#94a3b81a', // slate-400/10
    defaultActionHint: 'mark',
    icon: 'help-circle',
    sortOrder: 6,
  },
};

// -----------------------------------------------------------------------------
// Sortierte Kategorie-Liste (fuer UI-Rendering)
// -----------------------------------------------------------------------------

/** Alle Kategorien, sortiert nach sortOrder */
export const SORTED_CATEGORIES: CategoryMeta[] = Object.values(
  SUGGESTION_CATEGORIES
).sort((a, b) => a.sortOrder - b.sortOrder);

/** Nur Kategorien die als "Problem" gelten (alles ausser keep) */
export const PROBLEM_CATEGORIES: CategoryMeta[] = SORTED_CATEGORIES.filter(
  (c) => c.key !== 'keep'
);

// -----------------------------------------------------------------------------
// Fuellwort-Listen (regelbasiert, kein LLM noetig)
// -----------------------------------------------------------------------------

/** Deutsche Fuellwoerter mit typischen Varianten */
export const FILLER_WORDS_DE: string[] = [
  'äh', 'ähm', 'ähem',
  'eh', 'ehm',
  'hm', 'hmm', 'mhm',
  'halt', 'quasi', 'sozusagen',
  'irgendwie', 'praktisch', 'eigentlich',
  'also', 'ja', 'ne', 'naja',
  'genau', 'eben', 'gewissermaßen',
];

/** Englische Fuellwoerter */
export const FILLER_WORDS_EN: string[] = [
  'uh', 'um', 'uhm',
  'hmm', 'hm',
  'like', 'you know', 'basically',
  'actually', 'literally', 'right',
  'so', 'well', 'I mean',
  'kind of', 'sort of',
];

/**
 * Sprache zu Fuellwort-Liste zuordnen.
 * Gibt Default-Liste zurueck wenn Sprache unbekannt.
 */
export function getFillerWordsForLanguage(lang: string): string[] {
  const normalized = lang.toLowerCase().slice(0, 2);
  switch (normalized) {
    case 'de': return FILLER_WORDS_DE;
    case 'en': return FILLER_WORDS_EN;
    default:   return FILLER_WORDS_EN; // Fallback
  }
}

// -----------------------------------------------------------------------------
// Confidence Schwellenwerte
// -----------------------------------------------------------------------------

export const CONFIDENCE_THRESHOLDS = {
  /** Ab hier wird Suggestion angezeigt */
  DISPLAY_MIN: 0.3,
  /** Ab hier gilt Suggestion als zuverlaessig */
  RELIABLE: 0.7,
  /** Ab hier Auto-Apply-faehig (in Zukunft) */
  HIGH: 0.9,
} as const;

// -----------------------------------------------------------------------------
// Dauer-Schwellenwerte (Millisekunden)
// -----------------------------------------------------------------------------

export const DURATION_THRESHOLDS = {
  /** Minimale Dauer fuer einen Dead-Air-Vorschlag */
  DEAD_AIR_MIN_MS: 1500,
  /** Minimale Dauer fuer einen Filler-Vorschlag */
  FILLER_MIN_MS: 200,
  /** Padding links/rechts um einen Cut (Atemschutz) */
  CUT_PADDING_MS: 100,
  /** Minimale Dauer eines Segments, unter der kein Cut vorgeschlagen wird */
  MIN_CUT_DURATION_MS: 300,
} as const;

// -----------------------------------------------------------------------------
// Hilfsfunktionen
// -----------------------------------------------------------------------------

/** CategoryMeta fuer eine gegebene Kategorie abrufen */
export function getCategoryMeta(category: SuggestionCategory): CategoryMeta {
  return SUGGESTION_CATEGORIES[category];
}

/** Farbe fuer eine Kategorie abrufen */
export function getCategoryColor(category: SuggestionCategory): string {
  return SUGGESTION_CATEGORIES[category].color;
}

/** Default ActionHint fuer eine Kategorie abrufen */
export function getDefaultActionHint(
  category: SuggestionCategory
): SuggestionActionHint {
  return SUGGESTION_CATEGORIES[category].defaultActionHint;
}

/** Pruefen ob eine Kategorie standardmaessig geschnitten wird */
export function isCutCategory(category: SuggestionCategory): boolean {
  return SUGGESTION_CATEGORIES[category].defaultActionHint === 'cut';
}

/** Millisekunden in ein lesbares Zeitformat umwandeln (MM:SS.ms) */
export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor((ms % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;
}

/** Zeitfenster als "MM:SS - MM:SS" formatieren */
export function formatTimeRange(startMs: number, endMs: number): string {
  return `${formatDurationMs(startMs)} - ${formatDurationMs(endMs)}`;
}

/** Dauer eines Zeitfensters in Millisekunden */
export function getSpanDurationMs(startMs: number, endMs: number): number {
  return Math.max(0, endMs - startMs);
}
