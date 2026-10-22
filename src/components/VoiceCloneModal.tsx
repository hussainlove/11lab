import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Mic,
  Upload,
  Square,
  Play,
  Pause,
  Wand2,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { Voice, AcousticProfile } from '../types';
import { analyzeVoiceRecording, getAudioContext } from '../services/audioEngine';

interface VoiceCloneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveVoice: (voice: Voice) => void;
  offlineMode: boolean;
}

export const VoiceCloneModal: React.FC<VoiceCloneModalProps> = ({
  isOpen,
  onClose,
  onSaveVoice,
  offlineMode,
}) => {
  const [activeTab, setActiveTab] = useState<'instant' | 'design'>('instant');

  // Form State
  const [voiceName, setVoiceName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'narration' | 'character' | 'commercial' | 'social'>('narration');
  const [gender, setGender] = useState<'male' | 'female' | 'neutral'>('male');
  const [accent, setAccent] = useState('American');
  const [age, setAge] = useState('Middle Aged');

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProfile, setAnalysisProfile] = useState<AcousticProfile | null>(null);
  const [testText, setTestText] = useState('Hello! This is my newly cloned voice speaking.');
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
      if (testAudioUrl) URL.revokeObjectURL(testAudioUrl);
    };
  }, [recordedAudioUrl, testAudioUrl]);

  if (!isOpen) return null;

  // Start Mic Recording
  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setRecordedAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert('Unable to access microphone. Please allow microphone permissions or upload an audio file.');
    }
  };

  // Stop Mic Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    }
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRecordedAudioBlob(file);
      const url = URL.createObjectURL(file);
      setRecordedAudioUrl(url);
    }
  };

  // Run Voice Clone Analysis
  const handleAnalyzeAndClone = async () => {
    if (!voiceName.trim()) {
      alert('Please give your voice a name.');
      return;
    }

    setIsAnalyzing(true);
    try {
      let acousticInfo: any = {};

      if (recordedAudioBlob) {
        // Run on-device WebAudio acoustic analysis
        const clientAnalysis = await analyzeVoiceRecording(recordedAudioBlob);
        acousticInfo = {
          pitch: clientAnalysis.pitchRegister,
          timbre: clientAnalysis.timbreDescription,
          bestPrebuiltVoice: clientAnalysis.recommendedBaseVoice,
          pitchOffset: clientAnalysis.pitchRegister === 'bass' ? -2 : clientAnalysis.pitchRegister === 'soprano' ? 2 : 0,
        };
      }

      // If online, also send to Gemini analyze endpoint for deep semantic profile
      if (!offlineMode && recordedAudioBlob) {
        try {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((res) => {
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              res(base64);
            };
            reader.readAsDataURL(recordedAudioBlob);
          });
          const base64Audio = await base64Promise;

          const response = await fetch('/api/clone-voice/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Audio,
              mimeType: recordedAudioBlob.type || 'audio/wav',
              voiceName,
              description,
            }),
          });
          const data = await response.json();
          if (data.profile) {
            acousticInfo = { ...acousticInfo, ...data.profile };
          }
        } catch (e) {
          console.warn('Server voice analysis skipped, using local acoustic profile', e);
        }
      }

      const newVoice: Voice = {
        id: `voice-${Date.now()}`,
        name: `${voiceName} (Clone)`,
        category: 'cloned',
        avatarUrl:
          gender === 'female'
            ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80'
            : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80',
        avatarColor: 'from-emerald-500 to-teal-600',
        description: description || acousticInfo.timbre || 'Custom high-fidelity cloned voice',
        accent,
        gender,
        age,
        useCase: category.toUpperCase(),
        geminiVoiceName: acousticInfo.bestPrebuiltVoice || (gender === 'female' ? 'Kore' : 'Puck'),
        isCustom: true,
        acousticProfile: acousticInfo,
      };

      onSaveVoice(newVoice);
      onClose();
    } catch (err: any) {
      alert(`Error creating voice: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateDesignedVoice = async () => {
    if (!voiceName.trim()) {
      alert('Please give your designed voice a name.');
      return;
    }

    const newVoice: Voice = {
      id: `designed-${Date.now()}`,
      name: `${voiceName} (Designed)`,
      category: 'designed',
      avatarUrl:
        gender === 'female'
          ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80'
          : 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&h=120&q=80',
      avatarColor: 'from-purple-500 to-indigo-600',
      description: description || `${age} ${accent} ${gender} voice`,
      accent,
      gender,
      age,
      useCase: 'Voice Design',
      geminiVoiceName: gender === 'female' ? (age === 'Young' ? 'Zephyr' : 'Kore') : age === 'Senior' ? 'Charon' : 'Puck',
      isCustom: true,
      acousticProfile: {
        stylePrompt: description,
        accent,
        gender,
        age,
      },
    };

    onSaveVoice(newVoice);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/80 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Voice Creation
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Clone an existing voice or design a brand new vocal persona
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

        {/* Tabs */}
        <div className="flex border-b border-gray-200/80 dark:border-zinc-800 px-6 pt-2 shrink-0 gap-6">
          <button
            onClick={() => setActiveTab('instant')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'instant'
                ? 'border-black dark:border-white text-gray-950 dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Instant Voice Clone</span>
          </button>
          <button
            onClick={() => setActiveTab('design')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'design'
                ? 'border-black dark:border-white text-gray-950 dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Voice Design (Generative)</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {activeTab === 'instant' ? (
            <>
              {/* Audio Source Input (Record or Upload) */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Audio Sample (5 - 30 seconds recommended)
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Mic Record Button */}
                  <div className="p-4 rounded-2xl border border-dashed border-gray-300 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/30 flex flex-col items-center justify-center text-center space-y-2">
                    <button
                      type="button"
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-all ${
                        isRecording
                          ? 'bg-red-600 text-white animate-pulse'
                          : 'bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black'
                      }`}
                    >
                      {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
                    </button>
                    <div>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">
                        {isRecording ? `Recording... (${recordingSeconds}s)` : 'Record from Microphone'}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {isRecording ? 'Click square to stop' : 'Read a clear sentence'}
                      </p>
                    </div>
                  </div>

                  {/* File Upload Button */}
                  <label className="p-4 rounded-2xl border border-dashed border-gray-300 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/30 flex flex-col items-center justify-center text-center space-y-2 cursor-pointer hover:bg-gray-100/60 dark:hover:bg-zinc-800/60 transition-colors">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-2xs">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">
                        Upload Audio File
                      </p>
                      <p className="text-[11px] text-gray-400">
                        WAV, MP3, M4A, or WebM
                      </p>
                    </div>
                  </label>
                </div>

                {/* Sample playback preview if recording exists */}
                {recordedAudioUrl && (
                  <div className="p-3 bg-gray-100 dark:bg-zinc-800 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <audio
                        ref={previewAudioRef}
                        src={recordedAudioUrl}
                        onPlay={() => setIsPlayingRecorded(true)}
                        onPause={() => setIsPlayingRecorded(false)}
                        onEnded={() => setIsPlayingRecorded(false)}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (previewAudioRef.current) {
                            if (isPlayingRecorded) {
                              previewAudioRef.current.pause();
                            } else {
                              previewAudioRef.current.play();
                            }
                          }
                        }}
                        className="w-8 h-8 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center"
                      >
                        {isPlayingRecorded ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                      </button>
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                        Recorded Sample Ready
                      </span>
                    </div>
                    <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Captured
                    </span>
                  </div>
                )}
              </div>

              {/* Voice Metadata Fields */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Voice Name *
                  </label>
                  <input
                    type="text"
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value)}
                    placeholder="e.g. Liam - Studio Clone"
                    className="w-full mt-1 p-2.5 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Gender
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as any)}
                      className="w-full mt-1 p-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="neutral">Neutral</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Age
                    </label>
                    <select
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="w-full mt-1 p-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200"
                    >
                      <option value="Young">Young</option>
                      <option value="Middle Aged">Middle Aged</option>
                      <option value="Senior">Senior</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Accent
                    </label>
                    <input
                      type="text"
                      value={accent}
                      onChange={(e) => setAccent(e.target.value)}
                      placeholder="e.g. British, US"
                      className="w-full mt-1 p-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Description &amp; Persona
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Warm, slightly raspy conversational tone for podcasts..."
                    rows={2}
                    className="w-full mt-1 p-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200 resize-none"
                  />
                </div>
              </div>
            </>
          ) : (
            /* Voice Design Tab */
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Voice Name *
                </label>
                <input
                  type="text"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  placeholder="e.g. Captain Blackwood"
                  className="w-full mt-1 p-2.5 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Voice Persona Prompt
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A wise 65-year-old storyteller with a gravelly Scottish accent and slow, deliberate cadence..."
                  rows={3}
                  className="w-full mt-1 p-2.5 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full mt-1 p-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Age
                  </label>
                  <select
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full mt-1 p-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200"
                  >
                    <option value="Young">Young</option>
                    <option value="Middle Aged">Middle Aged</option>
                    <option value="Senior">Senior</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Accent
                  </label>
                  <input
                    type="text"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    placeholder="e.g. Scottish"
                    className="w-full mt-1 p-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200/80 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-xl"
          >
            Cancel
          </button>

          <button
            onClick={activeTab === 'instant' ? handleAnalyzeAndClone : handleCreateDesignedVoice}
            disabled={isAnalyzing || !voiceName.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-100 disabled:opacity-50 transition-all shadow-md"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Extracting Vocal Footprint...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Create &amp; Save Voice</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
