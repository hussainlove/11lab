import React, { useState } from 'react';
import {
  Sliders,
  History,
  Play,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ExternalLink,
  ChevronDown,
  Volume2,
  Download,
  Copy,
  Trash2,
  Check,
  Zap,
  Globe,
  Radio,
  Clock,
  Layers,
  Wand2,
  Loader2,
} from 'lucide-react';
import { Voice, AudioSettings, GenerationHistoryItem, OutputFormat } from '../types';
import { downloadSpeechAsMp3 } from '../services/audioEngine';

interface SettingsPanelProps {
  voices: Voice[];
  selectedVoice: Voice;
  setSelectedVoice: (v: Voice) => void;
  settings: AudioSettings;
  setSettings: React.Dispatch<React.SetStateAction<AudioSettings>>;
  history: GenerationHistoryItem[];
  onPlayHistoryItem: (item: GenerationHistoryItem) => void;
  onDeleteHistoryItem: (id: string) => void;
  onOpenVoiceLibrary: () => void;
  onOpenVoiceClone: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  voices,
  selectedVoice,
  setSelectedVoice,
  settings,
  setSettings,
  history,
  onPlayHistoryItem,
  onDeleteHistoryItem,
  onOpenVoiceLibrary,
  onOpenVoiceClone,
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'history'>('settings');
  const [showPromo, setShowPromo] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const updateSetting = <K extends keyof AudioSettings>(key: K, value: AudioSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const resetSlidersToDefault = () => {
    setSettings((prev) => ({
      ...prev,
      stability: 0.5,
      similarity: 0.75,
      styleExaggeration: 0.0,
      speakerBoost: true,
      speed: 1.0,
      pitch: 0,
    }));
  };

  const copyTextToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const modelOptions = [
    {
      id: 'eleven_v4',
      name: 'Eleven v4 (Gemini 3.8 Flagship)',
      badge: 'FASTEST & EMOTIVE',
      description: 'Supreme human emotional nuance, backchanneling & voice design',
    },
    {
      id: 'eleven_multilingual_v2',
      name: 'Eleven Multilingual v2',
      badge: '30+ LANGUAGES',
      description: 'State of the art multilingual cross-language consistency',
    },
    {
      id: 'eleven_turbo_v2_5',
      name: 'Eleven Turbo v2.5',
      badge: 'LOW LATENCY',
      description: 'Streamlined for real-time conversational agents',
    },
    {
      id: 'offline_webaudio_engine',
      name: 'Offline Neural Synthesizer',
      badge: '100% PRIVATE',
      description: 'On-device client processing with zero network latency',
    },
  ];

  const formatOptions: { id: OutputFormat; label: string; desc: string }[] = [
    { id: 'mp3_128', label: 'MP3 44.1 kHz (128kbps)', desc: 'Standard web streaming' },
    { id: 'mp3_320', label: 'MP3 44.1 kHz (320kbps)', desc: 'High bit-rate broadcast' },
    { id: 'wav_24', label: 'WAV 24 kHz (Studio Master)', desc: 'Uncompressed raw audio' },
    { id: 'pcm_16', label: 'PCM 16-bit 24 kHz', desc: 'Game & real-time engines' },
    { id: 'flac', label: 'FLAC Lossless', desc: 'Audiophile archiving' },
  ];

  const languageOptions = [
    { code: 'auto', name: 'Auto-detect Language' },
    { code: 'en', name: 'English (US/UK/AU)' },
    { code: 'es', name: 'Spanish (Español)' },
    { code: 'fr', name: 'French (Français)' },
    { code: 'de', name: 'German (Deutsch)' },
    { code: 'it', name: 'Italian (Italiano)' },
    { code: 'pt', name: 'Portuguese (Português)' },
    { code: 'ja', name: 'Japanese (日本語)' },
    { code: 'zh', name: 'Chinese (Mandarin)' },
    { code: 'hi', name: 'Hindi (हिन्दी)' },
    { code: 'ar', name: 'Arabic (العربية)' },
    { code: 'ru', name: 'Russian (Русский)' },
    { code: 'nl', name: 'Dutch (Nederlands)' },
    { code: 'pl', name: 'Polish (Polski)' },
    { code: 'ko', name: 'Korean (한국어)' },
    { code: 'sv', name: 'Swedish (Svenska)' },
  ];

  return (
    <div className="w-full h-full flex flex-col bg-gray-50/60 dark:bg-zinc-950/60 border-l border-gray-200/80 dark:border-zinc-800">
      {/* Top Tabs */}
      <div className="flex items-center px-4 pt-3 pb-1 border-b border-gray-200/80 dark:border-zinc-800 shrink-0 gap-6">
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-1.5 pb-2 text-sm font-semibold transition-all border-b-2 ${
            activeTab === 'settings'
              ? 'border-black dark:border-white text-gray-950 dark:text-white'
              : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Settings</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 pb-2 text-sm font-semibold transition-all border-b-2 ${
            activeTab === 'history'
              ? 'border-black dark:border-white text-gray-950 dark:text-white'
              : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
          }`}
        >
          <History className="w-4 h-4" />
          <span>History</span>
          {history.length > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-300">
              {history.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeTab === 'settings' ? (
          <>
            {/* Promo Card: Try Studio (ElevenLabs banner) */}
            {showPromo && (
              <div className="relative p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-blue-50/40 dark:from-indigo-950/30 dark:to-zinc-900 border border-indigo-100 dark:border-indigo-900/40 shadow-xs">
                <button
                  onClick={() => setShowPromo(false)}
                  className="absolute top-2.5 right-2.5 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md"
                >
                  <span className="text-xs">✕</span>
                </button>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-blue-600 text-white shrink-0 shadow-xs">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="pr-4">
                    <h4 className="text-xs font-semibold text-gray-900 dark:text-white">
                      Try Eleven Studio
                    </h4>
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5 leading-snug">
                      Produce complete voiceovers, background music and SFX in one timeline editor.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Voice Selection Card */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Voice
                </label>
                <button
                  onClick={onOpenVoiceLibrary}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center gap-0.5"
                >
                  Browse all voices
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div
                onClick={onOpenVoiceLibrary}
                className="w-full p-2.5 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-2xs hover:border-gray-300 dark:hover:border-zinc-700 transition-all cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={selectedVoice.avatarUrl}
                    alt={selectedVoice.name}
                    className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-gray-200 dark:ring-zinc-700"
                  />
                  <div className="truncate">
                    <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                      {selectedVoice.name}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                      {selectedVoice.accent} • {selectedVoice.gender} • {selectedVoice.useCase}
                    </p>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 shrink-0" />
              </div>
            </div>

            {/* Model Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                AI Speech Model
              </label>

              <div className="space-y-1.5">
                {modelOptions.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      updateSetting('modelId', m.id);
                      if (m.id === 'offline_webaudio_engine') {
                        updateSetting('offlineMode', true);
                      } else {
                        updateSetting('offlineMode', false);
                      }
                    }}
                    className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-start justify-between gap-2 ${
                      settings.modelId === m.id
                        ? 'bg-white dark:bg-zinc-900 border-black dark:border-white shadow-xs'
                        : 'bg-white/60 dark:bg-zinc-900/40 border-gray-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-900 dark:text-white">
                          {m.name}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          {m.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {m.description}
                      </p>
                    </div>
                    {settings.modelId === m.id && (
                      <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Customization Sliders */}
            <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Voice Settings
                </span>
                <button
                  onClick={resetSlidersToDefault}
                  className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>

              {/* Stability Slider */}
              <div className="space-y-1.5 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-gray-200 dark:border-zinc-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-800 dark:text-gray-200">Stability</span>
                  <span className="font-mono text-gray-500">
                    {Math.round(settings.stability * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.stability}
                  onChange={(e) => updateSetting('stability', parseFloat(e.target.value))}
                  className="w-full accent-blue-600 dark:accent-blue-400 cursor-pointer h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>More variable / Creative</span>
                  <span>More stable / Robust</span>
                </div>
              </div>

              {/* Similarity Slider */}
              <div className="space-y-1.5 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-gray-200 dark:border-zinc-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    Clarity + Similarity
                  </span>
                  <span className="font-mono text-gray-500">
                    {Math.round(settings.similarity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.similarity}
                  onChange={(e) => updateSetting('similarity', parseFloat(e.target.value))}
                  className="w-full accent-blue-600 dark:accent-blue-400 cursor-pointer h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>

              {/* Speed Slider */}
              <div className="space-y-1.5 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-gray-200 dark:border-zinc-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-800 dark:text-gray-200">Speed</span>
                  <span className="font-mono text-gray-500">{settings.speed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={settings.speed}
                  onChange={(e) => updateSetting('speed', parseFloat(e.target.value))}
                  className="w-full accent-blue-600 dark:accent-blue-400 cursor-pointer h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>0.5x Slow</span>
                  <span>1.0x Normal</span>
                  <span>2.0x Fast</span>
                </div>
              </div>

              {/* Pitch Shift Slider */}
              <div className="space-y-1.5 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-gray-200 dark:border-zinc-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-800 dark:text-gray-200">Pitch Offset</span>
                  <span className="font-mono text-gray-500">
                    {settings.pitch > 0 ? `+${settings.pitch}` : settings.pitch} st
                  </span>
                </div>
                <input
                  type="range"
                  min="-5"
                  max="5"
                  step="1"
                  value={settings.pitch}
                  onChange={(e) => updateSetting('pitch', parseInt(e.target.value, 10))}
                  className="w-full accent-blue-600 dark:accent-blue-400 cursor-pointer h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>-5 Deep</span>
                  <span>0 Natural</span>
                  <span>+5 High</span>
                </div>
              </div>

              {/* Speaker Boost Toggle */}
              <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-3 rounded-xl border border-gray-200 dark:border-zinc-800">
                <div>
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200">Speaker Boost</p>
                  <p className="text-[10px] text-gray-400">
                    Boosts presence and clarity of the vocal timbre
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateSetting('speakerBoost', !settings.speakerBoost)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                    settings.speakerBoost ? 'bg-black dark:bg-white' : 'bg-gray-200 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white dark:bg-zinc-900 shadow-sm transition duration-200 ease-in-out ${
                      settings.speakerBoost ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Language & Output Format */}
            <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-zinc-800">
              {/* Language Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Language
                </label>
                <div className="relative">
                  <select
                    value={settings.language}
                    onChange={(e) => updateSetting('language', e.target.value)}
                    className="w-full p-2.5 text-xs font-medium rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-200 appearance-none focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    {languageOptions.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Output Format */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Output Format
                </label>
                <div className="relative">
                  <select
                    value={settings.outputFormat}
                    onChange={(e) => updateSetting('outputFormat', e.target.value as OutputFormat)}
                    className="w-full p-2.5 text-xs font-medium rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-200 appearance-none focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    {formatOptions.map((fmt) => (
                      <option key={fmt.id} value={fmt.id}>
                        {fmt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </>
        ) : (
          /* History Tab */
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Recent Generations ({history.length})
              </span>
            </div>

            {history.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-white dark:bg-zinc-900 border border-dashed border-gray-200 dark:border-zinc-800">
                <Clock className="w-8 h-8 mx-auto text-gray-400 dark:text-gray-600 mb-2 opacity-60" />
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  No speech generated yet
                </p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Type your prompt in the editor and click "Generate speech" to start creating.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 transition-all shadow-2xs space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          src={item.avatarUrl}
                          alt={item.voiceName}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                        <span className="text-xs font-semibold text-gray-900 dark:text-white truncate max-w-[140px]">
                          {item.voiceName}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {item.duration.toFixed(1)}s • {item.characterCount} ch
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      "{item.text}"
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-zinc-800/80">
                      <button
                        onClick={() => onPlayHistoryItem(item)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Play</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyTextToClipboard(item.id, item.text)}
                          className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                          title="Copy text"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <a
                          href={item.audioUrl}
                          download={`elevenvoice-${item.voiceName.toLowerCase().replace(/\s+/g, '-')}-${item.id}.wav`}
                          className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                          title="Download audio"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>

                        <button
                          onClick={() => onDeleteHistoryItem(item.id)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
