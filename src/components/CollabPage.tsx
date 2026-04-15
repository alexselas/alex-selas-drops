import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2, Music, Play, Pause, ShoppingCart, Star } from 'lucide-react';
import type { Track, CollaboratorProfile, Section } from '../types';
import { formatPrice } from '../lib/utils';

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
        <div className="max-w-5xl mx-auto px-6 pt-32 pb-10 sm:pt-40 sm:pb-14 flex flex-col items-center text-center">
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

      {/* ====== FEATURED — same style as Home ====== */}
      {featuredTracks.length > 0 && (
        <div className="relative z-10 max-w-5xl mx-auto px-4 pt-8 pb-2">
          <h2 className="text-lg font-bold text-zinc-200 mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            Destacados
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredTracks.map(track => {
              const isCurrentTrack = currentTrackId === track.id;
              return (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group relative bg-[#1a1a1a] rounded-2xl border border-zinc-800/50 overflow-hidden hover:border-yellow-400/20 flex flex-col"
                >
                  {/* Cover */}
                  <div className="relative aspect-square bg-[#111] cursor-pointer overflow-hidden flex-shrink-0" onClick={() => onDetail(track)}>
                    {track.coverUrl ? (
                      <img src={track.coverUrl} alt={track.title} className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1e1e1e] to-[#141414]">
                        <Music className="w-12 h-12 text-zinc-800" />
                      </div>
                    )}
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={e => { e.stopPropagation(); onPlay(track); }}
                        className="w-12 h-12 rounded-full gradient-bg flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform"
                      >
                        {isCurrentTrack && isPlaying ? <Pause className="w-5 h-5 text-black" /> : <Play className="w-5 h-5 text-black ml-0.5" />}
                      </button>
                    </div>
                    {/* Playing indicator */}
                    {isCurrentTrack && isPlaying && (
                      <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-black/70 text-yellow-400 text-[10px] font-medium">
                        Reproduciendo
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-3 flex flex-col flex-1">
                    <h3 className="font-semibold text-sm text-zinc-50 truncate group-hover:text-yellow-400 transition-colors">{track.title}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">
                      {track.authors ? <><span className="text-zinc-400">{track.authors}</span> &middot; </> : null}
                      {track.genre}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-500">
                      {track.bpm > 0 && <span>{track.bpm} BPM</span>}
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-2.5">
                      <span className="text-base font-bold gradient-text">{formatPrice(track.price)}</span>
                      <button
                        onClick={() => onAddToCart(track)}
                        disabled={isInCart(track.id)}
                        className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                          isInCart(track.id)
                            ? 'bg-green-500/20 text-green-400 cursor-default'
                            : 'bg-zinc-800 text-zinc-300 hover:gradient-bg hover:text-black active:scale-95'
                        }`}
                      >
                        {isInCart(track.id) ? 'Añadido' : 'Añadir'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ====== ALL TRACKS ====== */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-6 pb-28">
        {myTracks.length === 0 ? (
          <div className="text-center py-20 bg-zinc-900/80 backdrop-blur-sm rounded-2xl border border-zinc-800/50">
            <Music className="w-14 h-14 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-400 text-lg font-medium">Próximamente</p>
            <p className="text-zinc-600 text-sm mt-1">Este artista aún no ha publicado tracks</p>
          </div>
        ) : (
          <div className="space-y-2">
            {myTracks.map((track, i) => {
              const isCurrentTrack = currentTrackId === track.id;
              return (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer group backdrop-blur-sm"
                  style={{
                    backgroundColor: isCurrentTrack ? `${c1}15` : 'rgba(20,20,20,0.85)',
                    borderColor: isCurrentTrack ? `${c1}30` : 'rgba(39,39,42,0.5)',
                  }}
                  onClick={() => onDetail(track)}
                >
                  {/* Play */}
                  <button
                    onClick={e => { e.stopPropagation(); onPlay(track); }}
                    className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all"
                    style={{
                      backgroundColor: isCurrentTrack && isPlaying ? `${c1}20` : 'rgba(63,63,70,0.4)',
                      border: isCurrentTrack ? `1.5px solid ${c1}40` : '1.5px solid transparent',
                    }}
                  >
                    {isCurrentTrack && isPlaying ? (
                      <Pause className="w-4 h-4" style={{ color: c1 }} />
                    ) : (
                      <Play className="w-4 h-4 text-zinc-400 ml-0.5 group-hover:text-white transition-colors" />
                    )}
                  </button>

                  {/* Cover */}
                  {track.coverUrl ? (
                    <img src={track.coverUrl} alt="" className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                      <Music className="w-4 h-4 text-zinc-600" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-100 truncate group-hover:text-white transition-colors">{track.title}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      {track.authors ? `${track.authors} · ` : ''}{track.genre}{track.bpm > 0 ? ` · ${track.bpm} BPM` : ''}
                    </p>
                  </div>

                  {/* Price */}
                  <span className="text-sm font-bold flex-shrink-0 hidden sm:block" style={{ color: c1 }}>
                    {formatPrice(track.price)}
                  </span>

                  {/* Cart */}
                  <button
                    onClick={e => { e.stopPropagation(); onAddToCart(track); }}
                    disabled={isInCart(track.id)}
                    className="flex-shrink-0 p-2.5 rounded-xl transition-all"
                    style={isInCart(track.id) ? { color: '#4ade80' } : { color: `${c1}90` }}
                  >
                    <ShoppingCart className="w-4 h-4" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
