// =============================================================================
// AI Settings Store - Persistenz fuer AI-Settings und verschluesselte API-Keys
// Speicherort: userData/ai-settings.json
// =============================================================================

import { app, safeStorage } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { AIAnalysisConfig } from '../../../src/components/video-editor/ai/types'

// -----------------------------------------------------------------------------
// Internes Settings-Format (auf Disk, MIT verschluesseltem Key)
// -----------------------------------------------------------------------------

type AIProviderType = 'gemini'

interface PersistedProviderConfig {
  type: AIProviderType
  encryptedApiKey?: string // Base64-encoded encrypted key (safeStorage)
  plaintextApiKey?: string // Fallback wenn safeStorage nicht verfuegbar
  model?: string
}

interface PersistedAISettings {
  version: 1
  activeProvider: AIProviderType
  providers: Partial<Record<AIProviderType, PersistedProviderConfig>>
  analysisDefaults: AIAnalysisConfig
}

// -----------------------------------------------------------------------------
// Renderer-sichtbares Format (OHNE Klartext-Keys)
// -----------------------------------------------------------------------------

export interface RendererAISettings {
  activeProvider: AIProviderType
  providers: Partial<Record<AIProviderType, { type: AIProviderType; hasApiKey: boolean; model?: string }>>
  analysisDefaults: AIAnalysisConfig
}

// -----------------------------------------------------------------------------
// Pfade und Defaults
// -----------------------------------------------------------------------------

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'ai-settings.json')
}

const DEFAULT_SETTINGS: PersistedAISettings = {
  version: 1,
  activeProvider: 'gemini',
  providers: {},
  analysisDefaults: {
    language: undefined,
    maxDurationMs: undefined,
    suggestionCategories: undefined,
    minConfidence: 0.5,
    fillerWordList: undefined,
  },
}

// -----------------------------------------------------------------------------
// Verschluesselung
// -----------------------------------------------------------------------------

function encryptKey(plaintext: string): { encrypted?: string; plaintext?: string } {
  if (safeStorage.isEncryptionAvailable()) {
    const buffer = safeStorage.encryptString(plaintext)
    return { encrypted: buffer.toString('base64') }
  }
  // Fallback: Klartext (mit Warnung im Log)
  console.warn('[aiSettingsStore] safeStorage nicht verfuegbar - API-Key wird unverschluesselt gespeichert')
  return { plaintext }
}

function decryptKey(config: PersistedProviderConfig): string | null {
  if (config.encryptedApiKey) {
    try {
      const buffer = Buffer.from(config.encryptedApiKey, 'base64')
      return safeStorage.decryptString(buffer)
    } catch (err) {
      console.error('[aiSettingsStore] Key-Entschluesselung fehlgeschlagen:', err)
      return null
    }
  }
  if (config.plaintextApiKey) {
    return config.plaintextApiKey
  }
  return null
}

// -----------------------------------------------------------------------------
// Load / Save
// -----------------------------------------------------------------------------

async function readSettingsFile(): Promise<PersistedAISettings> {
  try {
    const raw = await fs.readFile(getSettingsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<PersistedAISettings>

    // Validierung: mindestens version und activeProvider
    if (parsed.version !== 1 || !parsed.activeProvider) {
      console.warn('[aiSettingsStore] Ungueltige Settings-Datei, nutze Defaults')
      return { ...DEFAULT_SETTINGS }
    }

    return {
      version: 1,
      activeProvider: parsed.activeProvider,
      providers: parsed.providers ?? {},
      analysisDefaults: {
        ...DEFAULT_SETTINGS.analysisDefaults,
        ...(parsed.analysisDefaults ?? {}),
      },
    }
  } catch {
    // Datei existiert nicht oder ist korrupt → Defaults
    return { ...DEFAULT_SETTINGS }
  }
}

async function writeSettingsFile(settings: PersistedAISettings): Promise<void> {
  const settingsPath = getSettingsPath()
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Laedt Settings fuer den Renderer (ohne Klartext-Keys).
 */
export async function loadSettingsForRenderer(): Promise<RendererAISettings> {
  const settings = await readSettingsFile()

  const providers: RendererAISettings['providers'] = {}
  for (const [key, config] of Object.entries(settings.providers)) {
    if (config) {
      providers[key as AIProviderType] = {
        type: config.type,
        hasApiKey: !!(config.encryptedApiKey || config.plaintextApiKey),
        model: config.model,
      }
    }
  }

  return {
    activeProvider: settings.activeProvider,
    providers,
    analysisDefaults: settings.analysisDefaults,
  }
}

/**
 * Speichert Analyse-Defaults und aktiven Provider (ohne Key-Aenderung).
 */
export async function saveSettings(update: {
  activeProvider?: AIProviderType
  analysisDefaults?: Partial<AIAnalysisConfig>
}): Promise<void> {
  const settings = await readSettingsFile()

  if (update.activeProvider) {
    settings.activeProvider = update.activeProvider
  }
  if (update.analysisDefaults) {
    settings.analysisDefaults = {
      ...settings.analysisDefaults,
      ...update.analysisDefaults,
    }
  }

  await writeSettingsFile(settings)
}

/**
 * Speichert einen API-Key verschluesselt fuer einen Provider.
 */
export async function setApiKey(provider: AIProviderType, apiKey: string): Promise<void> {
  const settings = await readSettingsFile()
  const existing = settings.providers[provider] ?? { type: provider }
  const { encrypted, plaintext } = encryptKey(apiKey)

  settings.providers[provider] = {
    ...existing,
    encryptedApiKey: encrypted,
    plaintextApiKey: plaintext,
    // Alten Key entfernen wenn neuer verschluesselt ist
    ...(encrypted ? { plaintextApiKey: undefined } : {}),
  }

  await writeSettingsFile(settings)
}

/**
 * Loescht den API-Key eines Providers.
 */
export async function deleteApiKey(provider: AIProviderType): Promise<void> {
  const settings = await readSettingsFile()
  const existing = settings.providers[provider]
  if (existing) {
    delete existing.encryptedApiKey
    delete existing.plaintextApiKey
    settings.providers[provider] = existing
  }
  await writeSettingsFile(settings)
}

/**
 * Prueft ob ein Provider einen API-Key hat.
 */
export async function hasApiKey(provider: AIProviderType): Promise<boolean> {
  const settings = await readSettingsFile()
  const config = settings.providers[provider]
  if (!config) return false
  return !!(config.encryptedApiKey || config.plaintextApiKey)
}

/**
 * Liest den Klartext-API-Key eines Providers (NUR fuer Main-Process-Nutzung).
 * Wird NIE an den Renderer gesendet.
 */
export async function getApiKeyPlaintext(provider: AIProviderType): Promise<string | null> {
  const settings = await readSettingsFile()
  const config = settings.providers[provider]
  if (!config) return null
  return decryptKey(config)
}

/**
 * Liest die persistierten Analyse-Defaults.
 */
export async function getAnalysisDefaults(): Promise<AIAnalysisConfig> {
  const settings = await readSettingsFile()
  return settings.analysisDefaults
}
