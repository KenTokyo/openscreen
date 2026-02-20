import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
    hudOverlayHide: () => {
      ipcRenderer.send('hud-overlay-hide');
    },
    hudOverlayClose: () => {
      ipcRenderer.send('hud-overlay-close');
    },
  getAssetBasePath: async () => {
    // ask main process for the correct base path (production vs dev)
    return await ipcRenderer.invoke('get-asset-base-path')
  },
  getSources: async (opts: Electron.SourcesOptions) => {
    return await ipcRenderer.invoke('get-sources', opts)
  },
  switchToEditor: () => {
    return ipcRenderer.invoke('switch-to-editor')
  },
  openSourceSelector: () => {
    return ipcRenderer.invoke('open-source-selector')
  },
  selectSource: (source: any) => {
    return ipcRenderer.invoke('select-source', source)
  },
  getSelectedSource: () => {
    return ipcRenderer.invoke('get-selected-source')
  },

  storeRecordedVideo: (videoData: ArrayBuffer, fileName: string) => {
    return ipcRenderer.invoke('store-recorded-video', videoData, fileName)
  },

  getRecordedVideoPath: () => {
    return ipcRenderer.invoke('get-recorded-video-path')
  },
  setRecordingState: (recording: boolean) => {
    return ipcRenderer.invoke('set-recording-state', recording)
  },
  onStopRecordingFromTray: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('stop-recording-from-tray', listener)
    return () => ipcRenderer.removeListener('stop-recording-from-tray', listener)
  },
  openExternalUrl: (url: string) => {
    return ipcRenderer.invoke('open-external-url', url)
  },
  saveExportedVideo: (videoData: ArrayBuffer, fileName: string) => {
    return ipcRenderer.invoke('save-exported-video', videoData, fileName)
  },
  openVideoFilePicker: () => {
    return ipcRenderer.invoke('open-video-file-picker')
  },
  setCurrentVideoPath: (path: string) => {
    return ipcRenderer.invoke('set-current-video-path', path)
  },
  getCurrentVideoPath: () => {
    return ipcRenderer.invoke('get-current-video-path')
  },
  clearCurrentVideoPath: () => {
    return ipcRenderer.invoke('clear-current-video-path')
  },
  getPlatform: () => {
    return ipcRenderer.invoke('get-platform')
  },

  // --- AI Settings API ---
  aiSettingsLoad: () => {
    return ipcRenderer.invoke('ai-settings-load')
  },
  aiSettingsSave: (update: Record<string, unknown>) => {
    return ipcRenderer.invoke('ai-settings-save', update)
  },
  aiSettingsSetApiKey: (provider: string, apiKey: string) => {
    return ipcRenderer.invoke('ai-settings-set-api-key', provider, apiKey)
  },
  aiSettingsDeleteApiKey: (provider: string) => {
    return ipcRenderer.invoke('ai-settings-delete-api-key', provider)
  },
  aiSettingsGetApiKeyStatus: (provider: string) => {
    return ipcRenderer.invoke('ai-settings-get-api-key-status', provider)
  },

  // --- AI Analysis API ---
  aiSetApiKey: (apiKey: string) => {
    return ipcRenderer.invoke('ai-set-api-key', apiKey)
  },
  aiGetApiKeyStatus: () => {
    return ipcRenderer.invoke('ai-get-api-key-status')
  },
  aiStartAnalysis: (videoPath: string, config: Record<string, unknown>) => {
    return ipcRenderer.invoke('ai-start-analysis', { videoPath, config })
  },
  aiCancelAnalysis: (jobId: string) => {
    return ipcRenderer.invoke('ai-cancel-analysis', jobId)
  },
  aiGetJobStatus: (jobId: string) => {
    return ipcRenderer.invoke('ai-get-job-status', jobId)
  },
  aiGetArtifacts: (jobId: string) => {
    return ipcRenderer.invoke('ai-get-artifacts', jobId)
  },
  aiLoadPersistedArtifacts: (videoPath: string) => {
    return ipcRenderer.invoke('ai-load-persisted-artifacts', videoPath)
  },
  aiHasArtifacts: (videoPath: string) => {
    return ipcRenderer.invoke('ai-has-artifacts', videoPath)
  },
  onAIJobProgress: (callback: (status: unknown) => void) => {
    const listener = (_event: unknown, status: unknown) => callback(status)
    ipcRenderer.on('ai-job-progress', listener as (...args: unknown[]) => void)
    return () => ipcRenderer.removeListener('ai-job-progress', listener as (...args: unknown[]) => void)
  },
})