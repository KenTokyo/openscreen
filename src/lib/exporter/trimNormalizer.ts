import type { TrimRegion } from '@/components/video-editor/types';

/**
 * Normalisiert TrimRegions vor dem Export:
 * 1. Sortiert nach startMs
 * 2. Clampt auf [0, videoDurationMs]
 * 3. Merged ueberlappende/angrenzende Regionen
 * 4. Entfernt ungueltige (Dauer <= 0)
 *
 * Gibt ein neues Array zurueck, original bleibt unveraendert.
 */
export function normalizeTrimRegions(
  trimRegions: TrimRegion[],
  videoDurationMs: number
): TrimRegion[] {
  if (trimRegions.length === 0) return [];

  // Clampen und runden
  const clamped = trimRegions
    .map((r) => ({
      ...r,
      startMs: Math.round(Math.max(0, Math.min(r.startMs, videoDurationMs))),
      endMs: Math.round(Math.max(0, Math.min(r.endMs, videoDurationMs))),
    }))
    .filter((r) => r.endMs > r.startMs);

  if (clamped.length === 0) return [];

  // Sortieren nach startMs
  const sorted = [...clamped].sort((a, b) => a.startMs - b.startMs);

  // Ueberlappende/angrenzende Regionen mergen
  const merged: TrimRegion[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.startMs <= last.endMs) {
      // Ueberlappend oder angrenzend → mergen
      merged[merged.length - 1] = {
        ...last,
        endMs: Math.max(last.endMs, current.endMs),
      };
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Berechnet die effektive Videodauer nach Abzug aller Trims.
 */
export function getEffectiveDurationMs(
  videoDurationMs: number,
  trimRegions: TrimRegion[]
): number {
  const normalized = normalizeTrimRegions(trimRegions, videoDurationMs);
  const trimmedMs = normalized.reduce(
    (sum, r) => sum + (r.endMs - r.startMs),
    0
  );
  return Math.max(0, videoDurationMs - trimmedMs);
}
