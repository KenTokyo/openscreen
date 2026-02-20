/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  electronAPI: {
    getSources: (opts: Electron.SourcesOptions) => Promise<ProcessedDesktopSource[]>
    switchToEditor: () => Promise<void>
    openSourceSelector: () => Promise<void>
    selectSource: (source: any) => Promise<any>
    getSelectedSource: () => Promise<any>
    storeRecordedVideo: (videoData: ArrayBuffer, fileName: string) => Promise<{ success: boolean; path?: string; message?: string }>
    getRecordedVideoPath: () => Promise<{ success: boolean; path?: string; message?: string }>
    setRecordingState: (recording: boolean) => Promise<void>
    onStopRecordingFromTray: (callback: () => void) => () => void
    openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>
    saveExportedVideo: (videoData: ArrayBuffer, fileName: string) => Promise<{ success: boolean; path?: string; message?: string; cancelled?: boolean }>
    openVideoFilePicker: () => Promise<{ success: boolean; path?: string; cancelled?: boolean }>
    setCurrentVideoPath: (path: string) => Promise<{ success: boolean }>
    getCurrentVideoPath: () => Promise<{ success: boolean; path?: string }>
    clearCurrentVideoPath: () => Promise<{ success: boolean }>
    getPlatform: () => Promise<string>
    hudOverlayHide: () => void;
    hudOverlayClose: () => void;

    // AI Settings API
    aiSettingsLoad: () => Promise<{ success: boolean; settings?: unknown; error?: string }>
    aiSettingsSave: (update: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>
    aiSettingsSetApiKey: (provider: string, apiKey: string) => Promise<{ success: boolean; error?: string }>
    aiSettingsDeleteApiKey: (provider: string) => Promise<{ success: boolean; error?: string }>
    aiSettingsGetApiKeyStatus: (provider: string) => Promise<{ hasKey: boolean }>

    // AI Analysis API (Legacy - genutzt von AIPanelSection)
    aiSetApiKey: (apiKey: string) => Promise<{ success: boolean }>
    aiGetApiKeyStatus: () => Promise<{ hasKey: boolean }>
    aiStartAnalysis: (videoPath: string, config: Record<string, unknown>) => Promise<{
      success: boolean
      jobId?: string
      error?: string
    }>
    aiCancelAnalysis: (jobId: string) => Promise<{ success: boolean }>
    aiGetJobStatus: (jobId: string) => Promise<unknown>
    aiGetArtifacts: (jobId: string) => Promise<{
      success: boolean
      transcript?: unknown
      suggestions?: unknown
      error?: string
    }>
    aiLoadPersistedArtifacts: (videoPath: string) => Promise<{
      transcript?: unknown
      suggestions?: unknown
      jobStatus?: unknown
    }>
    aiHasArtifacts: (videoPath: string) => Promise<{ hasArtifacts: boolean }>
    onAIJobProgress: (callback: (status: unknown) => void) => () => void
  }
}

interface ProcessedDesktopSource {
  id: string
  name: string
  display_id: string
  thumbnail: string | null
  appIcon: string | null
}
