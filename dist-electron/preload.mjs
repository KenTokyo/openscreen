"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  hudOverlayHide: () => {
    electron.ipcRenderer.send("hud-overlay-hide");
  },
  hudOverlayClose: () => {
    electron.ipcRenderer.send("hud-overlay-close");
  },
  getAssetBasePath: async () => {
    return await electron.ipcRenderer.invoke("get-asset-base-path");
  },
  getSources: async (opts) => {
    return await electron.ipcRenderer.invoke("get-sources", opts);
  },
  switchToEditor: () => {
    return electron.ipcRenderer.invoke("switch-to-editor");
  },
  openSourceSelector: () => {
    return electron.ipcRenderer.invoke("open-source-selector");
  },
  selectSource: (source) => {
    return electron.ipcRenderer.invoke("select-source", source);
  },
  getSelectedSource: () => {
    return electron.ipcRenderer.invoke("get-selected-source");
  },
  storeRecordedVideo: (videoData, fileName) => {
    return electron.ipcRenderer.invoke("store-recorded-video", videoData, fileName);
  },
  getRecordedVideoPath: () => {
    return electron.ipcRenderer.invoke("get-recorded-video-path");
  },
  setRecordingState: (recording) => {
    return electron.ipcRenderer.invoke("set-recording-state", recording);
  },
  onStopRecordingFromTray: (callback) => {
    const listener = () => callback();
    electron.ipcRenderer.on("stop-recording-from-tray", listener);
    return () => electron.ipcRenderer.removeListener("stop-recording-from-tray", listener);
  },
  openExternalUrl: (url) => {
    return electron.ipcRenderer.invoke("open-external-url", url);
  },
  saveExportedVideo: (videoData, fileName) => {
    return electron.ipcRenderer.invoke("save-exported-video", videoData, fileName);
  },
  openVideoFilePicker: () => {
    return electron.ipcRenderer.invoke("open-video-file-picker");
  },
  setCurrentVideoPath: (path) => {
    return electron.ipcRenderer.invoke("set-current-video-path", path);
  },
  getCurrentVideoPath: () => {
    return electron.ipcRenderer.invoke("get-current-video-path");
  },
  clearCurrentVideoPath: () => {
    return electron.ipcRenderer.invoke("clear-current-video-path");
  },
  getPlatform: () => {
    return electron.ipcRenderer.invoke("get-platform");
  },
  // --- AI Settings API ---
  aiSettingsLoad: () => {
    return electron.ipcRenderer.invoke("ai-settings-load");
  },
  aiSettingsSave: (update) => {
    return electron.ipcRenderer.invoke("ai-settings-save", update);
  },
  aiSettingsSetApiKey: (provider, apiKey) => {
    return electron.ipcRenderer.invoke("ai-settings-set-api-key", provider, apiKey);
  },
  aiSettingsDeleteApiKey: (provider) => {
    return electron.ipcRenderer.invoke("ai-settings-delete-api-key", provider);
  },
  aiSettingsGetApiKeyStatus: (provider) => {
    return electron.ipcRenderer.invoke("ai-settings-get-api-key-status", provider);
  },
  // --- AI Analysis API ---
  aiSetApiKey: (apiKey) => {
    return electron.ipcRenderer.invoke("ai-set-api-key", apiKey);
  },
  aiGetApiKeyStatus: () => {
    return electron.ipcRenderer.invoke("ai-get-api-key-status");
  },
  aiStartAnalysis: (videoPath, config) => {
    return electron.ipcRenderer.invoke("ai-start-analysis", { videoPath, config });
  },
  aiCancelAnalysis: (jobId) => {
    return electron.ipcRenderer.invoke("ai-cancel-analysis", jobId);
  },
  aiGetJobStatus: (jobId) => {
    return electron.ipcRenderer.invoke("ai-get-job-status", jobId);
  },
  aiGetArtifacts: (jobId) => {
    return electron.ipcRenderer.invoke("ai-get-artifacts", jobId);
  },
  aiLoadPersistedArtifacts: (videoPath) => {
    return electron.ipcRenderer.invoke("ai-load-persisted-artifacts", videoPath);
  },
  aiHasArtifacts: (videoPath) => {
    return electron.ipcRenderer.invoke("ai-has-artifacts", videoPath);
  },
  onAIJobProgress: (callback) => {
    const listener = (_event, status) => callback(status);
    electron.ipcRenderer.on("ai-job-progress", listener);
    return () => electron.ipcRenderer.removeListener("ai-job-progress", listener);
  }
});
