import React, { useState } from 'react';
import {
  X,
  Search,
  Play,
  Pause,
  Check,
  Plus,
  Trash2,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { Voice } from '../types';

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
  const [filterCategory, setFilterCategory] = useState<'all' | 'cloned' | 'premade'>('all');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredVoices = voices.filter((v) => {
    const matchesSearch =
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.accent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.useCase.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterCategory === 'cloned') return v.isCustom;
    if (filterCategory === 'premade') return !v.isCustom;
    return true;
  });

  const handlePlayPreview = (voice: Voice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingVoiceId === voice.id) {
      window.speechSynthesis.cancel();
      setPlayingVoiceId(null);
      return;
    }

    window.speechSynthesis.cancel();
    setPlayingVoiceId(voice.id);

    const utterance = new SpeechSynthesisUtterance(
      voice.previewText || `Hello, I am ${voice.name.split(' - ')[0]}. This is a sample of my voice.`
    );
    utterance.rate = 1.0;
    utterance.pitch = voice.gender === 'female' ? 1.2 : 0.9;
    utterance.onend = () => setPlayingVoiceId(null);
    utterance.onerror = () => setPlayingVoiceId(null);

    window.speechSynthesis.speak(utterance);
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
                Choose from ultra-realistic studio voices or manage your cloned voices
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
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, accent, gender..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                filterCategory === 'all'
                  ? 'bg-black text-white dark:bg-white dark:text-black shadow-2xs'
                  : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
              }`}
            >
              All ({voices.length})
            </button>
            <button
              onClick={() => setFilterCategory('premade')}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                filterCategory === 'premade'
                  ? 'bg-black text-white dark:bg-white dark:text-black shadow-2xs'
                  : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
              }`}
            >
              Premade ({voices.filter((v) => !v.isCustom).length})
            </button>
            <button
              onClick={() => setFilterCategory('cloned')}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                filterCategory === 'cloned'
                  ? 'bg-black text-white dark:bg-white dark:text-black shadow-2xs'
                  : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
              }`}
            >
              Custom Clones ({voices.filter((v) => v.isCustom).length})
            </button>
          </div>
        </div>

        {/* Voices Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredVoices.map((voice) => {
              const isSelected = voice.id === selectedVoice.id;
              const isPlaying = playingVoiceId === voice.id;

              return (
                <div
                  key={voice.id}
                  onClick={() => {
                    onSelectVoice(voice);
                    onClose();
                  }}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 group relative ${
                    isSelected
                      ? 'border-blue-600 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs'
                      : 'border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-gray-300 dark:hover:border-zinc-700 shadow-2xs'
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
                          className="absolute inset-0 m-auto w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-95"
                          title="Preview voice"
                        >
                          {isPlaying ? (
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
