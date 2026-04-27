import { useState } from 'react';
import { Sparkles, Package, Play, Pause, ShoppingCart, Check, X, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Track } from '../types';
import TrackCard from './TrackCard';
import { formatPrice, formatDuration } from '../lib/utils';

interface FeaturedTracksProps {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  isInCart: (id: string) => boolean;
  onPlay: (track: Track) => void;
  onAddToCart: (track: Track) => void;
  onDetail: (track: Track) => void;
}

export default function FeaturedTracks({
  tracks,
  currentTrackId,
  isPlaying,
  isInCart,
  onPlay,
  onAddToCart,
  onDetail,
}: FeaturedTracksProps) {
  const [openPackId, setOpenPackId] = useState<string | null>(null);

  const featured = tracks.filter(t => t.featured && !t.collaboratorId);

  // Build display items: standalone tracks + 1 entry per pack
  type DisplayItem = { type: 'track'; track: Track } | { type: 'pack'; packId: string; packName: string; tracks: Track[]; coverUrl: string; price: number; artist: string; genre: string; category: string };
  const seenPacks = new Set<string>();
  const items: DisplayItem[] = [];
  for (const track of featured) {
    if (track.packId) {
      if (seenPacks.has(track.packId)) continue;
      seenPacks.add(track.packId);
      const packTracks = tracks.filter(t => t.packId === track.packId);
      items.push({
        type: 'pack',
        packId: track.packId,
        packName: track.packName || 'Pack',
        tracks: packTracks,
        coverUrl: track.coverUrl,
        price: packTracks.reduce((s, t) => s + t.price, 0),
        artist: track.artist,
        genre: track.genre,
        category: track.category,
      });
    } else {
      items.push({ type: 'track', track });
    }
  }

  const openPack = items.find(i => i.type === 'pack' && i.packId === openPackId) as (DisplayItem & { type: 'pack' }) | undefined;

  return (
    <section id="featured" className="py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="w-6 h-6 text-yellow-400" />
          <h2 className="text-3xl font-bold text-zinc-50">Destacados</h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map(item => {
            if (item.type === 'track') {
              return (
                <TrackCard
                  key={item.track.id}
                  track={item.track}
                  isPlaying={isPlaying}
                  isCurrentTrack={currentTrackId === item.track.id}
                  isInCart={isInCart(item.track.id)}
                  onPlay={() => onPlay(item.track)}
                  onAddToCart={() => onAddToCart(item.track)}
                  onDetail={() => onDetail(item.track)}
                />
              );
            }

            // Pack card
            return (
              <motion.div
                key={item.packId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 overflow-hidden card-hover hover:border-yellow-400/20 flex flex-col cursor-pointer"
                onClick={() => setOpenPackId(item.packId)}
              >
                {/* Cover */}
                <div className="relative aspect-square bg-[#111] overflow-hidden flex-shrink-0">
                  {item.coverUrl ? (
                    <img src={item.coverUrl} alt={item.packName} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1e1e1e] to-[#141414]">
                      <Package className="w-12 h-12 text-zinc-800" />
                    </div>
                  )}
                  <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg text-[10px] font-semibold backdrop-blur-sm bg-blue-400/20 text-blue-400">
                    PACK
                  </span>
                </div>

                {/* Info */}
                <div className="p-3 flex flex-col flex-1">
                  <h3 className="font-semibold text-sm text-zinc-50 truncate group-hover:text-yellow-400 transition-colors">
                    {item.packName}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">
                    {item.artist} &middot; {item.tracks.length} tracks
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-2.5">
                    <span className="text-base font-bold gradient-text">{formatPrice(item.price)}</span>
                    <button
                      onClick={e => { e.stopPropagation(); item.tracks.forEach(t => onAddToCart(t)); }}
                      disabled={item.tracks.every(t => isInCart(t.id))}
                      className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                        item.tracks.every(t => isInCart(t.id))
                          ? 'bg-green-500/20 text-green-400 cursor-default'
                          : 'bg-zinc-800 text-zinc-300 hover:gradient-bg hover:text-black active:scale-95'
                      }`}
                    >
                      {item.tracks.every(t => isInCart(t.id)) ? (
                        <><Check className="w-3 h-3" /> Añadido</>
                      ) : (
                        <><ShoppingCart className="w-3 h-3" /> Añadir</>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Pack detail modal */}
      <AnimatePresence>
        {openPack && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4"
            onClick={() => setOpenPackId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-[#141414] border border-zinc-800 rounded-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center gap-4 p-5 border-b border-zinc-800/50">
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-zinc-900">
                  {openPack.coverUrl ? (
                    <img src={openPack.coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-zinc-700" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-zinc-100 truncate">{openPack.packName}</h3>
                  <p className="text-xs text-zinc-500">{openPack.artist} · {openPack.tracks.length} tracks · {openPack.genre}</p>
                  <p className="text-sm font-bold text-yellow-400 mt-1">{formatPrice(openPack.price)}</p>
                </div>
                <button onClick={() => setOpenPackId(null)} className="p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Track list */}
              <div className="max-h-[400px] overflow-y-auto divide-y divide-zinc-800/30">
                {openPack.tracks.map((track, idx) => {
                  const isCurrent = currentTrackId === track.id;
                  return (
                    <div key={track.id} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-800/30 transition-colors">
                      <span className="text-[11px] text-zinc-600 font-bold w-5 text-center flex-shrink-0">{idx + 1}</span>
                      <button
                        onClick={() => onPlay(track)}
                        className="flex-shrink-0 w-9 h-9 rounded-full bg-zinc-800 hover:gradient-bg flex items-center justify-center transition-all group/play"
                      >
                        {isCurrent && isPlaying ? (
                          <Pause className="w-4 h-4 text-yellow-400 group-hover/play:text-black" />
                        ) : (
                          <Play className="w-4 h-4 text-zinc-400 group-hover/play:text-black ml-0.5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-200 truncate">{track.title}</p>
                        <p className="text-[11px] text-zinc-600">
                          {track.bpm > 0 ? `${track.bpm} BPM` : ''}{track.key ? ` · ${track.key}` : ''}{track.duration > 0 ? ` · ${formatDuration(track.duration)}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-zinc-800/50">
                <button
                  onClick={() => { openPack.tracks.forEach(t => onAddToCart(t)); setOpenPackId(null); }}
                  disabled={openPack.tracks.every(t => isInCart(t.id))}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                    openPack.tracks.every(t => isInCart(t.id))
                      ? 'bg-green-500/20 text-green-400'
                      : 'gradient-bg text-black hover:scale-[1.02] active:scale-95 shadow-lg'
                  }`}
                >
                  {openPack.tracks.every(t => isInCart(t.id)) ? 'Ya está en el carrito' : `Añadir pack al carrito — ${formatPrice(openPack.price)}`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
