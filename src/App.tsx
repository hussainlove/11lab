/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Editor } from './components/Editor';
import { SettingsPanel } from './components/SettingsPanel';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { VoiceCloneModal } from './components/VoiceCloneModal';
import { VoiceLibraryModal } from './components/VoiceLibraryModal';
import { SearchCommandModal } from './components/SearchCommandModal';
import { PRESET_VOICES, getStoredCustomVoices, saveCustomVoice, deleteCustomVoice, SAMPLE_PROMPT_PRESETS } from './data/voices';
import { Voice, DialogueBlock, AudioSettings, GenerationHistoryItem } from './types';
import {
  synthesizeOfflineSpeech,
  removeExtraAudioSpaces,
  applyVoiceCloneDsp,
  mixBackgroundMusicWithSpeech,
  speakWithBrowserVoice,
  stopBrowserVoice,
  convertFemaleStreamToMaleBaritone,
  stitchAudioBlobsAsWav,
  decodeAudioBlobOrUrl,
} from './services/audioEngine';
import { removeExtraSpaces, autoInjectHumanSlang, splitScriptIntoTtsChunks } from './utils/textCleaner';

export default function App() {
  // Theme State
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Apply dark mode class to root
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Voices State (Preset + Cloned)
  const [customVoices, setCustomVoices] = useState<Voice[]>(() => getStoredCustomVoices());
  const allVoices = [...customVoices, ...PRESET_VOICES];

  const [selectedVoice, setSelectedVoice] = useState<Voice>(PRESET_VOICES[0]); // Roger by default

  // Dialogue Blocks State
  const [dialogueBlocks, setDialogueBlocks] = useState<DialogueBlock[]>([
    {
      id: 'block-1',
      speakerId: PRESET_VOICES[0].id,
      speakerName: PRESET_VOICES[0].name.split(' - ')[0],
      voiceName: PRESET_VOICES[0].geminiVoiceName,
      tone: 'natural',
      accent: 'default',
      slangMode: 'auto_human',
      bgMusicMood: 'none',
      text: '',
    },
  ]);

  // Audio Settings State (bgMusicMood defaults to 'none' so user explicitly chooses which voice uses BGM)
  const [settings, setSettings] = useState<AudioSettings>({
    stability: 0.5,
    similarity: 0.75,
    styleExaggeration: 0.0,
    speakerBoost: true,
    speed: 1.0,
    pitch: 0,
    tone: 'natural',
    accent: 'default',
    slangMode: 'auto_human',
    autoHumanizeSlang: true,
    bgMusicMood: 'none',
    bgMusicVolume: 0.18,
    voiceBgmMap: {},
    outputFormat: 'mp3_128',
    language: 'auto',
    modelId: 'eleven_v4',
    offlineMode: false,
  });

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('tts');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isMobileSettingsOpen, setIsMobileSettingsOpen] = useState<boolean>(false);

  // Modals State
  const [isVoiceCloneModalOpen, setIsVoiceCloneModalOpen] = useState<boolean>(false);
  const [isVoiceLibraryModalOpen, setIsVoiceLibraryModalOpen] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);

  // Generation & Audio Playback State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  const [history, setHistory] = useState<GenerationHistoryItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('elevenvoice_history');
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Current Playing Audio
  const [currentTrack, setCurrentTrack] = useState<GenerationHistoryItem | null>(null);
  const [isRemovingAudioSpace, setIsRemovingAudioSpace] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Save history to storage safely (never store 3-hour multi-hundred-KB scripts in localStorage)
  useEffect(() => {
    try {
      const compactHistory = history.slice(0, 20).map((item) => ({
        ...item,
        spokenText:
          item.spokenText && item.spokenText.length > 6000
            ? item.spokenText.slice(0, 6000)
            : item.spokenText,
      }));
      localStorage.setItem('elevenvoice_history', JSON.stringify(compactHistory));
    } catch (e) {
      try {
        // Fallback: keep only latest 5 items without spokenText if storage is nearly full
        const minimalHistory = history.slice(0, 5).map(({ spokenText: _s, ...rest }) => rest);
        localStorage.setItem('elevenvoice_history', JSON.stringify(minimalHistory));
      } catch (_inner) {
        console.warn('Could not persist history', e);
      }
    }
  }, [history]);

  // Set up Audio element
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.onloadedmetadata = () => {
      setDuration(audio.duration || 0);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.onerror = () => {
      setIsPlaying(false);
    };

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Update playback rate & volume on audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Global ⌘K shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Play / Pause Track
  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;

    if (isPlaying) {
      audioRef.current.pause();
      stopBrowserVoice();
      setIsPlaying(false);
    } else {
      if (currentTrack.isOffline) {
        const trackVoice = allVoices.find((v) => v.id === currentTrack.voiceId) || selectedVoice;
        speakWithBrowserVoice(currentTrack.spokenText || currentTrack.text, {
          voiceGender: trackVoice.gender,
          pitchOffset: settings.pitch,
          speed: settings.speed,
        });
      }
      audioRef.current.play().then(() => setIsPlaying(true)).catch((err) => {
        console.warn('Playback error', err);
      });
    }
  };

  const seekTime = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const rewind10 = () => {
    if (audioRef.current) {
      const newTime = Math.max(0, audioRef.current.currentTime - 10);
      seekTime(newTime);
    }
  };

  const forward10 = () => {
    if (audioRef.current) {
      const newTime = Math.min(duration, audioRef.current.currentTime + 10);
      seekTime(newTime);
    }
  };

  // Load track into player WITHOUT auto-playing (used right after speech generation)
  const loadTrackWithoutPlaying = (item: GenerationHistoryItem) => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    stopBrowserVoice();
    setIsPlaying(false);
    setCurrentTrack(item);
    audioRef.current.src = item.audioUrl;
    audioRef.current.playbackRate = playbackRate;
    audioRef.current.volume = isMuted ? 0 : volume;
    audioRef.current.muted = isMuted;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    setDuration(item.duration || 0);
  };

  // Play a specific history track when user explicitly clicks Play
  const playTrack = (item: GenerationHistoryItem) => {
    if (!audioRef.current) return;
    stopBrowserVoice();
    setCurrentTrack(item);
    audioRef.current.src = item.audioUrl;
    audioRef.current.playbackRate = playbackRate;
    audioRef.current.volume = isMuted ? 0 : volume;
    audioRef.current.muted = isMuted;
    audioRef.current.currentTime = 0;
    if (item.isOffline) {
      const trackVoice = allVoices.find((v) => v.id === item.voiceId) || selectedVoice;
      speakWithBrowserVoice(item.spokenText || item.text, {
        voiceGender: trackVoice.gender,
        pitchOffset: settings.pitch,
        speed: settings.speed,
      });
    }
    audioRef.current.play().then(() => setIsPlaying(true)).catch(console.warn);
  };

  // Remove extra silence / dead space from current generated audio (and clean text spaces) without damaging the voice
  const handleRemoveAudioSpace = async () => {
    if (isRemovingAudioSpace) return;

    // Also clean any extra spaces in the Editor dialogue blocks immediately
    setDialogueBlocks((prev) =>
      prev.map((b) => ({
        ...b,
        text: removeExtraSpaces(b.text),
      }))
    );

    if (!currentTrack) return;

    setIsRemovingAudioSpace(true);
    try {
      const kbps = settings.outputFormat === 'mp3_320' ? 320 : 128;
      // If user clicks Remove Space again after already trimming once, tighten pauses slightly further
      const isSecondPass = Boolean(currentTrack.isSpaceRemoved);
      const result = await removeExtraAudioSpaces(currentTrack.audioUrl, {
        maxPauseMs: isSecondPass ? 55 : 80,
        targetPauseMs: isSecondPass ? 18 : 28,
        prePadMs: isSecondPass ? 22 : 30,
        postPadMs: isSecondPass ? 28 : 40,
        kbps,
      });

      const cumulativeRemoved =
        Math.round(
          ((currentTrack.removedSpaceSeconds || 0) + result.removedSeconds) * 100
        ) / 100;

      const updatedTrack: GenerationHistoryItem = {
        ...currentTrack,
        audioUrl: result.audioUrl,
        duration: result.newDuration,
        isSpaceRemoved: true,
        removedSpaceSeconds: cumulativeRemoved,
      };

      setCurrentTrack(updatedTrack);
      setHistory((prev) =>
        prev.map((item) => (item.id === updatedTrack.id ? updatedTrack : item))
      );

      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
        audioRef.current.src = updatedTrack.audioUrl;
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.volume = isMuted ? 0 : volume;
        audioRef.current.muted = isMuted;
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
        setDuration(result.newDuration);
      }
    } catch (err) {
      console.error('Failed to remove extra audio space:', err);
    } finally {
      setIsRemovingAudioSpace(false);
    }
  };

  // Automatically sync a selected or newly cloned voice into Settings and the active Dialogue Block
  const syncVoiceSelection = (voice: Voice) => {
    setSelectedVoice(voice);
    const prof = voice.acousticProfile;
    const nextAccent = prof?.accent || voice.accent || settings.accent || 'default';
    const nextTone = prof?.tone || settings.tone || 'natural';
    const nextSlang =
      prof?.slangMode ||
      (nextAccent === 'Hinglish' || nextAccent.includes('Indian')
        ? 'hinglish_slang'
        : settings.slangMode || 'auto_human');
    const savedVoiceBgm = settings.voiceBgmMap?.[voice.id] || 'none';

    setSettings((prev) => ({
      ...prev,
      accent: nextAccent,
      tone: nextTone,
      slangMode: nextSlang,
      bgMusicMood: savedVoiceBgm,
      pitch: typeof prof?.pitchOffset === 'number' ? prof.pitchOffset : 0,
      stability: typeof prof?.stability === 'number' ? prof.stability : prev.stability,
      similarity: typeof prof?.similarity === 'number' ? prof.similarity : prev.similarity,
    }));

    setDialogueBlocks((prev) =>
      prev.map((b, i) =>
        i === 0
          ? {
              ...b,
              speakerId: voice.id,
              speakerName: voice.name.split(' - ')[0],
              voiceName: voice.geminiVoiceName,
              tone: nextTone,
              accent: nextAccent,
              slangMode: nextSlang,
              bgMusicMood: savedVoiceBgm,
              style: prof?.stylePrompt || voice.description,
            }
          : b
      )
    );
  };

  // Reset Editor & Audio Player for a brand new voiceover
  const handleNewVoiceover = () => {
    stopBrowserVoice();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setCurrentTrack(null);

    const prof = selectedVoice.acousticProfile;
    const activeAccent = prof?.accent || settings.accent || selectedVoice.accent || 'default';
    const activeTone = prof?.tone || settings.tone || 'natural';
    const activeSlang = prof?.slangMode || settings.slangMode || 'auto_human';
    const activeVoiceBgm = settings.voiceBgmMap?.[selectedVoice.id] || 'none';

    setDialogueBlocks([
      {
        id: `block-${Date.now()}`,
        speakerId: selectedVoice.id,
        speakerName: selectedVoice.name.split(' - ')[0],
        voiceName: selectedVoice.geminiVoiceName,
        tone: activeTone,
        accent: activeAccent,
        slangMode: activeSlang,
        bgMusicMood: activeVoiceBgm,
        style: prof?.stylePrompt || selectedVoice.description,
        text: '',
      },
    ]);
  };

  // Voice CRUD
  const handleSaveCustomVoice = (voice: Voice) => {
    const updated = saveCustomVoice(voice);
    setCustomVoices(updated);
    syncVoiceSelection(voice);
  };

  const handleDeleteCustomVoice = (id: string) => {
    const updated = deleteCustomVoice(id);
    setCustomVoices(updated);
    if (selectedVoice.id === id) {
      syncVoiceSelection(PRESET_VOICES[0]);
    }
  };

  // Prompt Preset Selection
  const handleSelectPromptPreset = (preset: typeof SAMPLE_PROMPT_PRESETS[0]) => {
    if ((preset as any).isDialogue && (preset as any).blocks) {
      const blocks = (preset as any).blocks.map((b: any, idx: number) => {
        const v = allVoices.find((voice) => voice.name.toLowerCase().includes(b.speaker.toLowerCase())) || allVoices[idx % allVoices.length];
        return {
          id: `block-${Date.now()}-${idx}`,
          speakerId: v.id,
          speakerName: b.speaker,
          voiceName: b.voiceName,
          bgMusicMood: settings.voiceBgmMap?.[v.id] || 'none',
          text: b.text,
          style: b.style,
        };
      });
      setDialogueBlocks(blocks);
    } else {
      setDialogueBlocks([
        {
          id: `block-${Date.now()}`,
          speakerId: selectedVoice.id,
          speakerName: selectedVoice.name.split(' - ')[0],
          voiceName: selectedVoice.geminiVoiceName,
          bgMusicMood: settings.voiceBgmMap?.[selectedVoice.id] || 'none',
          text: (preset as any).text || '',
        },
      ]);
    }
  };

  // GENERATE SPEECH (Online with Gemini or Offline with WebAudio)
  const handleGenerateSpeech = async () => {
    // Automatically sanitize and remove extra/trailing/consecutive spaces,
    // and optionally weave in natural human slang if autoHumanizeSlang is enabled
    const cleanedBlocks = dialogueBlocks.map((b) => {
      const blockSlang = b.slangMode || settings.slangMode || 'auto_human';
      const blockAccent =
        b.accent && b.accent !== 'default'
          ? b.accent
          : settings.accent && settings.accent !== 'default'
          ? settings.accent
          : selectedVoice.accent;
      const baseClean = removeExtraSpaces(b.text);
      const humanizedText =
        settings.autoHumanizeSlang && blockSlang !== 'none'
          ? autoInjectHumanSlang(baseClean, blockSlang, blockAccent, false)
          : baseClean;
      return {
        ...b,
        text: humanizedText,
      };
    });

    // Update dialogue blocks in editor so user immediately sees sanitized, natural text
    setDialogueBlocks(cleanedBlocks);

    const fullText = cleanedBlocks.map((b) => b.text).filter(Boolean).join(' ').trim();
    if (!fullText) return;

    setIsGenerating(true);
    setGenerationProgress(null);

    try {
      let audioUrl = '';
      let audioBlob: Blob | null = null;
      let estDuration = 3.0;
      let usedOfflineEngine = false;
      let offlineSpokenText: string | undefined = undefined;

      const isMultiSpeaker = cleanedBlocks.length >= 2;
      const block0Voice = allVoices.find((v) => v.id === cleanedBlocks[0]?.speakerId);
      const effectiveVoice = !isMultiSpeaker && block0Voice ? block0Voice : selectedVoice;

      // Check if user has offline mode enabled or selected offline model
      const activeTone = cleanedBlocks[0]?.tone || settings.tone || 'natural';
      const activeAccent =
        cleanedBlocks[0]?.accent && cleanedBlocks[0].accent !== 'default'
          ? cleanedBlocks[0].accent
          : settings.accent && settings.accent !== 'default'
          ? settings.accent
          : effectiveVoice.accent;
      const activeSlangMode =
        cleanedBlocks[0]?.slangMode || settings.slangMode || 'auto_human';

      if (settings.offlineMode || settings.modelId === 'offline_webaudio_engine') {
        const toneSpeedFactor =
          activeTone === 'energetic'
            ? 1.12
            : activeTone === 'psychology'
            ? 0.94
            : activeTone === 'calm' || activeTone === 'documentary_deep' || activeTone === 'horror'
            ? 0.92
            : 1.0;
        const tonePitchAdjust =
          activeTone === 'documentary_deep'
            ? -2
            : activeTone === 'psychology' || activeTone === 'horror'
            ? -1
            : 0;
        const offlineResult = await synthesizeOfflineSpeech(fullText, {
          voiceGender: effectiveVoice.gender,
          pitchOffset: Math.max(-5, Math.min(5, settings.pitch + tonePitchAdjust)),
          speed: settings.speed * toneSpeedFactor,
          stability: settings.stability,
          timbre: `${effectiveVoice.description} (${activeTone}, ${activeAccent})`,
          autoSpeak: false,
        });

        audioBlob = offlineResult.audioBlob;
        audioUrl = offlineResult.audioUrl;
        estDuration = offlineResult.duration;
        usedOfflineEngine = true;
        offlineSpokenText = offlineResult.spokenText;
      } else {
        const targetKbps = settings.outputFormat === 'mp3_320' ? 320 : 128;

        // Build ordered <= 2,600-char chunk requests so 10-min, 50-min, or 3+ hr scripts stay fast AND never hit Gemini's ~4-min cap
        interface TtsChunkSpec {
          payload: any;
          voice: Voice;
          tone: string;
          bgMusicMood: string;
          textForDuration: string;
        }

        const chunkSpecs: TtsChunkSpec[] = [];

        if (isMultiSpeaker) {
          // Expand any oversized single block cleanly at sentence boundaries
          const expandedBlocks: { block: DialogueBlock; voice: Voice }[] = [];
          for (const b of cleanedBlocks) {
            if (!b.text || !b.text.trim()) continue;
            const bVoice = allVoices.find((v) => v.id === b.speakerId) || selectedVoice;
            const subTexts = splitScriptIntoTtsChunks(b.text, 2600);
            for (const st of subTexts) {
              expandedBlocks.push({ block: { ...b, text: st }, voice: bVoice });
            }
          }

          // Group consecutive dialogue blocks into batches <= 2,600 chars each
          const batches: { block: DialogueBlock; voice: Voice }[][] = [];
          let curBatch: { block: DialogueBlock; voice: Voice }[] = [];
          let curLen = 0;
          for (const item of expandedBlocks) {
            if (curBatch.length > 0 && curLen + item.block.text.length > 2600) {
              batches.push(curBatch);
              curBatch = [item];
              curLen = item.block.text.length;
            } else {
              curBatch.push(item);
              curLen += item.block.text.length;
            }
          }
          if (curBatch.length > 0) batches.push(curBatch);

          for (const batch of batches) {
            const batchText = batch.map((x) => x.block.text).join(' ');
            const firstItem = batch[0];
            const firstTone = firstItem.block.tone || settings.tone || 'natural';
            const firstAccent =
              firstItem.block.accent && firstItem.block.accent !== 'default'
                ? firstItem.block.accent
                : activeAccent;
            const batchMood =
              firstItem.block.bgMusicMood ||
              settings.voiceBgmMap?.[firstItem.block.speakerId] ||
              'none';

            const payload: any = {
              text: batchText,
              voiceName: firstItem.voice.geminiVoiceName,
              voiceGender: firstItem.voice.gender,
              model: 'gemini-3.8-flash-lite-tts',
              stability: settings.stability,
              similarity: settings.similarity,
              speed: settings.speed,
              pitch: settings.pitch,
              tone: firstTone,
              accent: firstAccent,
              slangMode: settings.autoHumanizeSlang
                ? firstItem.block.slangMode || activeSlangMode
                : 'none',
              language: settings.language,
              style:
                firstItem.voice.acousticProfile?.stylePrompt ||
                firstItem.voice.description,
              cloneProfile: firstItem.voice.isCustom
                ? firstItem.voice.acousticProfile
                : null,
            };

            if (batch.length >= 2) {
              payload.dialogueBlocks = batch.map(({ block: b, voice: bVoice }) => ({
                speaker: b.speakerName,
                voiceName: bVoice.geminiVoiceName,
                gender: bVoice.gender,
                text: b.text,
                tone: b.tone || settings.tone || 'natural',
                accent: b.accent && b.accent !== 'default' ? b.accent : activeAccent,
                slangMode: settings.autoHumanizeSlang
                  ? b.slangMode || activeSlangMode
                  : 'none',
                style: bVoice.acousticProfile?.stylePrompt || bVoice.description || b.style,
              }));
            }

            chunkSpecs.push({
              payload,
              voice: firstItem.voice,
              tone: firstTone,
              bgMusicMood: batchMood,
              textForDuration: batchText,
            });
          }
        } else {
          const singleMood =
            cleanedBlocks[0]?.bgMusicMood ||
            settings.voiceBgmMap?.[cleanedBlocks[0]?.speakerId || effectiveVoice.id] ||
            settings.bgMusicMood ||
            'none';
          const textChunks = splitScriptIntoTtsChunks(fullText, 2600);
          for (const chunkText of textChunks) {
            chunkSpecs.push({
              payload: {
                text: chunkText,
                voiceName: effectiveVoice.geminiVoiceName,
                voiceGender: effectiveVoice.gender,
                model: 'gemini-3.8-flash-lite-tts',
                stability: settings.stability,
                similarity: settings.similarity,
                speed: settings.speed,
                pitch: settings.pitch,
                tone: activeTone,
                accent: activeAccent,
                slangMode: settings.autoHumanizeSlang ? activeSlangMode : 'none',
                language: settings.language,
                style: effectiveVoice.acousticProfile?.stylePrompt || effectiveVoice.description,
                cloneProfile: effectiveVoice.isCustom ? effectiveVoice.acousticProfile : null,
              },
              voice: effectiveVoice,
              tone: activeTone,
              bgMusicMood: singleMood,
              textForDuration: chunkText,
            });
          }
        }

        const totalChunks = chunkSpecs.length;
        const isLongMultiChunk = totalChunks > 1;
        if (isLongMultiChunk) {
          setGenerationProgress({ completed: 0, total: totalChunks });
        }

        const synthesizeSingleSpec = async (spec: TtsChunkSpec): Promise<{
          blob: Blob;
          usedOffline: boolean;
          offlineText?: string;
        }> => {
          let lastErr: any = null;
          for (let attempt = 0; attempt < 4; attempt++) {
            if (attempt > 0) {
              const backoffMs = 600 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);
              await new Promise((r) => setTimeout(r, backoffMs));
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 75000);
            try {
              const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(spec.payload),
                signal: controller.signal,
              });
              clearTimeout(timeoutId);
              if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `Server responded with ${response.status}`);
              }

              const data = await response.json();
              if (data.useClientEngine || !data.audioBase64) {
                const offlineChunk = await synthesizeOfflineSpeech(spec.textForDuration, {
                  voiceGender: spec.voice.gender,
                  pitchOffset: Math.max(-5, Math.min(5, settings.pitch)),
                  speed: settings.speed,
                  stability: settings.stability,
                  timbre: `${spec.voice.description} (${spec.tone}, ${activeAccent})`,
                  autoSpeak: false,
                });
                return {
                  blob: offlineChunk.audioBlob,
                  usedOffline: true,
                  offlineText: offlineChunk.spokenText,
                };
              }

              const binaryStr = atob(data.audioBase64);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              const mimeType = data.mimeType || 'audio/wav';
              let chunkBlob = new Blob([bytes], { type: mimeType });

              // Convert female fallback stream to deep male baritone when male speaker is active
              const targetGender = spec.voice.gender || data.voiceGender;
              let wasBaritoneConverted = false;
              if (
                (data.quotaFallback || data.model === 'eleven_v4_neural_stream') &&
                targetGender === 'male'
              ) {
                try {
                  const baseFactor = spec.voice.age === 'Senior' ? 0.69 : 0.72;
                  const effectivePitchSt =
                    settings.pitch || spec.voice.acousticProfile?.pitchOffset || 0;
                  const pitchFactor = Math.max(
                    0.62,
                    Math.min(0.92, baseFactor * Math.pow(2, (effectivePitchSt * 0.45) / 12))
                  );
                  const maleConverted = await convertFemaleStreamToMaleBaritone(
                    chunkBlob,
                    pitchFactor
                  );
                  if (maleConverted?.audioBlob && maleConverted.audioBlob.size > 44) {
                    if (maleConverted.audioUrl) URL.revokeObjectURL(maleConverted.audioUrl);
                    chunkBlob = maleConverted.audioBlob;
                    wasBaritoneConverted = true;
                  }
                } catch (convErr) {
                  console.warn('Male baritone register conversion skipped:', convErr);
                }
              }

              // Apply DSP matching per chunk (skips secondary pitch shift if WSOLA already shifted male register)
              const needsDsp = Boolean(
                (spec.voice.isCustom && spec.voice.acousticProfile) ||
                  (settings.pitch !== 0 && !wasBaritoneConverted) ||
                  spec.tone === 'documentary_deep' ||
                  spec.tone === 'psychology' ||
                  spec.tone === 'horror'
              );
              if (needsDsp) {
                try {
                  const dspResult = await applyVoiceCloneDsp(
                    chunkBlob,
                    {
                      pitchOffset: settings.pitch || spec.voice.acousticProfile?.pitchOffset || 0,
                      formantShift: spec.voice.acousticProfile?.formantShift || 0,
                      tone: spec.tone,
                      asWav: isLongMultiChunk,
                      skipRateShift: wasBaritoneConverted,
                    },
                    targetKbps
                  );
                  if (dspResult?.audioBlob && dspResult.audioBlob.size > 44) {
                    if (dspResult.audioUrl) URL.revokeObjectURL(dspResult.audioUrl);
                    chunkBlob = dspResult.audioBlob;
                  }
                } catch (dspErr) {
                  console.warn('DSP matching skipped; keeping clean server audio:', dspErr);
                }
              }

              return { blob: chunkBlob, usedOffline: false };
            } catch (err) {
              clearTimeout(timeoutId);
              lastErr = err;
            }
          }

          // Recover a single transient failed chunk cleanly instead of discarding a multi-hour script
          if (totalChunks > 1) {
            console.warn('Recovering single chunk after 4 attempts:', lastErr);
            const fallbackSingle = await synthesizeOfflineSpeech(spec.textForDuration, {
              voiceGender: spec.voice.gender,
              pitchOffset: Math.max(-5, Math.min(5, settings.pitch)),
              speed: settings.speed,
              stability: settings.stability,
              autoSpeak: false,
            });
            return {
              blob: fallbackSingle.audioBlob,
              usedOffline: true,
              offlineText: fallbackSingle.spokenText,
            };
          }
          throw lastErr;
        };

        // Run ordered synthesis across all chunks with adaptive safe concurrency (prevents rate-limit storms on 3h scripts)
        const chunkResults: { blob: Blob; usedOffline: boolean; offlineText?: string }[] =
          new Array(totalChunks);
        let nextIndex = 0;
        let completedCount = 0;
        const concurrency = totalChunks > 4 ? 3 : Math.max(1, totalChunks);

        const worker = async () => {
          while (true) {
            const idx = nextIndex++;
            if (idx >= totalChunks) break;
            chunkResults[idx] = await synthesizeSingleSpec(chunkSpecs[idx]);
            completedCount++;
            if (isLongMultiChunk) {
              setGenerationProgress({ completed: completedCount, total: totalChunks });
            }
          }
        };

        await Promise.all(Array.from({ length: concurrency }, () => worker()));

        const chunkBlobs = chunkResults.map((r) => r.blob);
        usedOfflineEngine = chunkResults.every((r) => r.usedOffline);
        if (usedOfflineEngine) {
          offlineSpokenText = chunkResults
            .map((r) => r.offlineText || '')
            .filter(Boolean)
            .join(' ');
        }

        // Build per-voice / per-dialogue-block BGM segments
        const bgmSegments = cleanedBlocks
          .filter((b) => b.text && b.text.trim().length > 0)
          .map((b) => {
            const bVoice = allVoices.find((v) => v.id === b.speakerId) || selectedVoice;
            const bMood = b.bgMusicMood || settings.voiceBgmMap?.[b.speakerId] || 'none';
            return {
              weight: Math.max(1, b.text.trim().length),
              mood: bMood,
              text: b.text,
              tone: b.tone || settings.tone || 'natural',
              voiceName: bVoice.name,
              voiceDescription: bVoice.description,
              voiceUseCase: bVoice.useCase,
            };
          });
        const anyVoiceHasBgm = bgmSegments.some((s) => s.mood && s.mood !== 'none');
        let appliedBgmMood: string | undefined = undefined;

        if (chunkBlobs.length === 1) {
          audioBlob = chunkBlobs[0];
          audioUrl = URL.createObjectURL(audioBlob);
          const ab = await audioBlob.arrayBuffer();
          const bytes = new Uint8Array(ab);
          const wordsCount = fullText.split(/\s+/).filter(Boolean).length;
          if (
            audioBlob.type.includes('wav') &&
            bytes.length >= 44 &&
            bytes[0] === 0x52 &&
            bytes[1] === 0x49
          ) {
            const view = new DataView(bytes.buffer);
            const byteRate = view.getUint32(28, true) || 48000;
            const dataLen = Math.max(0, bytes.length - 44);
            estDuration = Math.max(0.8, Math.round((dataLen / byteRate) * 10) / 10);
          } else {
            estDuration = Math.max(1.2, Math.round((wordsCount / 2.6) * 10) / 10);
          }

          if (audioBlob && anyVoiceHasBgm) {
            try {
              const primarySeg = bgmSegments.find((s) => s.mood !== 'none') || bgmSegments[0];
              const mixedResult = await mixBackgroundMusicWithSpeech(audioBlob, {
                mood: primarySeg.mood,
                volume: settings.bgMusicVolume ?? 0.18,
                text: fullText,
                tone: activeTone,
                voiceName: selectedVoice.name,
                voiceDescription: selectedVoice.description,
                voiceUseCase: selectedVoice.useCase,
                kbps: targetKbps,
                segments: bgmSegments,
              });
              if (mixedResult?.audioBlob && mixedResult.audioBlob.size > 44) {
                if (audioUrl) URL.revokeObjectURL(audioUrl);
                audioBlob = mixedResult.audioBlob;
                audioUrl = mixedResult.audioUrl;
                estDuration = mixedResult.duration;
                appliedBgmMood = mixedResult.resolvedMood;
              }
            } catch (bgmErr) {
              console.warn('BGM mixing skipped; keeping clean vocal audio:', bgmErr);
            }
          }
        } else {
          // For multi-chunk long scripts (up to 3+ hours), mix BGM chunk-by-chunk before WAV stitching to stay under ~25MB peak RAM
          let blobsToStitch = chunkBlobs;
          if (anyVoiceHasBgm) {
            const mixedChunks: Blob[] = [];
            let timeOffsetSec = 0;
            for (let i = 0; i < chunkBlobs.length; i++) {
              const cBlob = chunkBlobs[i];
              const spec = chunkSpecs[i];
              const chunkMood = (spec.bgMusicMood || 'none') as any;
              let chunkDurSec = 4.0;
              try {
                const decoded = await decodeAudioBlobOrUrl(cBlob);
                chunkDurSec = decoded.duration || 4.0;
              } catch (_e) {}

              if (chunkMood && chunkMood !== 'none') {
                try {
                  const mixedChunk = await mixBackgroundMusicWithSpeech(cBlob, {
                    mood: chunkMood,
                    volume: settings.bgMusicVolume ?? 0.18,
                    text: spec.textForDuration,
                    tone: spec.tone,
                    voiceName: spec.voice.name,
                    voiceDescription: spec.voice.description,
                    voiceUseCase: spec.voice.useCase,
                    timeOffsetSec,
                    isFirstChunk: i === 0,
                    isLastChunk: i === chunkBlobs.length - 1,
                    asWav: true,
                  });
                  if (mixedChunk.audioUrl) URL.revokeObjectURL(mixedChunk.audioUrl);
                  mixedChunks.push(mixedChunk.audioBlob);
                  if (!appliedBgmMood && mixedChunk.resolvedMood !== 'none') {
                    appliedBgmMood = mixedChunk.resolvedMood;
                  }
                } catch (_err) {
                  mixedChunks.push(cBlob);
                }
              } else {
                mixedChunks.push(cBlob);
              }
              timeOffsetSec += chunkDurSec + 0.08;
            }
            blobsToStitch = mixedChunks;
          }

          const stitched = await stitchAudioBlobsAsWav(blobsToStitch, 80);
          audioBlob = stitched.audioBlob;
          audioUrl = stitched.audioUrl;
          estDuration = stitched.duration;
        }

        // Ensure all extra spaces are completely stripped from dialogue blocks & text after generating
        const cleanFullText = removeExtraSpaces(fullText);
        setDialogueBlocks((prev) =>
          prev.map((b) => ({ ...b, text: removeExtraSpaces(b.text) }))
        );

        const newItem: GenerationHistoryItem = {
          id: `gen-${Date.now()}`,
          timestamp: Date.now(),
          text: cleanFullText.length > 120 ? `${cleanFullText.substring(0, 117)}...` : cleanFullText,
          voiceId: effectiveVoice.id,
          voiceName: isMultiSpeaker ? `${dialogueBlocks.length} Speakers (Dialogue)` : effectiveVoice.name,
          avatarUrl: effectiveVoice.avatarUrl,
          duration: estDuration,
          audioUrl,
          format: settings.outputFormat,
          model: usedOfflineEngine
            ? 'Browser Neural Voice'
            : isMultiSpeaker
            ? 'HBL voicelab Dialogue'
            : 'HBL voicelab',
          characterCount: cleanFullText.length,
          isOffline: usedOfflineEngine,
          dialogueCount: dialogueBlocks.length,
          bgMusicMood: appliedBgmMood,
          spokenText: usedOfflineEngine ? offlineSpokenText : undefined,
        };

        setHistory((prev) => [newItem, ...prev]);

        // Load into player without auto-playing (user controls playback manually)
        loadTrackWithoutPlaying(newItem);
        return;
      }

      // Offline mode history creation
      const cleanFullText = removeExtraSpaces(fullText);
      setDialogueBlocks((prev) =>
        prev.map((b) => ({ ...b, text: removeExtraSpaces(b.text) }))
      );
      const newOfflineItem: GenerationHistoryItem = {
        id: `gen-${Date.now()}`,
        timestamp: Date.now(),
        text: cleanFullText.length > 120 ? `${cleanFullText.substring(0, 117)}...` : cleanFullText,
        voiceId: effectiveVoice.id,
        voiceName: isMultiSpeaker ? `${dialogueBlocks.length} Speakers (Dialogue)` : effectiveVoice.name,
        avatarUrl: effectiveVoice.avatarUrl,
        duration: estDuration,
        audioUrl,
        format: settings.outputFormat,
        model: 'Browser Neural Voice',
        characterCount: cleanFullText.length,
        isOffline: true,
        dialogueCount: dialogueBlocks.length,
        spokenText: offlineSpokenText,
      };
      setHistory((prev) => [newOfflineItem, ...prev]);
      loadTrackWithoutPlaying(newOfflineItem);
    } catch (error: any) {
      console.warn('Speech Generation fallback activated:', error?.message || error);

      // Graceful fallback to Browser SpeechSynthesis if server is unreachable
      try {
        const offlineFallback = await synthesizeOfflineSpeech(fullText, {
          voiceGender: selectedVoice.gender,
          pitchOffset: settings.pitch,
          speed: settings.speed,
          autoSpeak: false,
        });

        let finalFallbackUrl = offlineFallback.audioUrl;
        let finalFallbackDur = offlineFallback.duration;
        let fallbackBgmMood: string | undefined = undefined;

        const fallbackBgmSegments = cleanedBlocks
          .filter((b) => b.text && b.text.trim().length > 0)
          .map((b) => {
            const bVoice = allVoices.find((v) => v.id === b.speakerId) || selectedVoice;
            const bMood = b.bgMusicMood || settings.voiceBgmMap?.[b.speakerId] || 'none';
            return {
              weight: Math.max(1, b.text.trim().length),
              mood: bMood,
              text: b.text,
              tone: b.tone || settings.tone || 'natural',
              voiceName: bVoice.name,
              voiceDescription: bVoice.description,
              voiceUseCase: bVoice.useCase,
            };
          });
        const anyFallbackBgm = fallbackBgmSegments.some((s) => s.mood && s.mood !== 'none');

        if (anyFallbackBgm) {
          try {
            const primaryFallbackSeg =
              fallbackBgmSegments.find((s) => s.mood !== 'none') || fallbackBgmSegments[0];
            const mixedFallback = await mixBackgroundMusicWithSpeech(offlineFallback.audioBlob, {
              mood: primaryFallbackSeg.mood,
              volume: settings.bgMusicVolume ?? 0.18,
              text: fullText,
              tone: settings.tone,
              voiceName: selectedVoice.name,
              voiceDescription: selectedVoice.description,
              voiceUseCase: selectedVoice.useCase,
              segments: fallbackBgmSegments,
            });
            finalFallbackUrl = mixedFallback.audioUrl;
            finalFallbackDur = mixedFallback.duration;
            fallbackBgmMood = mixedFallback.resolvedMood;
          } catch (_bgmErr) {
            // Keep clean fallback timeline
          }
        }

        const cleanFallbackText = removeExtraSpaces(fullText);
        const fallbackItem: GenerationHistoryItem = {
          id: `gen-${Date.now()}`,
          timestamp: Date.now(),
          text: cleanFallbackText.length > 120 ? `${cleanFallbackText.substring(0, 117)}...` : cleanFallbackText,
          voiceId: selectedVoice.id,
          voiceName: `${selectedVoice.name}`,
          avatarUrl: selectedVoice.avatarUrl,
          duration: finalFallbackDur,
          audioUrl: finalFallbackUrl,
          format: settings.outputFormat,
          model: 'Browser Neural Voice',
          characterCount: cleanFallbackText.length,
          isOffline: true,
          bgMusicMood: fallbackBgmMood,
          spokenText: offlineFallback.spokenText,
        };

        setHistory((prev) => [fallbackItem, ...prev]);
        loadTrackWithoutPlaying(fallbackItem);
      } catch (fallbackErr) {
        console.warn('Fallback synthesis warning:', fallbackErr);
      }
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
    }
  };

  return (
    <div className="flex h-dvh max-h-dvh w-screen overflow-hidden bg-white dark:bg-zinc-950 font-sans text-gray-900 dark:text-gray-100 select-none">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenVoiceCloneModal={() => setIsVoiceCloneModalOpen(true)}
        onOpenVoiceLibraryModal={() => setIsVoiceLibraryModalOpen(true)}
        voicesCount={allVoices.length}
        offlineMode={settings.offlineMode}
        setOfflineMode={(off) => {
          setSettings((prev) => ({
            ...prev,
            offlineMode: off,
            modelId: off ? 'offline_webaudio_engine' : 'eleven_v4',
          }));
        }}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        isOpenMobile={isMobileSidebarOpen}
        setIsOpenMobile={setIsMobileSidebarOpen}
      />

      {/* Main Studio Viewport */}
      <div className="flex flex-col flex-1 h-full min-h-0 min-w-0 lg:pl-64">
        {/* Top Header */}
        <Header
          title="Text to Speech"
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          onOpenMobileSettings={() => setIsMobileSettingsOpen(true)}
          onOpenSearch={() => setIsSearchModalOpen(true)}
          onOpenVoiceClone={() => setIsVoiceCloneModalOpen(true)}
          offlineMode={settings.offlineMode}
          setOfflineMode={(off) => {
            setSettings((prev) => ({
              ...prev,
              offlineMode: off,
              modelId: off ? 'offline_webaudio_engine' : 'eleven_v4',
            }));
          }}
        />

        {/* Studio Workspace: Editor (left) + Settings/History Panel (right) */}
        <div
          className={`flex flex-1 h-full min-h-0 overflow-hidden transition-all ${
            currentTrack ? 'pb-36 sm:pb-24' : 'pb-0'
          }`}
        >
          {/* Main Central Editor */}
          <main className="flex-1 flex flex-col h-full min-h-0 min-w-0">
            <Editor
              dialogueBlocks={dialogueBlocks}
              setDialogueBlocks={setDialogueBlocks}
              availableVoices={allVoices}
              selectedVoice={selectedVoice}
              setSelectedVoice={setSelectedVoice}
              onGenerate={handleGenerateSpeech}
              isGenerating={isGenerating}
              generationProgress={generationProgress}
              offlineMode={settings.offlineMode}
              onSelectPromptPreset={handleSelectPromptPreset}
              settings={settings}
              setSettings={setSettings}
              currentTrack={currentTrack}
              onRemoveAudioSpace={handleRemoveAudioSpace}
              isRemovingAudioSpace={isRemovingAudioSpace}
              onNewVoiceover={handleNewVoiceover}
              onOpenMobileSettings={() => setIsMobileSettingsOpen(true)}
            />
          </main>

          {/* Right Inspector & History Panel (Desktop only; on mobile/tablet hidden and expanded via Settings button) */}
          <aside className="hidden lg:flex w-80 lg:w-96 xl:w-[420px] h-full shrink-0">
            <SettingsPanel
              voices={allVoices}
              selectedVoice={selectedVoice}
              setSelectedVoice={syncVoiceSelection}
              settings={settings}
              setSettings={(updater) => {
                setSettings((prev) => {
                  const next = typeof updater === 'function' ? updater(prev) : updater;
                  if (
                    next.tone !== prev.tone ||
                    next.accent !== prev.accent ||
                    next.slangMode !== prev.slangMode ||
                    next.bgMusicMood !== prev.bgMusicMood
                  ) {
                    setDialogueBlocks((blocks) =>
                      blocks.map((b, i) =>
                        b.speakerId === selectedVoice.id || i === 0
                          ? {
                              ...b,
                              tone: i === 0 ? next.tone : b.tone,
                              accent: i === 0 ? next.accent : b.accent,
                              slangMode: i === 0 ? next.slangMode : b.slangMode,
                              bgMusicMood:
                                b.speakerId === selectedVoice.id
                                  ? next.bgMusicMood
                                  : b.bgMusicMood,
                            }
                          : b
                      )
                    );
                  }
                  return next;
                });
              }}
              history={history}
              onPlayHistoryItem={playTrack}
              onDeleteHistoryItem={(id) => setHistory((prev) => prev.filter((h) => h.id !== id))}
              onOpenVoiceLibrary={() => setIsVoiceLibraryModalOpen(true)}
              onOpenVoiceClone={() => setIsVoiceCloneModalOpen(true)}
            />
          </aside>
        </div>

        {/* Mobile Settings & History Slide-Over / Expandable Drawer */}
        {isMobileSettingsOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-sm h-full bg-white dark:bg-zinc-950 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">
                  Voice Settings & History
                </span>
                <button
                  onClick={() => setIsMobileSettingsOpen(false)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200"
                >
                  Close ✕
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <SettingsPanel
                  voices={allVoices}
                  selectedVoice={selectedVoice}
                  setSelectedVoice={syncVoiceSelection}
                  settings={settings}
                  setSettings={(updater) => {
                    setSettings((prev) => {
                      const next = typeof updater === 'function' ? updater(prev) : updater;
                      if (
                        next.tone !== prev.tone ||
                        next.accent !== prev.accent ||
                        next.slangMode !== prev.slangMode ||
                        next.bgMusicMood !== prev.bgMusicMood
                      ) {
                        setDialogueBlocks((blocks) =>
                          blocks.map((b, i) =>
                            b.speakerId === selectedVoice.id || i === 0
                              ? {
                                  ...b,
                                  tone: i === 0 ? next.tone : b.tone,
                                  accent: i === 0 ? next.accent : b.accent,
                                  slangMode: i === 0 ? next.slangMode : b.slangMode,
                                  bgMusicMood:
                                    b.speakerId === selectedVoice.id
                                      ? next.bgMusicMood
                                      : b.bgMusicMood,
                                }
                              : b
                          )
                        );
                      }
                      return next;
                    });
                  }}
                  history={history}
                  onPlayHistoryItem={(item) => {
                    playTrack(item);
                    setIsMobileSettingsOpen(false);
                  }}
                  onDeleteHistoryItem={(id) =>
                    setHistory((prev) => prev.filter((h) => h.id !== id))
                  }
                  onOpenVoiceLibrary={() => {
                    setIsMobileSettingsOpen(false);
                    setIsVoiceLibraryModalOpen(true);
                  }}
                  onOpenVoiceClone={() => {
                    setIsMobileSettingsOpen(false);
                    setIsVoiceCloneModalOpen(true);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Bottom Audio Player Bar */}
        <AudioPlayerBar
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          currentTime={currentTime}
          duration={duration}
          onSeek={seekTime}
          playbackRate={playbackRate}
          onChangePlaybackRate={setPlaybackRate}
          onRewind10={rewind10}
          onForward10={forward10}
          volume={volume}
          onChangeVolume={setVolume}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(!isMuted)}
        />
      </div>

      {/* Voice Clone & Voice Design Modal */}
      <VoiceCloneModal
        isOpen={isVoiceCloneModalOpen}
        onClose={() => setIsVoiceCloneModalOpen(false)}
        onSaveVoice={handleSaveCustomVoice}
        offlineMode={settings.offlineMode}
      />

      {/* Voice Library Browser Modal */}
      <VoiceLibraryModal
        isOpen={isVoiceLibraryModalOpen}
        onClose={() => setIsVoiceLibraryModalOpen(false)}
        voices={allVoices}
        selectedVoice={selectedVoice}
        onSelectVoice={syncVoiceSelection}
        onDeleteCustomVoice={handleDeleteCustomVoice}
        onOpenVoiceCloneModal={() => setIsVoiceCloneModalOpen(true)}
      />

      {/* ⌘K Command & Search Modal */}
      <SearchCommandModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        voices={allVoices}
        onSelectVoice={syncVoiceSelection}
        onOpenVoiceClone={() => setIsVoiceCloneModalOpen(true)}
        onSelectTemplate={(text) => {
          setDialogueBlocks([
            {
              id: `block-${Date.now()}`,
              speakerId: selectedVoice.id,
              speakerName: selectedVoice.name.split(' - ')[0],
              voiceName: selectedVoice.geminiVoiceName,
              text,
            },
          ]);
        }}
      />
    </div>
  );
}
