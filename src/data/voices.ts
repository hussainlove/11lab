import { Voice } from '../types';

export const PRESET_VOICES: Voice[] = [
  {
    id: 'roger',
    name: 'Roger - Laid-Back, Casual, Resonant',
    category: 'premade',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
    avatarColor: 'from-amber-500 to-orange-600',
    description: 'Laid-back, confident American male with a warm, conversational undertone. Great for video essays and podcasts.',
    accent: 'American',
    gender: 'male',
    age: 'Middle Aged',
    useCase: 'Conversational & Video Essays',
    previewText: "Hey there. It's Roger. Sometimes the most interesting stories are the ones told with quiet confidence.",
    geminiVoiceName: 'Puck',
  },
  {
    id: 'liam',
    name: 'Liam Bainbridge - Smooth and Warm',
    category: 'premade',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80',
    avatarColor: 'from-blue-600 to-indigo-700',
    description: 'Sophisticated British gentleman with a buttery, engaging narrative cadence. Perfect for audiobooks and documentaries.',
    accent: 'British',
    gender: 'male',
    age: 'Middle Aged',
    useCase: 'Audiobooks & Documentaries',
    previewText: "Welcome to this evening's presentation. Let us begin our exploration of the natural world.",
    geminiVoiceName: 'Fenrir',
  },
  {
    id: 'rachel',
    name: 'Rachel - Calm, Empathetic, Audiobook',
    category: 'premade',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80',
    avatarColor: 'from-purple-500 to-pink-600',
    description: 'Soothing, friendly, and natural female voice with pristine clarity and empathetic warmth.',
    accent: 'American',
    gender: 'female',
    age: 'Young',
    useCase: 'Narration & Meditation',
    previewText: "Take a deep breath in, release the tension, and allow your thoughts to gently settle.",
    geminiVoiceName: 'Kore',
  },
  {
    id: 'adam',
    name: 'Adam - Deep, Authoritative, Corporate',
    category: 'premade',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&h=120&q=80',
    avatarColor: 'from-slate-700 to-zinc-900',
    description: 'Deep resonant voice commanding immediate attention and trust. Industry benchmark for executive presentations.',
    accent: 'American',
    gender: 'male',
    age: 'Middle Aged',
    useCase: 'Corporate & News',
    previewText: "In quarterly performance updates, clarity and consistency are the cornerstones of market confidence.",
    geminiVoiceName: 'Charon',
  },
  {
    id: 'sarah',
    name: 'Sarah - Dynamic, Expressive, Podcast',
    category: 'premade',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&h=120&q=80',
    avatarColor: 'from-rose-500 to-red-600',
    description: 'Vibrant, fast-thinking, and versatile speaker who infuses every sentence with enthusiasm and nuance.',
    accent: 'American',
    gender: 'female',
    age: 'Young',
    useCase: 'Podcast & Social Media',
    previewText: "You won't believe what just happened! Let me break it down step-by-step for you.",
    geminiVoiceName: 'Zephyr',
  },
  {
    id: 'nicole',
    name: 'Nicole - Whispery, Intimate, ASMR',
    category: 'premade',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80',
    avatarColor: 'from-teal-400 to-emerald-600',
    description: 'Soft-spoken, delicate and whisper-rich vocal qualities tailored for bedtime stories, relaxation and ASMR.',
    accent: 'American',
    gender: 'female',
    age: 'Young',
    useCase: 'ASMR & Intimate Dialogue',
    previewText: "Listen closely as the rain taps against the glass, steady and calm.",
    geminiVoiceName: 'Kore',
  },
  {
    id: 'george',
    name: 'George - Wise, Gravelly, Storyteller',
    category: 'premade',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&h=120&q=80',
    avatarColor: 'from-amber-700 to-yellow-900',
    description: 'Seasoned, gravelly timbre with vintage character. Ideal for historical fiction, folklore, and fantasy lore.',
    accent: 'British',
    gender: 'male',
    age: 'Senior',
    useCase: 'Fantasy & Lore',
    previewText: "Long before the towers were raised, the elders carved their memories into the living bedrock.",
    geminiVoiceName: 'Charon',
  },
  {
    id: 'charlie',
    name: 'Charlie - Playful, Upbeat, Animation',
    category: 'premade',
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=120&h=120&q=80',
    avatarColor: 'from-amber-400 to-yellow-500',
    description: 'Quirky, joyful, and bouncy delivery tailored for cartoons, mobile apps, and interactive gaming.',
    accent: 'Australian',
    gender: 'male',
    age: 'Young',
    useCase: 'Animation & Gaming',
    previewText: "Whoa, watch out! Press the turbo boost button and hang on tight!",
    geminiVoiceName: 'Puck',
  },
  {
    id: 'charlotte',
    name: 'Charlotte - Sophisticated, Posh, Luxury',
    category: 'premade',
    avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&h=120&q=80',
    avatarColor: 'from-fuchsia-600 to-purple-800',
    description: 'Refined elegance and pristine enunciation. The standard voice for luxury brands and haute couture narratives.',
    accent: 'British RP',
    gender: 'female',
    age: 'Middle Aged',
    useCase: 'Luxury & Commercials',
    previewText: "Excellence is not an accident. It is the relentless pursuit of timeless distinction.",
    geminiVoiceName: 'Zephyr',
  },
  {
    id: 'callum',
    name: 'Callum - Energetic, Techie, Commercial',
    category: 'premade',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=120&h=120&q=80',
    avatarColor: 'from-cyan-500 to-blue-600',
    description: 'Crisp, contemporary tech voice with authentic enthusiasm. Ideal for SaaS product demos and explainer videos.',
    accent: 'Transatlantic',
    gender: 'male',
    age: 'Young',
    useCase: 'Tech & Product Explainer',
    previewText: "With our new realtime inference pipeline, your workflows run up to ten times faster.",
    geminiVoiceName: 'Puck',
  },
  {
    id: 'marcus',
    name: 'Marcus - Booming, Cinema Trailer, Epic',
    category: 'premade',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&h=120&q=80',
    avatarColor: 'from-red-700 to-stone-900',
    description: 'Thunderous, earth-shaking cinematic movie trailer voice. Maximum impact and dramatic gravity.',
    accent: 'American Deep',
    gender: 'male',
    age: 'Middle Aged',
    useCase: 'Movie Trailers & Promos',
    previewText: "In a world divided by shadow, one choice will alter the destiny of generations.",
    geminiVoiceName: 'Fenrir',
  },
  {
    id: 'elena',
    name: 'Elena - Warm, Bilingual, Passionate',
    category: 'premade',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&h=120&q=80',
    avatarColor: 'from-emerald-500 to-teal-700',
    description: 'Rich, melodic bilingual speaker seamlessly transitioning between English and Spanish with genuine emotion.',
    accent: 'Spanish English',
    gender: 'female',
    age: 'Young',
    useCase: 'Global Content & Commercials',
    previewText: "Every journey begins with a spark of inspiration that connects people across borders.",
    geminiVoiceName: 'Kore',
  },
];

const CUSTOM_VOICES_STORAGE_KEY = 'elevenvoice_custom_cloned_voices';

export function getStoredCustomVoices(): Voice[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_VOICES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load custom voices from storage', e);
    return [];
  }
}

export function saveCustomVoice(voice: Voice): Voice[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getStoredCustomVoices();
    const updated = [voice, ...current.filter(v => v.id !== voice.id)];
    localStorage.setItem(CUSTOM_VOICES_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to save custom voice to storage', e);
    return [];
  }
}

export function deleteCustomVoice(id: string): Voice[] {
  if (typeof window === 'undefined') return [];
  try {
    const current = getStoredCustomVoices();
    const updated = current.filter(v => v.id !== id);
    localStorage.setItem(CUSTOM_VOICES_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to delete custom voice from storage', e);
    return [];
  }
}

export const SAMPLE_PROMPT_PRESETS = [
  {
    title: 'Command the room',
    tag: '[authoritative]',
    text: "Listen carefully. We only have one chance to execute this strategy, and every second counts. [intense gaze] Look at me: failure is not an option.",
  },
  {
    title: 'Feel the betrayal',
    tag: '[whisper]',
    text: "You promised me... [voice breaks] After everything we sacrificed together in the storm, how could you be the one to betray our sanctuary?",
  },
  {
    title: 'Laugh uncontrollably',
    tag: '[laughs]',
    text: "Wait, so you're telling me [laughs] you flew halfway across the planet [bursts into laughter] just to find out the store was closed?! That's hilarious!",
  },
  {
    title: 'Direct a predicament',
    tag: '[urgent]',
    text: "Captain, telemetry is dropping fast! [beeping alarm] We need to manually reroute main propulsion before the gravitational pull exceeds structural tolerance!",
  },
  {
    title: 'Narrate a mystery',
    tag: '[atmospheric]',
    text: "The lighthouse lantern had remained unlit for thirty-two days. [dramatic pause] Yet every midnight, ships claimed to see a blue beam piercing the fog.",
  },
  {
    title: 'Overlap speech',
    tag: '[dialogue]',
    isDialogue: true,
    blocks: [
      {
        speaker: 'Roger',
        voiceName: 'Puck',
        text: "I told you we should have checked the coordinates before launching!",
        style: "Passionate, frustrated argument",
      },
      {
        speaker: 'Sarah',
        voiceName: 'Zephyr',
        text: "And I told you the sensor array was offline! We didn't have time to wait!",
        style: "Defensive, quick comeback",
      },
    ],
  },
];
