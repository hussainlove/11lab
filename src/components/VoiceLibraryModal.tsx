import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Search,
  Play,
  Pause,
  Check,
  Plus,
  Trash2,
  Loader2,
  Volume2,
} from 'lucide-react';
import { Voice } from '../types';
import {
  speakWithBrowserVoice,
  stopBrowserVoice,
  convertFemaleStreamToMaleBaritone,
} from '../services/audioEngine';

interface VoiceLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  voices: Voice[];
  selectedVoice: Voice;
  onSelectVoice: (voice: Voice) => void;
  onDeleteCustomVoice: (id: string) => void;
  onOpenVoiceCloneModal: () => void;
}

export const VoiceLibraryModal: React.FC<VoiceLibraryModalProps> = ({
  isOpen,
  onClose,
  voices,
  selectedVoice,
  onSelectVoice,
  onDeleteCustomVoice,
  onOpenVoiceCloneModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<
    'all' | 'pakistani' | 'indian' | 'cloned' | 'premade'
  >('all');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewCacheRef = useRef<Map<string, string>>(new Map());

  const stopAllPreviews = () => {
    stopBrowserVoice();
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.src = '';
      previewAudioRef.current = null;
    }
    setPlayingVoiceId(null);
    setLoadingVoiceId(null);
  };

  useEffect(() => {
    if (!isOpen) {
      stopAllPreviews();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      stopAllPreviews();
      previewCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewCacheRef.current.clear();
    };
  }, []);

  if (!isOpen) return null;

  const isPakistaniVoice = (v: Voice) =>
    /pakistani|urdu|pashto|punjabi/i.test(`${v.name} ${v.accent} ${v.description}`);
  const isIndianVoice = (v: Voice) =>
    /indian|hindi|hinglish|punjabi|tamil|bengali/i.test(`${v.name} ${v.accent} ${v.description}`);

  const filteredVoices = voices.filter((v) => {
    const matchesSearch =
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.accent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.useCase.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterCategory === 'pakistani') return isPakistaniVoice(v);
    if (filterCategory === 'indian') return isIndianVoice(v);
    if (filterCategory === 'cloned') return v.isCustom;
    if (filterCategory === 'premade') return !v.isCustom;
    return true;
  });

  const playBlobUrl = (voiceId: string, url: string) => {
    const audio = new Audio(url);
    previewAudioRef.current = audio;
    setPlayingVoiceId(voiceId);
    audio.onended = () => {
      if (previewAudioRef.current === audio) {
        previewAudioRef.current = null;
        setPlayingVoiceId(null);
      }
    };
    audio.onerror = () => {
      if (previewAudioRef.current === audio) {
        previewAudioRef.current = null;
        setPlayingVoiceId(null);
      }
    };
    audio.play().catch(() => {
      setPlayingVoiceId(null);
    });
  };

  const handlePlayPreview = async (voice: Voice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingVoiceId === voice.id || loadingVoiceId === voice.id) {
      stopAllPreviews();
      return;
    }

    stopAllPreviews();

    const cachedUrl = previewCacheRef.current.get(voice.id);
    if (cachedUrl) {
      playBlobUrl(voice.id, cachedUrl);
      return;
    }

    const previewText =
      voice.previewText ||
      `Hello, I am ${voice.name.split(' - ')[0]}. This is a sample of my voice.`;

    setLoadingVoiceId(voice.id);
    try {
      const resp = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: previewText,
          voiceName: voice.geminiVoiceName,
          voiceGender: voice.gender,
          accent: voice.accent || 'default',
          tone: voice.acousticProfile?.tone || 'natural',
          style: voice.acousticProfile?.stylePrompt || voice.description,
          cloneProfile: voice.isCustom ? voice.acousticProfile : null,
        }),
      });
      if (!resp.ok) throw new Error('Preview fetch failed');
      const data = await resp.json();
      if (!data.audioBase64 || data.useClientEngine) {
        throw new Error('Use browser voice fallback');
      }

      const bin = atob(data.audioBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      let blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });

      if (
        (data.quotaFallback || data.model === 'eleven_v4_neural_stream') &&
        voice.gender === 'male'
      ) {
        const maleConv = await convertFemaleStreamToMaleBaritone(
          blob,
          voice.age === 'Senior' ? 0.69 : 0.72
        );
        if (maleConv?.audioBlob && maleConv.audioBlob.size > 44) {
          if (maleConv.audioUrl) URL.revokeObjectURL(maleConv.audioUrl);
          blob = maleConv.audioBlob;
        }
      }

      const url = URL.createObjectURL(blob);
      previewCacheRef.current.set(voice.id, url);
      setLoadingVoiceId(null);
      playBlobUrl(voice.id, url);
    } catch (_err) {
      setLoadingVoiceId(null);
      setPlayingVoiceId(voice.id);
      speakWithBrowserVoice(previewText, {
        voiceGender: voice.gender,
        pitchOffset: voice.acousticProfile?.pitchOffset || 0,
        speed: 1.0,
        onEnd: () => setPlayingVoiceId(null),
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/80 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Voice Library ({voices.length})
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Choose from Uzma, Pakistani, Indian, and global ultra-realistic studio voices
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 border-b border-gray-100 dark:border-zinc-800 shrink-0 bg-gray-50/50 dark:bg-zinc-900/50">
          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Uzma, Pakistani, Indian..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                filterCategory === 'all'
                  ? 'bg-black text-white dark:bg-white dark:text-black shadow-2xs'
                  : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
              }`}
            >
              All ({voices.length})
            </button>
            <button
              onClick={() => setFilterCategory('pakistani')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                filterCategory === 'pakistani'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-zinc-700'
              }`}
            >
              Pakistani ({voices.filter(isPakistaniVoice).length})
            </button>
            <button
              onClick={() => setFilterCategory('indian')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                filterCategory === 'indian'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white dark:bg-zinc-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-zinc-700'
              }`}
            >
              Indian / Hinglish ({voices.filter(isIndianVoice).length})
            </button>
            <button
              onClick={() => setFilterCategory('cloned')}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                filterCategory === 'cloned'
                  ? 'bg-black text-white dark:bg-white dark:text-black shadow-2xs'
                  : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
              }`}
            >
              Cloned ({voices.filter((v) => v.isCustom).length})
            </button>
          </div>
        </div>

        {/* Voices Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {filteredVoices.map((voice, idx) => {
              const isSelected = voice.id === selectedVoice.id;
              const isPlaying = playingVoiceId === voice.id;
              const isLoading = loadingVoiceId === voice.id;
              const cardGlows = [
                'glow-box-cyan',
                'glow-box-violet',
                'glow-box-emerald',
                'glow-box-amber',
                'glow-box-rose',
                'glow-box-indigo',
              ];

              return (
                <div
                  key={voice.id}
                  onClick={() => {
                    onSelectVoice(voice);
                    onClose();
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 group relative ${cardGlows[idx % cardGlows.length]} ${
                    isSelected
                      ? 'bg-blue-50/40 dark:bg-blue-950/20 ring-1 ring-cyan-500/40'
                      : 'border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <img
                          src={voice.avatarUrl}
                          alt={voice.name}
                          className="w-10 h-10 rounded-full object-cover shrink-0 ring-1 ring-gray-200 dark:ring-zinc-700"
                        />
                        <button
                          type="button"
                          onClick={(e) => handlePlayPreview(voice, e)}
                          className={`absolute inset-0 m-auto w-6 h-6 rounded-full bg-black/75 text-white flex items-center justify-center transition-opacity hover:scale-110 active:scale-95 ${
                            isPlaying || isLoading ? 'opacity-100' : 'opacity-80 sm:opacity-0 sm:group-hover:opacity-100'
                          }`}
                          title="Preview voice"
                        >
                          {isLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : isPlaying ? (
                            <Pause className="w-3 h-3 fill-current" />
                          ) : (
                            <Play className="w-3 h-3 fill-current ml-0.5" />
                          )}
                        </button>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                            {voice.name}
                          </p>
                          {voice.isCustom && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                              CLONE
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          {voice.accent} • {voice.gender} • {voice.age}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="p-1 rounded-full bg-blue-600 text-white shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-gray-600 dark:text-gray-400 line-clamp-2 leading-snug">
                    {voice.description}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100 dark:border-zinc-800/80">
                    <span className="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-zinc-800 font-medium">
                      {voice.useCase}
                    </span>

                    {voice.isCustom && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete cloned voice "${voice.name}"?`)) {
                            onDeleteCustomVoice(voice.id);
                          }
                        }}
                        className="text-gray-400 hover:text-red-500 p-1 rounded-md"
                        title="Delete voice"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200/80 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 flex items-center justify-between shrink-0">
          <button
            onClick={() => {
              onClose();
              onOpenVoiceCloneModal();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create or Clone a Voice</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-100 rounded-xl"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
