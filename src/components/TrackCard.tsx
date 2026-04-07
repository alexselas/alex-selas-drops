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
      className="group relative bg-[#1a1a1a] rounded-[18px] border border-zinc-800/50 overflow-hidden card-hover hover:border-yellow-400/20"
    >
      {/* Cover */}
      <div
        className="relative aspect-square bg-zinc-800 cursor-pointer overflow-hidden"
        onClick={onDetail}
      >
        {track.coverUrl ? (
          <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1e1e1e] to-[#141414]">
            <Zap className="w-16 h-16 text-zinc-800" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="w-14 h-14 rounded-full gradient-bg flex items-center justify-center shadow-lg glow hover:scale-110 active:scale-95 transition-transform"
          >
            {isCurrentTrack && isPlaying ? (
              <Pause className="w-6 h-6 text-black" />
            ) : (
              <Play className="w-6 h-6 text-black ml-0.5" />
            )}
          </button>
        </div>

        {/* Category badge */}
        <span
          className={`absolute top-3 left-3 px-2.5 py-1 rounded-xl text-xs font-semibold backdrop-blur-sm ${categoryColors[track.category]}`}
        >
          {categoryLabels[track.category]}
        </span>

        {/* Playing indicator */}
        {isCurrentTrack && isPlaying && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/70 text-yellow-400 text-xs font-medium">
            <span className="flex gap-0.5">
              {[1, 2, 3].map(i => (
                <motion.span
                  key={i}
                  className="w-0.5 bg-yellow-400 rounded-full"
                  animate={{ height: [4, 12, 4] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </span>
            Reproduciendo
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <button onClick={onDetail} className="text-left w-full">
          <h3 className="font-semibold text-zinc-50 truncate group-hover:text-yellow-400 transition-colors">
            {track.title}
          </h3>
        </button>
        <p className="text-sm text-zinc-500 mt-0.5">{track.genre}</p>

        <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
          {track.bpm > 0 && <span>{track.bpm} BPM</span>}
          {track.duration > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(track.duration)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-4">
          <span className="text-lg font-bold gradient-text">{formatPrice(track.price)}</span>

          <button
            onClick={onAddToCart}
            disabled={isInCart}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
              isInCart
                ? 'bg-green-500/20 text-green-400 cursor-default'
                : 'bg-zinc-800 text-zinc-300 hover:gradient-bg hover:text-black active:scale-95'
            }`}
          >
            {isInCart ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Agregado
              </>
            ) : (
              <>
                <ShoppingCart className="w-3.5 h-3.5" />
                Comprar
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
