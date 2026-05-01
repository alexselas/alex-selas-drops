import React from 'react';
import { Play, Pause, Volume2, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Track } from '../types';
import { formatDuration } from '../lib/utils';

interface AudioPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (percent: number) => void;
}

export default function AudioPlayer({
  currentTrack,
  isPlaying,
  progress,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
}: AudioPlayerProps) {
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = ((e.clientX - rect.left) / rect.width) * 100;
    onSeek(Math.max(0, Math.min(100, percent)));
  };

  return (
    <AnimatePresence>
      {currentTrack && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-40 bg-[#0e0e0e]/95 backdrop-blur-2xl border-t border-white/[0.06] shadow-[0_-8px_30px_rgba(0,0,0,0.4)]"
        >
          {/* Progress bar */}
          <div
            className="h-1 bg-zinc-800/80 cursor-pointer group relative"
            onClick={handleProgressClick}
            role="slider"
            aria-label="Progreso de reproducción"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            tabIndex={0}
          >
            <div
              className="h-full gradient-bg relative transition-[width] duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-yellow-400 shadow-lg shadow-yellow-400/30 opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100" />
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 py-2.5 sm:py-3 flex items-center gap-3 sm:gap-4">
            {/* Track info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-lg bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden shadow-md">
                {currentTrack.coverUrl ? (
                  <img src={currentTrack.coverUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Music className="w-5 h-5 text-zinc-600" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-100 truncate">{currentTrack.title}</p>
                <p className="text-xs text-zinc-500 truncate">
                  {currentTrack.artist}{currentTrack.authors ? ` · ${currentTrack.authors}` : ''}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 sm:gap-4">
              <span className="text-xs text-zinc-500 tabular-nums hidden sm:block w-10 text-right">
                {formatDuration(currentTime)}
              </span>

              <button
                onClick={onPlayPause}
                className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center text-black hover:scale-110 active:scale-90 transition-transform shadow-lg shadow-yellow-400/20"
                aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5" />
                )}
              </button>

              <span className="text-xs text-zinc-500 tabular-nums hidden sm:block w-10">
                {formatDuration(duration)}
              </span>
            </div>

            {/* Volume hint */}
            <div className="hidden md:flex items-center gap-2 flex-1 justify-end">
              <Volume2 className="w-4 h-4 text-zinc-600" />
              <span className="text-xs text-zinc-600">Preview &middot; Calidad completa tras la compra</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
