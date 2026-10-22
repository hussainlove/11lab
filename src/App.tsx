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
import { synthesizeOfflineSpeech, convertAudioToMp3Blob } from './services/audioEngine';
import { removeExtraSpaces } from './utils/textCleaner';

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
      text: '',
    },
  ]);

  // Audio Settings State
  const [settings, setSettings] = useState<AudioSettings>({
    stability: 0.5,
    similarity: 0.75,
    styleExaggeration: 0.0,
    speakerBoost: true,
    speed: 1.0,
    pitch: 0,
    outputFormat: 'mp3_128',
    language: 'auto',
    modelId: 'eleven_v4',
    offlineMode: false,
  });

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('tts');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Modals State
  const [isVoiceCloneModalOpen, setIsVoiceCloneModalOpen] = useState<boolean>(false);
  const [isVoiceLibraryModalOpen, setIsVoiceLibraryModalOpen] = useState<boolean>(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);

  // Generation & Audio Playback State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
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
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Save history to storage
  useEffect(() => {
    try {
      localStorage.setItem('elevenvoice_history', JSON.stringify(history.slice(0, 30)));
    } catch (e) {
      console.warn('Could not persist history', e);
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

  // Update playback rate on audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

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
      setIsPlaying(false);
    } else {
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

  // Play a specific history track
  const playTrack = (item: GenerationHistoryItem) => {
    if (!audioRef.current) return;
    setCurrentTrack(item);
    audioRef.current.src = item.audioUrl;
    audioRef.current.playbackRate = playbackRate;
    audioRef.current.currentTime = 0;
    audioRef.current.play().then(() => setIsPlaying(true)).catch(console.warn);
  };

  // Voice CRUD
  const handleSaveCustomVoice = (voice: Voice) => {
    const updated = saveCustomVoice(voice);
    setCustomVoices(updated);
    setSelectedVoice(voice);
  };

  const handleDeleteCustomVoice = (id: string) => {
    const updated = deleteCustomVoice(id);
    setCustomVoices(updated);
    if (selectedVoice.id === id) {
      setSelectedVoice(PRESET_VOICES[0]);
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
          text: (preset as any).text || '',
        },
      ]);
    }
  };

  // GENERATE SPEECH (Online with Gemini or Offline with WebAudio)
  const handleGenerateSpeech = async () => {
    // Automatically sanitize and remove extra/trailing/consecutive spaces
    const cleanedBlocks = dialogueBlocks.map((b) => ({
      ...b,
      text: removeExtraSpaces(b.text),
    }));

    // Update dialogue blocks in editor so user immediately sees sanitized, neat text
    setDialogueBlocks(cleanedBlocks);

    const fullText = cleanedBlocks.map((b) => b.text).filter(Boolean).join(' ').trim();
    if (!fullText) return;

    setIsGenerating(true);

    try {
      let audioUrl = '';
      let audioBlob: Blob | null = null;
      let estDuration = 3.0;

      const isMultiSpeaker = cleanedBlocks.length >= 2;

      // Check if user has offline mode enabled or selected offline model
      if (settings.offlineMode || settings.modelId === 'offline_webaudio_engine') {
        // Offline WebAudio / Web Speech Synthesis
        const offlineResult = await synthesizeOfflineSpeech(fullText, {
          voiceGender: selectedVoice.gender,
          pitchOffset: settings.pitch,
          speed: settings.speed,
          stability: settings.stability,
          timbre: selectedVoice.description,
        });

        audioBlob = offlineResult.audioBlob;
        audioUrl = offlineResult.audioUrl;
        estDuration = offlineResult.duration;
      } else {
        // Server-Side Gemini API call
        const payload: any = {
          text: fullText,
          voiceName: selectedVoice.geminiVoiceName,
          model: isMultiSpeaker ? 'gemini-3.8-flash-tts' : 'gemini-3.8-flash-lite-tts',
          stability: settings.stability,
          similarity: settings.similarity,
          speed: settings.speed,
          pitch: settings.pitch,
          language: settings.language,
          style: selectedVoice.acousticProfile?.stylePrompt || selectedVoice.description,
        };

        if (isMultiSpeaker) {
          payload.dialogueBlocks = dialogueBlocks.map((b) => ({
            speaker: b.speakerName,
            voiceName: b.voiceName || selectedVoice.geminiVoiceName,
            text: b.text,
            style: b.style,
          }));
        }

        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Server responded with ${response.status}`);
        }

        const data = await response.json();
        if (!data.audioBase64) {
          throw new Error('No audio returned from Gemini speech model.');
        }

        // Convert base64 WAV to AudioBlob and encode as pure MP3
        const binaryStr = atob(data.audioBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const rawWavBlob = new Blob([bytes], { type: 'audio/wav' });

        // Convert to high-fidelity MP3
        const mp3Blob = await convertAudioToMp3Blob(rawWavBlob, settings.outputFormat === 'mp3_320' ? 320 : 128);
        audioBlob = mp3Blob;
        audioUrl = URL.createObjectURL(mp3Blob);

        // Estimate duration from WAV bytes (24kHz 16-bit mono = 48000 bytes/sec)
        estDuration = Math.max(1.5, Math.round((bytes.length / 48000) * 10) / 10);
      }

      // Ensure all extra spaces are completely stripped from dialogue blocks & text after generating
      const cleanFullText = removeExtraSpaces(fullText);
      setDialogueBlocks((prev) =>
        prev.map((b) => ({ ...b, text: removeExtraSpaces(b.text) }))
      );

      // Create new history item with MP3 format
      const newItem: GenerationHistoryItem = {
        id: `gen-${Date.now()}`,
        timestamp: Date.now(),
        text: cleanFullText.length > 120 ? `${cleanFullText.substring(0, 117)}...` : cleanFullText,
        voiceId: selectedVoice.id,
        voiceName: isMultiSpeaker ? `${dialogueBlocks.length} Speakers (Dialogue)` : selectedVoice.name,
        avatarUrl: selectedVoice.avatarUrl,
        duration: estDuration,
        audioUrl,
        format: 'mp3_128',
        model: settings.offlineMode ? 'Offline Synthesizer' : isMultiSpeaker ? 'Eleven v4 Dialogue' : 'Eleven v4 Lite',
        characterCount: cleanFullText.length,
        isOffline: settings.offlineMode || settings.modelId === 'offline_webaudio_engine',
        dialogueCount: dialogueBlocks.length,
      };

      setHistory((prev) => [newItem, ...prev]);

      // Automatically play in player
      playTrack(newItem);
    } catch (error: any) {
      console.error('Speech Generation Error:', error);

      // Graceful fallback to Offline WebAudio if online server failed
      if (!settings.offlineMode) {
        try {
          const offlineFallback = await synthesizeOfflineSpeech(fullText, {
            voiceGender: selectedVoice.gender,
            pitchOffset: settings.pitch,
            speed: settings.speed,
          });

          const cleanFallbackText = removeExtraSpaces(fullText);
          const fallbackItem: GenerationHistoryItem = {
            id: `gen-${Date.now()}`,
            timestamp: Date.now(),
            text: cleanFallbackText,
            voiceId: selectedVoice.id,
            voiceName: `${selectedVoice.name} (Offline Fallback)`,
            avatarUrl: selectedVoice.avatarUrl,
            duration: offlineFallback.duration,
            audioUrl: offlineFallback.audioUrl,
            format: 'mp3_128',
            model: 'Offline Neural Engine (Fallback)',
            characterCount: cleanFallbackText.length,
            isOffline: true,
          };

          setHistory((prev) => [fallbackItem, ...prev]);
          playTrack(fallbackItem);
          return;
        } catch (fallbackErr) {
          console.error('Fallback synthesis failed', fallbackErr);
        }
      }

      alert(`Speech synthesis error: ${error?.message || 'Unable to generate speech.'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-zinc-950 font-sans text-gray-900 dark:text-gray-100 select-none">
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
      <div className="flex flex-col flex-1 h-full min-w-0 lg:pl-64">
        {/* Top Header */}
        <Header
          title="Text to Speech"
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
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
        <div className="flex flex-1 h-full min-h-0 pb-20 overflow-hidden">
          {/* Main Central Editor */}
          <main className="flex-1 flex flex-col h-full min-w-0">
            <Editor
              dialogueBlocks={dialogueBlocks}
              setDialogueBlocks={setDialogueBlocks}
              availableVoices={allVoices}
              selectedVoice={selectedVoice}
              setSelectedVoice={setSelectedVoice}
              onGenerate={handleGenerateSpeech}
              isGenerating={isGenerating}
              offlineMode={settings.offlineMode}
              onSelectPromptPreset={handleSelectPromptPreset}
            />
          </main>

          {/* Right Inspector & History Panel */}
          <aside className="hidden md:flex w-80 lg:w-96 xl:w-[420px] h-full shrink-0">
            <SettingsPanel
              voices={allVoices}
              selectedVoice={selectedVoice}
              setSelectedVoice={setSelectedVoice}
              settings={settings}
              setSettings={setSettings}
              history={history}
              onPlayHistoryItem={playTrack}
              onDeleteHistoryItem={(id) => setHistory((prev) => prev.filter((h) => h.id !== id))}
              onOpenVoiceLibrary={() => setIsVoiceLibraryModalOpen(true)}
              onOpenVoiceClone={() => setIsVoiceCloneModalOpen(true)}
            />
          </aside>
        </div>

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
        onSelectVoice={(v) => {
          setSelectedVoice(v);
          setDialogueBlocks((prev) =>
            prev.map((b, i) => (i === 0 ? { ...b, speakerId: v.id, speakerName: v.name.split(' - ')[0], voiceName: v.geminiVoiceName } : b))
          );
        }}
        onDeleteCustomVoice={handleDeleteCustomVoice}
        onOpenVoiceCloneModal={() => setIsVoiceCloneModalOpen(true)}
      />

      {/* ⌘K Command & Search Modal */}
      <SearchCommandModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        voices={allVoices}
        onSelectVoice={(v) => {
          setSelectedVoice(v);
          setDialogueBlocks((prev) =>
            prev.map((b, i) => (i === 0 ? { ...b, speakerId: v.id, speakerName: v.name.split(' - ')[0], voiceName: v.geminiVoiceName } : b))
          );
        }}
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
