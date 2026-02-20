// =============================================================================
// AI IPC Handlers - Electron Main-seitige IPC-Endpunkte fuer AI-Analyse
// =============================================================================

import { ipcMain } from 'electron'
import {
  AI_IPC_CHANNELS,
  AI_SETTINGS_IPC_CHANNELS,
  type AIStartAnalysisRequest,
  type AIStartAnalysisResponse,
  type AIGetArtifactsResponse,
  type AIJobStatus,
  type AIProviderType,
  type AIAnalysisConfig,
} from '../../src/components/video-editor/ai/types'
import {
  startAnalysis,
  cancelAnalysis,
  getJobStatus,
  getJobArtifacts,
} from '../ai/jobs/aiJobManager'
import {
  loadAllArtifacts,
  hasArtifacts,
} from '../ai/storage/aiArtifactStore'
import {
  loadSettingsForRenderer,
  saveSettings,
  setApiKey,
  deleteApiKey,
  hasApiKey as hasApiKeyPersisted,
  getApiKeyPlaintext,
} from '../ai/storage/aiSettingsStore'

// -----------------------------------------------------------------------------
// API Key Management - In-Memory-Cache (fuer laufende Session)
// Wird beim Start aus Settings geladen und bei Aenderungen aktualisiert.
// -----------------------------------------------------------------------------

let cachedApiKey: string | null = null

async function getActiveApiKey(): Promise<string | null> {
  if (cachedApiKey) return cachedApiKey
  // Aus persistiertem Store laden
  const key = await getApiKeyPlaintext('gemini')
  if (key) cachedApiKey = key
  return key
}

// -----------------------------------------------------------------------------
// Handler-Registrierung
// -----------------------------------------------------------------------------

export function registerAIHandlers(): void {
  // --- Legacy API Key Handler (Rueckwaertskompatibel) ---
  ipcMain.handle('ai-set-api-key', async (_event, apiKey: string) => {
    await setApiKey('gemini', apiKey)
    cachedApiKey = apiKey
    return { success: true }
  })

  ipcMain.handle('ai-get-api-key-status', async () => {
    const has = await hasApiKeyPersisted('gemini')
    return { hasKey: has }
  })

  // --- Settings IPC Handler ---
  ipcMain.handle(AI_SETTINGS_IPC_CHANNELS.LOAD, async () => {
    try {
      const settings = await loadSettingsForRenderer()
      return { success: true, settings }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(
    AI_SETTINGS_IPC_CHANNELS.SAVE,
    async (_event, update: { activeProvider?: AIProviderType; analysisDefaults?: Partial<AIAnalysisConfig> }) => {
      try {
        await saveSettings(update)
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    AI_SETTINGS_IPC_CHANNELS.SET_API_KEY,
    async (_event, provider: AIProviderType, apiKey: string) => {
      try {
        await setApiKey(provider, apiKey)
        // Cache aktualisieren wenn aktiver Provider
        if (provider === 'gemini') cachedApiKey = apiKey
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    AI_SETTINGS_IPC_CHANNELS.DELETE_API_KEY,
    async (_event, provider: AIProviderType) => {
      try {
        await deleteApiKey(provider)
        if (provider === 'gemini') cachedApiKey = null
        return { success: true }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    AI_SETTINGS_IPC_CHANNELS.GET_API_KEY_STATUS,
    async (_event, provider: AIProviderType) => {
      try {
        const has = await hasApiKeyPersisted(provider)
        return { hasKey: has }
      } catch {
        return { hasKey: false }
      }
    }
  )

  // --- Analyse starten ---
  ipcMain.handle(
    AI_IPC_CHANNELS.START_ANALYSIS,
    async (_event, request: AIStartAnalysisRequest): Promise<AIStartAnalysisResponse> => {
      try {
        const apiKey = await getActiveApiKey()
        if (!apiKey) {
          return {
            success: false,
            error: 'Kein API-Key konfiguriert. Bitte zuerst einen Gemini API-Key hinterlegen.',
          }
        }

        const result = startAnalysis(
          request.videoPath,
          apiKey,
          request.config
        )

        if (result.success) {
          return { success: true, jobId: result.jobId }
        }
        return { success: false, error: result.error }
      } catch (error) {
        return { success: false, error: `Fehler beim Starten der Analyse: ${String(error)}` }
      }
    }
  )

  // --- Analyse abbrechen ---
  ipcMain.handle(
    AI_IPC_CHANNELS.CANCEL_ANALYSIS,
    (_event, jobId: string) => {
      try {
        return cancelAnalysis(jobId)
      } catch (error) {
        return { success: false, error: `Fehler beim Abbrechen: ${String(error)}` }
      }
    }
  )

  // --- Job-Status abfragen ---
  ipcMain.handle(
    AI_IPC_CHANNELS.GET_JOB_STATUS,
    (_event, jobId: string): AIJobStatus | null => {
      return getJobStatus(jobId)
    }
  )

  // --- Artefakte abrufen (aus laufendem Job) ---
  ipcMain.handle(
    AI_IPC_CHANNELS.GET_ARTIFACTS,
    (_event, jobId: string): AIGetArtifactsResponse => {
      try {
        const artifacts = getJobArtifacts(jobId)

        if (!artifacts.transcript && !artifacts.suggestions) {
          return {
            success: false,
            error: 'Keine Artefakte verfuegbar. Job laeuft noch oder wurde nicht gefunden.',
          }
        }

        return {
          success: true,
          transcript: artifacts.transcript ?? undefined,
          suggestions: artifacts.suggestions ?? undefined,
        }
      } catch (error) {
        return {
          success: false,
          error: `Fehler beim Laden der Artefakte: ${String(error)}`,
        }
      }
    }
  )

  // --- Persistierte Artefakte laden (nach Window-Reload) ---
  ipcMain.handle(
    'ai-load-persisted-artifacts',
    async (_event, videoPath: string) => {
      try {
        const artifacts = await loadAllArtifacts(videoPath)
        return {
          success: true,
          transcript: artifacts.transcript,
          suggestions: artifacts.suggestions,
          jobStatus: artifacts.jobStatus,
        }
      } catch (error) {
        return {
          success: false,
          error: String(error),
        }
      }
    }
  )

  // --- Pruefen ob Artefakte existieren ---
  ipcMain.handle(
    'ai-has-artifacts',
    async (_event, videoPath: string) => {
      try {
        const exists = await hasArtifacts(videoPath)
        return { success: true, hasArtifacts: exists }
      } catch {
        return { success: true, hasArtifacts: false }
      }
    }
  )
}
