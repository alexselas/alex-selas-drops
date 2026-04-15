import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2, Music, Play, Pause, ShoppingCart, Star, Package, ChevronDown, ChevronUp, Search, ArrowUpDown, Sparkles } from 'lucide-react';
import type { Track, CollaboratorProfile, Section, Category, SortOption } from '../types';
import { formatPrice, formatDuration } from '../lib/utils';
import CategoryFilter from './CategoryFilter';
import TrackCard from './TrackCard';

interface CollabPageProps {
  collaboratorId: string;
  collaboratorName: string;
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  isInCart: (id: string) => boolean;
  onPlay: (track: Track) => void;
  onAddToCart: (track: Track) => void;
  onDetail: (track: Track) => void;
  onNavigate: (section: Section) => void;
}

const socialIcons: Record<string, { path: string; label: string }> = {
  instagram: { label: 'Instagram', path: 'M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 01-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 017.8 2zm-.2 2A3.6 3.6 0 004 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 003.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6zm9.65 1.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zM12 7a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6z' },
  tiktok: { label: 'TikTok', path: 'M16.6 5.82A4.28 4.28 0 0113.2 2h-3.4v13.4a2.59 2.59 0 01-2.6 2.6 2.59 2.59 0 01-2.6-2.6 2.59 2.59 0 012.6-2.6c.24 0 .48.03.7.1V9.6a6.1 6.1 0 00-.7-.04A6.15 6.15 0 001 15.7 6.15 6.15 0 007.2 21.9a6.15 6.15 0 006.2-6.2V9.3A7.8 7.8 0 0018 10.7V7.3a4.28 4.28 0 01-1.4-.48V5.82z' },
  spotify: { label: 'Spotify', path: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.6 14.4c-.2.3-.6.4-.9.2-2.5-1.5-5.7-1.9-9.4-1-.4.1-.7-.1-.8-.5-.1-.4.1-.7.5-.8 4.1-.9 7.6-.5 10.4 1.2.3.2.4.6.2.9zm1.2-2.7c-.2.4-.7.5-1.1.3-2.9-1.8-7.3-2.3-10.7-1.3-.4.1-.9-.1-1-.5-.1-.4.1-.9.5-1 3.9-1.2 8.7-.6 12 1.5.3.1.5.6.3 1zm.1-2.8c-3.5-2.1-9.2-2.3-12.5-1.3-.5.2-1.1-.1-1.2-.6-.2-.5.1-1.1.6-1.2 3.8-1.2 10.2-.9 14.2 1.4.5.3.6.9.3 1.4-.2.4-.8.6-1.4.3z' },
  youtube: { label: 'YouTube', path: 'M23.5 6.2c-.3-1-1-1.8-2-2.1C19.8 3.5 12 3.5 12 3.5s-7.8 0-9.5.6c-1 .3-1.8 1.1-2 2.1C0 7.9 0 12 0 12s0 4.1.5 5.8c.3 1 1 1.8 2 2.1 1.7.6 9.5.6 9.5.6s7.8 0 9.5-.6c1-.3 1.8-1.1 2-2.1.5-1.7.5-5.8.5-5.8s0-4.1-.5-5.8zM9.5 15.6V8.4l6.4 3.6-6.4 3.6z' },
  soundcloud: { label: 'SoundCloud', path: 'M1.2 14.4c-.1 0-.2-.1-.2-.2l-.3-2.2.3-2.3c0-.1.1-.2.2-.2s.2.1.2.2l.4 2.3-.4 2.2c0 .1-.1.2-.2.2zm2-1c-.1 0-.2-.1-.2-.2l-.3-3.2.3-3.3c0-.1.1-.2.2-.2s.2.1.2.2l.4 3.3-.4 3.2c0 .1-.1.2-.2.2zm2.1.1c-.1 0-.2-.1-.3-.3L4.7 10l.3-4.2c0-.2.1-.3.3-.3.1 0 .2.1.3.3l.3 4.2-.3 3.2c0 .2-.1.3-.3.3z' },
};

export default function CollabPage({
  collaboratorId,
  collaboratorName,
  tracks,
  currentTrackId,
  isPlaying,
  isInCart,
  onPlay,
  onAddToCart,
  onDetail,
  onNavigate,
}: CollabPageProps) {
  const [profile, setProfile] = useState<CollaboratorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const myTracks = tracks.filter(t => t.collaboratorId === collaboratorId);
  const featuredTracks = myTracks.filter(t => t.featured);

  useEffect(() => {
    fetch(`/api/collab-profile?id=${collaboratorId}`)
      .then(r => r.json())
      .then(data => { if (data) setProfile(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [collaboratorId]);

  const c1 = '#FACC15';
  const c2 = '#EAB308';
  const name = profile?.artistName || collaboratorName;
  const hasSocials = profile?.socialLinks && Object.values(profile.socialLinks).some(v => v);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: c1 }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* ====== FULL PAGE BACKGROUND ====== */}
      {profile?.bannerUrl ? (
        <div className="fixed inset-0 z-0">
          <img src={profile.bannerUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${c1}60 0%, ${c2}40 30%, rgba(9,9,11,0.85) 60%, rgba(9,9,11,1) 80%)` }} />
        </div>
      ) : (
        <div className="fixed inset-0 z-0" style={{ background: `linear-gradient(to bottom, ${c1} 0%, ${c2} 30%, #09090b 70%)` }} />
      )}

      {/* ====== HEADER AREA ====== */}
      <div className="relative z-10">
        {/* Back */}
        <button
          onClick={() => onNavigate('colabs')}
          className="fixed top-20 left-5 z-20 flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors bg-black/40 backdrop-blur-md px-3.5 py-2 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        {/* Hero content */}
        <div className="max-w-7xl mx-auto px-6 pt-32 pb-10 sm:pt-40 sm:pb-14 flex flex-col items-center text-center">
          {/* Name */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-6xl sm:text-8xl lg:text-9xl font-black text-white uppercase leading-[0.85] mb-5"
            style={{
              letterSpacing: '0.08em',
              textShadow: `0 2px 40px rgba(0,0,0,0.5), 0 0 120px ${c1}30`,
            }}
          >
            {name}
          </motion.h1>

          {/* Bio */}
          {profile?.bio && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-white/70 text-sm sm:text-base max-w-lg mx-auto leading-relaxed mb-6 text-center text-justify break-words"
            >
              {profile.bio}
            </motion.p>
          )}

          {/* Socials */}
          {hasSocials && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-2.5 mb-5"
            >
              {Object.entries(profile!.socialLinks).map(([key, url]) => {
                if (!url) return null;
                const icon = socialIcons[key];
                if (!icon) return null;
                return (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-110"
                    style={{ backgroundColor: `${c1}30`, border: `1.5px solid ${c1}50` }}
                    title={icon.label}
                  >
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d={icon.path} />
                    </svg>
                  </a>
                );
              })}
            </motion.div>
          )}

          {/* Divider line */}
          <div className="w-16 h-0.5 rounded-full mb-5" style={{ background: `linear-gradient(90deg, ${c1}, ${c2})` }} />

          {/* Track count */}
          <span className="text-sm font-bold text-white/50 uppercase tracking-widest">
            {myTracks.length} {myTracks.length === 1 ? 'Track' : 'Tracks'}
          </span>
        </div>
      </div>

      {/* ====== CONTENT — fade from hero to black ====== */}
      <div className="relative z-10">
      <div className="h-32 bg-gradient-to-b from-transparent to-zinc-950" />
      <div className="bg-zinc-950">
      <CollabContent
        myTracks={myTracks}
        featuredTracks={featuredTracks}
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
        isInCart={isInCart}
        onPlay={onPlay}
        onAddToCart={onAddToCart}
        onDetail={onDetail}
      />
      </div>
      </div>
    </div>
  );
}

/* ====== CONTENT SECTION — replicates Home layout ====== */
function CollabContent({ myTracks, featuredTracks, currentTrackId, isPlaying, isInCart, onPlay, onAddToCart, onDetail }: {
  myTracks: Track[];
  featuredTracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  isInCart: (id: string) => boolean;
  onPlay: (track: Track) => void;
  onAddToCart: (track: Track) => void;
  onDetail: (track: Track) => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all' | 'packs'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [expandedPackId, setExpandedPackId] = useState<string | null>(null);

  const filteredTracks = useMemo(() => {
    let result = [...myTracks];
    if (categoryFilter === 'packs') {
      result = result.filter(t => !!t.packId);
    } else if (categoryFilter !== 'all') {
      result = result.filter(t => t.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q) || t.tags.some(tag => tag.toLowerCase().includes(q)));
    }
    switch (sort) {
      case 'newest': result.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()); break;
      case 'oldest': result.sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()); break;
      case 'price-asc': result.sort((a, b) => a.price - b.price); break;
      case 'price-desc': result.sort((a, b) => b.price - a.price); break;
      case 'title': result.sort((a, b) => a.title.localeCompare(b.title)); break;
    }
    return result;
  }, [myTracks, categoryFilter, search, sort]);

  // Build display items: standalone + grouped packs
  const displayItems = useMemo(() => {
    type DisplayItem = { type: 'track'; track: Track } | { type: 'pack'; packId: string; packName: string; tracks: Track[]; coverUrl: string; price: number; artist: string; genre: string; category: string };
    const seenPacks = new Set<string>();
    const items: DisplayItem[] = [];
    for (const track of filteredTracks) {
      if (track.packId) {
        if (seenPacks.has(track.packId)) continue;
        seenPacks.add(track.packId);
        const packTracks = filteredTracks.filter(t => t.packId === track.packId);
        items.push({ type: 'pack', packId: track.packId, packName: track.packName || 'Pack', tracks: packTracks, coverUrl: track.coverUrl, price: packTracks.reduce((s, t) => s + t.price, 0), artist: track.artist, genre: track.genre, category: track.category });
      } else {
        items.push({ type: 'track', track });
      }
    }
    return items;
  }, [filteredTracks]);

  if (myTracks.length === 0) {
    return (
      <div className="relative z-10 max-w-7xl mx-auto px-4 py-10 pb-28">
        <div className="text-center py-20 bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-zinc-800/50">
          <Music className="w-14 h-14 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-400 text-lg font-medium">Próximamente</p>
          <p className="text-zinc-600 text-sm mt-1">Este artista aún no ha publicado tracks</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ====== FEATURED ====== */}
      {featuredTracks.length > 0 && (() => {
        // Group packs in featured — show packName not individual track title
        type FeatItem = { type: 'track'; track: Track } | { type: 'pack'; packId: string; packName: string; tracks: Track[]; coverUrl: string; price: number; artist: string; genre: string; category: string };
        const seenPacks = new Set<string>();
        const featItems: FeatItem[] = [];
        for (const track of featuredTracks) {
          if (track.packId) {
            if (seenPacks.has(track.packId)) continue;
            seenPacks.add(track.packId);
            const packTracks = myTracks.filter(t => t.packId === track.packId);
            featItems.push({ type: 'pack', packId: track.packId, packName: track.packName || 'Pack', tracks: packTracks, coverUrl: track.coverUrl, price: packTracks.reduce((s, t) => s + t.price, 0), artist: track.artist, genre: track.genre, category: track.category });
          } else {
            featItems.push({ type: 'track', track });
          }
        }
        return (
        <section className="relative z-10 py-8">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="w-6 h-6 text-yellow-400" />
              <h2 className="text-3xl font-bold text-zinc-50">Destacados</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {featItems.map(item => {
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
                    className="group relative bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 overflow-hidden hover:border-yellow-400/20 flex flex-col cursor-pointer"
                    onClick={() => item.tracks[0] && onDetail(item.tracks[0])}
                  >
                    <div className="relative aspect-square bg-[#111] overflow-hidden flex-shrink-0">
                      {item.coverUrl ? (
                        <img src={item.coverUrl} alt={item.packName} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1e1e1e] to-[#141414]">
                          <Package className="w-12 h-12 text-zinc-800" />
                        </div>
                      )}
                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg text-[10px] font-semibold backdrop-blur-sm bg-yellow-400/20 text-yellow-400">PACK</span>
                    </div>
                    <div className="p-3 flex flex-col flex-1">
                      <h3 className="font-semibold text-sm text-zinc-50 truncate group-hover:text-yellow-400 transition-colors">{item.packName}</h3>
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">{item.artist} &middot; {item.tracks.length} tracks</p>
                      <div className="flex items-center justify-between mt-auto pt-2.5">
                        <span className="text-base font-bold gradient-text">{formatPrice(item.price)}</span>
                        <button
                          onClick={e => { e.stopPropagation(); item.tracks.forEach(t => onAddToCart(t)); }}
                          disabled={item.tracks.every(t => isInCart(t.id))}
                          className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                            item.tracks.every(t => isInCart(t.id)) ? 'bg-green-500/20 text-green-400 cursor-default' : 'bg-zinc-800 text-zinc-300 hover:gradient-bg hover:text-black active:scale-95'
                          }`}
                        >
                          {item.tracks.every(t => isInCart(t.id)) ? 'Añadido' : 'Añadir'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
        );
      })()}

      {/* ====== ALL TRACKS ====== */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-28">
        {/* Promo banner */}
        <div className="relative overflow-hidden rounded-2xl mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500" />
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px)' }} />
          <div className="relative px-6 py-5 sm:py-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
            <div className="text-center sm:text-left">
              <p className="text-black/90 font-bold text-lg sm:text-xl">Descuento en tu primera compra</p>
              <p className="text-black/60 text-sm mt-0.5">Introduce este código en el carrito</p>
            </div>
            <span className="px-5 py-2.5 bg-black text-yellow-400 font-black text-xl sm:text-2xl tracking-widest rounded-xl shadow-lg">WELCOME20</span>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-zinc-50 mb-6">Todos los tracks</h2>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
          <CategoryFilter selected={categoryFilter} onSelect={v => setCategoryFilter(v)} />
          <div className="flex items-center gap-3 sm:ml-auto w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full sm:w-56 pl-10 pr-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-500 text-sm focus:outline-none focus:border-yellow-400/50 transition-colors"
              />
            </div>
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortOption)}
                className="pl-10 pr-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-yellow-400/50 transition-colors appearance-none cursor-pointer"
              >
                <option value="newest">Más recientes</option>
                <option value="oldest">Más antiguos</option>
                <option value="price-asc">Precio: menor</option>
                <option value="price-desc">Precio: mayor</option>
                <option value="title">A-Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Track + Pack list */}
        <div className="space-y-2">
          {displayItems.map(item => {
            if (item.type === 'track') {
              const track = item.track;
              const isCurrentTrack = currentTrackId === track.id;
              return (
                <div
                  key={track.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[#1a1a1a] border border-zinc-800/50 hover:border-yellow-400/20 transition-colors cursor-pointer"
                  onClick={() => onDetail(track)}
                >
                  <button
                    onClick={e => { e.stopPropagation(); onPlay(track); }}
                    className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-800 hover:gradient-bg flex items-center justify-center transition-all group/play"
                  >
                    {isCurrentTrack && isPlaying ? (
                      <Pause className="w-4 h-4 text-yellow-400 group-hover/play:text-black" />
                    ) : (
                      <Play className="w-4 h-4 text-zinc-400 group-hover/play:text-black ml-0.5" />
                    )}
                  </button>
                  {track.coverUrl ? (
                    <img src={track.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                      <Music className="w-4 h-4 text-zinc-700" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-100 truncate">{track.title}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      {track.authors ? `${track.authors} · ` : ''}{track.genre}{track.bpm > 0 ? ` · ${track.bpm} BPM` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-bold gradient-text flex-shrink-0 hidden sm:block">{formatPrice(track.price)}</span>
                  <button
                    onClick={e => { e.stopPropagation(); onAddToCart(track); }}
                    disabled={isInCart(track.id)}
                    className={`flex-shrink-0 p-2 rounded-lg transition-all ${isInCart(track.id) ? 'text-green-400' : 'text-zinc-500 hover:text-yellow-400 hover:bg-yellow-400/10'}`}
                  >
                    <ShoppingCart className="w-4 h-4" />
                  </button>
                </div>
              );
            }

            // PACK
            return (
              <PackRow
                key={item.packId}
                item={item}
                expanded={expandedPackId === item.packId}
                onToggle={() => setExpandedPackId(expandedPackId === item.packId ? null : item.packId)}
                currentTrackId={currentTrackId}
                isPlaying={isPlaying}
                isInCart={isInCart}
                onPlay={onPlay}
                onAddToCart={onAddToCart}
              />
            );
          })}

          {displayItems.length === 0 && (
            <div className="text-center py-16">
              <Music className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500">No se encontraron tracks</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* Pack row sub-component — matches Home style */
function PackRow({ item, expanded, onToggle, currentTrackId, isPlaying, isInCart, onPlay, onAddToCart }: {
  item: { packId: string; packName: string; tracks: Track[]; coverUrl: string; price: number; artist: string; genre: string };
  expanded: boolean;
  onToggle: () => void;
  currentTrackId: string | null;
  isPlaying: boolean;
  isInCart: (id: string) => boolean;
  onPlay: (track: Track) => void;
  onAddToCart: (track: Track) => void;
}) {
  return (
    <div className="rounded-xl overflow-hidden">
      <div
        className={`flex items-center gap-3 p-3 bg-[#1a1a1a] border border-zinc-800/50 hover:border-yellow-400/20 transition-colors cursor-pointer ${expanded ? 'rounded-t-xl border-b-0' : 'rounded-xl'}`}
        onClick={onToggle}
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400/20 to-amber-500/20 flex items-center justify-center">
          <Package className="w-5 h-5 text-yellow-400" />
        </div>
        {item.coverUrl ? (
          <img src={item.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
            <Music className="w-4 h-4 text-zinc-700" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-zinc-100 truncate">{item.packName}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-400/10 text-yellow-400 font-bold flex-shrink-0">PACK</span>
          </div>
          <p className="text-xs text-zinc-500 truncate">
            {item.artist} · {item.tracks.length} tracks · {item.genre}
          </p>
        </div>
        <span className="text-sm font-bold gradient-text flex-shrink-0 hidden sm:block">{formatPrice(item.price)}</span>
        <button
          onClick={e => { e.stopPropagation(); item.tracks.forEach(t => onAddToCart(t)); }}
          disabled={item.tracks.every(t => isInCart(t.id))}
          className={`flex-shrink-0 p-2 rounded-lg transition-all ${
            item.tracks.every(t => isInCart(t.id)) ? 'text-green-400' : 'text-zinc-500 hover:text-yellow-400 hover:bg-yellow-400/10'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
        </button>
        {expanded ? <ChevronUp className="w-4 h-4 text-zinc-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="bg-[#111] border border-zinc-800/50 border-t-0 rounded-b-xl divide-y divide-zinc-800/30 max-h-[400px] overflow-y-auto">
          {item.tracks.map((track, idx) => {
            const isCurrent = currentTrackId === track.id;
            return (
              <div key={track.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/30 transition-colors">
                <span className="text-[11px] text-zinc-600 font-bold w-5 text-center flex-shrink-0">{idx + 1}</span>
                <button
                  onClick={() => onPlay(track)}
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 hover:gradient-bg flex items-center justify-center transition-all group/play"
                >
                  {isCurrent && isPlaying ? (
                    <Pause className="w-3.5 h-3.5 text-yellow-400 group-hover/play:text-black" />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-zinc-400 group-hover/play:text-black ml-0.5" />
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
      )}
    </div>
  );
}
