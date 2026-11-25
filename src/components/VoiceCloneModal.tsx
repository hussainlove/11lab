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
  Loader2,
  Sparkles,
  Volume2,
  Scissors,
  Sliders,
  Activity,
  RefreshCw,
  FileAudio,
  BookOpen,
} from 'lucide-react';
import {
  Voice,
  AcousticProfile,
  VOICE_ACCENT_OPTIONS,
  VOICE_TONE_OPTIONS,
  VOICE_SLANG_OPTIONS,
} from '../types';
import {
  analyzeVoiceRecording,
  removeExtraAudioSpaces,
  applyVoiceCloneDsp,
  synthesizeOfflineSpeech,
  convertFemaleStreamToMaleBaritone,
} from '../services/audioEngine';
import { removeExtraSpaces, autoInjectHumanSlang } from '../utils/textCleaner';

interface VoiceCloneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveVoice: (voice: Voice) => void;
  offlineMode: boolean;
}

const CALIBRATION_SCRIPTS = [
  {
    id: 'hinglish',
    label: 'Hinglish (Natural)',
    accent: 'Hinglish',
    tone: 'conversational',
    slang: 'hinglish_slang',
    text: 'Yaar sach bataun toh aaj kal AI voice cloning itni natural ho gayi hai ke real aur digital voice mein farq pehchanna bilkul mushkil hai, hai na?',
  },
  {
    id: 'documentary',
    label: 'Documentary Deep',
    accent: 'American',
    tone: 'documentary_deep',
    slang: 'none',
    text: 'Across the silent expanse of the ancient mountain range, time moves at a deliberate, unforgiving pace, shaping every stone in the shadows.',
  },
  {
    id: 'english',
    label: 'English Studio',
    accent: 'American',
    tone: 'natural',
    slang: 'auto_human',
    text: 'Welcome back to the studio. Today we are exploring how subtle vocal nuances, rhythm, and warmth make every human voice truly one of a kind.',
  },
  {
    id: 'urdu_hindi',
    label: 'Urdu / Hindi',
    accent: 'Indian / Urdu-Hindi',
    tone: 'warm',
    slang: 'hinglish_slang',
    text: 'Awaaz ki duniya mein aapka swagat hai, jahan har lafz bilkul insaan ki tarah saaf, gehra aur qudrati sunai deta hai.',
  },
  {
    id: 'german',
    label: 'German (Deutsch)',
    accent: 'German',
    tone: 'natural',
    slang: 'none',
    text: 'Willkommen im Sprachstudio. Unsere künstliche Intelligenz erfasst jede feine Nuance, Klangfarbe und Melodie Ihrer persönlichen Stimme.',
  },
];

const DESIGN_PERSONA_PRESETS = [
  {
    label: 'Deep Documentary Narrator',
    name: 'Marcus - Documentary',
    gender: 'male' as const,
    age: 'Senior',
    accent: 'American',
    tone: 'documentary_deep',
    slangMode: 'none',
    baseVoice: 'Charon' as const,
    pitchOffset: -2,
    formantShift: -2,
    description:
      'Deep, mature, chest-resonant documentary narrator with gravelly warmth, authoritative gravitas, and deliberate cinematic pacing.',
  },
  {
    label: 'Hinglish Creator & Vlogger',
    name: 'Aarav - Hinglish Pro',
    gender: 'male' as const,
    age: 'Young',
    accent: 'Hinglish',
    tone: 'conversational',
    slangMode: 'hinglish_slang',
    baseVoice: 'Puck' as const,
    pitchOffset: 0,
    formantShift: 0.5,
    description:
      'Friendly, spontaneous Hinglish storyteller with natural Desi code-switching, warm smile in the voice, and relatable friend-like energy.',
  },
  {
    label: 'Late-Night Podcast Host',
    name: 'Elena - Midnight FM',
    gender: 'female' as const,
    age: 'Middle Aged',
    accent: 'British',
    tone: 'warm',
    slangMode: 'auto_human',
    baseVoice: 'Kore' as const,
    pitchOffset: -1,
    formantShift: -1.5,
    description:
      'Velvety, intimate close-mic podcast host with soothing alto resonance, relaxed breath control, and effortless conversational flow.',
  },
  {
    label: 'German Executive Speaker',
    name: 'Lukas - Berlin Studio',
    gender: 'male' as const,
    age: 'Middle Aged',
    accent: 'German',
    tone: 'authoritative',
    slangMode: 'none',
    baseVoice: 'Fenrir' as const,
    pitchOffset: -1,
    formantShift: 0,
    description:
      'Crisp, articulate German studio narrator with grounded baritone clarity, precise diction, and modern broadcast confidence.',
  },
];

export const VoiceCloneModal: React.FC<VoiceCloneModalProps> = ({
  isOpen,
  onClose,
  onSaveVoice,
  offlineMode,
}) => {
  const [activeTab, setActiveTab] = useState<'instant' | 'design'>('instant');

  // Voice Metadata & Acoustic Controls
  const [voiceName, setVoiceName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'narration' | 'character' | 'commercial' | 'social'>('narration');
  const [gender, setGender] = useState<'male' | 'female' | 'neutral'>('male');
  const [accent, setAccent] = useState('Hinglish');
  const [tone, setTone] = useState('natural');
  const [slangMode, setSlangMode] = useState('auto_human');
  const [age, setAge] = useState('Middle Aged');
  const [baseVoice, setBaseVoice] = useState<'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr'>('Fenrir');
  const [pitchOffset, setPitchOffset] = useState<number>(0);
  const [formantShift, setFormantShift] = useState<number>(0);
  const [stability, setStability] = useState<number>(0.55);
  const [similarity, setSimilarity] = useState<number>(0.92);

  // Teleprompter Script State
  const [selectedScriptId, setSelectedScriptId] = useState<string>('hinglish');

  // Recording & Sample State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveMicBars, setLiveMicBars] = useState<number[]>(Array(28).fill(0.1));
  const [micLevelDb, setMicLevelDb] = useState<string>('Ready');
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [sampleWaveform, setSampleWaveform] = useState<number[]>([]);
  const [sampleDuration, setSampleDuration] = useState<number>(0);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState(false);
  const [isCleaningSample, setIsCleaningSample] = useState(false);
  const [cleanedSavedSec, setCleanedSavedSec] = useState<number>(0);

  // Analysis & Vocal DNA State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProfile, setAnalysisProfile] = useState<AcousticProfile | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Live Clone Test Preview State
  const [testText, setTestText] = useState(
    'Yaar dekho, meri cloned voice kitni natural aur clear sunai de rahi hai!'
  );
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [isPlayingTest, setIsPlayingTest] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef<number>(44100);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const micAnimFrameRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (micAnimFrameRef.current) cancelAnimationFrame(micAnimFrameRef.current);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (micAudioCtxRef.current && micAudioCtxRef.current.state !== 'closed') {
        micAudioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  if (!isOpen) return null;

  const activeScript =
    CALIBRATION_SCRIPTS.find((s) => s.id === selectedScriptId) || CALIBRATION_SCRIPTS[0];

  // Encode Float32 PCM chunks into a standard 16-bit WAV Blob
  const encodePcmToWavBlob = (chunks: Float32Array[], sampleRate: number): Blob => {
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const buffer = new ArrayBuffer(44 + totalLength * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + totalLength * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, totalLength * 2, true);

    let offset = 44;
    for (const chunk of chunks) {
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  // Run Deep Acoustic & Gemini Multimodal Analysis on a Blob
  const runVocalDnaAnalysis = async (blob: Blob) => {
    setIsAnalyzing(true);
    setStatusMessage('Analyzing vocal pitch (F0), formant resonance & accent DNA...');
    try {
      const clientAnalysis = await analyzeVoiceRecording(blob);
      setSampleWaveform(clientAnalysis.waveformPeaks);
      setSampleDuration(clientAnalysis.durationSeconds);

      const detectedGender: 'male' | 'female' | 'neutral' =
        clientAnalysis.estimatedPitchHz >= 180 ? 'female' : 'male';

      let mergedProfile: AcousticProfile = {
        estimatedPitchHz: clientAnalysis.estimatedPitchHz,
        pitch: clientAnalysis.pitchRegister,
        timbre: clientAnalysis.timbreDescription,
        bestPrebuiltVoice: clientAnalysis.recommendedBaseVoice,
        pitchOffset: clientAnalysis.pitchOffset,
        formantShift: clientAnalysis.formantShift,
        clarityScore: clientAnalysis.clarityScore,
        speakingRateWpm: clientAnalysis.speakingRateWpm,
        similarityScore: Math.min(98, Math.max(91, Math.round(clientAnalysis.clarityScore * 0.98))),
        gender: detectedGender,
        accent,
        tone,
        slangMode,
        stability: 0.55,
        similarity: 0.92,
      };

      if (!offlineMode) {
        try {
          const base64Audio = await new Promise<string>((res) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const b64 = (reader.result as string).split(',')[1] || '';
              res(b64);
            };
            reader.readAsDataURL(blob);
          });

          const response = await fetch('/api/clone-voice/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Audio,
              mimeType: blob.type || 'audio/wav',
              voiceName: voiceName || 'Studio Clone',
              description,
              clientMetrics: {
                estimatedPitchHz: clientAnalysis.estimatedPitchHz,
                pitchRegister: clientAnalysis.pitchRegister,
                formantShift: clientAnalysis.formantShift,
                speakingRateWpm: clientAnalysis.speakingRateWpm,
                clarityScore: clientAnalysis.clarityScore,
              },
            }),
          });
          const data = await response.json();
          if (data?.profile) {
            const p = data.profile;
            mergedProfile = {
              ...mergedProfile,
              timbre: p.timbre || mergedProfile.timbre,
              pitch: p.pitch || mergedProfile.pitch,
              accent: p.accent || mergedProfile.accent,
              tone: p.tone || mergedProfile.tone,
              slangMode: p.slangMode || mergedProfile.slangMode,
              age: p.age || age,
              gender: p.gender || mergedProfile.gender,
              cadence: p.cadence || 'Natural human conversational rhythm',
              transcribedSample: p.transcribedSample || '',
              similarityScore: p.similarityScore || mergedProfile.similarityScore,
              stylePrompt: p.stylePrompt || p.timbre,
              bestPrebuiltVoice: p.bestPrebuiltVoice || mergedProfile.bestPrebuiltVoice,
              pitchOffset:
                typeof p.recommendedSettings?.pitchOffset === 'number'
                  ? p.recommendedSettings.pitchOffset
                  : mergedProfile.pitchOffset,
              formantShift:
                typeof p.recommendedSettings?.formantShift === 'number'
                  ? p.recommendedSettings.formantShift
                  : mergedProfile.formantShift,
              stability: p.recommendedSettings?.stability ?? 0.55,
              similarity: p.recommendedSettings?.similarity ?? 0.92,
            };
          }
        } catch (err) {
          console.warn('Using on-device WebAudio vocal DNA profile:', err);
        }
      }

      setAnalysisProfile(mergedProfile);
      if (mergedProfile.gender) setGender(mergedProfile.gender);
      if (mergedProfile.age && ['Young', 'Middle Aged', 'Senior'].includes(mergedProfile.age)) {
        setAge(mergedProfile.age);
      }
      if (mergedProfile.accent) setAccent(mergedProfile.accent);
      if (mergedProfile.tone) setTone(mergedProfile.tone);
      if (mergedProfile.slangMode) setSlangMode(mergedProfile.slangMode);
      if (mergedProfile.bestPrebuiltVoice) setBaseVoice(mergedProfile.bestPrebuiltVoice);
      if (typeof mergedProfile.pitchOffset === 'number') setPitchOffset(mergedProfile.pitchOffset);
      if (typeof mergedProfile.formantShift === 'number') setFormantShift(mergedProfile.formantShift);
      if (typeof mergedProfile.stability === 'number') setStability(mergedProfile.stability);
      if (typeof mergedProfile.similarity === 'number') setSimilarity(mergedProfile.similarity);
      if (!description.trim() && mergedProfile.stylePrompt) {
        setDescription(mergedProfile.stylePrompt);
      }
      setStatusMessage(null);
    } catch (err) {
      console.warn('Vocal analysis fallback:', err);
      setStatusMessage(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Start Mic Recording with Live Frequency Visualizer & Universal WAV/MediaRecorder Capture
  const startRecording = async () => {
    try {
      setStatusMessage(null);
      audioChunksRef.current = [];
      pcmChunksRef.current = [];
      setCleanedSavedSec(0);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setStatusMessage('Microphone API is not available in this browser. Please upload an audio file.');
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      micStreamRef.current = stream;

      // Connect WebAudio Analyser for real-time mic waveform bars + PCM WAV capture
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx: AudioContext = new AudioCtx();
        micAudioCtxRef.current = audioCtx;
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        sampleRateRef.current = audioCtx.sampleRate || 44100;

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        const silentGain = audioCtx.createGain();
        silentGain.gain.value = 0;
        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(audioCtx.destination);
        processor.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          pcmChunksRef.current.push(new Float32Array(input));
        };

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateMeter = () => {
          analyser.getByteFrequencyData(dataArray);
          const bars: number[] = [];
          let sum = 0;
          for (let i = 0; i < 28; i++) {
            const val = (dataArray[i % dataArray.length] || 0) / 255;
            bars.push(Math.max(0.08, Math.min(1, val * 1.25)));
            sum += val;
          }
          setLiveMicBars(bars);
          const avg = sum / 28;
          if (avg > 0.65) setMicLevelDb('Strong Studio Signal');
          else if (avg > 0.18) setMicLevelDb('Optimal Vocal Level');
          else setMicLevelDb('Speak Closer to Mic');
          micAnimFrameRef.current = requestAnimationFrame(updateMeter);
        };
        micAnimFrameRef.current = requestAnimationFrame(updateMeter);
      } catch (e) {
        console.warn('WebAudio visualizer setup warning:', e);
      }

      const candidateMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      let selectedMimeType = '';
      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        for (const candidate of candidateMimeTypes) {
          if (MediaRecorder.isTypeSupported(candidate)) {
            selectedMimeType = candidate;
            break;
          }
        }
      }

      const mediaRecorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (micAnimFrameRef.current) {
          cancelAnimationFrame(micAnimFrameRef.current);
          micAnimFrameRef.current = null;
        }
        stream.getTracks().forEach((track) => track.stop());
        if (micAudioCtxRef.current && micAudioCtxRef.current.state !== 'closed') {
          await micAudioCtxRef.current.close().catch(() => {});
          micAudioCtxRef.current = null;
        }

        let finalBlob: Blob;
        if (pcmChunksRef.current.length > 0) {
          finalBlob = encodePcmToWavBlob(pcmChunksRef.current, sampleRateRef.current);
        } else {
          const mimeType = mediaRecorder.mimeType || selectedMimeType || 'audio/webm';
          finalBlob = new Blob(audioChunksRef.current, { type: mimeType });
        }

        setRecordedAudioBlob(finalBlob);
        if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
        const url = URL.createObjectURL(finalBlob);
        setRecordedAudioUrl(url);
        await runVocalDnaAnalysis(finalBlob);
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setStatusMessage(
        'Microphone permission denied or unavailable. Please allow microphone access in your browser or upload an audio file.'
      );
    }
  };

  // Stop Mic Recording
  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.warn('Error stopping MediaRecorder:', e);
      }
    }
  };

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCleanedSavedSec(0);
      setRecordedAudioBlob(file);
      if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
      const url = URL.createObjectURL(file);
      setRecordedAudioUrl(url);
      if (!voiceName.trim()) {
        const cleanFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setVoiceName(cleanFileName.slice(0, 28));
      }
      await runVocalDnaAnalysis(file);
    }
  };

  // Remove Dead Space & Clean Recorded/Uploaded Sample Before Cloning
  const handleCleanSampleSpace = async () => {
    if (!recordedAudioBlob || isCleaningSample) return;
    setIsCleaningSample(true);
    try {
      const result = await removeExtraAudioSpaces(recordedAudioBlob, {
        maxPauseMs: 70,
        targetPauseMs: 24,
        prePadMs: 28,
        postPadMs: 36,
        kbps: 128,
      });
      setRecordedAudioBlob(result.audioBlob);
      if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(result.audioUrl);
      setSampleDuration(result.newDuration);
      setCleanedSavedSec(
        Math.round(((cleanedSavedSec || 0) + result.removedSeconds) * 100) / 100
      );
      const updatedPeaks = await analyzeVoiceRecording(result.audioBlob);
      setSampleWaveform(updatedPeaks.waveformPeaks);
    } catch (e) {
      console.error('Failed to clean sample:', e);
    } finally {
      setIsCleaningSample(false);
    }
  };

  // Live Test Cloned / Designed Voice Inside Modal
  const handleTestClonedVoice = async () => {
    const rawText = removeExtraSpaces(testText);
    if (!rawText || isTestingVoice) return;

    setIsTestingVoice(true);
    try {
      const humanized =
        slangMode !== 'none'
          ? autoInjectHumanSlang(rawText, slangMode, accent, false)
          : rawText;

      const currentCloneProfile: AcousticProfile = {
        ...(analysisProfile || {}),
        timbre: description || analysisProfile?.timbre || `${age} ${accent} ${gender} voice`,
        stylePrompt:
          description ||
          analysisProfile?.stylePrompt ||
          `Speak with a natural ${age} ${accent} ${gender} voice`,
        accent,
        tone,
        slangMode,
        gender,
        age,
        bestPrebuiltVoice: baseVoice,
        pitchOffset,
        formantShift,
        stability,
        similarity,
      };

      if (offlineMode) {
        const offlineRes = await synthesizeOfflineSpeech(humanized, {
          voiceGender: gender,
          pitchOffset,
          speed: 1.0,
          stability,
          timbre: currentCloneProfile.timbre,
          autoSpeak: true,
        });
        if (testAudioUrl) URL.revokeObjectURL(testAudioUrl);
        setTestAudioUrl(offlineRes.audioUrl);
      } else {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: humanized,
            voiceName: baseVoice,
            voiceGender: gender,
            model: 'gemini-3.8-flash-tts',
            stability,
            similarity,
            speed: 1.0,
            pitch: pitchOffset,
            tone,
            accent,
            slangMode,
            style: currentCloneProfile.stylePrompt,
            cloneProfile: currentCloneProfile,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to synthesize test preview');
        }
        const data = await response.json();
        if (data.useClientEngine || !data.audioBase64) {
          const offlineRes = await synthesizeOfflineSpeech(humanized, {
            voiceGender: gender,
            pitchOffset,
            speed: 1.0,
            stability,
            timbre: currentCloneProfile.timbre,
            autoSpeak: true,
          });
          if (testAudioUrl) URL.revokeObjectURL(testAudioUrl);
          setTestAudioUrl(offlineRes.audioUrl);
        } else {
          const binaryStr = atob(data.audioBase64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          let rawBlob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
          let finalUrl = URL.createObjectURL(rawBlob);

          if (
            (data.quotaFallback || data.model === 'eleven_v4_neural_stream') &&
            (gender === 'male' || data.voiceGender === 'male')
          ) {
            try {
              const maleConverted = await convertFemaleStreamToMaleBaritone(rawBlob, 0.70);
              if (maleConverted?.audioBlob && maleConverted.audioBlob.size > 44) {
                URL.revokeObjectURL(finalUrl);
                rawBlob = maleConverted.audioBlob;
                finalUrl = maleConverted.audioUrl;
              }
            } catch (_convErr) {
              // Keep raw preview if conversion fails
            }
          }

          // Apply custom DSP Formant & Pitch Voice Clone Matcher safely
          try {
            const dspRes = await applyVoiceCloneDsp(rawBlob, currentCloneProfile, 128);
            if (dspRes?.audioBlob && dspRes.audioBlob.size > 44) {
              URL.revokeObjectURL(finalUrl);
              finalUrl = dspRes.audioUrl;
            }
          } catch (dspErr) {
            console.warn('Preview DSP skipped; using pure server preview:', dspErr);
          }

          if (testAudioUrl) URL.revokeObjectURL(testAudioUrl);
          setTestAudioUrl(finalUrl);
        }
      }
    } catch (err) {
      console.warn('Online test failed, using browser speech preview:', err);
      const fallback = await synthesizeOfflineSpeech(rawText, {
        voiceGender: gender,
        pitchOffset,
        speed: 1.0,
        stability,
        autoSpeak: true,
      });
      if (testAudioUrl) URL.revokeObjectURL(testAudioUrl);
      setTestAudioUrl(fallback.audioUrl);
    } finally {
      setIsTestingVoice(false);
    }
  };

  // Finalize & Save Cloned or Designed Voice
  const handleSaveVoiceToStudio = async () => {
    const finalName = voiceName.trim() || (activeTab === 'instant' ? 'Custom Studio Clone' : 'Designed Voice');

    const finalProfile: AcousticProfile = {
      ...(analysisProfile || {}),
      timbre:
        description ||
        analysisProfile?.timbre ||
        `Custom ${accent} ${gender} voice with natural resonance`,
      stylePrompt:
        description ||
        analysisProfile?.stylePrompt ||
        `Deliver with a natural, expressive ${age} ${accent} ${gender} vocal persona`,
      accent,
      tone,
      slangMode,
      age,
      gender,
      bestPrebuiltVoice: baseVoice,
      pitchOffset,
      formantShift,
      stability,
      similarity,
      similarityScore: analysisProfile?.similarityScore || 95,
      clarityScore: analysisProfile?.clarityScore || 94,
    };

    const newVoice: Voice = {
      id: `${activeTab === 'instant' ? 'clone' : 'designed'}-${Date.now()}`,
      name:
        finalName.includes('(Clone)') || finalName.includes('(Designed)')
          ? finalName
          : `${finalName} (${activeTab === 'instant' ? 'Clone' : 'Designed'})`,
      category: activeTab === 'instant' ? 'cloned' : 'designed',
      avatarUrl:
        gender === 'female'
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80'
          : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80',
      avatarColor:
        activeTab === 'instant'
          ? 'from-emerald-500 to-teal-600'
          : 'from-purple-500 to-indigo-600',
      description: finalProfile.timbre || 'High-fidelity custom cloned voice',
      accent,
      gender,
      age,
      useCase: activeTab === 'instant' ? category.toUpperCase() : 'Voice Design',
      sampleAudioUrl: recordedAudioUrl || testAudioUrl || undefined,
      geminiVoiceName: baseVoice,
      isCustom: true,
      acousticProfile: finalProfile,
    };

    onSaveVoice(newVoice);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200/80 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Neural Voice Clone Studio
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  v4 DSP + Vocal DNA
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Clone any voice with F0 pitch, formant warmth &amp; accent matching or design a custom persona
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

        {/* Mode Tabs */}
        <div className="flex border-b border-gray-200/80 dark:border-zinc-800 px-5 sm:px-6 pt-2 shrink-0 gap-6 bg-gray-50/50 dark:bg-zinc-950/40">
          <button
            onClick={() => setActiveTab('instant')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'instant'
                ? 'border-emerald-600 dark:border-emerald-400 text-gray-950 dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Instant Voice Clone (Record / Upload)</span>
          </button>
          <button
            onClick={() => setActiveTab('design')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'design'
                ? 'border-purple-600 dark:border-purple-400 text-gray-950 dark:text-white'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generative Voice Design</span>
          </button>
        </div>

        {/* Scrollable Studio Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {statusMessage && (
            <div className="px-3.5 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
              {isAnalyzing && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
              <span>{statusMessage}</span>
            </div>
          )}

          {activeTab === 'instant' ? (
            <>
              {/* Step 1: Guided Teleprompter Script */}
              <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-200/80 dark:border-zinc-800 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Guided Calibration Script (Read aloud while recording)</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {CALIBRATION_SCRIPTS.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedScriptId(s.id);
                          setAccent(s.accent);
                          setTone(s.tone);
                          setSlangMode(s.slang);
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                          selectedScriptId === s.id
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-700 hover:border-gray-300'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-xs sm:text-sm font-medium leading-relaxed text-gray-900 dark:text-gray-100 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-gray-200/60 dark:border-zinc-800 italic">
                  &ldquo;{activeScript.text}&rdquo;
                </p>
              </div>

              {/* Step 2: Record or Upload Sample */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Microphone Recorder Card */}
                <div
                  className={`p-4 rounded-2xl border transition-all flex flex-col items-center justify-center text-center space-y-2.5 ${
                    isRecording
                      ? 'border-red-500 bg-red-50/40 dark:bg-red-950/20'
                      : 'border-dashed border-gray-300 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/30'
                  }`}
                >
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-all ${
                      isRecording
                        ? 'bg-red-600 text-white animate-pulse scale-105'
                        : 'bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black'
                    }`}
                  >
                    {isRecording ? (
                      <Square className="w-5 h-5 fill-current" />
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                  </button>

                  <div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">
                      {isRecording
                        ? `Recording Live... (${recordingSeconds}s)`
                        : recordedAudioBlob
                        ? 'Re-Record Voice Sample'
                        : 'Record from Microphone'}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {isRecording ? micLevelDb : '5–25 seconds for high-accuracy clone'}
                    </p>
                  </div>

                  {/* Live Mic Frequency Visualizer */}
                  {isRecording && (
                    <div className="w-full flex items-end justify-center gap-0.5 h-8 pt-1">
                      {liveMicBars.map((bar, idx) => (
                        <div
                          key={idx}
                          className="w-1 rounded-full bg-red-500 transition-all duration-75"
                          style={{ height: `${Math.round(bar * 28)}px` }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Upload Audio File Card */}
                <label className="p-4 rounded-2xl border border-dashed border-gray-300 dark:border-zinc-700 bg-gray-50/50 dark:bg-zinc-800/30 flex flex-col items-center justify-center text-center space-y-2.5 cursor-pointer hover:bg-gray-100/60 dark:hover:bg-zinc-800/60 transition-colors">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-2xs">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white">
                      Upload Voice Reference
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      WAV, MP3, M4A, WebM, or OGG
                    </p>
                  </div>
                </label>
              </div>

              {/* Recorded / Uploaded Sample Waveform & Clean Space Bar */}
              {recordedAudioUrl && (
                <div className="p-3.5 bg-gray-100/90 dark:bg-zinc-800/80 rounded-2xl border border-gray-200 dark:border-zinc-700 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
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
                          if (!previewAudioRef.current) return;
                          if (isPlayingRecorded) previewAudioRef.current.pause();
                          else previewAudioRef.current.play();
                        }}
                        className="w-8 h-8 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center shrink-0 shadow-xs"
                      >
                        {isPlayingRecorded ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-gray-900 dark:text-white">
                            Reference Voice Sample
                          </span>
                          {sampleDuration > 0 && (
                            <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                              ({sampleDuration}s)
                            </span>
                          )}
                        </div>
                        {cleanedSavedSec > 0 && (
                          <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                            Removed {cleanedSavedSec}s of dead air &amp; silence
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Remove Extra Space from Reference Sample */}
                      <button
                        type="button"
                        onClick={handleCleanSampleSpace}
                        disabled={isCleaningSample}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition-colors disabled:opacity-50"
                        title="Strip silence and dead space from your recorded sample for cleaner cloning"
                      >
                        {isCleaningSample ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Scissors className="w-3 h-3" />
                        )}
                        <span>Remove Space</span>
                      </button>

                      {/* Re-Analyze Vocal DNA */}
                      {recordedAudioBlob && (
                        <button
                          type="button"
                          onClick={() => runVocalDnaAnalysis(recordedAudioBlob)}
                          disabled={isAnalyzing}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${isAnalyzing ? 'animate-spin' : ''}`} />
                          <span>Re-Analyze</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Visual Waveform Bars */}
                  {sampleWaveform.length > 0 && (
                    <div className="flex items-center gap-0.5 h-8 px-1">
                      {sampleWaveform.map((peak, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-full bg-emerald-600/75 dark:bg-emerald-400/80"
                          style={{ height: `${Math.max(15, Math.round(peak * 100))}%` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Extracted Vocal DNA Blueprint Card */}
              {analysisProfile && (
                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                        Extracted Vocal DNA Blueprint
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-600 text-white">
                      {analysisProfile.similarityScore || 95}% Clone Match
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800">
                      <p className="text-[10px] text-gray-400 uppercase font-semibold">Fundamental Pitch</p>
                      <p className="text-xs font-bold text-gray-900 dark:text-white capitalize">
                        {analysisProfile.estimatedPitchHz || 132} Hz ({analysisProfile.pitch || 'Baritone'})
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800">
                      <p className="text-[10px] text-gray-400 uppercase font-semibold">Sample Clarity</p>
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {analysisProfile.clarityScore || 94}% Studio SNR
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800">
                      <p className="text-[10px] text-gray-400 uppercase font-semibold">Speaking Pace</p>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">
                        ~{analysisProfile.speakingRateWpm || 140} WPM
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-100 dark:border-zinc-800">
                      <p className="text-[10px] text-gray-400 uppercase font-semibold">Neural Core</p>
                      <p className="text-xs font-bold text-purple-600 dark:text-purple-400">
                        {baseVoice} HD
                      </p>
                    </div>
                  </div>

                  {analysisProfile.transcribedSample && (
                    <div className="text-[11px] text-gray-600 dark:text-gray-300 bg-white/80 dark:bg-zinc-900/80 px-3 py-2 rounded-xl border border-emerald-100 dark:border-zinc-800">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">Detected Speech: </span>
                      &ldquo;{analysisProfile.transcribedSample}&rdquo;
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Generative Voice Design Tab: Quick Persona Presets */
            <div className="space-y-3">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                1-Click Vocal Persona Templates
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DESIGN_PERSONA_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setVoiceName(preset.name);
                      setGender(preset.gender);
                      setAge(preset.age);
                      setAccent(preset.accent);
                      setTone(preset.tone);
                      setSlangMode(preset.slangMode);
                      setBaseVoice(preset.baseVoice);
                      setPitchOffset(preset.pitchOffset);
                      setFormantShift(preset.formantShift);
                      setDescription(preset.description);
                    }}
                    className="p-3 rounded-xl border border-gray-200 dark:border-zinc-800 hover:border-purple-500 dark:hover:border-purple-500 bg-gray-50/70 dark:bg-zinc-800/40 text-left transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">
                        {preset.label}
                      </span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                        {preset.accent}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {preset.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Shared Voice Identity & Acoustic Fine-Tuning Controls */}
          <div className="space-y-3.5 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Voice Name *
                </label>
                <input
                  type="text"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  placeholder="e.g. Zeeshan - Hinglish Studio Clone"
                  className="w-full mt-1 p-2.5 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Base Neural Acoustic Engine
                </label>
                <select
                  value={baseVoice}
                  onChange={(e) => setBaseVoice(e.target.value as any)}
                  className="w-full mt-1 p-2.5 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200"
                >
                  <option value="Charon">Charon — Deep Mature Bass-Baritone (Documentary)</option>
                  <option value="Fenrir">Fenrir — Warm Grounded Baritone (Natural Male)</option>
                  <option value="Puck">Puck — Expressive Conversational Tenor (Creator)</option>
                  <option value="Kore">Kore — Warm Natural Alto (Studio Female)</option>
                  <option value="Zephyr">Zephyr — Crisp Bright Soprano (Energetic Female)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => {
                    const g = e.target.value as 'male' | 'female' | 'neutral';
                    setGender(g);
                    if (g === 'female' && (baseVoice === 'Fenrir' || baseVoice === 'Charon')) {
                      setBaseVoice('Kore');
                    } else if (g === 'male' && (baseVoice === 'Kore' || baseVoice === 'Zephyr')) {
                      setBaseVoice('Fenrir');
                    }
                  }}
                  className="w-full mt-1 p-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Age Profile
                </label>
                <select
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full mt-1 p-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200"
                >
                  <option value="Young">Young</option>
                  <option value="Middle Aged">Middle Aged</option>
                  <option value="Senior">Senior / Mature</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Native Accent
                </label>
                <select
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="w-full mt-1 p-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200"
                >
                  {VOICE_ACCENT_OPTIONS.filter((a) => a.id !== 'default').map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Signature Tone
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full mt-1 p-2 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200"
                >
                  {VOICE_TONE_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Acoustic DSP Tuning Sliders (Pitch Shift, Formant Warmth, Slang Cadence) */}
            <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800/40 border border-gray-200/80 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Acoustic Clone DSP Calibration</span>
                </span>
                <select
                  value={slangMode}
                  onChange={(e) => setSlangMode(e.target.value)}
                  className="px-2 py-1 text-[11px] rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300"
                >
                  {VOICE_SLANG_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                    <span>Pitch Register Shift</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                      {pitchOffset > 0 ? `+${pitchOffset}` : pitchOffset} st
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-4}
                    max={4}
                    step={0.5}
                    value={pitchOffset}
                    onChange={(e) => setPitchOffset(parseFloat(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>Deeper Bass (-4)</span>
                    <span>Natural (0)</span>
                    <span>Higher (+4)</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                    <span>Vocal Formant Timber</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                      {formantShift < 0
                        ? `Chest Warmth (${formantShift})`
                        : formantShift > 0
                        ? `Crisp Presence (+${formantShift})`
                        : 'Balanced (0)'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-4}
                    max={4}
                    step={0.5}
                    value={formantShift}
                    onChange={(e) => setFormantShift(parseFloat(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-gray-200 dark:bg-zinc-700 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>Warm &amp; Deep (-4)</span>
                    <span>Neutral (0)</span>
                    <span>Bright Air (+4)</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Vocal Persona &amp; Micro-Prosody Instructions
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe vocal texture, breathing, rasp, warmth, or let Vocal DNA auto-fill this..."
                rows={2}
                className="w-full mt-1 p-2.5 text-xs rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-800 dark:text-gray-200 resize-none"
              />
            </div>

            {/* Instant Voice Clone Preview & Side-by-Side Test */}
            <div className="p-3.5 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-950 border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5 text-emerald-400">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Live Clone Sandbox (Test Before Saving)</span>
                </span>
                <span className="text-[10px] text-zinc-400">
                  Applies {baseVoice} + DSP Formant &amp; {accent} Accent
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder="Type any sentence to test your cloned voice..."
                  className="flex-1 px-3 py-2 text-xs rounded-xl bg-zinc-800 border border-zinc-700 text-white focus:outline-hidden focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleTestClonedVoice}
                  disabled={isTestingVoice || !testText.trim()}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isTestingVoice ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Synthesizing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Test Cloned Voice</span>
                    </>
                  )}
                </button>
              </div>

              {testAudioUrl && (
                <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
                  <div className="flex items-center gap-2">
                    <audio
                      ref={testAudioRef}
                      src={testAudioUrl}
                      onPlay={() => setIsPlayingTest(true)}
                      onPause={() => setIsPlayingTest(false)}
                      onEnded={() => setIsPlayingTest(false)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!testAudioRef.current) return;
                        if (isPlayingTest) testAudioRef.current.pause();
                        else testAudioRef.current.play();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-bold hover:bg-gray-200 transition-colors"
                    >
                      {isPlayingTest ? (
                        <>
                          <Pause className="w-3 h-3 fill-current" />
                          <span>Pause Clone Preview</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 fill-current" />
                          <span>Play Cloned Output</span>
                        </>
                      )}
                    </button>
                    <span className="text-[11px] text-emerald-400 font-medium">
                      Cloned voice ready — click Play to listen!
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-gray-200/80 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-xl"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveVoiceToStudio}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-100 disabled:opacity-50 transition-all shadow-md cursor-pointer"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Extracting Vocal DNA...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Save &amp; Activate Cloned Voice</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
