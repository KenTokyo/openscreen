// =============================================================================
// AI Job Manager - State-Machine, Queue, Cancel, Progress-Events, Retry
// Orchestriert den AI-Analyse-Lifecycle im Electron Main Process
// =============================================================================

import { BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import fs from 'node:fs/promises'
import type {
  AIJobPhase,
  AIJobStatus,
  AIJobProgress,
  AIJobError,
  AIJobErrorClass,
  AIAnalysisConfig,
  Transcript,
  SuggestionsResult,
} from '../../../src/components/video-editor/ai/types'
import {
  AI_IPC_CHANNELS,
  DEFAULT_AI_ANALYSIS_CONFIG,
} from '../../../src/components/video-editor/ai/types'
import { getProvider } from '../providers/aiProvider'
import type { GeminiAdapterError } from '../providers/geminiTranscriptionAdapter'
import {
  saveTranscript,
  saveSuggestions,
  saveJobStatus,
} from '../storage/aiArtifactStore'
import {
  enrichSuggestionsResult,
} from '../../../src/components/video-editor/ai/engine/suggestionEngine'

// -----------------------------------------------------------------------------
// Retry & Timeout Konfiguration
// -----------------------------------------------------------------------------

const MAX_RETRIES = 2
const RETRY_DELAYS_MS = [2_000, 8_000] // Exponential Backoff: 2s, 8s
const BASE_TIMEOUT_MS = 120_000         // 120s Basis-Timeout
const TIMEOUT_PER_100MB_MS = 60_000     // +60s pro 100MB Dateigroesse

// -----------------------------------------------------------------------------
// Interner Job-Zustand
// -----------------------------------------------------------------------------

interface ActiveJob {
  jobId: string
  videoPath: string
  config: AIAnalysisConfig
  phase: AIJobPhase
  progress: AIJobProgress
  error?: AIJobError
  startedAt: string
  completedAt?: string
  abortController: AbortController
  // Ergebnisse (nach Abschluss)
  transcript?: Transcript
  suggestions?: SuggestionsResult
}

// -----------------------------------------------------------------------------
// Timeout & Sleep Utilities
// -----------------------------------------------------------------------------

/**
 * Wraps a promise with a timeout. Rejects with a timeout-classified error
 * if the promise does not resolve within the given duration.
 * Also respects an AbortSignal for early cancellation.
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        reject({
          errorClass: 'timeout',
          message: `Request timed out after ${Math.round(timeoutMs / 1000)}s`,
          retryable: true,
        } as GeminiAdapterError)
      }
    }, timeoutMs)

    // AbortSignal listener
    const onAbort = () => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        reject({
          errorClass: 'internal',
          message: 'Cancelled',
          retryable: false,
        } as GeminiAdapterError)
      }
    }
    if (signal?.aborted) {
      clearTimeout(timer)
      return reject({
        errorClass: 'internal',
        message: 'Cancelled',
        retryable: false,
      } as GeminiAdapterError)
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    promise.then(
      (val) => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          signal?.removeEventListener('abort', onAbort)
          resolve(val)
        }
      },
      (err) => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          signal?.removeEventListener('abort', onAbort)
          reject(err)
        }
      }
    )
  })
}

/**
 * Berechnet den Timeout basierend auf Dateigroesse.
 * Basis: 120s + 60s pro 100MB
 */
async function computeTimeoutMs(videoPath: string): Promise<number> {
  try {
    const stat = await fs.stat(videoPath)
    const sizeMB = stat.size / (1024 * 1024)
    return BASE_TIMEOUT_MS + Math.ceil(sizeMB / 100) * TIMEOUT_PER_100MB_MS
  } catch {
    return BASE_TIMEOUT_MS + TIMEOUT_PER_100MB_MS // Fallback: 180s
  }
}

/**
 * Sleep-Utility die durch AbortSignal unterbrochen werden kann.
 * Returned true wenn der Sleep normal abgelaufen ist, false bei Abort.
 */
function abortableSleep(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false)
      return
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve(true)
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      resolve(false)
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

// -----------------------------------------------------------------------------
// Manager-Singleton-State
// -----------------------------------------------------------------------------

const activeJobs = new Map<string, ActiveJob>()

// Nur 1 Job gleichzeitig (Queue-Logik fuer spaeter erweiterbar)
let runningJobId: string | null = null

// -----------------------------------------------------------------------------
// Progress Broadcasting
// -----------------------------------------------------------------------------

function broadcastProgress(job: ActiveJob): void {
  const payload: AIJobStatus = {
    jobId: job.jobId,
    videoPath: job.videoPath,
    phase: job.phase,
    progress: { ...job.progress },
    error: job.error,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  }

  // An alle offenen Fenster senden
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(AI_IPC_CHANNELS.JOB_PROGRESS, payload)
    }
  }
}

function updateJobPhase(
  job: ActiveJob,
  phase: AIJobPhase,
  percent: number,
  stepText: string
): void {
  job.phase = phase
  job.progress = { phase, percent, stepText }
  broadcastProgress(job)
}

// -----------------------------------------------------------------------------
// Fehler-Mapping
// -----------------------------------------------------------------------------

function mapAdapterErrorToJobError(err: GeminiAdapterError): AIJobError {
  const userHints: Record<string, string> = {
    'auth': 'Der API-Key ist ungueltig oder fehlt. Bitte in den Einstellungen pruefen.',
    'rate-limit': 'API-Rate-Limit erreicht. Bitte warten und erneut versuchen.',
    'timeout': 'Die Anfrage hat zu lange gedauert. Bitte erneut versuchen.',
    'network': 'Netzwerkfehler. Bitte Internetverbindung pruefen.',
    'invalid-input': 'Die Eingabedatei ist ungueltig oder wird nicht unterstuetzt.',
    'provider-error': 'Fehler beim AI-Provider. Bitte erneut versuchen.',
    'internal': 'Interner Fehler. Bitte erneut versuchen.',
  }

  return {
    errorClass: err.errorClass as AIJobErrorClass,
    message: err.message,
    userHint: userHints[err.errorClass] || 'Unbekannter Fehler.',
    retryable: err.retryable,
  }
}

// -----------------------------------------------------------------------------
// Job-Pipeline (mit Retry und Timeout)
// -----------------------------------------------------------------------------

async function runJob(job: ActiveJob, apiKey: string): Promise<void> {
  try {
    // Phase 1: Preparing
    updateJobPhase(job, 'preparing', 5, 'Videodatei wird vorbereitet...')
    await saveJobStatus(job.videoPath, toJobStatus(job))

    if (job.abortController.signal.aborted) {
      handleCancel(job)
      return
    }

    // Timeout berechnen (abhaengig von Dateigroesse)
    const timeoutMs = await computeTimeoutMs(job.videoPath)

    updateJobPhase(job, 'preparing', 10, 'Daten werden vorbereitet...')

    // Phase 2: Transcribing + Analyzing (Provider-Call mit Retry)
    const provider = getProvider('gemini')
    let lastError: GeminiAdapterError | null = null
    let result: { transcript: Transcript; suggestions: SuggestionsResult } | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (job.abortController.signal.aborted) {
        handleCancel(job)
        return
      }

      // Retry-Wartezeit (ab 2. Versuch)
      if (attempt > 0) {
        const delayMs = RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]
        updateJobPhase(
          job,
          'transcribing',
          15,
          `Erneuter Versuch (${attempt}/${MAX_RETRIES}) in ${Math.round(delayMs / 1000)}s...`
        )
        const completed = await abortableSleep(delayMs, job.abortController.signal)
        if (!completed) {
          handleCancel(job)
          return
        }
      }

      updateJobPhase(
        job,
        'transcribing',
        attempt > 0 ? 15 : 15,
        attempt > 0
          ? `Erneuter Versuch (${attempt}/${MAX_RETRIES}) – API-Anfrage wird gesendet...`
          : 'API-Anfrage wird gesendet...'
      )

      try {
        const apiResult = await withTimeout(
          provider.analyze(
            job.videoPath,
            apiKey,
            job.config,
            job.abortController.signal
          ),
          timeoutMs,
          job.abortController.signal
        )

        result = apiResult
        lastError = null
        break // Erfolg - Schleife verlassen
      } catch (error) {
        if (job.abortController.signal.aborted) {
          handleCancel(job)
          return
        }

        const adapterError: GeminiAdapterError = (
          typeof error === 'object' &&
          error !== null &&
          'errorClass' in error
        )
          ? error as GeminiAdapterError
          : { errorClass: 'internal' as const, message: String(error), retryable: false }

        lastError = adapterError

        // Nicht-retryable Fehler: sofort abbrechen
        if (!adapterError.retryable || attempt >= MAX_RETRIES) {
          break
        }

        console.warn(
          `[AIJobManager] Attempt ${attempt + 1} failed (${adapterError.errorClass}): ${adapterError.message}. Retrying...`
        )
      }
    }

    // Fehler nach allen Retries?
    if (lastError || !result) {
      const finalError = lastError ?? {
        errorClass: 'internal' as const,
        message: 'Unknown error after retries',
        retryable: false,
      }
      job.error = mapAdapterErrorToJobError(finalError)
      job.completedAt = new Date().toISOString()
      updateJobPhase(job, 'failed', 0, `Fehler: ${job.error.userHint}`)
      await saveJobStatus(job.videoPath, toJobStatus(job)).catch(() => {})
      return
    }

    if (job.abortController.signal.aborted) {
      handleCancel(job)
      return
    }

    // Phase 3: Analyzing (Suggestion-Engine nachverarbeiten + speichern)
    updateJobPhase(job, 'analyzing', 80, 'Vorschlaege werden verarbeitet...')

    const enrichedSuggestions = enrichSuggestionsResult(
      result.transcript,
      result.suggestions,
      {
        customFillerWords: job.config.fillerWordList,
      }
    )

    job.transcript = result.transcript
    job.suggestions = enrichedSuggestions

    // Persistieren
    updateJobPhase(job, 'analyzing', 90, 'Ergebnisse werden gespeichert...')
    await Promise.all([
      saveTranscript(job.videoPath, result.transcript),
      saveSuggestions(job.videoPath, enrichedSuggestions),
    ])

    if (job.abortController.signal.aborted) {
      handleCancel(job)
      return
    }

    // Phase 4: Done
    job.completedAt = new Date().toISOString()
    updateJobPhase(job, 'done', 100, 'Analyse abgeschlossen')
    await saveJobStatus(job.videoPath, toJobStatus(job))
  } catch (error) {
    if (job.abortController.signal.aborted) {
      handleCancel(job)
      return
    }

    // Unerwarteter Fehler (sollte nicht auftreten, da Retry-Loop eigene Fehler faengt)
    const adapterError: GeminiAdapterError = (
      typeof error === 'object' &&
      error !== null &&
      'errorClass' in error
    )
      ? error as GeminiAdapterError
      : { errorClass: 'internal' as const, message: String(error), retryable: false }

    job.error = mapAdapterErrorToJobError(adapterError)
    job.completedAt = new Date().toISOString()
    updateJobPhase(job, 'failed', 0, `Fehler: ${job.error.userHint}`)

    await saveJobStatus(job.videoPath, toJobStatus(job)).catch(() => {})
  } finally {
    runningJobId = null
  }
}

function handleCancel(job: ActiveJob): void {
  job.completedAt = new Date().toISOString()
  updateJobPhase(job, 'cancelled', 0, 'Analyse abgebrochen')
  saveJobStatus(job.videoPath, toJobStatus(job)).catch(() => {
    // Speicherfehler ignorieren bei Cancel
  })
  runningJobId = null
}

function toJobStatus(job: ActiveJob): AIJobStatus {
  return {
    jobId: job.jobId,
    videoPath: job.videoPath,
    phase: job.phase,
    progress: { ...job.progress },
    error: job.error,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  }
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Startet eine neue AI-Analyse fuer ein Video.
 * Gibt die Job-ID zurueck oder einen Fehler wenn bereits ein Job laeuft.
 */
export function startAnalysis(
  videoPath: string,
  apiKey: string,
  config?: Partial<AIAnalysisConfig>
): { success: true; jobId: string } | { success: false; error: string } {
  // Pruefen ob bereits ein Job laeuft
  if (runningJobId) {
    return {
      success: false,
      error: 'Es laeuft bereits eine Analyse. Bitte warten oder abbrechen.',
    }
  }

  // API Key pruefen
  if (!apiKey || apiKey.trim().length === 0) {
    return {
      success: false,
      error: 'Kein API-Key konfiguriert. Bitte in den Einstellungen hinterlegen.',
    }
  }

  const jobId = uuidv4()
  const fullConfig: AIAnalysisConfig = {
    ...DEFAULT_AI_ANALYSIS_CONFIG,
    ...config,
  }

  const job: ActiveJob = {
    jobId,
    videoPath,
    config: fullConfig,
    phase: 'queued',
    progress: { phase: 'queued', percent: 0, stepText: 'Job angelegt...' },
    startedAt: new Date().toISOString(),
    abortController: new AbortController(),
  }

  activeJobs.set(jobId, job)
  runningJobId = jobId

  // Job asynchron starten (nicht awaiten - Fire-and-Forget)
  runJob(job, apiKey).catch((err) => {
    console.error('[AIJobManager] Unexpected error in job pipeline:', err)
  })

  return { success: true, jobId }
}

/**
 * Bricht einen laufenden Job ab.
 */
export function cancelAnalysis(
  jobId: string
): { success: boolean; error?: string } {
  const job = activeJobs.get(jobId)
  if (!job) {
    return { success: false, error: 'Job nicht gefunden.' }
  }

  if (job.phase === 'done' || job.phase === 'failed' || job.phase === 'cancelled') {
    return { success: false, error: 'Job ist bereits beendet.' }
  }

  job.abortController.abort()
  return { success: true }
}

/**
 * Gibt den aktuellen Status eines Jobs zurueck.
 */
export function getJobStatus(
  jobId: string
): AIJobStatus | null {
  const job = activeJobs.get(jobId)
  if (!job) return null
  return toJobStatus(job)
}

/**
 * Gibt Transcript und Suggestions eines abgeschlossenen Jobs zurueck.
 */
export function getJobArtifacts(
  jobId: string
): {
  transcript: Transcript | null
  suggestions: SuggestionsResult | null
} {
  const job = activeJobs.get(jobId)
  if (!job) {
    return { transcript: null, suggestions: null }
  }
  return {
    transcript: job.transcript ?? null,
    suggestions: job.suggestions ?? null,
  }
}

/**
 * Entfernt einen abgeschlossenen Job aus dem Speicher.
 */
export function removeJob(jobId: string): void {
  const job = activeJobs.get(jobId)
  if (job && (job.phase === 'done' || job.phase === 'failed' || job.phase === 'cancelled')) {
    activeJobs.delete(jobId)
  }
}

/**
 * Pruefen ob aktuell ein Job laeuft.
 */
export function isJobRunning(): boolean {
  return runningJobId !== null
}
