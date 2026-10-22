import React from 'react';
import {
  Home,
  Mic,
  FolderOpen,
  Volume2,
  Sparkles,
  Layers,
  MessageSquare,
  Wand2,
  Headphones,
  FileAudio,
  Radio,
  Sliders,
  ChevronRight,
  Plus,
  Zap,
  Globe,
  WifiOff,
  Sun,
  Moon,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenVoiceCloneModal: () => void;
  onOpenVoiceLibraryModal: () => void;
  voicesCount: number;
  offlineMode: boolean;
  setOfflineMode: (offline: boolean) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenVoiceCloneModal,
  onOpenVoiceLibraryModal,
  voicesCount,
  offlineMode,
  setOfflineMode,
  darkMode,
  setDarkMode,
  isOpenMobile,
  setIsOpenMobile,
}) => {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col w-64 bg-gray-50/95 dark:bg-zinc-950/95 border-r border-gray-200/80 dark:border-zinc-800 backdrop-blur-md transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header Logo */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-gray-200/60 dark:border-zinc-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            {/* ElevenLabs stylized dual bars icon */}
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-6 bg-black dark:bg-white rounded-full inline-block"></span>
              <span className="w-1.5 h-6 bg-black dark:bg-white rounded-full inline-block"></span>
            </div>
            <div className="flex items-baseline">
              <span className="font-semibold text-lg tracking-tight text-gray-900 dark:text-white">ElevenVoice</span>
              <span className="ml-1 text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-gray-600 dark:text-gray-300">
                Studio
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5 text-sm">
          {/* Main Group */}
          <div className="space-y-0.5">
            <button
              onClick={() => {
                setActiveTab('tts');
                setIsOpenMobile(false);
              }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl font-medium transition-colors ${
                activeTab === 'home'
                  ? 'bg-gray-200/70 dark:bg-zinc-800 text-gray-950 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Home className="w-4 h-4 text-gray-500" />
              <span>Home</span>
            </button>

            <button
              onClick={() => {
                onOpenVoiceLibraryModal();
                setIsOpenMobile(false);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Mic className="w-4 h-4 text-gray-500" />
                <span>Voices</span>
              </div>
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 font-mono">
                {voicesCount}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('studio');
                setIsOpenMobile(false);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              <Sliders className="w-4 h-4 text-gray-500" />
              <span>Studio</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('flows');
                setIsOpenMobile(false);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              <Layers className="w-4 h-4 text-gray-500" />
              <span>Flows</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('chat');
                setIsOpenMobile(false);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-gray-500" />
              <span>Chat</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('assets');
                setIsOpenMobile(false);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            >
              <FolderOpen className="w-4 h-4 text-gray-500" />
              <span>Assets</span>
            </button>
          </div>

          {/* Pinned Section */}
          <div>
            <div className="flex items-center justify-between px-2.5 mb-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              <span>Pinned</span>
            </div>

            <div className="space-y-0.5">
              <button
                onClick={() => {
                  setActiveTab('tts');
                  setIsOpenMobile(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl font-medium transition-colors ${
                  activeTab === 'tts'
                    ? 'bg-gray-200/80 dark:bg-zinc-800 text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Volume2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Text to Speech</span>
                </div>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse"></span>
              </button>

              <button
                onClick={() => {
                  onOpenVoiceCloneModal();
                  setIsOpenMobile(false);
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-white transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <Wand2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Voice Creation</span>
                </div>
                <Plus className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>

              <button
                onClick={() => {
                  setActiveTab('sound-effects');
                  setIsOpenMobile(false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Sound Effects</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('voice-changer');
                  setIsOpenMobile(false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
              >
                <Radio className="w-4 h-4 text-emerald-500" />
                <span>Voice Changer</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('audiobooks');
                  setIsOpenMobile(false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
              >
                <Headphones className="w-4 h-4 text-indigo-500" />
                <span>Audiobooks</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('speech-to-text');
                  setIsOpenMobile(false);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100/80 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
              >
                <FileAudio className="w-4 h-4 text-cyan-500" />
                <span>Speech to Text</span>
              </button>
            </div>
          </div>

          {/* Engine Processing Mode Banner */}
          <div className="p-3 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200/80 dark:border-zinc-800 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                {offlineMode ? (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                    Offline Synthesis
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5 text-blue-500" />
                    Cloud Turbo (v4)
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => setOfflineMode(!offlineMode)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  offlineMode ? 'bg-amber-500' : 'bg-gray-300 dark:bg-zinc-700'
                }`}
                role="switch"
                aria-checked={offlineMode}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    offlineMode ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-[11px] leading-tight text-gray-500 dark:text-gray-400">
              {offlineMode
                ? 'Zero-latency on-device WebAudio engine with formant cloning.'
                : 'High-fidelity Gemini 3.8 studio models with emotive nuance.'}
            </p>
          </div>

          {/* Limitless Plan Banner */}
          <div className="relative overflow-hidden p-3 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-900 dark:to-zinc-950">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-gray-900 dark:text-white">Limitless Studio</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
              Unrestricted character limits and unlimited instant voice clones.
            </p>
            <div className="flex items-center justify-between text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-lg">
              <span>Status: Active</span>
              <span>∞ / ∞ Credits</span>
            </div>
          </div>
        </div>

        {/* Footer info & theme toggle */}
        <div className="p-3 border-t border-gray-200/80 dark:border-zinc-800 shrink-0 space-y-2">
          <div className="flex items-center justify-between px-2 py-1 rounded-xl bg-gray-100/60 dark:bg-zinc-900/60">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-black text-white dark:bg-white dark:text-black flex items-center justify-center font-bold text-[10px]">
                EC
              </div>
              <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate max-w-[100px]">
                ElevenCreative
              </span>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-1 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
