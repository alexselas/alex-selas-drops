import { useState, useMemo, useCallback, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import type { Track, Category, SortOption, Section } from './types';
import { demoTracks } from './data/tracks';
import { useCart } from './hooks/useCart';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useAdmin } from './hooks/useAdmin';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import FeaturedTracks from './components/FeaturedTracks';
import CategoryFilter from './components/CategoryFilter';
import TrackCard from './components/TrackCard';
import TrackDetail from './components/TrackDetail';
import AudioPlayer from './components/AudioPlayer';
import CartDrawer from './components/CartDrawer';
import CheckoutPanel from './components/CheckoutPanel';
import AdminLogin from './components/AdminLogin';
import AdminPanel from './components/AdminPanel';
import Footer from './components/Footer';
import { Search, ArrowUpDown, LayoutGrid, List, Music, ShoppingCart, Play, Pause } from 'lucide-react';
import { formatPrice } from './lib/utils';

function getInitialSection(): Section {
  const path = window.location.pathname;
  if (path === '/admin') return 'admin';
  return 'home';
}

export default function App() {
  // State
  const [section, setSection] = useState<Section>(getInitialSection);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [showCheckout, setShowCheckout] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('payment');
  });

  // Catalog filters
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [discount, setDiscount] = useState(0);

  // Hooks
  const cart = useCart();
  const player = useAudioPlayer();
  const admin = useAdmin();

  // Load tracks from API + handle /track/:id URLs
  useEffect(() => {
    fetch('/api/tracks')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTracks(data);
          // Check if URL points to a specific track (e.g. /track/track-001)
          const match = window.location.pathname.match(/^\/track\/(.+)$/);
          if (match) {
            const found = data.find((t: Track) => t.id === match[1]);
            if (found) {
              setSelectedTrack(found);
              setSection('catalog');
            }
          }
        } else {
          setTracks(demoTracks);
        }
      })
      .catch(() => setTracks(demoTracks))
      .finally(() => setLoading(false));
  }, []);

  // Navigate
  const navigate = useCallback((s: Section) => {
    setSection(s);
    setShowCheckout(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Filtered tracks for catalog (exclude collaborator tracks)
  const filteredTracks = useMemo(() => {
    let result = tracks.filter(t => !t.collaborator);

    // Category
    if (categoryFilter !== 'all') {
      result = result.filter(t => t.category === categoryFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        t =>
          t.title.toLowerCase().includes(q) ||
          t.genre.toLowerCase().includes(q) ||
          t.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }

    // Sort
    switch (sort) {
      case 'newest':
        result.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime());
        break;
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'title':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return result;
  }, [tracks, categoryFilter, search, sort]);

  // Track CRUD (admin) — syncs with server
  const handleAddTrack = useCallback(async (data: Omit<Track, 'id'> & { id?: string }) => {
    try {
      const res = await fetch('/api/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const newTrack = await res.json();
      setTracks(prev => [...prev, newTrack]);
    } catch {
      // Fallback local
      const newTrack = { ...data, id: data.id || `track-${Date.now()}` } as Track;
      setTracks(prev => [...prev, newTrack]);
    }
  }, []);

  const handleUpdateTrack = useCallback(async (data: Omit<Track, 'id'> & { id?: string }) => {
    if (!data.id) return;
    try {
      await fetch('/api/tracks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch {}
    setTracks(prev => prev.map(t => (t.id === data.id ? { ...t, ...data } as Track : t)));
  }, []);

  const handleDeleteTrack = useCallback(async (id: string) => {
    try {
      await fetch(`/api/tracks?id=${id}`, { method: 'DELETE' });
    } catch {}
    setTracks(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleReorderTracks = useCallback(async (reordered: Track[]) => {
    setTracks(reordered);
    try {
      await fetch('/api/tracks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reordered),
      });
    } catch {}
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      {/* Navbar */}
      <Navbar
        currentSection={section}
        onNavigate={navigate}
        cartCount={cart.count}
        onCartOpen={() => cart.setIsOpen(true)}
      />

      {/* Main content */}
      <main className="pt-16">
        {/* ============ HOME ============ */}
        {section === 'home' && !showCheckout && (
          <>
            <Hero onNavigate={navigate} />
            <FeaturedTracks
              tracks={tracks}
              currentTrackId={player.currentTrack?.id || null}
              isPlaying={player.isPlaying}
              isInCart={cart.isInCart}
              onPlay={track => player.play(track)}
              onAddToCart={track => cart.addItem(track)}
              onDetail={track => {
                setSelectedTrack(track);
                window.history.pushState({}, '', `/track/${track.id}`);
              }}
            />
            <Footer />
          </>
        )}

        {/* ============ CATALOG ============ */}
        {section === 'catalog' && !showCheckout && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            {/* Promo banner */}
            <div className="bg-gradient-to-r from-yellow-400/10 via-amber-400/10 to-yellow-400/10 border border-yellow-400/20 rounded-2xl px-4 py-3 mb-6 text-center">
              <p className="text-xs sm:text-sm text-yellow-400 font-medium">
                Usa el código <span className="font-bold bg-yellow-400/20 px-1.5 py-0.5 rounded">WELCOME20</span> y obtén un descuento en tu primera compra
              </p>
            </div>

            <h1 className="text-3xl font-bold text-zinc-50 mb-8">Catálogo</h1>

            {/* Filters bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
              <CategoryFilter selected={categoryFilter} onSelect={setCategoryFilter} />

              <div className="flex items-center gap-3 sm:ml-auto w-full sm:w-auto">
                {/* Search */}
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

                {/* Sort */}
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

                {/* View toggle */}
                <div className="flex items-center bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-yellow-400/10 text-yellow-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-yellow-400/10 text-yellow-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Tracks */}
            {filteredTracks.length > 0 ? (
              viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredTracks.map(track => (
                    <TrackCard
                      key={track.id}
                      track={track}
                      isPlaying={player.isPlaying}
                      isCurrentTrack={player.currentTrack?.id === track.id}
                      isInCart={cart.isInCart(track.id)}
                      onPlay={() => player.play(track)}
                      onAddToCart={() => cart.addItem(track)}
                      onDetail={() => {
                        setSelectedTrack(track);
                        window.history.pushState({}, '', `/track/${track.id}`);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTracks.map(track => {
                    const isCurrentTrack = player.currentTrack?.id === track.id;
                    return (
                      <div
                        key={track.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-[#1a1a1a] border border-zinc-800/50 hover:border-yellow-400/20 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedTrack(track);
                          window.history.pushState({}, '', `/track/${track.id}`);
                        }}
                      >
                        {/* Play button */}
                        <button
                          onClick={e => { e.stopPropagation(); player.play(track); }}
                          className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-800 hover:gradient-bg flex items-center justify-center transition-all group/play"
                        >
                          {isCurrentTrack && player.isPlaying ? (
                            <Pause className="w-4 h-4 text-yellow-400 group-hover/play:text-black" />
                          ) : (
                            <Play className="w-4 h-4 text-zinc-400 group-hover/play:text-black ml-0.5" />
                          )}
                        </button>
                        {/* Cover */}
                        {track.coverUrl ? (
                          <img src={track.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                            <Music className="w-4 h-4 text-zinc-700" />
                          </div>
                        )}
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-100 truncate">{track.title}</p>
                          <p className="text-xs text-zinc-500 truncate">
                            {track.authors ? `${track.authors} · ` : ''}{track.genre}{track.bpm > 0 ? ` · ${track.bpm} BPM` : ''}
                          </p>
                        </div>
                        <span className="text-sm font-bold gradient-text flex-shrink-0 hidden sm:block">{formatPrice(track.price)}</span>
                        <button
                          onClick={e => { e.stopPropagation(); cart.addItem(track); }}
                          disabled={cart.isInCart(track.id)}
                          className={`flex-shrink-0 p-2 rounded-lg transition-all ${
                            cart.isInCart(track.id) ? 'text-green-400' : 'text-zinc-500 hover:text-yellow-400 hover:bg-yellow-400/10'
                          }`}
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="text-center py-20">
                <p className="text-zinc-500 text-lg">No se encontraron tracks</p>
                <p className="text-zinc-600 text-sm mt-1">Prueba con otros filtros o búsqueda</p>
              </div>
            )}

            <div className="mt-16">
              <Footer />
            </div>
          </div>
        )}

        {/* ============ COLABORADORES ============ */}
        {section === 'colabs' && !showCheckout && (() => {
          const colabTracks = tracks.filter(t => t.collaborator);
          return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
              <h1 className="text-3xl font-bold text-zinc-50 mb-3">Colaboradores</h1>
              <p className="text-zinc-500 mb-8">Tracks de artistas que colaboran con Alex Selas</p>

              {colabTracks.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-16">
                  {colabTracks.map(track => (
                    <TrackCard
                      key={track.id}
                      track={track}
                      isPlaying={player.isPlaying}
                      isCurrentTrack={player.currentTrack?.id === track.id}
                      isInCart={cart.isInCart(track.id)}
                      onPlay={() => player.play(track)}
                      onAddToCart={() => cart.addItem(track)}
                      onDetail={() => {
                        setSelectedTrack(track);
                        window.history.pushState({}, '', `/track/${track.id}`);
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Contact CTA */}
              <div className="bg-[#141414] rounded-[22px] border border-zinc-800/50 p-8 sm:p-12 text-center">
                <h2 className="text-2xl font-bold text-zinc-50 mb-3">¿Quieres colaborar?</h2>
                <p className="text-zinc-500 mb-6 max-w-md mx-auto">
                  Si eres DJ o productor y quieres vender tus tracks en Alex Selas Drops, escríbenos con tu propuesta.
                </p>
                <a
                  href="https://www.instagram.com/alexselas"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl gradient-bg text-black font-bold text-lg shadow-lg glow hover:scale-105 active:scale-95 transition-transform"
                >
                  Contactar por Instagram
                </a>
              </div>

              <div className="mt-16">
                <Footer />
              </div>
            </div>
          );
        })()}

        {/* ============ CHECKOUT ============ */}
        {showCheckout && (
          <CheckoutPanel
            items={cart.items}
            total={cart.total}
            discount={discount}
            onBack={() => setShowCheckout(false)}
            onClearCart={cart.clearCart}
            onComplete={() => {
              setDiscount(0);
              setShowCheckout(false);
              navigate('home');
            }}
          />
        )}

        {/* ============ ADMIN ============ */}
        {section === 'admin' && !showCheckout && (
          <>
            {!admin.isAuthenticated ? (
              <AdminLogin onLogin={admin.login} />
            ) : (
              <AdminPanel
                tracks={tracks}
                onAddTrack={handleAddTrack}
                onUpdateTrack={handleUpdateTrack}
                onDeleteTrack={handleDeleteTrack}
                onReorderTracks={handleReorderTracks}
                onLogout={admin.logout}
              />
            )}
          </>
        )}
      </main>

      {/* Track Detail Modal */}
      <AnimatePresence>
        {selectedTrack && (
          <TrackDetail
            track={selectedTrack}
            isPlaying={player.isPlaying}
            isCurrentTrack={player.currentTrack?.id === selectedTrack.id}
            isInCart={cart.isInCart(selectedTrack.id)}
            onClose={() => {
              setSelectedTrack(null);
              // Restore clean URL
              if (window.location.pathname.startsWith('/track/')) {
                window.history.replaceState({}, '', '/');
              }
            }}
            onPlay={() => player.play(selectedTrack)}
            onAddToCart={() => cart.addItem(selectedTrack)}
          />
        )}
      </AnimatePresence>

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={cart.isOpen}
        items={cart.items}
        total={cart.total}
        onClose={() => cart.setIsOpen(false)}
        onRemove={cart.removeItem}
        onCheckout={(d) => {
          setDiscount(d);
          cart.setIsOpen(false);
          setShowCheckout(true);
        }}
      />

      {/* Global Audio Player */}
      <AudioPlayer
        currentTrack={player.currentTrack}
        isPlaying={player.isPlaying}
        progress={player.progress}
        currentTime={player.currentTime}
        duration={player.duration}
        onPlayPause={() => {
          if (player.currentTrack) {
            player.play(player.currentTrack);
          }
        }}
        onSeek={player.seek}
      />
    </div>
  );
}
