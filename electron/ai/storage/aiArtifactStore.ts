// =============================================================================
// AI Artifact Store - Persistenz fuer Transcript, Suggestions und Job-Status
// Speichert pro Video versionierte JSON-Artefakte unter userData/ai-artifacts/
// =============================================================================

import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import type {
  Transcript,
  SuggestionsResult,
  AIJobStatus,
} from '../../../src/components/video-editor/ai/types'

// -----------------------------------------------------------------------------
// Pfade und Konstanten
// -----------------------------------------------------------------------------

const AI_ARTIFACTS_DIR_NAME = 'ai-artifacts'

function getArtifactsBaseDir(): string {
  return path.join(app.getPath('userData'), AI_ARTIFACTS_DIR_NAME)
}

/**
 * Erzeugt einen sicheren Ordnernamen aus dem Video-Pfad.
 * Ersetzt Sonderzeichen und kuerzt auf max 200 Zeichen.
 */
function videoPathToFolderName(videoPath: string): string {
  const normalized = videoPath
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
  return normalized.slice(-200)
}

function getJobDir(videoPath: string): string {
  return path.join(getArtifactsBaseDir(), videoPathToFolderName(videoPath))
}

// -----------------------------------------------------------------------------
// Dateinamen
// -----------------------------------------------------------------------------

const FILE_NAMES = {
  transcript: 'transcript.json',
  suggestions: 'suggestions.json',
  jobStatus: 'job-status.json',
} as const

// -----------------------------------------------------------------------------
// Hilfsfunktionen
// -----------------------------------------------------------------------------

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true })
}

async function writeJSON(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath))
  const json = JSON.stringify(data, null, 2)
  await fs.writeFile(filePath, json, 'utf-8')
}

async function readJSON<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function removeFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  } catch {
    // Datei existiert nicht - ok
  }
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/** Transcript speichern */
export async function saveTranscript(
  videoPath: string,
  transcript: Transcript
): Promise<void> {
  const filePath = path.join(getJobDir(videoPath), FILE_NAMES.transcript)
  await writeJSON(filePath, transcript)
}

/** Transcript laden */
export async function loadTranscript(
  videoPath: string
): Promise<Transcript | null> {
  const filePath = path.join(getJobDir(videoPath), FILE_NAMES.transcript)
  return readJSON<Transcript>(filePath)
}

/** Suggestions speichern */
export async function saveSuggestions(
  videoPath: string,
  suggestions: SuggestionsResult
): Promise<void> {
  const filePath = path.join(getJobDir(videoPath), FILE_NAMES.suggestions)
  await writeJSON(filePath, suggestions)
}

/** Suggestions laden */
export async function loadSuggestions(
  videoPath: string
): Promise<SuggestionsResult | null> {
  const filePath = path.join(getJobDir(videoPath), FILE_NAMES.suggestions)
  return readJSON<SuggestionsResult>(filePath)
}

/** Job-Status speichern */
export async function saveJobStatus(
  videoPath: string,
  status: AIJobStatus
): Promise<void> {
  const filePath = path.join(getJobDir(videoPath), FILE_NAMES.jobStatus)
  await writeJSON(filePath, status)
}

/** Job-Status laden */
export async function loadJobStatus(
  videoPath: string
): Promise<AIJobStatus | null> {
  const filePath = path.join(getJobDir(videoPath), FILE_NAMES.jobStatus)
  return readJSON<AIJobStatus>(filePath)
}

/** Alle Artefakte fuer ein Video laden */
export async function loadAllArtifacts(videoPath: string): Promise<{
  transcript: Transcript | null
  suggestions: SuggestionsResult | null
  jobStatus: AIJobStatus | null
}> {
  const [transcript, suggestions, jobStatus] = await Promise.all([
    loadTranscript(videoPath),
    loadSuggestions(videoPath),
    loadJobStatus(videoPath),
  ])
  return { transcript, suggestions, jobStatus }
}

/** Alle Artefakte fuer ein Video loeschen */
export async function clearArtifacts(videoPath: string): Promise<void> {
  const dir = getJobDir(videoPath)
  await Promise.all([
    removeFile(path.join(dir, FILE_NAMES.transcript)),
    removeFile(path.join(dir, FILE_NAMES.suggestions)),
    removeFile(path.join(dir, FILE_NAMES.jobStatus)),
  ])
  // Verzeichnis loeschen wenn leer
  try {
    await fs.rmdir(dir)
  } catch {
    // Verzeichnis nicht leer oder existiert nicht - ok
  }
}

/** Pruefen ob Artefakte fuer ein Video existieren */
export async function hasArtifacts(videoPath: string): Promise<boolean> {
  const filePath = path.join(getJobDir(videoPath), FILE_NAMES.transcript)
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}
