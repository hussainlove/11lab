import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Download,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  Loader2,
} from 'lucide-react';
import { GenerationHistoryItem } from '../types';
import { downloadSpeechAsMp3 } from '../services/audioEngine';

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
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isDownloading, setIsDownloading] = useState(false);
  const speedMenuRef = useRef<HTMLDivElement>(null);

  const handleDownloadMp3 = async () => {
    if (!currentTrack || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadSpeechAsMp3(
        currentTrack.audioUrl,
        currentTrack.voiceName,
        currentTrack.text,
        128
      );
    } catch (e) {
      console.error('Download MP3 failed', e);
    } finally {
      setIsDownloading(false);
    }
  };

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
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:left-64 bg-white/95 dark:bg-zinc-950/95 border-t border-gray-200/90 dark:border-zinc-800 backdrop-blur-lg shadow-xl transition-all duration-200">
      {/* Minimized bar toggle */}
      {isMinimized ? (
        <div className="flex items-center justify-between px-6 py-2">
          <div className="flex items-center gap-3">
            <img
              src={currentTrack.avatarUrl}
              alt={currentTrack.voiceName}
              className="w-6 h-6 rounded-full object-cover"
            />
            <span className="text-xs font-semibold text-gray-900 dark:text-white truncate max-w-[200px]">
              {currentTrack.voiceName}
            </span>
            <span className="text-xs text-gray-400 font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePlay}
              className="w-7 h-7 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center hover:scale-105 active:scale-95"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
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
        <div className="flex flex-col px-4 sm:px-8 py-3 max-w-6xl mx-auto space-y-2">
          {/* Top row: Track info, Main Controls, Utility Buttons */}
          <div className="flex items-center justify-between gap-4">
            {/* Left: Voice Avatar & Title */}
            <div className="flex items-center gap-3 basis-1/4 min-w-0">
              <img
                src={currentTrack.avatarUrl}
                alt={currentTrack.voiceName}
                className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-gray-200 dark:ring-zinc-700 shadow-2xs"
              />
              <div className="truncate">
                <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {currentTrack.voiceName}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  "{currentTrack.text}"
                </p>
              </div>
            </div>

            {/* Middle: Controls */}
            <div className="flex items-center justify-center gap-3 sm:gap-4 shrink-0">
              <button
                onClick={onRewind10}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                title="Rewind 10 seconds"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={onTogglePlay}
                className="w-10 h-10 rounded-full bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-100 flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
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

            {/* Right: Speed, Download & Minimize */}
            <div className="flex items-center justify-end gap-2 basis-1/4 shrink-0">
              {/* Playback speed selector */}
              <div className="relative" ref={speedMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="px-2 py-1 text-xs font-mono font-medium rounded-lg bg-gray-100 dark:bg-zinc-900 hover:bg-gray-200/80 dark:hover:bg-zinc-800 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-gray-300"
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

              {/* Download Audio as MP3 (Clean filename, no extra spaces) */}
              <button
                type="button"
                onClick={handleDownloadMp3}
                disabled={isDownloading}
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                title="Download as MP3"
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>

              {/* Minimize bar */}
              <button
                onClick={() => setIsMinimized(true)}
                className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                title="Minimize player"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bottom row: Scrubber with timeline & waveform representation */}
          <div className="flex items-center gap-3 w-full">
            <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500 w-10 text-right">
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

            <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500 w-10 text-left">
              {formatTime(duration)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
