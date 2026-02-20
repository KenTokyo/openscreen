// =============================================================================
// AIPanelSection - Haupt-Container fuer das AI-Panel im Editor
// Orchestriert Job-Status, API-Key-Eingabe, Summary, Segmentliste und Actions
// =============================================================================

import { memo, useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type {
  Suggestion,
  SuggestionCategory,
  SuggestionsResult,
  Transcript,
  AIJobStatus,
  AIJobPhase,
  AIAnalysisConfig,
} from './types';
import { DEFAULT_AI_ANALYSIS_CONFIG } from './types';
import { AISegmentSummaryCard } from './AISegmentSummaryCard';
import { AISegmentList } from './AISegmentList';
import { AISettingsSection } from './AISettingsSection';
import { useAISegmentNavigation } from './hooks/useAISegmentNavigation';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

export interface AIPanelSectionProps {
  /** Aktueller Pfad des geladenen Videos (raw, nicht file://) */
  videoPath: string | null;
  /** Seek-Handler: setzt Video-Playhead (Zeit in Sekunden) */
  onSeek: (timeSec: number) => void;
  /** Aktuelle Playback-Zeit in Sekunden */
  currentTimeSec: number;
  /** Video-Gesamtdauer in Sekunden */
  durationSec: number;
  /** Callback wenn User Suggestions als Trims anwenden will */
  onApplyTrimSuggestions: (suggestions: Suggestion[]) => void;
  /** Callback um letzte AI-Apply-Aktion rueckgaengig zu machen */
  onUndoAIApply: () => void;
  /** Ob aktuell AI-erzeugte Trims in der Timeline liegen */
  hasAppliedSuggestions: boolean;
}

// -----------------------------------------------------------------------------
// Job-Phase Labels und Farben
// -----------------------------------------------------------------------------

const PHASE_LABELS: Record<AIJobPhase, string> = {
  queued: 'In Warteschlange…',
  preparing: 'Vorbereitung…',
  transcribing: 'Transkription…',
  analyzing: 'Analyse…',
  done: 'Abgeschlossen',
  failed: 'Fehlgeschlagen',
  cancelled: 'Abgebrochen',
};

function isRunningPhase(phase: AIJobPhase): boolean {
  return phase === 'queued' || phase === 'preparing' || phase === 'transcribing' || phase === 'analyzing';
}

// -----------------------------------------------------------------------------
// Job-Status Display
// -----------------------------------------------------------------------------

/** Erkennt ob der stepText auf einen Retry-Versuch hinweist */
function isRetryingStep(stepText: string): boolean {
  return stepText.includes('Erneuter Versuch');
}

function JobStatusDisplay({
  jobStatus,
  onCancel,
}: {
  jobStatus: AIJobStatus;
  onCancel: () => void;
}) {
  const { phase, progress, error } = jobStatus;
  const running = isRunningPhase(phase);
  const retrying = running && isRetryingStep(progress.stepText);

  return (
    <div className={`flex flex-col gap-2 p-3 rounded-lg border ${
      retrying
        ? 'bg-amber-500/[0.03] border-amber-500/10'
        : 'bg-white/[0.03] border-white/5'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {retrying && (
            <svg className="w-3 h-3 text-amber-400 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          )}
          <span className={`text-[11px] font-medium ${
            retrying ? 'text-amber-300' : 'text-slate-300'
          }`}>
            {progress.stepText || PHASE_LABELS[phase]}
          </span>
        </div>
        {running && (
          <button
            onClick={onCancel}
            className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
          >
            Abbrechen
          </button>
        )}
      </div>

      {running && (
        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              retrying ? 'bg-amber-400' : 'bg-[#34B27B]'
            }`}
            style={{ width: `${Math.max(2, progress.percent)}%` }}
          />
        </div>
      )}

      {phase === 'failed' && error && (
        <p className="text-[10px] text-red-400">{error.userHint}</p>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Haupt-Komponente
// -----------------------------------------------------------------------------

export const AIPanelSection = memo(function AIPanelSection({
  videoPath,
  onSeek,
  currentTimeSec,
  durationSec,
  onApplyTrimSuggestions,
  onUndoAIApply,
  hasAppliedSuggestions,
}: AIPanelSectionProps) {
  // ----- State -----
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<AIJobStatus | null>(null);
  const [, setTranscript] = useState<Transcript | null>(null);
  const [suggestionsResult, setSuggestionsResult] = useState<SuggestionsResult | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<SuggestionCategory | null>(null);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const suggestions = suggestionsResult?.suggestions ?? [];
  const totalDurationMs = suggestionsResult?.totalDurationMs ?? durationSec * 1000;

  // ----- Navigation Hook -----
  const {
    activeSegmentId,
    currentPlayheadSegmentId,
    handleSegmentClick,
    seekToNextSegment,
    seekToPrevSegment,
  } = useAISegmentNavigation({
    onSeek,
    suggestions,
    currentTimeSec,
  });

  // ----- API-Key Status pruefen -----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const result = await window.electronAPI.aiGetApiKeyStatus();
        if (mounted) setHasApiKey(result.hasKey);
      } catch {
        if (mounted) setHasApiKey(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ----- Persisted Artifacts laden beim Mount -----
  useEffect(() => {
    if (!videoPath) return;
    let mounted = true;

    (async () => {
      try {
        setLoadingArtifacts(true);
        const result = await window.electronAPI.aiLoadPersistedArtifacts(videoPath);
        if (!mounted) return;
        if (result.transcript) setTranscript(result.transcript as Transcript);
        if (result.suggestions) setSuggestionsResult(result.suggestions as SuggestionsResult);
        if (result.jobStatus) setJobStatus(result.jobStatus as AIJobStatus);
      } catch {
        // Keine persisted Artifacts → OK
      } finally {
        if (mounted) setLoadingArtifacts(false);
      }
    })();

    return () => { mounted = false; };
  }, [videoPath]);

  // ----- Job Progress Listener -----
  useEffect(() => {
    const cleanup = window.electronAPI.onAIJobProgress((status) => {
      const typedStatus = status as AIJobStatus;
      setJobStatus(typedStatus);

      // Bei Abschluss: Artifacts laden
      if (typedStatus.phase === 'done' && jobId) {
        (async () => {
          try {
            const artifacts = await window.electronAPI.aiGetArtifacts(jobId);
            if (artifacts.transcript) setTranscript(artifacts.transcript as Transcript);
            if (artifacts.suggestions) setSuggestionsResult(artifacts.suggestions as SuggestionsResult);
          } catch (err) {
            console.error('Failed to load AI artifacts:', err);
          }
        })();
      }
    });

    return cleanup;
  }, [jobId]);

  // ----- Handlers -----
  const refreshApiKeyStatus = useCallback(async () => {
    try {
      const result = await window.electronAPI.aiGetApiKeyStatus();
      setHasApiKey(result.hasKey);
    } catch {
      setHasApiKey(false);
    }
  }, []);

  const handleStartAnalysis = useCallback(async () => {
    if (!videoPath) return;

    try {
      const config: AIAnalysisConfig = { ...DEFAULT_AI_ANALYSIS_CONFIG };
      const result = await window.electronAPI.aiStartAnalysis(videoPath, config as unknown as Record<string, unknown>);
      if (result.success && result.jobId) {
        setJobId(result.jobId as string);
        // Reset alte Ergebnisse
        setTranscript(null);
        setSuggestionsResult(null);
        setCategoryFilter(null);
      }
    } catch (err) {
      console.error('Failed to start AI analysis:', err);
    }
  }, [videoPath]);

  const handleCancelAnalysis = useCallback(async () => {
    if (!jobId) return;
    try {
      await window.electronAPI.aiCancelAnalysis(jobId);
    } catch (err) {
      console.error('Failed to cancel AI analysis:', err);
    }
  }, [jobId]);

  const handleApply = useCallback(() => {
    if (suggestions.length === 0) return;
    onApplyTrimSuggestions(suggestions);
  }, [suggestions, onApplyTrimSuggestions]);

  // ----- Derived State -----
  const isRunning = jobStatus != null && isRunningPhase(jobStatus.phase);
  const hasFailed = jobStatus?.phase === 'failed';
  const hasResults = suggestions.length > 0;
  const showStartButton = !isRunning && hasApiKey === true;

  // ----- Render -----
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-200">
            {showSettings ? 'AI Einstellungen' : 'AI Segments'}
          </span>
          {!showSettings && hasResults && (
            <span className="text-[9px] font-mono text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
              {suggestions.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Navigation Pfeile (wenn Ergebnisse und nicht Settings) */}
          {!showSettings && hasResults && (
            <>
              <button
                onClick={seekToPrevSegment}
                className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded"
                title="Vorheriges Segment"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                onClick={seekToNextSegment}
                className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded"
                title="Naechstes Segment"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </>
          )}
          {/* Settings Toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1 rounded transition-colors ${showSettings ? 'text-[#34B27B] bg-[#34B27B]/10' : 'text-slate-500 hover:text-slate-300'}`}
            title={showSettings ? 'Zurueck zu Segmenten' : 'Einstellungen'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Settings-Bereich */}
      {showSettings && (
        <AISettingsSection onSettingsChanged={refreshApiKeyStatus} />
      )}

      {/* API Key fehlt (nur wenn nicht in Settings-Ansicht) */}
      {!showSettings && hasApiKey === false && (
        <div className="flex flex-col gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/5">
          <p className="text-[11px] text-slate-400">
            API Key fehlt. Bitte in den Einstellungen hinterlegen.
          </p>
          <Button
            onClick={() => setShowSettings(true)}
            size="sm"
            className="text-[10px] h-7 bg-[#34B27B] hover:bg-[#34B27B]/90 text-white"
          >
            Einstellungen oeffnen
          </Button>
        </div>
      )}

      {/* Loading API-Key Status */}
      {!showSettings && hasApiKey === null && (
        <p className="text-[10px] text-slate-500">Pruefe API-Key…</p>
      )}

      {/* Alles unterhalb wird im Settings-Modus ausgeblendet */}
      {!showSettings && (
        <>
          {/* Loading persisted Artifacts */}
          {loadingArtifacts && (
            <p className="text-[10px] text-slate-500">Lade gespeicherte Ergebnisse…</p>
          )}

          {/* Job-Status Anzeige */}
          {jobStatus && isRunning && (
            <JobStatusDisplay jobStatus={jobStatus} onCancel={handleCancelAnalysis} />
          )}

          {/* Fehler */}
          {hasFailed && jobStatus?.error && (
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
              <div className="flex items-start gap-2">
                <svg className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] text-red-400">{jobStatus.error.userHint}</p>
                  <p className="text-[9px] text-slate-500 font-mono">
                    {jobStatus.error.errorClass}
                    {jobStatus.error.retryable ? ' (Automatische Retries erschoepft)' : ''}
                  </p>
                </div>
              </div>
              {jobStatus.error.retryable && (
                <Button
                  onClick={handleStartAnalysis}
                  size="sm"
                  className="mt-2 text-[10px] h-6 bg-white/5 hover:bg-white/10 text-slate-300"
                >
                  Erneut versuchen
                </Button>
              )}
            </div>
          )}

          {/* Start-Button (wenn kein Job laeuft und Key vorhanden) */}
          {showStartButton && !isRunning && !hasResults && !loadingArtifacts && (
            <Button
              onClick={handleStartAnalysis}
              disabled={!videoPath}
              className="w-full text-[11px] h-8 bg-[#34B27B]/10 text-[#34B27B] border border-[#34B27B]/20 hover:bg-[#34B27B]/20 hover:border-[#34B27B]/30 transition-all"
            >
              AI-Analyse starten
            </Button>
          )}

          {/* Ergebnisse: Summary + Liste */}
          {hasResults && (
            <>
              <AISegmentSummaryCard
                suggestions={suggestions}
                totalDurationMs={totalDurationMs}
                activeCategory={categoryFilter}
                onCategoryClick={(cat) => setCategoryFilter(cat as SuggestionCategory | null)}
              />

              <div className="flex-1 min-h-0 overflow-hidden">
                <AISegmentList
                  suggestions={suggestions}
                  activeSegmentId={activeSegmentId}
                  currentPlayheadSegmentId={currentPlayheadSegmentId}
                  categoryFilter={categoryFilter}
                  onSegmentClick={handleSegmentClick}
                />
              </div>

              {/* Action-Buttons */}
              <div className="flex gap-2 flex-shrink-0 pt-1">
                {hasAppliedSuggestions ? (
                  <>
                    <Button
                      onClick={onUndoAIApply}
                      className="flex-1 text-[10px] h-7 bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                    >
                      Rueckgaengig
                    </Button>
                    <Button
                      onClick={handleApply}
                      className="text-[10px] h-7 bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-200 transition-all"
                    >
                      Erneut anwenden
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleApply}
                    className="flex-1 text-[10px] h-7 bg-[#34B27B]/10 text-[#34B27B] border border-[#34B27B]/20 hover:bg-[#34B27B]/20 transition-all"
                  >
                    Als Cuts anwenden
                  </Button>
                )}
                <Button
                  onClick={handleStartAnalysis}
                  className="text-[10px] h-7 bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-200 transition-all"
                >
                  Neu analysieren
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
});
