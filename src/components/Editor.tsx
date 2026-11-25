import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  X,
  Sparkles,
  ChevronDown,
  Loader2,
  Trash2,
  Heart,
  Megaphone,
  Laugh,
  Compass,
  Moon,
  Users,
  Check,
  Search,
  Globe,
  Flame,
  MessageCircle,
  Languages,
  Download,
  RefreshCw,
  Scissors,
  Sliders,
  Music,
  Play,
  Square,
  Volume2,
  Mic,
  MicOff,
} from 'lucide-react';
import {
  DialogueBlock,
  Voice,
  AudioSettings,
  GenerationHistoryItem,
  VOICE_TONE_OPTIONS,
  VOICE_ACCENT_OPTIONS,
  VOICE_SLANG_OPTIONS,
  VOICE_LANGUAGE_OPTIONS,
  HUMAN_SLANG_PHRASES,
  BACKGROUND_MUSIC_OPTIONS,
  BackgroundMusicMood,
} from '../types';
import { SAMPLE_PROMPT_PRESETS } from '../data/voices';
import { removeExtraSpaces, autoInjectHumanSlang } from '../utils/textCleaner';
import {
  downloadSpeechAsMp3,
  detectBestMusicMood,
  previewBackgroundMusicSample,
  stopBackgroundMusicPreview,
} from '../services/audioEngine';

interface EditorProps {
  dialogueBlocks: DialogueBlock[];
  setDialogueBlocks: React.Dispatch<React.SetStateAction<DialogueBlock[]>>;
  availableVoices: Voice[];
  selectedVoice: Voice;
  setSelectedVoice: (v: Voice) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  generationProgress?: { completed: number; total: number } | null;
  offlineMode: boolean;
  onSelectPromptPreset: (preset: typeof SAMPLE_PROMPT_PRESETS[0]) => void;
  settings: AudioSettings;
  setSettings: React.Dispatch<React.SetStateAction<AudioSettings>>;
  currentTrack: GenerationHistoryItem | null;
  onRemoveAudioSpace: () => Promise<void>;
  isRemovingAudioSpace: boolean;
  onNewVoiceover: () => void;
  onOpenMobileSettings?: () => void;
}

export const Editor: React.FC<EditorProps> = ({
  dialogueBlocks,
  setDialogueBlocks,
  availableVoices,
  selectedVoice,
  setSelectedVoice,
  onGenerate,
  isGenerating,
  generationProgress,
  offlineMode,
  onSelectPromptPreset,
  settings,
  setSettings,
  currentTrack,
  onRemoveAudioSpace,
  isRemovingAudioSpace,
  onNewVoiceover,
  onOpenMobileSettings,
}) => {
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showSlangMenu, setShowSlangMenu] = useState(false);
  const [showBgmMenu, setShowBgmMenu] = useState(false);
  const [isPreviewingBgm, setIsPreviewingBgm] = useState(false);
  const [isDownloadingTrack, setIsDownloadingTrack] = useState(false);
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);
  const [speakerSelectBlockId, setSpeakerSelectBlockId] = useState<string | null>(null);
  const [speakerSearchQuery, setSpeakerSearchQuery] = useState('');
  const [speakerFilterGender, setSpeakerFilterGender] = useState<
    'all' | 'pakistani' | 'indian' | 'female' | 'male' | 'cloned'
  >('all');
  const [speakerFilterAccent, setSpeakerFilterAccent] = useState<string>('all');
  const [speakerFilterTone, setSpeakerFilterTone] = useState<string>('all');
  const [isMobileBlockSettingsExpanded, setIsMobileBlockSettingsExpanded] = useState(false);

  // Voice Typing (Speech-to-Text Dictation) States & Refs
  const [dictatingBlockId, setDictatingBlockId] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [isTranscribingAudio, setIsTranscribingAudio] = useState<boolean>(false);
  const [voiceTypingError, setVoiceTypingError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const gotLiveSpeechTextRef = useRef<boolean>(false);
  const activeDictationBlockIdRef = useRef<string | null>(null);

  const tagMenuRef = useRef<HTMLDivElement>(null);
  const firstTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Close tag, slang & bgm menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tagMenuRef.current && !tagMenuRef.current.contains(event.target as Node)) {
        setShowTagMenu(false);
        setShowSlangMenu(false);
        setShowBgmMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      stopBackgroundMusicPreview();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_e) {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const appendDictatedTextToBlock = (blockId: string, spokenText: string) => {
    const cleanSpoken = removeExtraSpaces(spokenText);
    if (!cleanSpoken) return;
    setDialogueBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== blockId) return block;
        const existing = block.text ? block.text.trim() : '';
        const combined = existing ? `${existing} ${cleanSpoken}` : cleanSpoken;
        return { ...block, text: combined };
      })
    );
  };

  const resolveRecognitionLang = (langCode: string): string => {
    if (!langCode || langCode === 'auto') return 'en-US';
    if (langCode === 'hinglish') return 'en-IN';
    if (langCode === 'ur') return 'ur-PK';
    if (langCode === 'hi') return 'hi-IN';
    if (langCode === 'ar') return 'ar-SA';
    return langCode;
  };

  const stopVoiceTyping = async () => {
    const targetBlockId = activeDictationBlockIdRef.current || dictatingBlockId;
    activeDictationBlockIdRef.current = null;
    setDictatingBlockId(null);
    setInterimTranscript('');

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (_e) {}
      recognitionRef.current = null;
    }

    let recordedMimeType = 'audio/webm';
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      const recorder = mediaRecorderRef.current;
      recordedMimeType = recorder.mimeType || 'audio/webm';
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        try {
          recorder.stop();
        } catch (_e) {
          resolve();
        }
      });
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    // If browser SpeechRecognition didn't emit final text (e.g. iframe or browser limitation),
    // automatically transcribe the captured microphone audio via /api/transcribe!
    if (
      !gotLiveSpeechTextRef.current &&
      targetBlockId &&
      audioChunksRef.current.length > 0
    ) {
      const audioBlob = new Blob(audioChunksRef.current, { type: recordedMimeType });
      audioChunksRef.current = [];

      if (audioBlob.size > 600) {
        setIsTranscribingAudio(true);
        try {
          const base64Audio = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = String(reader.result || '');
              const b64 = res.includes(',') ? res.split(',')[1] : res;
              resolve(b64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
          });

          const resp = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Audio,
              mimeType: audioBlob.type || 'audio/webm',
              language: settings.language || 'auto',
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.text) {
              appendDictatedTextToBlock(targetBlockId, data.text);
            }
          }
        } catch (err) {
          console.warn('Audio transcription fallback warning:', err);
        } finally {
          setIsTranscribingAudio(false);
        }
      }
    } else {
      audioChunksRef.current = [];
    }
  };

  const toggleVoiceTyping = async (blockId?: string) => {
    const resolvedBlockId =
      blockId ||
      dialogueBlocks[activeBlockIndex]?.id ||
      dialogueBlocks[0]?.id;
    if (!resolvedBlockId) return;

    if (dictatingBlockId) {
      await stopVoiceTyping();
      return;
    }

    setVoiceTypingError(null);
    gotLiveSpeechTextRef.current = false;
    audioChunksRef.current = [];
    activeDictationBlockIdRef.current = resolvedBlockId;
    setDictatingBlockId(resolvedBlockId);
    setInterimTranscript('');

    // 1. Start Microphone MediaRecorder for 100% reliable audio capture fallback
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            audioChunksRef.current.push(ev.data);
          }
        };
        recorder.start(250);
      }
    } catch (micErr: any) {
      console.warn('Mic access warning for voice typing:', micErr);
      setVoiceTypingError('Please allow microphone access in your browser to use Voice Typing.');
      activeDictationBlockIdRef.current = null;
      setDictatingBlockId(null);
      return;
    }

    // 2. Also start real-time Web Speech API SpeechRecognition if supported by browser
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognitionAPI) {
      try {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = resolveRecognitionLang(settings.language || 'auto');

        recognition.onresult = (event: any) => {
          let finalChunk = '';
          let interimChunk = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0]?.transcript || '';
            if (event.results[i].isFinal) {
              finalChunk += transcript + ' ';
            } else {
              interimChunk += transcript;
            }
          }
          if (finalChunk.trim() && activeDictationBlockIdRef.current) {
            gotLiveSpeechTextRef.current = true;
            appendDictatedTextToBlock(activeDictationBlockIdRef.current, finalChunk.trim());
          }
          setInterimTranscript(interimChunk);
        };

        recognition.onerror = () => {
          // MediaRecorder fallback remains active
        };

        recognition.onend = () => {
          if (activeDictationBlockIdRef.current && recognitionRef.current === recognition) {
            try {
              recognition.start();
            } catch (_e) {}
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (_recErr) {
        // Fallback to MediaRecorder + /api/transcribe when user clicks Stop
      }
    }
  };


  const resolveMatchingAccentOption = (voiceAccent: string): string => {
    const matched = VOICE_ACCENT_OPTIONS.find(
      (opt) =>
        opt.id !== 'default' &&
        voiceAccent.toLowerCase().includes(opt.id.toLowerCase())
    );
    return matched ? matched.id : 'default';
  };

  const updateBlockText = (id: string, text: string) => {
    setDialogueBlocks((prev) =>
      prev.map((block) => (block.id === id ? { ...block, text } : block))
    );
  };

  const getVoiceBgmPreference = (voiceId: string, blockMood?: BackgroundMusicMood): BackgroundMusicMood => {
    if (blockMood) return blockMood;
    if (settings.voiceBgmMap && settings.voiceBgmMap[voiceId]) {
      return settings.voiceBgmMap[voiceId];
    }
    return 'none';
  };

  const updateBlockBgmMood = (blockId: string, speakerId: string, mood: BackgroundMusicMood) => {
    setDialogueBlocks((prev) =>
      prev.map((block) => (block.id === blockId ? { ...block, bgMusicMood: mood } : block))
    );
    setSettings((prev) => ({
      ...prev,
      bgMusicMood: mood,
      voiceBgmMap: {
        ...(prev.voiceBgmMap || {}),
        [speakerId]: mood,
      },
    }));
  };

  const updateBlockSpeaker = (blockId: string, voice: Voice) => {
    const matchedAccent =
      voice.acousticProfile?.accent || resolveMatchingAccentOption(voice.accent);
    const matchedTone = voice.acousticProfile?.tone || settings.tone || 'natural';
    const autoSlangMode =
      voice.acousticProfile?.slangMode ||
      (matchedAccent === 'Hinglish' || matchedAccent.includes('Indian')
        ? 'hinglish_slang'
        : settings.slangMode || 'auto_human');
    const savedVoiceBgm: BackgroundMusicMood =
      settings.voiceBgmMap?.[voice.id] || 'none';

    setDialogueBlocks((prev) =>
      prev.map((block) =>
        block.id === blockId
          ? {
              ...block,
              speakerId: voice.id,
              speakerName: voice.name.split(' - ')[0],
              voiceName: voice.geminiVoiceName,
              tone: matchedTone,
              accent: matchedAccent,
              slangMode: autoSlangMode,
              bgMusicMood: savedVoiceBgm,
              style: voice.acousticProfile?.stylePrompt || voice.description,
            }
          : block
      )
    );
    // Automatically sync selected speaker, accent, tone, slang, per-voice BGM & cloned DSP settings with the Settings Panel
    setSelectedVoice(voice);
    setSettings((prev) => ({
      ...prev,
      tone: matchedTone,
      accent: matchedAccent,
      slangMode: autoSlangMode,
      bgMusicMood: savedVoiceBgm,
      pitch:
        typeof voice.acousticProfile?.pitchOffset === 'number'
          ? voice.acousticProfile.pitchOffset
          : 0,
      stability:
        typeof voice.acousticProfile?.stability === 'number'
          ? voice.acousticProfile.stability
          : prev.stability,
      similarity:
        typeof voice.acousticProfile?.similarity === 'number'
          ? voice.acousticProfile.similarity
          : prev.similarity,
    }));
    setSpeakerSelectBlockId(null);
  };

  const updateBlockTone = (blockId: string, tone: string) => {
    setDialogueBlocks((prev) =>
      prev.map((block) => (block.id === blockId ? { ...block, tone } : block))
    );
    setSettings((prev) => ({ ...prev, tone }));
  };

  const updateBlockAccent = (blockId: string, accent: string) => {
    setDialogueBlocks((prev) =>
      prev.map((block) => (block.id === blockId ? { ...block, accent } : block))
    );
    setSettings((prev) => ({ ...prev, accent }));
  };

  const updateBlockSlangMode = (blockId: string, slangMode: string) => {
    setDialogueBlocks((prev) =>
      prev.map((block) => (block.id === blockId ? { ...block, slangMode } : block))
    );
    setSettings((prev) => ({
      ...prev,
      slangMode,
      autoHumanizeSlang: slangMode !== 'none',
    }));
  };

  const addSpeakerBlock = () => {
    const usedIds = new Set(dialogueBlocks.map((b) => b.speakerId));
    const nextVoice =
      availableVoices.find((v) => !usedIds.has(v.id)) ||
      availableVoices[dialogueBlocks.length % availableVoices.length] ||
      selectedVoice;

    const matchedAccent = resolveMatchingAccentOption(nextVoice.accent);
    const savedVoiceBgm: BackgroundMusicMood =
      settings.voiceBgmMap?.[nextVoice.id] || 'none';
    const newBlock: DialogueBlock = {
      id: `block-${Date.now()}`,
      speakerId: nextVoice.id,
      speakerName: nextVoice.name.split(' - ')[0],
      voiceName: nextVoice.geminiVoiceName,
      tone: settings.tone || 'natural',
      accent: matchedAccent,
      slangMode: settings.slangMode || 'auto_human',
      bgMusicMood: savedVoiceBgm,
      text: '',
    };
    setDialogueBlocks((prev) => [...prev, newBlock]);
    setActiveBlockIndex(dialogueBlocks.length);
    // Automatically sync new active speaker to Settings Panel
    setSelectedVoice(nextVoice);
    setSettings((prev) => ({
      ...prev,
      accent: matchedAccent,
      bgMusicMood: savedVoiceBgm,
    }));
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
    setShowSlangMenu(false);
  };

  const autoTagText = () => {
    const tags = ['[expressive]', '[laughs]', '[whispers]', '[sighs]', '[intense]'];
    const randomTag = tags[Math.floor(Math.random() * tags.length)];
    insertTag(randomTag);
  };

  const autoSlangText = () => {
    const targetBlock = dialogueBlocks[activeBlockIndex] || dialogueBlocks[0];
    if (!targetBlock) return;
    const currentAccent = targetBlock.accent || settings.accent || selectedVoice.accent;
    const currentSlangMode =
      targetBlock.slangMode && targetBlock.slangMode !== 'none'
        ? targetBlock.slangMode
        : settings.slangMode && settings.slangMode !== 'none'
        ? settings.slangMode
        : 'auto_human';

    if (!targetBlock.text.trim()) {
      const isHinglish =
        currentSlangMode === 'hinglish_slang' ||
        currentAccent.toLowerCase().includes('hinglish') ||
        currentAccent.toLowerCase().includes('indian');
      const starter = isHinglish
        ? 'Dekho yaar, sach bataun toh yeh naya voice system bilkul real human jaisa lagta hai, hai na?'
        : "Honestly, you know, I was just thinking about how natural and human this voice sounds, let's be real.";
      updateBlockText(targetBlock.id, starter);
      return;
    }

    const humanized = autoInjectHumanSlang(
      targetBlock.text,
      currentSlangMode,
      currentAccent,
      true
    );
    updateBlockText(targetBlock.id, humanized);
  };

  const totalCharacters = dialogueBlocks.reduce((acc, b) => acc + (b.text?.length || 0), 0);
  const totalWords = dialogueBlocks.reduce(
    (acc, b) => acc + (b.text ? b.text.trim().split(/\s+/).filter(Boolean).length : 0),
    0
  );
  const estimatedSpeechMinutes =
    totalWords > 0 ? Math.max(0.1, Math.round((totalWords / 145) * 10) / 10) : 0;

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

  // Match speaker tone keywords for filtering inside speaker dropdown
  const matchesToneFilter = (v: Voice, toneFilter: string): boolean => {
    if (toneFilter === 'all') return true;
    const combined = `${v.name} ${v.description} ${v.useCase}`.toLowerCase();
    switch (toneFilter) {
      case 'documentary_deep':
        return (
          /deep|documentary|documentaries|mature|wise|gravelly|storyteller|resonant|senior|baritone|booming|history|nature|wildlife|cinema|orator/.test(
            combined
          ) || v.age === 'Senior' || v.age === 'Middle Aged'
        );
      case 'energetic':
        return /energetic|upbeat|playful|dynamic|enthusiastic|action|fierce|arcade|strong|excited|bright|animated/.test(combined);
      case 'calm':
        return /calm|soothing|meditative|soft|gentle|whispery|asmr|smooth|warm|pleasant|empathetic|comforting/.test(combined);
      case 'conversational':
        return /conversational|casual|laid-back|friendly|natural|podcast|vlogs|youtube/.test(combined);
      case 'authoritative':
        return /authoritative|deep|commanding|corporate|news|anchor|reporter|booming|orator/.test(combined);
      case 'storytelling':
        return /storyteller|audiobook|narration|folklore|documentary|mystery|lore|drama/.test(combined);
      default:
        return combined.includes(toneFilter.toLowerCase());
    }
  };

  const getFilteredSpeakers = () => {
    const q = speakerSearchQuery.toLowerCase().trim();
    return availableVoices.filter((v) => {
      const combinedInfo = `${v.name} ${v.accent} ${v.description} ${v.useCase}`.toLowerCase();
      if (speakerFilterGender === 'pakistani' && !/pakistani|urdu|pashto|punjabi/.test(combinedInfo)) {
        return false;
      }
      if (
        speakerFilterGender === 'indian' &&
        !/indian|hindi|hinglish|punjabi|tamil|bengali/.test(combinedInfo)
      ) {
        return false;
      }
      if (speakerFilterGender === 'female' && v.gender !== 'female') return false;
      if (speakerFilterGender === 'male' && v.gender !== 'male') return false;
      if (speakerFilterGender === 'cloned' && !v.isCustom) return false;
      if (
        speakerFilterAccent !== 'all' &&
        !v.accent.toLowerCase().includes(speakerFilterAccent.toLowerCase())
      ) {
        return false;
      }
      if (!matchesToneFilter(v, speakerFilterTone)) {
        return false;
      }
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        v.accent.toLowerCase().includes(q) ||
        v.useCase.toLowerCase().includes(q) ||
        v.gender.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q)
      );
    });
  };

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 bg-white dark:bg-zinc-950 overflow-hidden">
      {/* Scrollable Dialogue Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {dialogueBlocks.map((block, index) => {
            const currentVoice =
              availableVoices.find((v) => v.id === block.speakerId) || selectedVoice;
            const filteredSpeakers = getFilteredSpeakers();
            const currentTone = block.tone || settings.tone || 'natural';
            const currentAccent = block.accent || settings.accent || 'default';
            const currentSlangMode = block.slangMode || settings.slangMode || 'auto_human';
            const currentBlockBgm = getVoiceBgmPreference(block.speakerId, block.bgMusicMood);
            const isBlockBgmOn = currentBlockBgm !== 'none';

            const blockGlowClasses = [
              'glow-box-cyan',
              'glow-box-violet',
              'glow-box-emerald',
              'glow-box-amber',
              'glow-box-rose',
              'glow-box-indigo',
            ];
            const blockGlow = blockGlowClasses[index % blockGlowClasses.length];

            return (
              <div
                key={block.id}
                onClick={() => {
                  setActiveBlockIndex(index);
                  if (currentVoice.id !== selectedVoice.id) {
                    setSelectedVoice(currentVoice);
                  }
                  setSettings((prev) => ({
                    ...prev,
                    tone: block.tone || prev.tone,
                    accent: block.accent || prev.accent,
                    slangMode: block.slangMode || prev.slangMode,
                    bgMusicMood: currentBlockBgm,
                  }));
                }}
                className={`relative group rounded-2xl transition-all border ${blockGlow} ${
                  activeBlockIndex === index
                    ? 'bg-gray-50/60 dark:bg-zinc-900/50 ring-1 ring-cyan-500/30'
                    : 'bg-white/80 dark:bg-zinc-950/60'
                }`}
              >
                {/* Block Header: Speaker Switcher + Tone Dropdown + Accent Dropdown + Slang Dropdown + Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-3 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* 1. Speaker Selector Button & Popover */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setSpeakerSelectBlockId(
                            speakerSelectBlockId === block.id ? null : block.id
                          );
                          setSpeakerSearchQuery('');
                          setSpeakerFilterGender('all');
                          setSpeakerFilterAccent('all');
                          setSpeakerFilterTone('all');
                        }}
                        className="flex items-center gap-2 px-2.5 py-1 text-xs font-semibold rounded-xl bg-white dark:bg-zinc-900 border border-gray-200/90 dark:border-zinc-800 glow-box-cyan hover:bg-cyan-50/30 dark:hover:bg-cyan-950/20 transition-all text-gray-800 dark:text-gray-200 cursor-pointer"
                      >
                        <img
                          src={currentVoice.avatarUrl}
                          alt={currentVoice.name}
                          className="w-4 h-4 rounded-full object-cover"
                        />
                        <span className="truncate max-w-[180px] sm:max-w-[210px]">
                          {currentVoice.name}
                        </span>
                        <ChevronDown className="w-3 h-3 text-gray-400" />
                      </button>

                      {/* Speaker Selector Popover with Search Bar + Tone & Accent Dropdowns */}
                      {speakerSelectBlockId === block.id && (
                        <div className="absolute left-0 top-full mt-1.5 w-80 sm:w-96 max-h-[420px] flex flex-col bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                          {/* Search Input & Filter Controls */}
                          <div className="p-2.5 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-900/70 space-y-2">
                            <div className="relative flex items-center">
                              <Search className="w-3.5 h-3.5 absolute left-2.5 text-gray-400 pointer-events-none" />
                              <input
                                type="text"
                                autoFocus
                                value={speakerSearchQuery}
                                onChange={(e) => setSpeakerSearchQuery(e.target.value)}
                                placeholder={`Search all ${availableVoices.length} speakers...`}
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

                            {/* Tone & Accent Filter Dropdowns inside Speaker Selector */}
                            <div className="grid grid-cols-2 gap-1.5">
                              <select
                                value={speakerFilterTone}
                                onChange={(e) => setSpeakerFilterTone(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full px-2 py-1 text-[11px] font-medium rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-200 focus:outline-hidden"
                              >
                                <option value="all">All Tones</option>
                                <option value="psychology">Psychology & Human Mind</option>
                                <option value="motivational">Motivational & Inspiring</option>
                                <option value="horror">Horror & Eerie Suspense</option>
                                <option value="documentary_deep">Deep, Mature, Documentary-Style</option>
                                <option value="energetic">Energetic & Upbeat</option>
                                <option value="calm">Calm & Soothing</option>
                                <option value="conversational">Conversational</option>
                                <option value="authoritative">Authoritative</option>
                                <option value="storytelling">Storytelling</option>
                              </select>

                              <select
                                value={speakerFilterAccent}
                                onChange={(e) => setSpeakerFilterAccent(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full px-2 py-1 text-[11px] font-medium rounded-lg bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-200 focus:outline-hidden"
                              >
                                <option value="all">All Accents ({VOICE_ACCENT_OPTIONS.length - 1})</option>
                                {VOICE_ACCENT_OPTIONS.filter((a) => a.id !== 'default').map((acc) => (
                                  <option key={acc.id} value={acc.id}>
                                    {acc.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Gender / Region Quick Filter Pills */}
                            <div className="flex flex-wrap items-center justify-between gap-1">
                              <div className="flex flex-wrap items-center gap-1">
                                {(
                                  [
                                    'all',
                                    'pakistani',
                                    'indian',
                                    'female',
                                    'male',
                                    'cloned',
                                  ] as const
                                ).map((tab) => (
                                  <button
                                    key={tab}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSpeakerFilterGender(tab);
                                    }}
                                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-lg capitalize transition-colors cursor-pointer ${
                                      speakerFilterGender === tab
                                        ? 'bg-black text-white dark:bg-white dark:text-black'
                                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                    }`}
                                  >
                                    {tab}
                                  </button>
                                ))}
                              </div>
                              <span className="text-[10px] font-mono text-gray-400">
                                {filteredSpeakers.length} voices
                              </span>
                            </div>
                          </div>

                          {/* List of Voices matching query */}
                          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                            {filteredSpeakers.map((v) => (
                              <button
                                key={v.id}
                                onClick={() => {
                                  updateBlockSpeaker(block.id, v);
                                  setSpeakerSearchQuery('');
                                }}
                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-left hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200 transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <img
                                    src={v.avatarUrl}
                                    alt={v.name}
                                    className="w-6 h-6 rounded-full object-cover shrink-0"
                                  />
                                  <div className="truncate">
                                    <p className="font-medium truncate text-gray-900 dark:text-gray-100">
                                      {v.name}
                                    </p>
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
                            {filteredSpeakers.length === 0 && (
                              <div className="py-4 text-center text-xs text-gray-400">
                                No speaker found matching filters
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Per-Voice BGM ON/OFF Quick Toggle & Mood Selector (Always visible for this voice) */}
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const nextMood: BackgroundMusicMood = isBlockBgmOn ? 'none' : 'auto';
                          updateBlockBgmMood(block.id, block.speakerId, nextMood);
                        }}
                        title={
                          isBlockBgmOn
                            ? `BGM is ON for ${currentVoice.name.split(' - ')[0]}. Click to turn BGM OFF for this voice.`
                            : `BGM is OFF for ${currentVoice.name.split(' - ')[0]}. Click to turn BGM ON for this voice.`
                        }
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                          isBlockBgmOn
                            ? 'bg-rose-600 text-white border-rose-400 glow-box-rose'
                            : 'bg-white dark:bg-zinc-900 text-gray-500 dark:text-gray-400 border-gray-200/90 dark:border-zinc-800 hover:text-gray-800 dark:hover:text-gray-200'
                        }`}
                      >
                        <Music className="w-3 h-3" />
                        <span>{isBlockBgmOn ? 'BGM: ON' : 'BGM: OFF'}</span>
                      </button>

                      {isBlockBgmOn && (
                        <div className="relative flex items-center">
                          <select
                            value={currentBlockBgm}
                            onChange={(e) =>
                              updateBlockBgmMood(
                                block.id,
                                block.speakerId,
                                e.target.value as BackgroundMusicMood
                              )
                            }
                            title={`Select BGM mood for ${currentVoice.name}`}
                            className="pl-2.5 pr-6 py-1 text-xs font-semibold rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 glow-box-rose text-rose-700 dark:text-rose-300 appearance-none cursor-pointer focus:outline-hidden max-w-[145px] truncate"
                          >
                            {BACKGROUND_MUSIC_OPTIONS.filter((b) => b.id !== 'none').map((bgm) => (
                              <option key={bgm.id} value={bgm.id}>
                                {bgm.shortLabel}
                              </option>
                            ))}
                            <option value="none">Turn BGM OFF</option>
                          </select>
                          <ChevronDown className="w-3 h-3 text-rose-500 absolute right-1.5 pointer-events-none" />
                        </div>
                      )}
                    </div>

                    {/* Mobile Expand Settings Toggle Button (Hidden on Desktop where settings are always shown) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMobileBlockSettingsExpanded((prev) => !prev);
                      }}
                      className={`md:hidden flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                        isMobileBlockSettingsExpanded
                          ? 'bg-indigo-600 text-white border-indigo-400 glow-box-indigo'
                          : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-200 border-gray-200/90 dark:border-zinc-800 glow-box-indigo'
                      }`}
                      title="Expand or hide voice settings"
                    >
                      <Sliders className="w-3 h-3" />
                      <span>Settings</span>
                      <ChevronDown
                        className={`w-3 h-3 transition-transform duration-200 ${
                          isMobileBlockSettingsExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Collapsible Voice Settings on Mobile (Always visible on Desktop md+) */}
                    <div
                      className={`${
                        isMobileBlockSettingsExpanded ? 'flex' : 'hidden md:flex'
                      } flex-wrap items-center gap-2 w-full md:w-auto pt-1 md:pt-0`}
                    >
                      {/* 2. Tone Dropdown (Energetic, Calm, Conversational, etc.) */}
                      <div className="relative flex items-center">
                        <Flame className="w-3 h-3 text-amber-500 absolute left-2.5 pointer-events-none" />
                        <select
                          value={currentTone}
                          onChange={(e) => updateBlockTone(block.id, e.target.value)}
                          title="Select Voice Tone (e.g., Energetic, Calm)"
                          className="pl-7 pr-6 py-1 text-xs font-medium rounded-xl bg-white dark:bg-zinc-900 border border-gray-200/90 dark:border-zinc-800 glow-box-amber hover:bg-amber-50/30 dark:hover:bg-amber-950/20 text-gray-700 dark:text-gray-200 appearance-none cursor-pointer focus:outline-hidden"
                        >
                          {VOICE_TONE_OPTIONS.map((t) => (
                            <option key={t.id} value={t.id}>
                              Tone: {t.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 pointer-events-none" />
                      </div>

                      {/* 3. Language Dropdown (All Global Languages + Auto Accent Sync) */}
                      <div className="relative flex items-center">
                        <Languages className="w-3 h-3 text-indigo-500 absolute left-2.5 pointer-events-none" />
                        <select
                          value={settings.language || 'auto'}
                          onChange={(e) => {
                            const langCode = e.target.value;
                            const langObj = VOICE_LANGUAGE_OPTIONS.find((l) => l.code === langCode);
                            const nextAccent = langObj?.defaultAccent || currentAccent;
                            setSettings((prev) => ({
                              ...prev,
                              language: langCode,
                              accent: nextAccent,
                            }));
                            updateBlockAccent(block.id, nextAccent);
                          }}
                          title="Select Language (automatically matches native accent)"
                          className="pl-7 pr-6 py-1 text-xs font-medium rounded-xl bg-white dark:bg-zinc-900 border border-gray-200/90 dark:border-zinc-800 glow-box-indigo hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 text-gray-700 dark:text-gray-200 appearance-none cursor-pointer focus:outline-hidden max-w-[195px] truncate"
                        >
                          {VOICE_LANGUAGE_OPTIONS.map((lang) => (
                            <option key={lang.code} value={lang.code}>
                              Lang: {lang.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 pointer-events-none" />
                      </div>

                      {/* 4. Accent Dropdown (German, American, British, Hinglish, Urdu-Hindi, etc.) */}
                      <div className="relative flex items-center">
                        <Globe className="w-3 h-3 text-purple-500 absolute left-2.5 pointer-events-none" />
                        <select
                          value={currentAccent}
                          onChange={(e) => updateBlockAccent(block.id, e.target.value)}
                          title="Select Voice Accent"
                          className="pl-7 pr-6 py-1 text-xs font-medium rounded-xl bg-white dark:bg-zinc-900 border border-gray-200/90 dark:border-zinc-800 glow-box-violet hover:bg-purple-50/30 dark:hover:bg-purple-950/20 text-gray-700 dark:text-gray-200 appearance-none cursor-pointer focus:outline-hidden max-w-[205px] truncate"
                        >
                          {VOICE_ACCENT_OPTIONS.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              Accent: {acc.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 pointer-events-none" />
                      </div>

                      {/* 5. Slang / Humanize Dropdown (Auto Human, Hinglish Slang, Casual English, etc.) */}
                      <div className="relative flex items-center">
                        <MessageCircle className="w-3 h-3 text-emerald-500 absolute left-2.5 pointer-events-none" />
                        <select
                          value={currentSlangMode}
                          onChange={(e) => updateBlockSlangMode(block.id, e.target.value)}
                          title="Select Human Slang & Conversational Fillers"
                          className="pl-7 pr-6 py-1 text-xs font-medium rounded-xl bg-white dark:bg-zinc-900 border border-gray-200/90 dark:border-zinc-800 glow-box-emerald hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 text-gray-700 dark:text-gray-200 appearance-none cursor-pointer focus:outline-hidden"
                        >
                          {VOICE_SLANG_OPTIONS.map((sl) => (
                            <option key={sl.id} value={sl.id}>
                              Slang: {sl.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 pointer-events-none" />
                      </div>

                      {/* Full Voice Settings Drawer Button (Mobile/Tablet) */}
                      {onOpenMobileSettings && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenMobileSettings();
                          }}
                          className="lg:hidden flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 glow-box-indigo cursor-pointer"
                        >
                          <Sliders className="w-3 h-3" />
                          <span>Full Voice Settings</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Voice Typing (Mic Dictation) + Clear text or delete speaker */}
                  <div className="flex items-center gap-1.5">
                    {/* Voice Typing Mic Button per block */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleVoiceTyping(block.id);
                      }}
                      disabled={isTranscribingAudio}
                      className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                        dictatingBlockId === block.id
                          ? 'bg-red-600 text-white border-red-400 glow-box-rose animate-pulse'
                          : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-200 border-gray-200/90 dark:border-zinc-800 glow-box-cyan hover:bg-cyan-50/40 dark:hover:bg-cyan-950/30'
                      }`}
                      title={
                        dictatingBlockId === block.id
                          ? 'Stop Voice Typing (Click when finished speaking)'
                          : 'Voice Typing: Speak into your mic to type text automatically'
                      }
                    >
                      {isTranscribingAudio && activeBlockIndex === index ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" />
                          <span>Transcribing...</span>
                        </>
                      ) : dictatingBlockId === block.id ? (
                        <>
                          <MicOff className="w-3.5 h-3.5" />
                          <span>Stop Mic</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5 text-cyan-500" />
                          <span>Voice Type</span>
                        </>
                      )}
                    </button>

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
                </div>

                {/* Live Voice Typing Status Banner inside block */}
                {(dictatingBlockId === block.id ||
                  (isTranscribingAudio && activeBlockIndex === index) ||
                  (voiceTypingError && activeBlockIndex === index)) && (
                  <div className="mx-3 mt-1.5 px-3 py-1.5 rounded-xl bg-red-50/80 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center justify-between gap-2 text-xs">
                    {voiceTypingError ? (
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        {voiceTypingError}
                      </span>
                    ) : isTranscribingAudio ? (
                      <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300 font-medium">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Converting your spoken voice into script text...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-medium truncate">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
                        <span className="truncate">
                          {interimTranscript
                            ? `Listening: "${interimTranscript}"`
                            : 'Listening... Speak now (Bol kar apna script likhein, phir Stop Mic dabayein)'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Textarea for dialogue (auto-cleans extra spaces on blur/paste) */}
                <div className="px-3 pb-2.5 pt-1">
                  <textarea
                    ref={index === 0 ? firstTextareaRef : undefined}
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
                    placeholder="Type your text, click 'Voice Type' to speak and write with your voice, or use [laughs] tags..."
                    rows={Math.max(3, Math.min(10, Math.ceil((block.text.length || 1) / 55)))}
                    className="w-full bg-transparent resize-none focus:outline-hidden text-sm sm:text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 leading-relaxed font-sans"
                  />

                  {/* Mobile Inline Generate Speech Bar (Always visible right below text box on mobile devices) */}
                  {index === dialogueBlocks.length - 1 && (
                    <div
                      className="sm:hidden flex flex-wrap items-center justify-between gap-2 pt-2 mt-1 border-t border-gray-100 dark:border-zinc-800/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[11px] font-mono text-gray-400">
                        {totalCharacters.toLocaleString()} / 10,000 ch
                      </span>

                      <div className="flex items-center gap-1.5 ml-auto">
                        {currentTrack && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!currentTrack || isDownloadingTrack) return;
                              setIsDownloadingTrack(true);
                              try {
                                await downloadSpeechAsMp3(
                                  currentTrack.audioUrl,
                                  currentTrack.voiceName,
                                  currentTrack.text,
                                  settings.outputFormat === 'mp3_320' ? 320 : 128
                                );
                              } catch (err) {
                                console.warn('Editor download error', err);
                              } finally {
                                setIsDownloadingTrack(false);
                              }
                            }}
                            disabled={isDownloadingTrack}
                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white border border-cyan-400/50 glow-box-cyan cursor-pointer"
                          >
                            {isDownloadingTrack ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            <span>Download</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={onGenerate}
                          disabled={isGenerating || totalCharacters === 0}
                          className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                            isGenerating || totalCharacters === 0
                              ? 'bg-gray-100 dark:bg-zinc-900 text-gray-400 dark:text-zinc-600 cursor-not-allowed border-gray-200 dark:border-zinc-800'
                              : 'bg-black text-white dark:bg-white dark:text-black border-indigo-500/50 glow-box-indigo active:scale-95 cursor-pointer'
                          }`}
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 dark:text-blue-600" />
                              <span>Generating...</span>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-0.5 opacity-90">
                                <span className="w-0.5 h-2.5 bg-current rounded-full" />
                                <span className="w-0.5 h-3.5 bg-current rounded-full" />
                                <span className="w-0.5 h-2 bg-current rounded-full" />
                              </div>
                              <span>Generate speech</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
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
              className="relative flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-zinc-950 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 border border-gray-200/80 dark:border-zinc-800 rounded-full glow-box-indigo hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
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
            <div className="flex flex-wrap gap-2.5">
              {SAMPLE_PROMPT_PRESETS.map((preset, idx) => {
                const icons = [Megaphone, Heart, Laugh, Compass, Moon, Users];
                const IconComponent = icons[idx % icons.length];
                const starterGlows = [
                  'glow-box-rose',
                  'glow-box-cyan',
                  'glow-box-amber',
                  'glow-box-emerald',
                  'glow-box-violet',
                  'glow-box-indigo',
                ];
                const starterIconColors = [
                  'text-rose-500',
                  'text-cyan-500',
                  'text-amber-500',
                  'text-emerald-500',
                  'text-purple-500',
                  'text-indigo-500',
                ];

                return (
                  <button
                    key={preset.title}
                    onClick={() => onSelectPromptPreset(preset)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-white/90 dark:bg-zinc-900/90 hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-800 ${starterGlows[idx % starterGlows.length]} transition-all cursor-pointer`}
                  >
                    <IconComponent className={`w-3.5 h-3.5 ${starterIconColors[idx % starterIconColors.length]}`} />
                    <span>{preset.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Control Bar */}
      <div className="border-t border-gray-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 px-3 sm:px-8 py-2.5 sm:py-3 shrink-0 z-20">
        <div className="max-w-3xl mx-auto flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
          {/* Left Controls: Voice Typing Mic, Auto-Tag, Auto-Slang (Humanize), Copyright-Free Smart BGM, and Menus */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5" ref={tagMenuRef}>
            {/* Voice Typing (Speech-to-Text Dictation) Button */}
            <button
              type="button"
              onClick={() => toggleVoiceTyping()}
              disabled={isTranscribingAudio}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                dictatingBlockId
                  ? 'bg-red-600 text-white border-red-400 glow-box-rose animate-pulse'
                  : 'bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-zinc-800 glow-box-cyan hover:bg-cyan-50/40 dark:hover:bg-cyan-950/30'
              }`}
              title={
                dictatingBlockId
                  ? 'Stop Voice Typing'
                  : 'Voice Typing: Speak into microphone to type your script'
              }
            >
              {isTranscribingAudio ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" />
                  <span>Transcribing...</span>
                </>
              ) : dictatingBlockId ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  <span>Stop Voice Typing</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Voice Type</span>
                </>
              )}
            </button>

            {/* Auto-Tag Split Button */}
            <div className="relative inline-flex rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 glow-box-amber">
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
                onClick={() => {
                  setShowTagMenu(!showTagMenu);
                  setShowSlangMenu(false);
                  setShowBgmMenu(false);
                }}
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

            {/* Auto-Slang / Humanize Split Button */}
            <div className="relative inline-flex rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 glow-box-emerald">
              <button
                type="button"
                onClick={autoSlangText}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-l-xl transition-colors"
                title="Automatically weave natural human slang & conversational fillers into text"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span>Auto-slang</span>
                {settings.autoHumanizeSlang && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Auto-slang on generate is active" />
                )}
              </button>
              <div className="w-px bg-gray-200 dark:bg-zinc-800 my-1" />
              <button
                type="button"
                onClick={() => {
                  setShowSlangMenu(!showSlangMenu);
                  setShowTagMenu(false);
                  setShowBgmMenu(false);
                }}
                className="px-2 py-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-r-xl transition-colors"
                title="Browse human slang & Hinglish fillers"
              >
                <ChevronDown className="w-3 h-3" />
              </button>

              {/* Human Slang & Fillers Dropdown Menu */}
              {showSlangMenu && (
                <div className="absolute left-0 bottom-full mb-2 w-72 max-h-80 flex flex-col bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden">
                  <div className="p-2.5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gray-50/70 dark:bg-zinc-900/70">
                    <div>
                      <p className="text-[11px] font-semibold text-gray-800 dark:text-gray-200">
                        Auto-Slang on Generate
                      </p>
                      <p className="text-[10px] text-gray-400">
                        Humanize voice automatically
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          autoHumanizeSlang: !prev.autoHumanizeSlang,
                          slangMode:
                            !prev.autoHumanizeSlang && prev.slangMode === 'none'
                              ? 'auto_human'
                              : prev.slangMode,
                        }))
                      }
                      className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        settings.autoHumanizeSlang
                          ? 'bg-emerald-600 dark:bg-emerald-500'
                          : 'bg-gray-200 dark:bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white dark:bg-zinc-950 shadow-sm transition duration-200 ease-in-out ${
                          settings.autoHumanizeSlang ? 'translate-x-3.5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                    <div className="px-2 py-0.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      Click to Insert Human Slang
                    </div>
                    {HUMAN_SLANG_PHRASES.map((item) => (
                      <button
                        key={item.phrase}
                        type="button"
                        onClick={() => insertTag(item.phrase)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-gray-100 dark:hover:bg-zinc-800 text-left transition-colors"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate">
                            "{item.phrase}"
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 shrink-0">
                            {item.category}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate ml-2">
                          {item.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Copyright-Free Per-Voice Background Music Split Button */}
            {(() => {
              const activeBlock = dialogueBlocks[activeBlockIndex] || dialogueBlocks[0];
              const activeVoice =
                availableVoices.find((v) => v.id === activeBlock?.speakerId) || selectedVoice;
              const activeBlockBgm = activeBlock
                ? getVoiceBgmPreference(activeBlock.speakerId, activeBlock.bgMusicMood)
                : settings.bgMusicMood || 'none';
              const isBgmActive = activeBlockBgm !== 'none';
              const allScriptText = dialogueBlocks.map((b) => b.text).join(' ');
              const activeTone = activeBlock?.tone || settings.tone || 'natural';
              const autoDetectedMood = detectBestMusicMood({
                text: activeBlock?.text || allScriptText,
                tone: activeTone,
                voiceName: activeVoice.name,
                voiceDescription: activeVoice.description,
                voiceUseCase: activeVoice.useCase,
              });
              const activeBgmOption =
                BACKGROUND_MUSIC_OPTIONS.find((o) => o.id === activeBlockBgm) ||
                BACKGROUND_MUSIC_OPTIONS[0];
              const shortVoiceName = activeVoice.name.split(' - ')[0];

              return (
                <div className="relative inline-flex rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 glow-box-rose">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBgmMenu(!showBgmMenu);
                      setShowTagMenu(false);
                      setShowSlangMenu(false);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-l-xl transition-colors cursor-pointer"
                    title="Choose which voice uses Copyright-Free Background Music (ON/OFF per voice)"
                  >
                    <Music className={`w-3.5 h-3.5 ${isBgmActive ? 'text-rose-500' : 'text-gray-400'}`} />
                    <span>
                      {!isBgmActive
                        ? `BGM (${shortVoiceName}): OFF`
                        : activeBlockBgm === 'auto'
                        ? `BGM (${shortVoiceName}): Auto (${autoDetectedMood})`
                        : `BGM (${shortVoiceName}): ${activeBgmOption.shortLabel}`}
                    </span>
                    {isBgmActive && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-rose-500"
                        title="Background Music enabled for this voice"
                      />
                    )}
                  </button>
                  <div className="w-px bg-gray-200 dark:bg-zinc-800 my-1" />
                  <button
                    type="button"
                    onClick={async () => {
                      if (isPreviewingBgm) {
                        stopBackgroundMusicPreview();
                        setIsPreviewingBgm(false);
                        return;
                      }
                      const moodToPlay =
                        activeBlockBgm === 'none' ? 'auto' : activeBlockBgm || 'auto';
                      setIsPreviewingBgm(true);
                      await previewBackgroundMusicSample({
                        mood: moodToPlay,
                        volume: settings.bgMusicVolume ?? 0.18,
                        text: activeBlock?.text || allScriptText,
                        tone: activeTone,
                        voiceName: activeVoice.name,
                        voiceDescription: activeVoice.description,
                        voiceUseCase: activeVoice.useCase,
                        onEnded: () => setIsPreviewingBgm(false),
                      });
                    }}
                    className="px-2.5 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-r-xl transition-colors flex items-center gap-1 cursor-pointer"
                    title={
                      isPreviewingBgm
                        ? 'Stop BGM Preview'
                        : 'Preview Copyright-Free Background Music for current voice & script'
                    }
                  >
                    {isPreviewingBgm ? (
                      <Square className="w-3 h-3 fill-current" />
                    ) : (
                      <Play className="w-3 h-3 fill-current" />
                    )}
                  </button>

                  {/* BGM Per-Voice Control & Mood Popover Menu */}
                  {showBgmMenu && (
                    <div className="absolute left-0 bottom-full mb-2 w-80 sm:w-88 max-h-[420px] flex flex-col bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden">
                      <div className="p-3 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/80 dark:bg-zinc-900/80 space-y-2.5">
                        {/* Explicit ON/OFF Toggle for Active Voice */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5 truncate">
                              <Music className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <span className="truncate">BGM for {shortVoiceName}</span>
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">
                              {isBgmActive
                                ? 'BGM is ON for this voice'
                                : 'BGM is OFF (Voice Only)'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!activeBlock) return;
                              const nextMood: BackgroundMusicMood = isBgmActive ? 'none' : 'auto';
                              updateBlockBgmMood(activeBlock.id, activeBlock.speakerId, nextMood);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                              isBgmActive
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {isBgmActive ? 'BGM: ON' : 'BGM: OFF'}
                          </button>
                        </div>

                        {/* Multi-Speaker Per-Voice BGM List (when 2+ speaker blocks exist) */}
                        {dialogueBlocks.length > 1 && (
                          <div className="pt-1.5 border-t border-gray-200/70 dark:border-zinc-800 space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                              Choose BGM per Speaker Block:
                            </p>
                            <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                              {dialogueBlocks.map((b, bIdx) => {
                                const bMood = getVoiceBgmPreference(b.speakerId, b.bgMusicMood);
                                const bOn = bMood !== 'none';
                                return (
                                  <div
                                    key={b.id}
                                    className="flex items-center justify-between gap-2 text-[11px] bg-white dark:bg-zinc-800/80 px-2 py-1 rounded-lg border border-gray-200/70 dark:border-zinc-700/70"
                                  >
                                    <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                                      #{bIdx + 1} {b.speakerName}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateBlockBgmMood(
                                          b.id,
                                          b.speakerId,
                                          bOn ? 'none' : 'auto'
                                        )
                                      }
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer ${
                                        bOn
                                          ? 'bg-rose-600 text-white'
                                          : 'bg-gray-100 dark:bg-zinc-700 text-gray-500 dark:text-gray-300'
                                      }`}
                                    >
                                      {bOn ? `ON (${bMood})` : 'OFF'}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Subtle ("Dheema") Mix Volume Slider */}
                        <div className="pt-1 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-600 dark:text-gray-300 font-medium flex items-center gap-1">
                              <Volume2 className="w-3 h-3 text-rose-500" />
                              BGM Volume (Dheema Mix)
                            </span>
                            <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                              {Math.round((settings.bgMusicVolume ?? 0.18) * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.05"
                            max="0.40"
                            step="0.01"
                            value={settings.bgMusicVolume ?? 0.18}
                            onChange={(e) =>
                              setSettings((prev) => ({
                                ...prev,
                                bgMusicVolume: parseFloat(e.target.value),
                              }))
                            }
                            className="w-full accent-rose-500 cursor-pointer h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-lg"
                          />
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                        {BACKGROUND_MUSIC_OPTIONS.map((opt) => {
                          const isSelected = activeBlockBgm === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                if (activeBlock) {
                                  updateBlockBgmMood(activeBlock.id, activeBlock.speakerId, opt.id);
                                } else {
                                  setSettings((prev) => ({
                                    ...prev,
                                    bgMusicMood: opt.id,
                                  }));
                                }
                                setShowBgmMenu(false);
                              }}
                              className={`w-full flex items-start justify-between px-2.5 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100'
                                  : 'hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200'
                              }`}
                            >
                              <div className="pr-2">
                                <p className="font-semibold text-gray-900 dark:text-gray-100">
                                  {opt.label}
                                </p>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-snug mt-0.5">
                                  {opt.desc}
                                </p>
                              </div>
                              {isSelected && (
                                <Check className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Offline Engine Badge */}
            {offlineMode && (
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-full">
                Zero Latency
              </span>
            )}
          </div>

          {/* Right Controls: Download, Regenerate / Generate Button & Unlimited Script Counter */}
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-2.5 w-full sm:w-auto">
            {/* Character, Estimated Duration & Unlimited counter */}
            <div className="flex items-center gap-1.5 text-right">
              <span className="text-[11px] font-mono font-medium text-gray-600 dark:text-gray-300">
                {totalCharacters.toLocaleString()} ch
              </span>
              {totalWords > 0 && (
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono font-medium">
                  • ~{estimatedSpeechMinutes >= 60
                    ? `${Math.floor(estimatedSpeechMinutes / 60)}h ${Math.round(estimatedSpeechMinutes % 60)}m`
                    : estimatedSpeechMinutes >= 1
                    ? `${Math.round(estimatedSpeechMinutes)}m`
                    : `${Math.max(1, Math.round(estimatedSpeechMinutes * 60))}s`}
                </span>
              )}
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                • Unlimited
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 ml-auto sm:ml-0">
              {/* Remove Space button: cleans extra spaces & removes dead audio silence/pauses before download */}
              {(currentTrack || totalCharacters > 0) && (
                <button
                  type="button"
                  onClick={onRemoveAudioSpace}
                  disabled={isRemovingAudioSpace || isGenerating}
                  title="Remove extra silence / dead space from generated voice (and clean text spaces) without damaging voice quality"
                  className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 h-8.5 rounded-[10px] text-xs font-semibold border transition-all active:scale-95 disabled:opacity-60 cursor-pointer ${
                    currentTrack?.isSpaceRemoved
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-800/70 glow-box-emerald'
                      : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 dark:text-purple-300 dark:border-purple-800/70 glow-box-violet'
                  }`}
                >
                  {isRemovingAudioSpace ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Removing Space...</span>
                    </>
                  ) : currentTrack?.isSpaceRemoved ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        {currentTrack.removedSpaceSeconds && currentTrack.removedSpaceSeconds > 0
                          ? `Space Removed (-${currentTrack.removedSpaceSeconds}s)`
                          : 'Space Removed'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Scissors className="w-3.5 h-3.5" />
                      <span>Remove Space</span>
                    </>
                  )}
                </button>
              )}

              {/* New Voice button (replaces Regenerate): resets editor & player so everything is ready for a fresh voiceover */}
              {(currentTrack || totalCharacters > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    onNewVoiceover();
                    setTimeout(() => {
                      firstTextareaRef.current?.focus();
                    }, 30);
                  }}
                  disabled={isGenerating}
                  title="Start a fresh New Voiceover (clears current script & audio preview)"
                  className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 h-8.5 rounded-[10px] text-xs font-semibold bg-white hover:bg-emerald-50/50 dark:bg-zinc-900 dark:hover:bg-emerald-950/30 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-zinc-700 glow-box-emerald transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>New Voice</span>
                </button>
              )}

              {/* When audio has been generated, show Download MP3 button side-by-side */}
              {currentTrack && (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!currentTrack || isDownloadingTrack) return;
                      setIsDownloadingTrack(true);
                      try {
                        await downloadSpeechAsMp3(
                          currentTrack.audioUrl,
                          currentTrack.voiceName,
                          currentTrack.text,
                          settings.outputFormat === 'mp3_320' ? 320 : 128
                        );
                      } catch (err) {
                        console.warn('Editor download error', err);
                      } finally {
                        setIsDownloadingTrack(false);
                      }
                    }}
                    disabled={isDownloadingTrack}
                    title="Download Generated MP3"
                    className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 h-8.5 rounded-[10px] text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white border border-cyan-400/50 glow-box-cyan transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isDownloadingTrack ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>Download</span>
                  </button>
                </>
              )}

              {/* Generate Speech Main Button (Compact & Polished, full-priority on mobile) */}
              <button
                onClick={onGenerate}
                disabled={isGenerating || totalCharacters === 0}
                title="Generate speech"
                className={`relative inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 h-8.5 rounded-[10px] text-xs font-semibold border transition-all duration-150 select-none ${
                  isGenerating || totalCharacters === 0
                    ? 'bg-gray-100 dark:bg-zinc-900 text-gray-400 dark:text-zinc-600 cursor-not-allowed border-gray-200/70 dark:border-zinc-800'
                    : 'bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-100 border-indigo-500/50 glow-box-indigo active:scale-[0.98] cursor-pointer'
                }`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 dark:text-blue-600" />
                    <span>
                      {generationProgress && generationProgress.total > 1
                        ? `Part ${generationProgress.completed}/${generationProgress.total} (${Math.round(
                            (generationProgress.completed / generationProgress.total) * 100
                          )}%)`
                        : 'Generating...'}
                    </span>
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
                  </>
                )}
              </button>
            </div>
          </div>

          {isGenerating && generationProgress && generationProgress.total > 1 && (
            <div className="w-full pt-1">
              <div className="flex items-center justify-between text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mb-1">
                <span>
                  Analyzing full script ({generationProgress.completed} of {generationProgress.total} segments completed)
                </span>
                <span className="font-mono">
                  {Math.round((generationProgress.completed / generationProgress.total) * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 transition-all duration-300"
                  style={{
                    width: `${Math.max(
                      4,
                      Math.round((generationProgress.completed / generationProgress.total) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
