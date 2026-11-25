export type VoiceCategory = 'premade' | 'cloned' | 'designed' | 'offline';

export type OutputFormat = 'mp3_128' | 'mp3_320' | 'wav_24' | 'pcm_16' | 'flac';

export type BackgroundMusicMood =
  | 'auto'
  | 'none'
  | 'psychology'
  | 'motivational'
  | 'horror'
  | 'emotional'
  | 'suspense'
  | 'calm'
  | 'epic'
  | 'lofi';

export interface AcousticProfile {
  timbre?: string;
  pitch?: string;
  estimatedPitchHz?: number;
  accent?: string;
  tone?: string;
  slangMode?: string;
  age?: string;
  gender?: 'male' | 'female' | 'neutral';
  cadence?: string;
  stylePrompt?: string;
  bestPrebuiltVoice?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  pitchOffset?: number;
  formantShift?: number;
  reverbLevel?: number;
  stability?: number;
  similarity?: number;
  speed?: number;
  clarityScore?: number;
  similarityScore?: number;
  speakingRateWpm?: number;
  transcribedSample?: string;
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
  tone?: string;
  accent?: string;
  slangMode?: string;
  bgMusicMood?: BackgroundMusicMood;
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
  tone: string;
  accent: string;
  slangMode: string;
  autoHumanizeSlang: boolean;
  bgMusicMood: BackgroundMusicMood;
  bgMusicVolume: number; // 0.05 - 0.45 (default 0.18 subtle "dheema" impactful mix)
  voiceBgmMap?: Record<string, BackgroundMusicMood>; // Per-voice BGM ON/OFF & mood preference
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
  isSpaceRemoved?: boolean;
  removedSpaceSeconds?: number;
  bgMusicMood?: string;
  spokenText?: string;
}

export const BACKGROUND_MUSIC_OPTIONS: {
  id: BackgroundMusicMood;
  label: string;
  shortLabel: string;
  desc: string;
}[] = [
  {
    id: 'none',
    label: 'No Background Music (BGM OFF — Voice Only)',
    shortLabel: 'BGM Off',
    desc: 'Pure studio voiceover without any background music for this voice',
  },
  {
    id: 'auto',
    label: 'Auto-Match Voice & Script (Smart BGM ON)',
    shortLabel: 'Auto Match',
    desc: 'Automatically generates psychology, horror, motivational, emotional, or suspense music based on voice & script',
  },
  {
    id: 'psychology',
    label: 'Psychology & Mind (Deep Cerebral Pulse)',
    shortLabel: 'Psychology',
    desc: 'Hypnotic analytical sub-pulse, warm cerebral chords & subtle synapse plucks for human mind & psychology',
  },
  {
    id: 'motivational',
    label: 'Motivational & Inspiring (Dheema Impact)',
    shortLabel: 'Motivational',
    desc: 'Warm cinematic pads, subtle heartbeat pulse & uplifting chords for motivational speeches',
  },
  {
    id: 'horror',
    label: 'Horror & Dark Eerie (Khaufnak / Thriller)',
    shortLabel: 'Horror & Eerie',
    desc: 'Unsettling dark drone, ghostly harmonics & eerie tension swells for horror stories',
  },
  {
    id: 'emotional',
    label: 'Emotional & Heartfelt (Sad / Kahani)',
    shortLabel: 'Emotional',
    desc: 'Soft melancholic minor chords & gentle felt-piano resonance for deep emotional stories',
  },
  {
    id: 'suspense',
    label: 'Mystery & Documentary (Deep Suspense)',
    shortLabel: 'Mystery / Doc',
    desc: 'Deep investigative pulse & dark cinematic atmosphere for documentaries and crime stories',
  },
  {
    id: 'calm',
    label: 'Calm & Peaceful (Sukoon / Meditation)',
    shortLabel: 'Calm & Soft',
    desc: 'Serene warm ambient pads for peaceful narration, audiobooks, and relaxation',
  },
  {
    id: 'epic',
    label: 'Epic Cinematic & Heroic (Grand Swell)',
    shortLabel: 'Epic Cinematic',
    desc: 'Deep powerful fifths swell & resonant sub-bass for dramatic trailers and history',
  },
  {
    id: 'lofi',
    label: 'Cozy Podcast & Conversational (Soft Lo-Fi)',
    shortLabel: 'Podcast Lo-Fi',
    desc: 'Warm subtle Rhodes-style chords for casual vlogs, podcasts, and friendly chats',
  },
];

export const VOICE_SLANG_OPTIONS = [
  {
    id: 'auto_human',
    label: 'Auto Human Slang (Natural)',
    prompt: 'Deliver with ultra-natural human conversational flow, subtle real-life micro-pauses, natural contractions, and authentic unscripted human warmth',
  },
  {
    id: 'hinglish_slang',
    label: 'Hinglish / Desi Slang (Yaar, Matlab)',
    prompt: 'Deliver with authentic Hinglish / South Asian casual slang cadence (like a real friend saying yaar, matlab, dekho, hai na) with natural bilingual rhythm',
  },
  {
    id: 'casual_english',
    label: 'Casual English Slang (You know, I mean)',
    prompt: 'Deliver with relaxed native English conversational slang cadence, casual contractions (gonna, wanna, kinda), and spontaneous podcast-style realism',
  },
  {
    id: 'genz_creator',
    label: 'Gen-Z / Creator Slang (Lowkey, Real talk)',
    prompt: 'Deliver with modern Gen-Z creator energy, expressive conversational emphasis, and relatable social-media cadence',
  },
  {
    id: 'none',
    label: 'No Slang (Strict Script)',
    prompt: 'Deliver the exact script cleanly without informal slang inflections',
  },
];

export const HUMAN_SLANG_PHRASES = [
  { phrase: 'you know,', category: 'English Casual', desc: 'Natural conversational bridge' },
  { phrase: 'I mean,', category: 'English Casual', desc: 'Human thought starter' },
  { phrase: 'honestly,', category: 'English Casual', desc: 'Authentic candid emphasis' },
  { phrase: 'like,', category: 'English Casual', desc: 'Casual spoken filler' },
  { phrase: "let's be real,", category: 'Creator Slang', desc: 'Direct relatable hook' },
  { phrase: 'lowkey', category: 'Creator Slang', desc: 'Subtle modern slang' },
  { phrase: 'right?', category: 'English Casual', desc: 'Conversational check-in' },
  { phrase: 'yaar,', category: 'Hinglish Slang', desc: 'Friendly Desi address' },
  { phrase: 'matlab,', category: 'Hinglish Slang', desc: 'Hinglish "I mean" filler' },
  { phrase: 'sach bataun toh,', category: 'Hinglish Slang', desc: '"To be honest" in Hinglish' },
  { phrase: 'dekho yaar,', category: 'Hinglish Slang', desc: '"Look my friend" starter' },
  { phrase: 'hai na?', category: 'Hinglish Slang', desc: 'Natural Hinglish tag question' },
  { phrase: 'bhai,', category: 'Hinglish Slang', desc: 'Casual bro/friend slang' },
  { phrase: 'bilkul', category: 'Hinglish Slang', desc: 'Natural agreement ("totally")' },
];

export const VOICE_TONE_OPTIONS = [
  { id: 'natural', label: 'Natural & Balanced', prompt: 'Natural, balanced, and authentic studio delivery' },
  {
    id: 'psychology',
    label: 'Psychology & Human Mind (Deep Analytical)',
    prompt:
      'Deep, hypnotic, analytical psychology narrator tone—measured, insightful, calm yet intriguing, with thoughtful micro-pauses, intimate chest warmth, and compelling cognitive authority',
  },
  { id: 'motivational', label: 'Motivational & Inspiring', prompt: 'Passionate, uplifting, and inspiring keynote speaker tone' },
  { id: 'horror', label: 'Horror & Eerie Suspense', prompt: 'Dark, chilling, suspenseful horror storyteller tone with eerie tension and haunting atmosphere' },
  { id: 'documentary_deep', label: 'Deep, Mature, Documentary-Style', prompt: 'Deep, mature, resonant documentary-style narration with authoritative gravitas and measured pacing' },
  { id: 'energetic', label: 'Energetic & Upbeat', prompt: 'High-energy, enthusiastic, vibrant, and upbeat delivery' },
  { id: 'calm', label: 'Calm & Soothing', prompt: 'Calm, soothing, relaxed, peaceful, and gentle delivery' },
  { id: 'conversational', label: 'Conversational & Casual', prompt: 'Warm, laid-back, natural conversational tone' },
  { id: 'authoritative', label: 'Authoritative & Confident', prompt: 'Commanding, authoritative, executive, and confident tone' },
  { id: 'dramatic', label: 'Dramatic & Cinematic', prompt: 'Dramatic, intense, theatrical movie-trailer emotion' },
  { id: 'warm', label: 'Warm & Empathetic', prompt: 'Warm, empathetic, comforting, and friendly tone' },
  { id: 'whispery', label: 'Whispery & Intimate (ASMR)', prompt: 'Soft whispery, close-mic intimate ASMR delivery' },
  { id: 'cheerful', label: 'Cheerful & Playful', prompt: 'Joyful, smiling, playful, and animated tone' },
  { id: 'serious', label: 'Serious & News Anchor', prompt: 'Crisp, serious, objective broadcast journalism delivery' },
  { id: 'storytelling', label: 'Expressive Storyteller', prompt: 'Engaging, paced narrative audiobook storytelling tone' },
];

export const VOICE_ACCENT_OPTIONS = [
  { id: 'default', label: 'Default (Speaker Native)' },
  { id: 'Pakistani', label: 'Pakistani (Urdu / Pakistani English)' },
  { id: 'Indian', label: 'Indian (Hindi / Indian English)' },
  { id: 'Indian / Urdu-Hindi', label: 'Indian & Pakistani (Urdu-Hindi)' },
  { id: 'Hinglish', label: 'Hinglish (Urdu/Hindi + English)' },
  { id: 'American', label: 'American (US General)' },
  { id: 'American Southern', label: 'American Southern / Texan' },
  { id: 'New York', label: 'American (New York / Brooklyn)' },
  { id: 'Canadian', label: 'Canadian English' },
  { id: 'British', label: 'British (UK / Received Pronunciation)' },
  { id: 'British-Essex', label: 'British (London / Cockney / Essex)' },
  { id: 'Scottish', label: 'Scottish (Edinburgh / Glasgow)' },
  { id: 'Irish', label: 'Irish (Dublin / Celtic)' },
  { id: 'Welsh', label: 'Welsh' },
  { id: 'Australian', label: 'Australian (Sydney / Melbourne)' },
  { id: 'New Zealand', label: 'New Zealand (Kiwi)' },
  { id: 'South African', label: 'South African' },
  { id: 'Transatlantic', label: 'Transatlantic (Mid-Atlantic)' },
  { id: 'German', label: 'German (Standard Hochdeutsch)' },
  { id: 'Austrian German', label: 'German (Austrian / Viennese)' },
  { id: 'Swiss German', label: 'German (Swiss / Zürich)' },
  { id: 'French', label: 'French (Parisian)' },
  { id: 'Canadian French', label: 'French (Québécois / Canadian)' },
  { id: 'Spanish', label: 'Spanish (Castilian / Madrid)' },
  { id: 'Latin American Spanish', label: 'Spanish (Mexican / Latin American)' },
  { id: 'Argentinian', label: 'Spanish (Argentinian / Rioplatense)' },
  { id: 'Italian', label: 'Italian (Rome / Milan)' },
  { id: 'Portuguese (Brazilian)', label: 'Portuguese (Brazilian / São Paulo)' },
  { id: 'Portuguese (European)', label: 'Portuguese (Lisbon / European)' },
  { id: 'Dutch', label: 'Dutch (Amsterdam / Flemish)' },
  { id: 'Russian', label: 'Russian (Moscow / Slavic)' },
  { id: 'Ukrainian', label: 'Ukrainian (Kyiv)' },
  { id: 'Polish', label: 'Polish (Warsaw)' },
  { id: 'Czech', label: 'Czech (Prague)' },
  { id: 'Romanian', label: 'Romanian (Bucharest)' },
  { id: 'Hungarian', label: 'Hungarian (Budapest)' },
  { id: 'Greek', label: 'Greek (Athens / Mediterranean)' },
  { id: 'Turkish', label: 'Turkish (Istanbul)' },
  { id: 'Arabic', label: 'Arabic (Modern Standard / Gulf)' },
  { id: 'Egyptian Arabic', label: 'Arabic (Egyptian / Cairo)' },
  { id: 'Levantine Arabic', label: 'Arabic (Levantine / Beirut)' },
  { id: 'Persian', label: 'Persian / Farsi (Tehran)' },
  { id: 'Hebrew', label: 'Hebrew (Tel Aviv)' },
  { id: 'Punjabi', label: 'Punjabi (Lahore / Chandigarh)' },
  { id: 'Bengali', label: 'Bengali (Dhaka / Kolkata)' },
  { id: 'Tamil', label: 'Tamil / South Indian' },
  { id: 'Pashto', label: 'Pashto / Afghan' },
  { id: 'Japanese', label: 'Japanese (Tokyo)' },
  { id: 'Korean', label: 'Korean (Seoul)' },
  { id: 'Chinese (Mandarin)', label: 'Chinese (Mandarin / Beijing)' },
  { id: 'Cantonese', label: 'Chinese (Cantonese / Hong Kong)' },
  { id: 'Indonesian', label: 'Indonesian (Jakarta)' },
  { id: 'Malay', label: 'Malay (Kuala Lumpur)' },
  { id: 'Thai', label: 'Thai (Bangkok)' },
  { id: 'Vietnamese', label: 'Vietnamese (Hanoi / Saigon)' },
  { id: 'Filipino', label: 'Filipino / Tagalog (Manila)' },
  { id: 'Swedish', label: 'Swedish (Stockholm / Nordic)' },
  { id: 'Norwegian', label: 'Norwegian (Oslo)' },
  { id: 'Danish', label: 'Danish (Copenhagen)' },
  { id: 'Finnish', label: 'Finnish (Helsinki)' },
  { id: 'Swahili', label: 'Swahili / East African' },
  { id: 'Nigerian', label: 'Nigerian / West African' },
];

export const VOICE_LANGUAGE_OPTIONS = [
  { code: 'auto', name: 'Auto-detect Language (Multilingual)', defaultAccent: 'default' },
  { code: 'hinglish', name: 'Hinglish (Hindi + English)', defaultAccent: 'Hinglish' },
  { code: 'en-US', name: 'English — United States (US)', defaultAccent: 'American' },
  { code: 'en-GB', name: 'English — United Kingdom (UK)', defaultAccent: 'British' },
  { code: 'en-AU', name: 'English — Australia', defaultAccent: 'Australian' },
  { code: 'en-CA', name: 'English — Canada', defaultAccent: 'Canadian' },
  { code: 'en-IE', name: 'English — Ireland', defaultAccent: 'Irish' },
  { code: 'en-IN', name: 'English — India / South Asia', defaultAccent: 'Indian / Urdu-Hindi' },
  { code: 'en-ZA', name: 'English — South Africa', defaultAccent: 'South African' },
  { code: 'ur', name: 'Urdu (اردو — Pakistan / India)', defaultAccent: 'Indian / Urdu-Hindi' },
  { code: 'hi', name: 'Hindi (हिन्दी — India)', defaultAccent: 'Indian / Urdu-Hindi' },
  { code: 'de', name: 'German (Deutsch — Germany)', defaultAccent: 'German' },
  { code: 'de-AT', name: 'German — Austria (Österreichisches Deutsch)', defaultAccent: 'Austrian German' },
  { code: 'de-CH', name: 'German — Switzerland (Schweizerdeutsch)', defaultAccent: 'Swiss German' },
  { code: 'fr', name: 'French (Français — France)', defaultAccent: 'French' },
  { code: 'fr-CA', name: 'French — Canada (Québécois)', defaultAccent: 'Canadian French' },
  { code: 'es', name: 'Spanish (Español — Spain)', defaultAccent: 'Spanish' },
  { code: 'es-MX', name: 'Spanish — Mexico & Latin America', defaultAccent: 'Latin American Spanish' },
  { code: 'es-AR', name: 'Spanish — Argentina', defaultAccent: 'Argentinian' },
  { code: 'it', name: 'Italian (Italiano)', defaultAccent: 'Italian' },
  { code: 'pt-BR', name: 'Portuguese — Brazil (Português Brasileiro)', defaultAccent: 'Portuguese (Brazilian)' },
  { code: 'pt-PT', name: 'Portuguese — Portugal (Português Europeu)', defaultAccent: 'Portuguese (European)' },
  { code: 'nl', name: 'Dutch (Nederlands / Vlaams)', defaultAccent: 'Dutch' },
  { code: 'ru', name: 'Russian (Русский)', defaultAccent: 'Russian' },
  { code: 'uk', name: 'Ukrainian (Українська)', defaultAccent: 'Ukrainian' },
  { code: 'pl', name: 'Polish (Polski)', defaultAccent: 'Polish' },
  { code: 'cs', name: 'Czech (Čeština)', defaultAccent: 'Czech' },
  { code: 'ro', name: 'Romanian (Română)', defaultAccent: 'Romanian' },
  { code: 'hu', name: 'Hungarian (Magyar)', defaultAccent: 'Hungarian' },
  { code: 'el', name: 'Greek (Ελληνικά)', defaultAccent: 'Greek' },
  { code: 'tr', name: 'Turkish (Türkçe)', defaultAccent: 'Turkish' },
  { code: 'ar', name: 'Arabic (العربية — Standard / Gulf)', defaultAccent: 'Arabic' },
  { code: 'ar-EG', name: 'Arabic — Egypt (مصرى)', defaultAccent: 'Egyptian Arabic' },
  { code: 'ar-LB', name: 'Arabic — Levantine (لبناني / شامي)', defaultAccent: 'Levantine Arabic' },
  { code: 'fa', name: 'Persian / Farsi (فارسی)', defaultAccent: 'Persian' },
  { code: 'he', name: 'Hebrew (עברית)', defaultAccent: 'Hebrew' },
  { code: 'pa', name: 'Punjabi (پنجابی / ਪੰਜਾਬੀ)', defaultAccent: 'Punjabi' },
  { code: 'bn', name: 'Bengali (বাংলা)', defaultAccent: 'Bengali' },
  { code: 'ta', name: 'Tamil (தமிழ்)', defaultAccent: 'Tamil' },
  { code: 'te', name: 'Telugu (తెలుగు)', defaultAccent: 'Tamil' },
  { code: 'mr', name: 'Marathi (मराठी)', defaultAccent: 'Indian / Urdu-Hindi' },
  { code: 'gu', name: 'Gujarati (ગુજરાતી)', defaultAccent: 'Indian / Urdu-Hindi' },
  { code: 'ps', name: 'Pashto (پښتو)', defaultAccent: 'Pashto' },
  { code: 'ja', name: 'Japanese (日本語)', defaultAccent: 'Japanese' },
  { code: 'ko', name: 'Korean (한국어)', defaultAccent: 'Korean' },
  { code: 'zh-CN', name: 'Chinese — Mandarin (简体中文)', defaultAccent: 'Chinese (Mandarin)' },
  { code: 'zh-HK', name: 'Chinese — Cantonese (繁體中文 / 粵語)', defaultAccent: 'Cantonese' },
  { code: 'id', name: 'Indonesian (Bahasa Indonesia)', defaultAccent: 'Indonesian' },
  { code: 'ms', name: 'Malay (Bahasa Melayu)', defaultAccent: 'Malay' },
  { code: 'th', name: 'Thai (ไทย)', defaultAccent: 'Thai' },
  { code: 'vi', name: 'Vietnamese (Tiếng Việt)', defaultAccent: 'Vietnamese' },
  { code: 'tl', name: 'Filipino / Tagalog', defaultAccent: 'Filipino' },
  { code: 'sv', name: 'Swedish (Svenska)', defaultAccent: 'Swedish' },
  { code: 'no', name: 'Norwegian (Norsk)', defaultAccent: 'Norwegian' },
  { code: 'da', name: 'Danish (Dansk)', defaultAccent: 'Danish' },
  { code: 'fi', name: 'Finnish (Suomi)', defaultAccent: 'Finnish' },
  { code: 'sw', name: 'Swahili (Kiswahili)', defaultAccent: 'Swahili' },
];

