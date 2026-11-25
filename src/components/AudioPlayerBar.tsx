import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  Sparkles,
} from 'lucide-react';
import { GenerationHistoryItem } from '../types';

interface AudioPlayerBarProps {
  currentTrack: GenerationHistoryItem | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  playbackRate: number;
  onChangePlaybackRate: (rate: number) => void;
  onRewind10: () => void;
  onForward10: () => void;
  volume: number;
  onChangeVolume: (vol: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  currentTrack,
  isPlaying,
  onTogglePlay,
  currentTime,
  duration,
  onSeek,
  playbackRate,
  onChangePlaybackRate,
  onRewind10,
  onForward10,
  volume,
  onChangeVolume,
  isMuted,
  onToggleMute,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const speedMenuRef = useRef<HTMLDivElement>(null);

  // Close speed menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (speedMenuRef.current && !speedMenuRef.current.contains(event.target as Node)) {
        setShowSpeedMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!currentTrack) return null;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const total = Math.floor(secs);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:left-64 bg-white/95 dark:bg-zinc-950/95 border-t border-gray-200/90 dark:border-zinc-800 backdrop-blur-lg shadow-2xl transition-all duration-200">
      {/* Minimized bar toggle (Mobile & Desktop Friendly) */}
      {isMinimized ? (
        <div className="flex items-center justify-between gap-2 px-3 sm:px-6 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={currentTrack.avatarUrl}
              alt={currentTrack.voiceName}
              className="w-6 h-6 rounded-full object-cover shrink-0"
            />
            <span className="text-xs font-semibold text-gray-900 dark:text-white truncate max-w-[140px] sm:max-w-[240px]">
              {currentTrack.voiceName}
            </span>
            <span className="text-[11px] text-gray-400 font-mono shrink-0">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            {currentTrack.isSpaceRemoved && (
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                <Sparkles className="w-2.5 h-2.5" />
                {currentTrack.removedSpaceSeconds && currentTrack.removedSpaceSeconds > 0
                  ? `-${currentTrack.removedSpaceSeconds}s space`
                  : 'Space cleaned'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onTogglePlay}
              className="w-7 h-7 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center hover:scale-105 active:scale-95"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={() => setIsMinimized(false)}
              className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-md"
              title="Expand player"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col px-3 sm:px-6 py-2.5 max-w-6xl mx-auto space-y-2">
          {/* Row 1: Voice Info + Play/Pause Controls + Single Voice Control Slider */}
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
            {/* Left: Voice Avatar & Title */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1 sm:basis-1/3">
              <img
                src={currentTrack.avatarUrl}
                alt={currentTrack.voiceName}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover shrink-0 ring-1 ring-gray-200 dark:ring-zinc-700 shadow-2xs"
              />
              <div className="truncate min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {currentTrack.voiceName}
                  </p>
                  {currentTrack.isSpaceRemoved && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 shrink-0">
                      <Sparkles className="w-2.5 h-2.5" />
                      {currentTrack.removedSpaceSeconds && currentTrack.removedSpaceSeconds > 0
                        ? `-${currentTrack.removedSpaceSeconds}s trimmed`
                        : 'Clean audio'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  "{currentTrack.text}"
                </p>
              </div>
            </div>

            {/* Middle: Play / Pause / Skip Controls */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 shrink-0">
              <button
                onClick={onRewind10}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                title="Rewind 10 seconds"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={onTogglePlay}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-100 flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              <button
                onClick={onForward10}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                title="Forward 10 seconds"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            {/* Right: Single Voice Control Slider + Playback Speed + Minimize */}
            <div className="flex items-center justify-end gap-2 shrink-0">
              {/* Single Voice Control Slider when audio is loaded/played */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200/80 dark:border-zinc-800 glow-box-cyan">
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors cursor-pointer"
                  title={isMuted ? 'Unmute Voice' : 'Mute Voice'}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-3.5 h-3.5 text-red-500" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    onChangeVolume(v);
                    if (v > 0 && isMuted) onToggleMute();
                  }}
                  aria-label="Voice Control Slider"
                  title={`Voice Control: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                  className="w-16 sm:w-20 h-1 bg-gray-300 dark:bg-zinc-700 rounded-lg accent-cyan-500 cursor-pointer"
                />
                <span className="text-[10px] font-mono font-medium text-gray-600 dark:text-gray-300 w-7 text-right">
                  {Math.round((isMuted ? 0 : volume) * 100)}%
                </span>
              </div>

              {/* Playback speed selector */}
              <div className="relative" ref={speedMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="px-2 py-1.5 text-xs font-mono font-medium rounded-xl bg-white dark:bg-zinc-900 hover:bg-purple-50/40 dark:hover:bg-zinc-800 border border-gray-200 dark:border-zinc-800 glow-box-violet text-gray-700 dark:text-gray-300 cursor-pointer"
                  title="Playback Speed"
                >
                  {playbackRate}x
                </button>

                {showSpeedMenu && (
                  <div className="absolute right-0 bottom-full mb-1.5 w-24 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-lg p-1 z-50 space-y-0.5">
                    {speeds.map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          onChangePlaybackRate(s);
                          setShowSpeedMenu(false);
                        }}
                        className={`w-full text-center px-2 py-1 text-xs rounded-lg font-mono transition-colors ${
                          playbackRate === s
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300 font-bold'
                            : 'hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Minimize bar */}
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                title="Minimize player"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Row 2: Scrubber with timeline & waveform representation */}
          <div className="flex items-center gap-2.5 w-full">
            <span className="text-[10px] sm:text-[11px] font-mono text-gray-400 dark:text-gray-500 w-12 sm:w-14 shrink-0 text-right">
              {formatTime(currentTime)}
            </span>

            {/* Interactive Timeline Progress Bar */}
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                onSeek(ratio * duration);
              }}
              className="relative flex-1 h-3.5 flex items-center cursor-pointer group"
            >
              {/* Background Track */}
              <div className="w-full h-1.5 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden transition-all group-hover:h-2">
                {/* Active progress */}
                <div
                  className="h-full bg-black dark:bg-white rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Scrubbing Thumb */}
              <div
                className="absolute w-3 h-3 bg-black dark:bg-white rounded-full shadow-md -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `${progressPercent}%` }}
              />
            </div>

            <span className="text-[10px] sm:text-[11px] font-mono text-gray-400 dark:text-gray-500 w-12 sm:w-14 shrink-0 text-left">
              {formatTime(duration)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

