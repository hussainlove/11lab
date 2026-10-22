export type VoiceCategory = 'premade' | 'cloned' | 'designed' | 'offline';

export type OutputFormat = 'mp3_128' | 'mp3_320' | 'wav_24' | 'pcm_16' | 'flac';

export interface AcousticProfile {
  timbre?: string;
  pitch?: string;
  accent?: string;
  age?: string;
  gender?: 'male' | 'female' | 'neutral';
  cadence?: string;
  stylePrompt?: string;
  bestPrebuiltVoice?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  pitchOffset?: number;
  formantShift?: number;
  reverbLevel?: number;
}

export interface Voice {
  id: string;
  name: string;
  category: VoiceCategory;
  avatarUrl: string;
  avatarColor?: string;
  description: string;
  accent: string;
  gender: 'male' | 'female' | 'neutral';
  age: string;
  useCase: string;
  previewText?: string;
  sampleAudioUrl?: string;
  geminiVoiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  isCustom?: boolean;
  acousticProfile?: AcousticProfile;
}

export interface DialogueBlock {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  voiceName: string;
  style?: string;
  audioUrl?: string;
  audioBase64?: string;
  duration?: number;
  isGenerating?: boolean;
  error?: string;
}

export interface AudioSettings {
  stability: number; // 0.0 - 1.0 (Creative -> Robust)
  similarity: number; // 0.0 - 1.0 (Low -> High)
  styleExaggeration: number; // 0.0 - 1.0
  speakerBoost: boolean;
  speed: number; // 0.5 - 2.0
  pitch: number; // -5 to +5
  outputFormat: OutputFormat;
  language: string;
  modelId: string;
  offlineMode: boolean;
}

export interface GenerationHistoryItem {
  id: string;
  timestamp: number;
  text: string;
  voiceId: string;
  voiceName: string;
  avatarUrl: string;
  duration: number;
  audioUrl: string;
  audioBase64?: string;
  format: OutputFormat;
  model: string;
  characterCount: number;
  isOffline: boolean;
  dialogueCount?: number;
}
