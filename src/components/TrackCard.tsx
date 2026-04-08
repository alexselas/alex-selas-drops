import { Play, Pause, ShoppingCart, Check, Clock, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import type { Track } from '../types';
import { formatPrice, formatDuration } from '../lib/utils';

interface TrackCardProps {
  track: Track;
  isPlaying: boolean;
  isCurrentTrack: boolean;
  isInCart: boolean;
  onPlay: () => void;
  onAddToCart: () => void;
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
  const categoryColors: Record<string, string> = {
    sesiones: 'bg-emerald-500/20 text-emerald-400',
    remixes: 'bg-violet-500/20 text-violet-400',
    mashups: 'bg-yellow-400/20 text-yellow-400',
    librerias: 'bg-amber-500/20 text-amber-400',
  };

  const categoryLabels: Record<string, string> = {
    sesiones: 'Sesión',
    remixes: 'Remix',
    mashups: 'Mashup',
    librerias: 'Librería',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 overflow-hidden card-hover hover:border-yellow-400/20 flex flex-col"
    >
      {/* Cover — smaller, 4:3 ratio */}
      <div
        className="relative aspect-[4/3] bg-zinc-800 cursor-pointer overflow-hidden flex-shrink-0"
        onClick={onDetail}
      >
        {track.coverUrl ? (
          <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1e1e1e] to-[#141414]">
            <Zap className="w-12 h-12 text-zinc-800" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="w-12 h-12 rounded-full gradient-bg flex items-center justify-center shadow-lg glow hover:scale-110 active:scale-95 transition-transform"
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
          className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg text-[10px] font-semibold backdrop-blur-sm ${categoryColors[track.category]}`}
        >
          {categoryLabels[track.category]}
        </span>

        {/* Playing indicator */}
        {isCurrentTrack && isPlaying && (
          <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-black/70 text-yellow-400 text-[10px] font-medium">
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

      {/* Info — fixed height */}
      <div className="p-3 flex flex-col flex-1">
        <button onClick={onDetail} className="text-left w-full">
          <h3 className="font-semibold text-sm text-zinc-50 truncate group-hover:text-yellow-400 transition-colors">
            {track.title}
          </h3>
        </button>
        <p className="text-xs text-zinc-500 mt-0.5 truncate">
          {track.authors ? <><span className="text-zinc-400">{track.authors}</span> &middot; </> : null}
          {track.genre}
        </p>

        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-500">
          {track.bpm > 0 && <span>{track.bpm} BPM</span>}
          {track.duration > 0 && (
            <span className="flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              {formatDuration(track.duration)}
            </span>
          )}
        </div>

        {/* Price + Buy — always at bottom */}
        <div className="flex items-center justify-between mt-auto pt-2.5">
          <span className="text-base font-bold gradient-text">{formatPrice(track.price)}</span>

          <button
            onClick={onAddToCart}
            disabled={isInCart}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              isInCart
                ? 'bg-green-500/20 text-green-400 cursor-default'
                : 'bg-zinc-800 text-zinc-300 hover:gradient-bg hover:text-black active:scale-95'
            }`}
          >
            {isInCart ? (
              <>
                <Check className="w-3 h-3" />
                Agregado
              </>
            ) : (
              <>
                <ShoppingCart className="w-3 h-3" />
                Comprar
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
