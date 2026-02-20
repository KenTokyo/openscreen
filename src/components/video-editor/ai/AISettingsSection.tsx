// =============================================================================
// AISettingsSection - API-Key-Verwaltung und Analyse-Konfiguration
// =============================================================================

import { memo, useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { AISettings } from './types';
import { AI_PROVIDER_META, DEFAULT_AI_SETTINGS } from './types';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

export interface AISettingsSectionProps {
  onSettingsChanged: () => void;
}

// -----------------------------------------------------------------------------
// Haupt-Komponente
// -----------------------------------------------------------------------------

export const AISettingsSection = memo(function AISettingsSection({
  onSettingsChanged,
}: AISettingsSectionProps) {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [keyInput, setKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // ----- Settings laden -----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const result = await window.electronAPI.aiSettingsLoad();
        if (mounted && result.success && result.settings) {
          setSettings(result.settings as AISettings);
        }
      } catch {
        // Defaults beibehalten
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ----- API Key speichern -----
  const handleSaveKey = useCallback(async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) return;

    setSavingKey(true);
    try {
      const result = await window.electronAPI.aiSettingsSetApiKey('gemini', trimmed);
      if (result.success) {
        setSettings(prev => ({
          ...prev,
          providers: {
            ...prev.providers,
            gemini: { ...prev.providers.gemini!, hasApiKey: true },
          },
        }));
        setKeyInput('');
        setShowKeyInput(false);
        onSettingsChanged();
      }
    } catch {
      // Fehler ignorieren
    } finally {
      setSavingKey(false);
    }
  }, [keyInput, onSettingsChanged]);

  // ----- API Key loeschen -----
  const handleDeleteKey = useCallback(async () => {
    try {
      const result = await window.electronAPI.aiSettingsDeleteApiKey('gemini');
      if (result.success) {
        setSettings(prev => ({
          ...prev,
          providers: {
            ...prev.providers,
            gemini: { ...prev.providers.gemini!, hasApiKey: false },
          },
        }));
        onSettingsChanged();
      }
    } catch {
      // Fehler ignorieren
    }
  }, [onSettingsChanged]);

  // ----- Analyse-Defaults speichern -----
  const handleSaveDefaults = useCallback(async (
    update: Partial<AISettings['analysisDefaults']>
  ) => {
    setSaveStatus('saving');
    try {
      const result = await window.electronAPI.aiSettingsSave({
        analysisDefaults: update,
      });
      if (result.success) {
        setSettings(prev => ({
          ...prev,
          analysisDefaults: { ...prev.analysisDefaults, ...update },
        }));
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 1500);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    }
  }, []);

  // ----- Render -----
  if (loading) {
    return <p className="text-[10px] text-slate-500 p-2">Lade Einstellungen...</p>;
  }

  const activeProviderMeta = AI_PROVIDER_META[settings.activeProvider];
  const providerConfig = settings.providers[settings.activeProvider];
  const hasKey = providerConfig?.hasApiKey ?? false;

  return (
    <div className="flex flex-col gap-3">
      {/* Provider-Info */}
      <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-white/[0.03] border border-white/5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-300">
            {activeProviderMeta.label}
          </span>
          <span className="text-[9px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
            {settings.activeProvider}
          </span>
        </div>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          {activeProviderMeta.description}
        </p>
      </div>

      {/* API-Key-Verwaltung */}
      <div className="flex flex-col gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-300">API Key</span>
          {hasKey ? (
            <span className="text-[9px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              Konfiguriert
            </span>
          ) : (
            <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
              Fehlt
            </span>
          )}
        </div>

        {hasKey && !showKeyInput && (
          <div className="flex gap-1.5">
            <Button
              onClick={() => setShowKeyInput(true)}
              size="sm"
              className="flex-1 text-[10px] h-6 bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-slate-200 transition-all"
            >
              Key aendern
            </Button>
            <Button
              onClick={handleDeleteKey}
              size="sm"
              className="text-[10px] h-6 bg-red-500/5 text-red-400 border border-red-500/10 hover:bg-red-500/10 transition-all"
            >
              Loeschen
            </Button>
          </div>
        )}

        {(!hasKey || showKeyInput) && (
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-1.5">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="AIza..."
                onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                className="flex-1 text-[11px] bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-[#34B27B]/50"
              />
              <Button
                onClick={handleSaveKey}
                disabled={!keyInput.trim() || savingKey}
                size="sm"
                className="text-[10px] h-7 bg-[#34B27B] hover:bg-[#34B27B]/90 text-white"
              >
                Speichern
              </Button>
            </div>
            {showKeyInput && (
              <button
                onClick={() => { setShowKeyInput(false); setKeyInput(''); }}
                className="text-[9px] text-slate-500 hover:text-slate-400 transition-colors self-start"
              >
                Abbrechen
              </button>
            )}
          </div>
        )}
      </div>

      {/* Analyse-Defaults */}
      <div className="flex flex-col gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-300">Analyse-Einstellungen</span>
          {saveStatus === 'saved' && (
            <span className="text-[9px] text-emerald-400">Gespeichert</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-[9px] text-red-400">Fehler</span>
          )}
        </div>

        {/* Sprache */}
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-slate-400">Sprache</label>
          <select
            value={settings.analysisDefaults.language ?? ''}
            onChange={(e) => handleSaveDefaults({ language: e.target.value || undefined })}
            className="text-[10px] bg-white/5 border border-white/10 rounded px-1.5 py-1 text-slate-200 focus:outline-none focus:border-[#34B27B]/50"
          >
            <option value="">Auto-Erkennung</option>
            <option value="de">Deutsch</option>
            <option value="en">Englisch</option>
            <option value="fr">Franzoesisch</option>
            <option value="es">Spanisch</option>
          </select>
        </div>

        {/* Min-Confidence */}
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-slate-400">Min. Confidence</label>
          <select
            value={settings.analysisDefaults.minConfidence ?? 0.5}
            onChange={(e) => handleSaveDefaults({ minConfidence: parseFloat(e.target.value) })}
            className="text-[10px] bg-white/5 border border-white/10 rounded px-1.5 py-1 text-slate-200 focus:outline-none focus:border-[#34B27B]/50"
          >
            <option value="0.3">30% (mehr Vorschlaege)</option>
            <option value="0.5">50% (Standard)</option>
            <option value="0.7">70% (konservativ)</option>
            <option value="0.9">90% (nur sichere)</option>
          </select>
        </div>
      </div>
    </div>
  );
});
