import React, { useState } from 'react';
import {
  Menu,
  Search,
  X,
  Plus,
  Sliders,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface HeaderProps {
  title?: string;
  onOpenMobileMenu: () => void;
  onOpenMobileSettings?: () => void;
  onOpenSearch: () => void;
  onOpenVoiceClone: () => void;
  offlineMode: boolean;
  setOfflineMode: (offline: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'Text to Speech',
  onOpenMobileMenu,
  onOpenMobileSettings,
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
          <div className="flex items-center gap-2 text-center truncate pr-6">
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wider">
              NEW
            </span>
            <span className="truncate">
              HBL voicelab &amp; Gemini 3.8 Speech Engine is active — 55+ languages, accents &amp; human slang enabled.
            </span>
            <button
              onClick={onOpenVoiceClone}
              className="underline hover:text-blue-100 font-semibold cursor-pointer shrink-0 ml-1"
            >
              Clone Voice
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
      <div className="flex items-center justify-between h-13 sm:h-14 px-3 sm:px-6 gap-2 sm:gap-3">
        {/* Left: Mobile hamburger & Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onOpenMobileMenu}
            className="p-1.5 -ml-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 lg:hidden shrink-0"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="brand-wordmark flex items-baseline gap-1 text-base sm:text-xl whitespace-nowrap shrink-0">
              <span className="font-extrabold text-gray-950 dark:text-white">HBL</span>
              <span className="font-medium bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 dark:from-cyan-400 dark:via-sky-300 dark:to-indigo-400 bg-clip-text text-transparent">
                voicelab
              </span>
            </h1>
            <span className="hidden md:inline-block text-xs font-medium text-gray-400 dark:text-zinc-500 whitespace-nowrap truncate">
              · {title}
            </span>
          </div>
        </div>

        {/* Right side controls (Search, Settings, Engine Status, Clone Voice — uniform compact buttons) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Compact Search Trigger Button (matches Settings & Clone Voice button height & size) */}
          <button
            onClick={onOpenSearch}
            className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-100 border border-cyan-400/50 dark:border-cyan-500/50 glow-box-cyan transition-all cursor-pointer max-w-[115px] sm:max-w-[140px]"
            title="Search voices, tags, audiobooks & templates (⌘K)"
          >
            <Search className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
            <span className="truncate">Search voices...</span>
          </button>

          {/* Mobile Settings & History Drawer Trigger */}
          {onOpenMobileSettings && (
            <button
              onClick={onOpenMobileSettings}
              className="lg:hidden inline-flex items-center justify-center gap-1.5 h-8 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-100 border border-indigo-400/50 dark:border-indigo-500/50 glow-box-indigo transition-all cursor-pointer shrink-0"
              title="Expand Voice Settings & History"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Settings</span>
            </button>
          )}

          {/* Offline / Cloud Mode Toggle Button */}
          <button
            onClick={() => setOfflineMode(!offlineMode)}
            className={`inline-flex items-center justify-center gap-1.5 h-8 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer shrink-0 ${
              offlineMode
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 glow-box-amber'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 glow-box-emerald'
            }`}
            title={offlineMode ? 'Currently Offline: Using local WebAudio' : 'Currently Online: Using Gemini Cloud'}
          >
            {offlineMode ? (
              <WifiOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            ) : (
              <Wifi className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            )}
            <span className="hidden sm:inline">{offlineMode ? 'Offline' : 'Cloud Studio'}</span>
          </button>

          {/* Quick Clone Voice Button */}
          <button
            onClick={onOpenVoiceClone}
            className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 py-1 text-xs font-semibold rounded-lg bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-100 border border-purple-400/50 glow-box-violet transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Clone Voice</span>
          </button>
        </div>
      </div>
    </div>
  );
};

