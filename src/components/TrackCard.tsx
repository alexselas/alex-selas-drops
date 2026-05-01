import { useRef, useState } from 'react';
import { Play, Pause, Clock, Zap, Coins, ShoppingCart, Check } from 'lucide-react';
import { motion } from 'motion/react';
import type { Track } from '../types';
import { CATEGORY_LABELS, CATEGORY_COLORS, CREDIT_COSTS } from '../types';
import { formatCredits, formatDuration } from '../lib/utils';

interface TrackCardProps {
  track: Track;
  isPlaying: boolean;
  isCurrentTrack: boolean;
  isInCart?: boolean;
  onPlay: () => void;
  onAddToCart?: () => void;
  onDetail: () => void;
}

export default function TrackCard({
  track,
  isPlaying,
  isCurrentTrack,
  isInCart,
  onPlay,
  onAddToCart,
  onDetail,
}: TrackCardProps) {
  const credits = CREDIT_COSTS[track.category] || 1;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);

  const handleMouseEnter = () => {
    setHovered(true);
    videoRef.current?.play().catch(() => {});
  };

  const handleMouseLeave = () => {
    setHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group relative bg-[#141414] rounded-2xl border border-white/[0.06] overflow-hidden card-hover hover:border-yellow-400/20 flex flex-col"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Cover */}
      <div
        className="relative aspect-square bg-[#0e0e0e] cursor-pointer overflow-hidden flex-shrink-0"
        onClick={onDetail}
        role="button"
        tabIndex={0}
        aria-label={`Ver detalles de ${track.title}`}
        onKeyDown={(e) => { if (e.key === 'Enter') onDetail(); }}
      >
        {track.coverUrl ? (
          <img src={track.coverUrl} alt={track.title} className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a1a1a] to-[#0e0e0e]">
            <Zap className="w-12 h-12 text-zinc-800" />
          </div>
        )}

        {/* Video loop on hover */}
        <video
          ref={videoRef}
          src="/loop-md.mp4"
          muted
          loop
          playsInline
          preload="none"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${hovered ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* Hover overlay with play button */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent transition-opacity duration-300 flex items-center justify-center ${hovered ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="w-12 h-12 rounded-full gradient-bg flex items-center justify-center shadow-lg shadow-yellow-400/25 hover:scale-110 active:scale-90 transition-transform"
            aria-label={isCurrentTrack && isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isCurrentTrack && isPlaying ? (
              <Pause className="w-5 h-5 text-black" />
            ) : (
              <Play className="w-5 h-5 text-black ml-0.5" />
            )}
          </button>
        </div>

        {/* Category badge */}
        <span
          className={`absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold shadow-lg backdrop-blur-sm z-10 ${CATEGORY_COLORS[track.category] || 'bg-zinc-600 text-white'}`}
        >
          {CATEGORY_LABELS[track.category] || track.category}
        </span>

        {/* Playing indicator */}
        {isCurrentTrack && isPlaying && (
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-sm text-yellow-400 text-[10px] font-medium z-10">
            <span className="flex gap-0.5">
              {[1, 2, 3].map(i => (
                <motion.span
                  key={i}
                  className="w-0.5 bg-yellow-400 rounded-full"
                  animate={{ height: [3, 10, 3] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </span>
            Reproduciendo
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3.5 flex flex-col flex-1">
        <button onClick={onDetail} className="text-left w-full">
          <h3 className="font-semibold text-sm text-zinc-100 truncate group-hover:text-yellow-400 transition-colors leading-tight">
            {track.title}
          </h3>
        </button>
        <p className="text-xs text-zinc-500 mt-1 truncate">
          {track.authors ? <><span className="text-zinc-400">{track.authors}</span> &middot; </> : null}
          {track.genre}
        </p>

        <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-500">
          {track.bpm > 0 && <span className="bg-white/[0.04] px-1.5 py-0.5 rounded">{track.bpm} BPM</span>}
          {track.camelot && <span className="text-yellow-400/70 font-bold bg-yellow-400/[0.06] px-1.5 py-0.5 rounded">{track.camelot}</span>}
          {track.key && !track.camelot && <span className="bg-white/[0.04] px-1.5 py-0.5 rounded">{track.key}</span>}
          {track.duration > 0 && (
            <span className="flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {formatDuration(track.duration)}
            </span>
          )}
        </div>

        {/* Credits + Add to cart */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/[0.04]">
          <span className="flex items-center gap-1 text-base font-bold gradient-text">
            <Coins className="w-4 h-4 text-yellow-400" />
            {formatCredits(credits)}
          </span>
          {onAddToCart && (
            <button
              onClick={onAddToCart}
              disabled={isInCart}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isInCart
                  ? 'bg-green-500/15 text-green-400 cursor-default border border-green-500/20'
                  : 'bg-white/[0.06] text-zinc-300 border border-white/[0.06] hover:gradient-bg hover:text-black hover:border-transparent hover:shadow-md hover:shadow-yellow-400/10 active:scale-95'
              }`}
              aria-label={isInCart ? 'En el carrito' : `Añadir ${track.title} al carrito`}
            >
              {isInCart ? (<><Check className="w-3 h-3" />Añadido</>) : (<><ShoppingCart className="w-3 h-3" />Añadir</>)}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
