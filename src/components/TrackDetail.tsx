import { X, Play, Pause, ShoppingCart, Check, Clock, Tag, Calendar, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Track } from '../types';
import { formatPrice, formatDuration } from '../lib/utils';

interface TrackDetailProps {
  track: Track | null;
  isPlaying: boolean;
  isCurrentTrack: boolean;
  isInCart: boolean;
  onClose: () => void;
  onPlay: () => void;
  onAddToCart: () => void;
}

export default function TrackDetail({
  track,
  isPlaying,
  isCurrentTrack,
  isInCart,
  onClose,
  onPlay,
  onAddToCart,
}: TrackDetailProps) {
  if (!track) return null;

  const categoryLabels: Record<string, string> = {
    sesiones: 'Sesión',
    remixes: 'Remix',
    mashups: 'Mashup',
    librerias: 'Librería',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl bg-[#1a1a1a] rounded-[22px] border border-zinc-800/50 overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Cover */}
          <div className="relative aspect-video bg-zinc-800 flex items-center justify-center overflow-hidden">
            {track.coverUrl ? (
              <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1e1e1e] to-[#0f0f0f]">
                <Music className="w-24 h-24 text-zinc-800" />
              </div>
            )}

            {/* Play overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent" />
            <button
              onClick={onPlay}
              className="absolute bottom-6 left-6 w-14 h-14 rounded-full gradient-bg flex items-center justify-center shadow-lg glow hover:scale-110 active:scale-95 transition-transform"
            >
              {isCurrentTrack && isPlaying ? (
                <Pause className="w-6 h-6 text-black" />
              ) : (
                <Play className="w-6 h-6 text-black ml-0.5" />
              )}
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">
                  {categoryLabels[track.category]}
                </span>
                <h2 className="text-2xl font-bold text-zinc-50 mt-1">{track.title}</h2>
                <p className="text-zinc-400 mt-1">
                  {track.artist}
                  {track.authors && <span className="text-zinc-500"> &middot; Original: {track.authors}</span>}
                </p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold gradient-text">{formatPrice(track.price)}</span>
              </div>
            </div>

            {/* Meta */}
            <div className="flex flex-wrap gap-4 mt-6 text-sm text-zinc-400">
              {track.bpm > 0 && (
                <span className="flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-yellow-400" />
                  {track.bpm} BPM
                </span>
              )}
              {track.duration > 0 && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-yellow-400" />
                  {formatDuration(track.duration)}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-yellow-400" />
                {new Date(track.releaseDate).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-1.5">
                <Music className="w-4 h-4 text-yellow-400" />
                {track.genre}
              </span>
            </div>

            {/* Description */}
            <p className="mt-6 text-zinc-400 leading-relaxed">{track.description}</p>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-4">
              {track.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-xl bg-zinc-800/50 text-xs text-zinc-500"
                >
                  #{tag}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-8">
              <button
                onClick={onPlay}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl border border-zinc-700 text-zinc-300 font-medium hover:border-yellow-400/40 hover:text-white transition-all"
              >
                {isCurrentTrack && isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                {isCurrentTrack && isPlaying ? 'Pausar Preview' : 'Escuchar Preview'}
              </button>

              <button
                onClick={onAddToCart}
                disabled={isInCart}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-semibold transition-all ${
                  isInCart
                    ? 'bg-green-500/20 text-green-400 cursor-default'
                    : 'gradient-bg text-black shadow-lg glow hover:scale-[1.02] active:scale-95'
                }`}
              >
                {isInCart ? (
                  <>
                    <Check className="w-5 h-5" />
                    En el carrito
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5" />
                    Añadir al Carrito — {formatPrice(track.price)}
                  </>
                )}
              </button>
            </div>

            {/* Info note */}
            <p className="mt-4 text-xs text-zinc-600 text-center">
              MP3 320kbps &middot; Descarga inmediata tras el pago &middot; Preview con marca de agua
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
