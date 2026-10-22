import React, { useState } from 'react';
import {
  Menu,
  Search,
  X,
  Plus,
  HelpCircle,
  MessageSquare,
  BookOpen,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface HeaderProps {
  title?: string;
  onOpenMobileMenu: () => void;
  onOpenSearch: () => void;
  onOpenVoiceClone: () => void;
  offlineMode: boolean;
  setOfflineMode: (offline: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'Text to Speech',
  onOpenMobileMenu,
  onOpenSearch,
  onOpenVoiceClone,
  offlineMode,
  setOfflineMode,
}) => {
  const [showBanner, setShowBanner] = useState(true);

  return (
    <div className="sticky top-0 z-30 flex flex-col w-full bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-gray-200/80 dark:border-zinc-800">
      {/* Top Banner (Eleven v4 announcement) */}
      {showBanner && (
        <div className="relative flex items-center justify-center px-4 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 transition-all">
          <div className="flex items-center gap-2 text-center truncate">
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wider">
              NEW
            </span>
            <span className="truncate">
              Eleven v4 &amp; Gemini 3.8 Speech Engine is active — ultra-low latency, multi-speaker and offline voice cloning enabled.
            </span>
            <button
              onClick={onOpenVoiceClone}
              className="underline hover:text-blue-100 font-semibold cursor-pointer shrink-0 ml-1"
            >
              Clone a Voice
            </button>
          </div>
          <button
            onClick={() => setShowBanner(false)}
            className="absolute right-2 p-1 text-white/80 hover:text-white rounded-md hover:bg-white/10 transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Navbar */}
      <div className="flex items-center justify-between h-14 px-4 sm:px-6 gap-3">
        {/* Left: Mobile hamburger & Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="p-1.5 -ml-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
              {title}
            </h1>
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-zinc-700">
              v4.2 High-Fidelity
            </span>
          </div>
        </div>

        {/* Middle: Search bar trigger */}
        <div className="flex-1 max-w-md mx-2 hidden md:block">
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-100/80 dark:bg-zinc-900/80 hover:bg-gray-200/60 dark:hover:bg-zinc-800/80 border border-gray-200/80 dark:border-zinc-800 rounded-xl transition-all shadow-2xs group"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200" />
              <span>Search voices, tags, audiobooks, templates...</span>
            </div>
            <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-md text-gray-500 dark:text-gray-400 shadow-2xs">
              <span>⌘</span>
              <span>K</span>
            </kbd>
          </button>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Offline / Cloud Mode Toggle Pill */}
          <button
            onClick={() => setOfflineMode(!offlineMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border transition-all ${
              offlineMode
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
            }`}
            title={offlineMode ? 'Currently Offline: Using local WebAudio' : 'Currently Online: Using Gemini Cloud'}
          >
            {offlineMode ? <WifiOff className="w-3.5 h-3.5 text-amber-500" /> : <Wifi className="w-3.5 h-3.5 text-emerald-500" />}
            <span className="hidden sm:inline">{offlineMode ? 'Offline Engine' : 'Cloud Studio'}</span>
          </button>

          {/* Quick Clone Voice Button */}
          <button
            onClick={onOpenVoiceClone}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-100 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clone Voice</span>
          </button>

          {/* User Credits Avatar Ring */}
          <div className="flex items-center gap-2 pl-1 border-l border-gray-200 dark:border-zinc-800">
            <div className="relative group/avatar cursor-pointer">
              {/* Animated Progress Ring */}
              <div className="w-8 h-8 rounded-full p-0.5 bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center">
                <div className="w-full h-full rounded-full bg-white dark:bg-zinc-950 flex items-center justify-center text-[11px] font-bold text-gray-800 dark:text-white">
                  EV
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 text-[9px] font-bold px-1 bg-emerald-500 text-white rounded-full leading-tight">
                ∞
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
