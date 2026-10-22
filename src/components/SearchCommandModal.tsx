import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  Volume2,
  Wand2,
  Sliders,
  History,
  FileAudio,
  Radio,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import { Voice } from '../types';

interface SearchCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  voices: Voice[];
  onSelectVoice: (voice: Voice) => void;
  onOpenVoiceClone: () => void;
  onSelectTemplate: (text: string) => void;
}

export const SearchCommandModal: React.FC<SearchCommandModalProps> = ({
  isOpen,
  onClose,
  voices,
  onSelectVoice,
  onOpenVoiceClone,
  onSelectTemplate,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        // toggle
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredVoices = voices
    .filter((v) => v.name.toLowerCase().includes(query.toLowerCase()) || v.accent.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 5);

  const actions = [
    {
      title: 'Clone a New Voice',
      subtitle: 'Record microphone or upload sample audio',
      icon: Wand2,
      action: () => {
        onClose();
        onOpenVoiceClone();
      },
    },
    {
      title: 'Insert Dramatic Dialogue Template',
      subtitle: 'Multi-speaker heated dialogue script',
      icon: Volume2,
      action: () => {
        onClose();
        onSelectTemplate(
          "Roger: I told you we shouldn't have opened that door.\nSarah: And what was your alternative? Waiting in the dark?"
        );
      },
    },
    {
      title: 'Insert Documentary Narration Template',
      subtitle: 'Pensive nature documentary narration',
      icon: BookOpen,
      action: () => {
        onClose();
        onSelectTemplate(
          "Deep beneath the canopy, life persists in silent contemplation. [dramatic pause] Here, every creature plays its destined part."
        );
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-gray-200/80 dark:border-zinc-800">
          <Search className="w-4 h-4 text-gray-400 mr-2.5 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, voice, or search..."
            className="w-full text-sm bg-transparent border-none text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-hidden"
          />
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {/* Quick Actions */}
          <div className="space-y-1">
            <p className="px-2 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Quick Actions
            </p>
            {actions.map((act) => {
              const Icon = act.icon;
              return (
                <button
                  key={act.title}
                  onClick={act.action}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 text-left transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-950 text-gray-600 dark:text-gray-300 group-hover:text-blue-600">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">
                        {act.title}
                      </p>
                      <p className="text-[10px] text-gray-400">{act.subtitle}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              );
            })}
          </div>

          {/* Voices */}
          {filteredVoices.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-gray-100 dark:border-zinc-800">
              <p className="px-2 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Voices
              </p>
              {filteredVoices.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    onSelectVoice(v);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-800 text-left transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={v.avatarUrl}
                      alt={v.name}
                      className="w-6 h-6 rounded-full object-cover shrink-0"
                    />
                    <div className="truncate">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                        {v.name}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {v.accent} • {v.useCase}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-500">
                    Select
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200/80 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 flex items-center justify-between text-[11px] text-gray-400">
          <span>Search or press ESC to dismiss</span>
          <span className="font-mono">ElevenVoice AI</span>
        </div>
      </div>
    </div>
  );
};
