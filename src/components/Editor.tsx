import React, { useState, useRef, useEffect } from 'react';
import {
  Volume2,
  Plus,
  X,
  Sparkles,
  Smile,
  ChevronDown,
  Loader2,
  Trash2,
  Heart,
  Megaphone,
  Laugh,
  Compass,
  Moon,
  Users,
  Wand2,
  Check,
  Search,
} from 'lucide-react';
import { DialogueBlock, Voice } from '../types';
import { SAMPLE_PROMPT_PRESETS } from '../data/voices';
import { removeExtraSpaces } from '../utils/textCleaner';

interface EditorProps {
  dialogueBlocks: DialogueBlock[];
  setDialogueBlocks: React.Dispatch<React.SetStateAction<DialogueBlock[]>>;
  availableVoices: Voice[];
  selectedVoice: Voice;
  setSelectedVoice: (v: Voice) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  offlineMode: boolean;
  onSelectPromptPreset: (preset: typeof SAMPLE_PROMPT_PRESETS[0]) => void;
}

export const Editor: React.FC<EditorProps> = ({
  dialogueBlocks,
  setDialogueBlocks,
  availableVoices,
  selectedVoice,
  setSelectedVoice,
  onGenerate,
  isGenerating,
  offlineMode,
  onSelectPromptPreset,
}) => {
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const [speakerSelectBlockId, setSpeakerSelectBlockId] = useState<string | null>(null);
  const [speakerSearchQuery, setSpeakerSearchQuery] = useState('');
  const tagMenuRef = useRef<HTMLDivElement>(null);

  // Close tag menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tagMenuRef.current && !tagMenuRef.current.contains(event.target as Node)) {
        setShowTagMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Ctrl+Enter or Shift+Enter keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isGenerating && totalCharacters > 0) {
          onGenerate();
        }
      } else if (e.shiftKey && e.key === 'Enter') {
        // Shift+Enter inside textarea adds speaker if not typing a normal newline
        // We'll let the button also do this
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGenerating, dialogueBlocks]);

  const updateBlockText = (id: string, text: string) => {
    setDialogueBlocks((prev) =>
      prev.map((block) => (block.id === id ? { ...block, text } : block))
    );
  };

  const updateBlockSpeaker = (blockId: string, voice: Voice) => {
    setDialogueBlocks((prev) =>
      prev.map((block) =>
        block.id === blockId
          ? {
              ...block,
              speakerId: voice.id,
              speakerName: voice.name.split(' - ')[0],
              voiceName: voice.geminiVoiceName,
            }
          : block
      )
    );
    setSpeakerSelectBlockId(null);
  };

  const addSpeakerBlock = () => {
    const nextVoice =
      availableVoices.find((v) => v.id !== selectedVoice.id) || selectedVoice;
    const newBlock: DialogueBlock = {
      id: `block-${Date.now()}`,
      speakerId: nextVoice.id,
      speakerName: nextVoice.name.split(' - ')[0],
      voiceName: nextVoice.geminiVoiceName,
      text: '',
    };
    setDialogueBlocks((prev) => [...prev, newBlock]);
    setActiveBlockIndex(dialogueBlocks.length);
  };

  const removeBlock = (id: string) => {
    if (dialogueBlocks.length <= 1) return;
    setDialogueBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const clearBlockText = (id: string) => {
    updateBlockText(id, '');
  };

  const insertTag = (tag: string) => {
    const targetBlock = dialogueBlocks[activeBlockIndex] || dialogueBlocks[0];
    if (!targetBlock) return;
    const newText = targetBlock.text ? `${targetBlock.text} ${tag} ` : `${tag} `;
    updateBlockText(targetBlock.id, newText);
    setShowTagMenu(false);
  };

  const autoTagText = () => {
    const tags = ['[expressive]', '[laughs]', '[whispers]', '[sighs]', '[intense]'];
    const randomTag = tags[Math.floor(Math.random() * tags.length)];
    insertTag(randomTag);
  };

  const totalCharacters = dialogueBlocks.reduce((acc, b) => acc + (b.text?.length || 0), 0);

  const audioTagsList = [
    { label: '[laughs]', desc: 'Natural chuckle or laughter burst' },
    { label: '[whispers]', desc: 'Quiet, intimate tone' },
    { label: '[sighs]', desc: 'Tired or relieved exhalation' },
    { label: '[gasp]', desc: 'Sudden intake of breath' },
    { label: '[dramatic pause]', desc: '1.5s pregnant silence' },
    { label: '[authoritative]', desc: 'Commanding leadership voice' },
    { label: '[shouting]', desc: 'High energy projected speech' },
    { label: '[sarcastic]', desc: 'Dry, ironic delivery' },
    { label: '[clears throat]', desc: 'Realistic throat clearing' },
    { label: '[applause]', desc: 'Crowd clapping burst' },
  ];

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 bg-white dark:bg-zinc-950 overflow-hidden">
      {/* Scrollable Dialogue Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {dialogueBlocks.map((block, index) => {
            const currentVoice =
              availableVoices.find((v) => v.id === block.speakerId) || selectedVoice;

            return (
              <div
                key={block.id}
                onClick={() => setActiveBlockIndex(index)}
                className={`relative group rounded-2xl transition-all border ${
                  activeBlockIndex === index
                    ? 'border-gray-300 dark:border-zinc-700 shadow-xs bg-gray-50/40 dark:bg-zinc-900/30'
                    : 'border-transparent hover:border-gray-200 dark:hover:border-zinc-800'
                }`}
              >
                {/* Block Header: Speaker Switcher & Actions */}
                <div className="flex items-center justify-between px-3 pt-3 pb-1">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setSpeakerSelectBlockId(
                          speakerSelectBlockId === block.id ? null : block.id
                        );
                        setSpeakerSearchQuery('');
                      }}
                      className="flex items-center gap-2 px-2.5 py-1 text-xs font-semibold rounded-xl bg-white dark:bg-zinc-900 border border-gray-200/90 dark:border-zinc-800 shadow-2xs hover:bg-gray-50 dark:hover:bg-zinc-800/80 transition-all text-gray-800 dark:text-gray-200"
                    >
                      <img
                        src={currentVoice.avatarUrl}
                        alt={currentVoice.name}
                        className="w-4 h-4 rounded-full object-cover"
                      />
                      <span className="truncate max-w-[200px]">
                        {currentVoice.name}
                      </span>
                      <ChevronDown className="w-3 h-3 text-gray-400" />
                    </button>

                    {/* Speaker Selector Popover with Search Bar */}
                    {speakerSelectBlockId === block.id && (
                      <div className="absolute left-0 top-full mt-1.5 w-80 max-h-80 flex flex-col bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                        {/* Search Input Bar */}
                        <div className="p-2 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-900/70">
                          <div className="relative flex items-center">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 text-gray-400 pointer-events-none" />
                            <input
                              type="text"
                              autoFocus
                              value={speakerSearchQuery}
                              onChange={(e) => setSpeakerSearchQuery(e.target.value)}
                              placeholder="Search speaker by name, accent..."
                              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                              onClick={(e) => e.stopPropagation()}
                            />
                            {speakerSearchQuery && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSpeakerSearchQuery('');
                                }}
                                className="absolute right-2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* List of Voices matching query */}
                        <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                          {availableVoices
                            .filter((v) => {
                              const q = speakerSearchQuery.toLowerCase().trim();
                              if (!q) return true;
                              return (
                                v.name.toLowerCase().includes(q) ||
                                v.accent.toLowerCase().includes(q) ||
                                v.useCase.toLowerCase().includes(q) ||
                                v.gender.toLowerCase().includes(q)
                              );
                            })
                            .map((v) => (
                              <button
                                key={v.id}
                                onClick={() => {
                                  updateBlockSpeaker(block.id, v);
                                  setSpeakerSearchQuery('');
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-left hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200 transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <img
                                    src={v.avatarUrl}
                                    alt={v.name}
                                    className="w-5.5 h-5.5 rounded-full object-cover shrink-0"
                                  />
                                  <div className="truncate">
                                    <p className="font-medium truncate text-gray-900 dark:text-gray-100">{v.name}</p>
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                                      {v.accent} • {v.gender} • {v.useCase}
                                    </p>
                                  </div>
                                </div>
                                {v.id === block.speakerId && (
                                  <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />
                                )}
                              </button>
                            ))}
                          {availableVoices.filter((v) => {
                            const q = speakerSearchQuery.toLowerCase().trim();
                            if (!q) return true;
                            return (
                              v.name.toLowerCase().includes(q) ||
                              v.accent.toLowerCase().includes(q) ||
                              v.useCase.toLowerCase().includes(q) ||
                              v.gender.toLowerCase().includes(q)
                            );
                          }).length === 0 && (
                            <div className="py-4 text-center text-xs text-gray-400">
                              No speaker found for "{speakerSearchQuery}"
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Clear text or delete speaker */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {block.text && (
                      <button
                        onClick={() => clearBlockText(block.id)}
                        className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                        title="Clear text"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {dialogueBlocks.length > 1 && (
                      <button
                        onClick={() => removeBlock(block.id)}
                        className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="Remove speaker block"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Textarea for dialogue (auto-cleans extra spaces on blur/paste) */}
                <div className="px-3 pb-3 pt-1">
                  <textarea
                    value={block.text}
                    onChange={(e) => updateBlockText(block.id, e.target.value)}
                    onBlur={() => updateBlockText(block.id, removeExtraSpaces(block.text))}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData('text');
                      if (pasted) {
                        e.preventDefault();
                        const cleaned = removeExtraSpaces(pasted);
                        document.execCommand('insertText', false, cleaned);
                      }
                    }}
                    placeholder="Type your text with audio tags like [laughs] to turn into expressive speech..."
                    rows={Math.max(3, Math.min(10, Math.ceil((block.text.length || 1) / 55)))}
                    className="w-full bg-transparent resize-none focus:outline-hidden text-sm sm:text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 leading-relaxed font-sans"
                  />
                </div>
              </div>
            );
          })}

          {/* "+ Add speaker" Divider */}
          <div className="relative flex items-center justify-center my-4 group">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200/80 dark:border-zinc-800" />
            </div>
            <button
              onClick={addSpeakerBlock}
              className="relative flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-zinc-950 hover:bg-gray-100 dark:hover:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 rounded-full shadow-2xs hover:scale-105 active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Add speaker</span>
              <kbd className="hidden sm:inline text-[9px] px-1 py-0.2 bg-gray-100 dark:bg-zinc-800 rounded-sm text-gray-400">
                Shift+Enter
              </kbd>
            </button>
          </div>

          {/* Quick Prompt Starters */}
          <div className="pt-2">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2.5">
              Get started with
            </p>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_PROMPT_PRESETS.map((preset, idx) => {
                const icons = [Megaphone, Heart, Laugh, Compass, Moon, Users];
                const IconComponent = icons[idx % icons.length];

                return (
                  <button
                    key={preset.title}
                    onClick={() => onSelectPromptPreset(preset)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-gray-100/80 dark:bg-zinc-900 hover:bg-gray-200/70 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300 border border-gray-200/60 dark:border-zinc-800/80 transition-all hover:scale-102 active:scale-98"
                  >
                    <IconComponent className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                    <span>{preset.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="border-t border-gray-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 px-4 sm:px-8 py-3 shrink-0">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left Controls: Auto-Tag and Audio Tags Menu */}
          <div className="flex items-center gap-2" ref={tagMenuRef}>
            <div className="relative inline-flex rounded-xl shadow-2xs border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <button
                type="button"
                onClick={autoTagText}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-l-xl transition-colors"
                title="Automatically insert emotional expressive tags"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Auto-tag</span>
              </button>
              <div className="w-px bg-gray-200 dark:bg-zinc-800 my-1" />
              <button
                type="button"
                onClick={() => setShowTagMenu(!showTagMenu)}
                className="px-2 py-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-r-xl transition-colors"
                title="Choose emotion audio tag"
              >
                <ChevronDown className="w-3 h-3" />
              </button>

              {/* Tag Dropdown Menu */}
              {showTagMenu && (
                <div className="absolute left-0 bottom-full mb-2 w-64 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-2 space-y-1">
                  <div className="px-2 py-1 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Audio Emotion Tags
                  </div>
                  {audioTagsList.map((tag) => (
                    <button
                      key={tag.label}
                      onClick={() => insertTag(tag.label)}
                      className="w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-xs hover:bg-gray-100 dark:hover:bg-zinc-800 text-left transition-colors"
                    >
                      <span className="font-mono font-medium text-blue-600 dark:text-blue-400">
                        {tag.label}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {tag.desc}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Offline Engine Badge */}
            {offlineMode && (
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-full">
                Zero Latency
              </span>
            )}
          </div>

          {/* Right Controls: Generate Button & Credits */}
          <div className="flex items-center justify-between sm:justify-end gap-3">
            {/* Character & Credit counter */}
            <div className="flex items-center gap-1 text-right">
              <span className="text-[11px] font-mono font-medium text-gray-600 dark:text-gray-300">
                {totalCharacters.toLocaleString()}
              </span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-mono">
                / 10,000
              </span>
            </div>

            {/* Generate Speech Main Button (Compact & Polished) */}
            <button
              onClick={onGenerate}
              disabled={isGenerating || totalCharacters === 0}
              title="Ctrl + Enter to Generate"
              className={`relative inline-flex items-center justify-center gap-1.5 px-3 py-1.5 h-8.5 rounded-[10px] text-xs font-semibold transition-all duration-150 select-none ${
                isGenerating || totalCharacters === 0
                  ? 'bg-gray-100 dark:bg-zinc-900 text-gray-400 dark:text-zinc-600 cursor-not-allowed border border-gray-200/70 dark:border-zinc-800'
                  : 'bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-100 shadow-xs hover:shadow-sm active:scale-[0.98] cursor-pointer'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 dark:text-blue-600" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  {/* Subtle audio waveform wave indicator */}
                  <div className="flex items-center gap-0.5 opacity-90">
                    <span className="w-0.5 h-2.5 bg-current rounded-full" />
                    <span className="w-0.5 h-3.5 bg-current rounded-full" />
                    <span className="w-0.5 h-2 bg-current rounded-full" />
                  </div>
                  <span>Generate speech</span>
                  <span className="hidden sm:inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 text-[10px] font-mono font-medium rounded-md bg-white/20 dark:bg-black/15 text-white/90 dark:text-black/80">
                    <span>Ctrl</span>
                    <span>↵</span>
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
