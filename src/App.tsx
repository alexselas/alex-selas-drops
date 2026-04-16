import { useState, useMemo, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Track, Category, SortOption, Section } from './types';
import { demoTracks } from './data/tracks';
import { collaborators } from './data/collaborators';
import { useCart } from './hooks/useCart';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useAdmin } from './hooks/useAdmin';
import { useCollabAdmin } from './hooks/useCollabAdmin';
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
import CollabLogin from './components/CollabLogin';
import CollabPanel from './components/CollabPanel';
import CollabPage from './components/CollabPage';
import Footer from './components/Footer';
import { Search, ArrowUpDown, LayoutGrid, List, Music, ShoppingCart, Play, Pause, Check, Package, ChevronDown, ChevronUp, Clock, Sparkles, Headphones, Users, Zap, Star, Crown, ArrowRight } from 'lucide-react';
import { formatPrice, formatDuration } from './lib/utils';

/* Collab tracks catalog — same layout as Home */
function CollabTracksSection({ tracks: colabTracks, collabProfiles, player, cart, onDetail }: {
  tracks: Track[];
  collabProfiles: Record<string, any>;
  player: { currentTrack: Track | null; isPlaying: boolean; play: (t: Track) => void };
  cart: { isInCart: (id: string) => boolean; addItem: (t: Track) => void };
  onDetail: (t: Track) => void;
}) {
  const [catFilter, setCatFilter] = useState<Category | 'all' | 'packs'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [expandedPackId, setExpandedPackId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let r = [...colabTracks];
    if (catFilter === 'packs') r = r.filter(t => !!t.packId);
    else if (catFilter !== 'all') r = r.filter(t => t.category === catFilter);
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter(t => t.title.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q) || t.tags.some(tag => tag.toLowerCase().includes(q))); }
    switch (sort) {
      case 'newest': r.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()); break;
      case 'oldest': r.sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()); break;
      case 'price-asc': r.sort((a, b) => a.price - b.price); break;
      case 'price-desc': r.sort((a, b) => b.price - a.price); break;
      case 'title': r.sort((a, b) => a.title.localeCompare(b.title)); break;
    }
    return r;
  }, [colabTracks, catFilter, search, sort]);

  const displayItems = useMemo(() => {
    type DI = { type: 'track'; track: Track } | { type: 'pack'; packId: string; packName: string; tracks: Track[]; coverUrl: string; price: number; artist: string; genre: string; category: string };
    const seen = new Set<string>();
    const items: DI[] = [];
    for (const t of filtered) {
      if (t.packId) {
        if (seen.has(t.packId)) continue;
        seen.add(t.packId);
        const pt = filtered.filter(x => x.packId === t.packId);
        items.push({ type: 'pack', packId: t.packId, packName: t.packName || 'Pack', tracks: pt, coverUrl: t.coverUrl, price: pt.reduce((s, x) => s + x.price, 0), artist: t.artist, genre: t.genre, category: t.category });
      } else {
        items.push({ type: 'track', track: t });
      }
    }
    return items;
  }, [filtered]);

  return (
    <>
      <h2 className="text-2xl font-bold text-zinc-50 mb-6">Tracks de colaboradores</h2>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <CategoryFilter selected={catFilter} onSelect={v => setCatFilter(v)} />
        <div className="flex items-center gap-3 sm:ml-auto w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full sm:w-56 pl-10 pr-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-500 text-sm focus:outline-none focus:border-yellow-400/50 transition-colors" />
          </div>
          <div className="relative">
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <select value={sort} onChange={e => setSort(e.target.value as SortOption)} className="pl-10 pr-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-yellow-400/50 transition-colors appearance-none cursor-pointer">
              <option value="newest">Más recientes</option>
              <option value="oldest">Más antiguos</option>
              <option value="price-asc">Precio: menor</option>
              <option value="price-desc">Precio: mayor</option>
              <option value="title">A-Z</option>
            </select>
          </div>
        </div>
      </div>
      <div className="space-y-2 mb-16">
        {displayItems.map(item => {
          if (item.type === 'track') {
            const track = item.track;
            const isCurrent = player.currentTrack?.id === track.id;
            const prof = collabProfiles[track.collaboratorId || ''];
            const collabName = prof?.artistName || track.collaboratorId || '';
            return (
              <div key={track.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#1a1a1a] border border-zinc-800/50 hover:border-yellow-400/20 transition-colors cursor-pointer" onClick={() => onDetail(track)}>
                <button onClick={e => { e.stopPropagation(); player.play(track); }} className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-800 hover:gradient-bg flex items-center justify-center transition-all group/play">
                  {isCurrent && player.isPlaying ? <Pause className="w-4 h-4 text-yellow-400 group-hover/play:text-black" /> : <Play className="w-4 h-4 text-zinc-400 group-hover/play:text-black ml-0.5" />}
                </button>
                {track.coverUrl ? <img src={track.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" /> : <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0"><Music className="w-4 h-4 text-zinc-700" /></div>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-100 truncate">{track.title}</p>
                  <p className="text-xs text-zinc-500 truncate">{collabName}{track.authors ? ` · ${track.authors}` : ''} · {track.genre}{track.bpm > 0 ? ` · ${track.bpm} BPM` : ''}</p>
                </div>
                <span className="text-sm font-bold gradient-text flex-shrink-0 hidden sm:block">{formatPrice(track.price)}</span>
                <button onClick={e => { e.stopPropagation(); cart.addItem(track); }} disabled={cart.isInCart(track.id)} className={`flex-shrink-0 p-2 rounded-lg transition-all ${cart.isInCart(track.id) ? 'text-green-400' : 'text-zinc-500 hover:text-yellow-400 hover:bg-yellow-400/10'}`}><ShoppingCart className="w-4 h-4" /></button>
              </div>
            );
          }
          // PACK
          const isExp = expandedPackId === item.packId;
          return (
            <div key={item.packId} className="rounded-xl overflow-hidden">
              <div className={`flex items-center gap-3 p-3 bg-[#1a1a1a] border border-zinc-800/50 hover:border-yellow-400/20 transition-colors cursor-pointer ${isExp ? 'rounded-t-xl border-b-0' : 'rounded-xl'}`} onClick={() => setExpandedPackId(isExp ? null : item.packId)}>
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400/20 to-amber-500/20 flex items-center justify-center"><Package className="w-5 h-5 text-yellow-400" /></div>
                {item.coverUrl ? <img src={item.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" /> : <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0"><Music className="w-4 h-4 text-zinc-700" /></div>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><p className="text-sm font-semibold text-zinc-100 truncate">{item.packName}</p><span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-400/10 text-yellow-400 font-bold flex-shrink-0">PACK</span></div>
                  <p className="text-xs text-zinc-500 truncate">{item.artist} · {item.tracks.length} tracks · {item.genre}</p>
                </div>
                <span className="text-sm font-bold gradient-text flex-shrink-0 hidden sm:block">{formatPrice(item.price)}</span>
                <button onClick={e => { e.stopPropagation(); item.tracks.forEach(t => cart.addItem(t)); }} disabled={item.tracks.every(t => cart.isInCart(t.id))} className={`flex-shrink-0 p-2 rounded-lg transition-all ${item.tracks.every(t => cart.isInCart(t.id)) ? 'text-green-400' : 'text-zinc-500 hover:text-yellow-400 hover:bg-yellow-400/10'}`}><ShoppingCart className="w-4 h-4" /></button>
                {isExp ? <ChevronUp className="w-4 h-4 text-zinc-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
              </div>
              {isExp && (
                <div className="bg-[#111] border border-zinc-800/50 border-t-0 rounded-b-xl divide-y divide-zinc-800/30 max-h-[400px] overflow-y-auto">
                  {item.tracks.map((track, idx) => {
                    const isCurrent = player.currentTrack?.id === track.id;
                    return (
                      <div key={track.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/30 transition-colors">
                        <span className="text-[11px] text-zinc-600 font-bold w-5 text-center flex-shrink-0">{idx + 1}</span>
                        <button onClick={() => player.play(track)} className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 hover:gradient-bg flex items-center justify-center transition-all group/play">
                          {isCurrent && player.isPlaying ? <Pause className="w-3.5 h-3.5 text-yellow-400 group-hover/play:text-black" /> : <Play className="w-3.5 h-3.5 text-zinc-400 group-hover/play:text-black ml-0.5" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-200 truncate">{track.title}</p>
                          <p className="text-[11px] text-zinc-600">{track.authors ? `${track.authors} · ` : ''}{track.bpm > 0 ? `${track.bpm} BPM` : ''}{track.key ? ` · ${track.key}` : ''}{track.duration > 0 ? ` · ${formatDuration(track.duration)}` : ''}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {displayItems.length === 0 && (
          <div className="text-center py-16"><Music className="w-12 h-12 text-zinc-700 mx-auto mb-3" /><p className="text-zinc-500">No se encontraron tracks</p></div>
        )}
      </div>
    </>
  );
}

function pathToSection(path: string): Section {
  if (path === '/admin') return 'admin';
  if (path === '/colab-admin') return 'colab-admin';
  if (path === '/colaboradores') return 'colabs';
  if (path === '/club360') return 'club360';
  if (path.match(/^\/collab\/[a-z0-9-]+$/)) return 'colab-page';
  return 'home';
}

function getInitialSection(): Section {
  return pathToSection(window.location.pathname);
}

function sectionToPath(s: Section, collabId?: string): string {
  switch (s) {
    case 'colabs': return '/colaboradores';
    case 'admin': return '/admin';
    case 'colab-admin': return '/colab-admin';
    case 'colab-page': return collabId ? `/collab/${collabId}` : '/colaboradores';
    case 'club360': return '/club360';
    default: return '/';
  }
}

function getInitialCollabPageId(): string {
  const match = window.location.pathname.match(/^\/collab\/([a-z0-9-]+)$/);
  return match ? match[1] : '';
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
  const [activeCollabId, setActiveCollabId] = useState(getInitialCollabPageId);
  const [collabProfiles, setCollabProfiles] = useState<Record<string, any>>({});

  // Catalog filters
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all' | 'packs'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [discount, setDiscount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedPackId, setExpandedPackId] = useState<string | null>(null);
  const TRACKS_PER_PAGE = 10;

  // Hooks
  const cart = useCart();
  const player = useAudioPlayer();
  const admin = useAdmin();
  const collabAdmin = useCollabAdmin();

  // Load tracks from API + handle /track/:id URLs
  const loadTracks = useCallback((token?: string) => {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    fetch('/api/tracks', { headers })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTracks(data);
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

  useEffect(() => { loadTracks(); }, [loadTracks]);

  // Fetch collaborator profiles
  useEffect(() => {
    fetch('/api/collab-profiles')
      .then(r => r.json())
      .then(data => { if (data && typeof data === 'object') setCollabProfiles(data); })
      .catch(() => {});
  }, []);

  // Reload tracks with admin token when admin logs in
  useEffect(() => {
    if (admin.isAuthenticated) {
      loadTracks(admin.getToken());
    }
  }, [admin.isAuthenticated, loadTracks]);

  // Reload tracks with collab token when collaborator logs in
  useEffect(() => {
    if (collabAdmin.isAuthenticated) {
      loadTracks(collabAdmin.getToken());
    }
  }, [collabAdmin.isAuthenticated, loadTracks]);

  // Stop music when entering admin panels
  useEffect(() => {
    if (section === 'admin' || section === 'colab-admin') {
      player.stop();
    }
  }, [section]);

  // Navigate — always update URL
  const navigate = useCallback((s: Section, collabId?: string) => {
    setSection(s);
    setShowCheckout(false);
    if (s === 'colab-page' && collabId) {
      setActiveCollabId(collabId);
    }
    const newPath = sectionToPath(s, collabId);
    if (window.location.pathname !== newPath) {
      window.history.pushState({ section: s, collabId }, '', newPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      const s = pathToSection(path);
      setSection(s);
      setShowCheckout(false);
      if (s === 'colab-page') {
        const match = path.match(/^\/collab\/([a-z0-9-]+)$/);
        if (match) setActiveCollabId(match[1]);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Filtered tracks for catalog
  const filteredTracks = useMemo(() => {
    let result = [...tracks];

    // Category
    if (categoryFilter === 'packs') {
      result = result.filter(t => !!t.packId);
    } else if (categoryFilter !== 'all') {
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

  // Track CRUD (admin + collab) — syncs with server
  const getActiveToken = () =>
    sessionStorage.getItem('alex-selas-drops-token') ||
    sessionStorage.getItem('alex-selas-drops-collab-token') ||
    '';

  const handleAddTrack = useCallback(async (data: Omit<Track, 'id'> & { id?: string }) => {
    try {
      const res = await fetch('/api/tracks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getActiveToken()}`,
        },
        body: JSON.stringify(data),
      });
      const newTrack = await res.json();
      setTracks(prev => [newTrack, ...prev]);
    } catch {
      const newTrack = { ...data, id: data.id || `track-${Date.now()}` } as Track;
      setTracks(prev => [newTrack, ...prev]);
    }
  }, []);

  const handleAddTracksBatch = useCallback(async (items: (Omit<Track, 'id'> & { id?: string })[]) => {
    try {
      const res = await fetch('/api/tracks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getActiveToken()}`,
        },
        body: JSON.stringify(items),
      });
      const newTracks = await res.json();
      if (Array.isArray(newTracks)) {
        setTracks(prev => [...newTracks, ...prev]);
      }
    } catch {
      const newTracks = items.map((d, i) => ({ ...d, id: d.id || `track-${Date.now()}-${i}` } as Track));
      setTracks(prev => [...newTracks, ...prev]);
    }
  }, []);

  const handleUpdateTrack = useCallback(async (data: Omit<Track, 'id'> & { id?: string }) => {
    if (!data.id) return;
    try {
      await fetch('/api/tracks', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getActiveToken()}`,
        },
        body: JSON.stringify(data),
      });
    } catch {}
    setTracks(prev => prev.map(t => (t.id === data.id ? { ...t, ...data } as Track : t)));
  }, []);

  const handleDeleteTrack = useCallback(async (id: string) => {
    try {
      await fetch(`/api/tracks?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getActiveToken()}` },
      });
    } catch {}
    setTracks(prev => prev.filter(t => t.id !== id));
  }, []);

  const handleReorderTracks = useCallback(async (reordered: Track[]) => {
    setTracks(reordered);
    try {
      await fetch('/api/tracks', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getActiveToken()}`,
        },
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
        collabArtistName={section === 'colab-page' && activeCollabId ? (collabProfiles[activeCollabId]?.artistName || activeCollabId) : undefined}
      />

      {/* Main content */}
      <main className="pt-16">
        {/* ============ MAIN PAGE (Destacados + Catálogo) ============ */}
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

            {/* All tracks — compact list */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
              {/* Promo banner */}
              <div className="relative overflow-hidden rounded-2xl mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500" />
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px)' }} />
                <div className="relative px-6 py-5 sm:py-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
                  <div className="text-center sm:text-left">
                    <p className="text-black/90 font-bold text-lg sm:text-xl">Descuento en tu primera compra</p>
                    <p className="text-black/60 text-sm mt-0.5">Introduce este código en el carrito</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-5 py-2.5 bg-black text-yellow-400 font-black text-xl sm:text-2xl tracking-widest rounded-xl shadow-lg">
                      WELCOME20
                    </span>
                  </div>
                </div>
              </div>

              <h2 id="all-tracks" className="text-2xl font-bold text-zinc-50 mb-6 scroll-mt-20">Todos los tracks</h2>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
                <CategoryFilter selected={categoryFilter} onSelect={v => { setCategoryFilter(v); setCurrentPage(1); }} />
                <div className="flex items-center gap-3 sm:ml-auto w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-initial">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      value={search}
                      onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                      placeholder="Buscar..."
                      className="w-full sm:w-56 pl-10 pr-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-500 text-sm focus:outline-none focus:border-yellow-400/50 transition-colors"
                    />
                  </div>
                  <div className="relative">
                    <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <select
                      value={sort}
                      onChange={e => { setSort(e.target.value as SortOption); setCurrentPage(1); }}
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

              {/* Compact list view with pagination — packs grouped */}
              {(() => {
                // Build display items: standalone tracks + 1 entry per pack
                type DisplayItem = { type: 'track'; track: Track } | { type: 'pack'; packId: string; packName: string; tracks: Track[]; coverUrl: string; price: number; artist: string; genre: string; category: string };
                const seenPacks = new Set<string>();
                const displayItems: DisplayItem[] = [];
                for (const track of filteredTracks) {
                  if (track.packId) {
                    if (seenPacks.has(track.packId)) continue;
                    seenPacks.add(track.packId);
                    const packTracks = filteredTracks.filter(t => t.packId === track.packId);
                    const totalPrice = packTracks.reduce((sum, t) => sum + t.price, 0);
                    displayItems.push({
                      type: 'pack',
                      packId: track.packId,
                      packName: track.packName || 'Pack',
                      tracks: packTracks,
                      coverUrl: track.coverUrl,
                      price: totalPrice,
                      artist: track.artist,
                      genre: track.genre,
                      category: track.category,
                    });
                  } else {
                    displayItems.push({ type: 'track', track });
                  }
                }

                const totalPages = Math.ceil(displayItems.length / TRACKS_PER_PAGE);
                const paginatedItems = displayItems.slice((currentPage - 1) * TRACKS_PER_PAGE, currentPage * TRACKS_PER_PAGE);

                return displayItems.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      {paginatedItems.map(item => {
                        if (item.type === 'track') {
                          const track = item.track;
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
                        }

                        // PACK item
                        const isExpanded = expandedPackId === item.packId;
                        return (
                          <div key={item.packId} className="rounded-xl overflow-hidden">
                            {/* Pack header row */}
                            <div
                              className={`flex items-center gap-3 p-3 bg-[#1a1a1a] border border-zinc-800/50 hover:border-yellow-400/20 transition-colors cursor-pointer ${isExpanded ? 'rounded-t-xl border-b-0' : 'rounded-xl'}`}
                              onClick={() => setExpandedPackId(isExpanded ? null : item.packId)}
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
                                onClick={e => { e.stopPropagation(); item.tracks.forEach(t => cart.addItem(t)); }}
                                disabled={item.tracks.every(t => cart.isInCart(t.id))}
                                className={`flex-shrink-0 p-2 rounded-lg transition-all ${
                                  item.tracks.every(t => cart.isInCart(t.id)) ? 'text-green-400' : 'text-zinc-500 hover:text-yellow-400 hover:bg-yellow-400/10'
                                }`}
                              >
                                <ShoppingCart className="w-4 h-4" />
                              </button>
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
                            </div>

                            {/* Expanded: tracks inside pack */}
                            {isExpanded && (
                              <div className="bg-[#111] border border-zinc-800/50 border-t-0 rounded-b-xl divide-y divide-zinc-800/30 max-h-[400px] overflow-y-auto">
                                {item.tracks.map((track, idx) => {
                                  const isCurrentTrack = player.currentTrack?.id === track.id;
                                  return (
                                    <div
                                      key={track.id}
                                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/30 transition-colors"
                                    >
                                      <span className="text-[11px] text-zinc-600 font-bold w-5 text-center flex-shrink-0">{idx + 1}</span>
                                      <button
                                        onClick={() => player.play(track)}
                                        className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 hover:gradient-bg flex items-center justify-center transition-all group/play"
                                      >
                                        {isCurrentTrack && player.isPlaying ? (
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
                      })}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-8">
                        <button
                          onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); document.getElementById('all-tracks')?.scrollIntoView({ behavior: 'smooth' }); }}
                          disabled={currentPage === 1}
                          className="px-4 py-2 rounded-xl border border-zinc-700 text-sm text-zinc-400 hover:border-yellow-400/30 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Anterior
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                          <button
                            key={page}
                            onClick={() => { setCurrentPage(page); document.getElementById('all-tracks')?.scrollIntoView({ behavior: 'smooth' }); }}
                            className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                              page === currentPage
                                ? 'bg-yellow-400 text-black'
                                : 'border border-zinc-700 text-zinc-400 hover:border-yellow-400/30 hover:text-white'
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); document.getElementById('all-tracks')?.scrollIntoView({ behavior: 'smooth' }); }}
                          disabled={currentPage === totalPages}
                          className="px-4 py-2 rounded-xl border border-zinc-700 text-sm text-zinc-400 hover:border-yellow-400/30 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Siguiente
                        </button>
                      </div>
                    )}
                    <p className="text-center text-[10px] text-zinc-600 mt-3">
                      {displayItems.length} items · Página {currentPage} de {totalPages}
                    </p>
                  </>
                ) : (
                  <div className="text-center py-20">
                    <p className="text-zinc-500 text-lg">No se encontraron tracks</p>
                    <p className="text-zinc-600 text-sm mt-1">Prueba con otros filtros o búsqueda</p>
                  </div>
                );
              })()}
            </div>
            <Footer onAdmin={() => navigate('admin')} />
          </>
        )}

        {/* ============ COLABORADORES ============ */}
        {section === 'colabs' && !showCheckout && (() => {
          const colabTracks = tracks.filter(t => t.collaborator);
          // Build dynamic collaborator list from API profiles, sorted alphabetically
          const dynamicCollabs = Object.entries(collabProfiles)
            .map(([id, prof]: [string, any]) => ({
              id,
              name: prof.artistName || id,
              photoUrl: prof.photoUrl || '',
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'es'));
          return (
            <>
            {/* MUSIC DROPS Hero Banner */}
            <section className="relative min-h-[42vh] sm:min-h-[48vh] flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-yellow-400/6 rounded-full blur-[200px]" />
                <div className="absolute top-1/3 right-1/3 w-[400px] h-[400px] bg-violet-500/8 rounded-full blur-[160px]" />
                <div className="absolute bottom-1/3 left-1/4 w-[350px] h-[350px] bg-amber-500/8 rounded-full blur-[140px]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0a0a0a_75%)]" />
              </div>
              <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(rgba(250,204,21,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(250,204,21,.2) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
              <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 w-full max-w-3xl mx-auto py-16 sm:py-20">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mb-6">
                  <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-yellow-400/25 bg-yellow-400/5">
                    <Music className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-yellow-400 font-semibold tracking-wide">La comunidad de los DJs</span>
                  </div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="flex flex-col items-center mb-5">
                  <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-[0.15em] gradient-text leading-[0.9]">MUSIC</h1>
                  <h2 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-[0.25em] text-white/90 leading-[0.9] mt-1">DROPS</h2>
                </motion.div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.25 }}>
                  <p className="text-sm sm:text-base text-zinc-400 font-medium tracking-[0.25em] uppercase">
                    Remixes &middot; Mashups &middot; Hype Intros &middot; Sesiones
                  </p>
                </motion.div>
              </div>
            </section>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
              <h3 className="text-xl font-bold text-zinc-50 mb-6">Nuestros productores</h3>
              {/* Collaborator avatars — compact row, sorted alphabetically */}
              {dynamicCollabs.length > 0 ? (
                <div className="flex flex-wrap gap-3 mb-10">
                  {dynamicCollabs.map(collab => {
                    const collabTrackCount = colabTracks.filter(t => t.collaboratorId === collab.id).length;
                    return (
                      <button
                        key={collab.id}
                        onClick={() => navigate('colab-page', collab.id)}
                        className="flex items-center gap-3 bg-yellow-400/5 rounded-xl border border-yellow-400/20 px-4 py-3 hover:border-yellow-400/50 hover:bg-yellow-400/10 transition-all"
                      >
                        {collab.photoUrl ? (
                          <img src={collab.photoUrl} alt={collab.name} className="w-10 h-10 rounded-full object-cover border-2 border-yellow-400/40 flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-yellow-400/40 bg-yellow-400/10 flex-shrink-0">
                            <span className="text-sm font-bold text-yellow-400">{collab.name.charAt(0)}</span>
                          </div>
                        )}
                        <div className="text-left">
                          <h3 className="text-sm font-bold text-yellow-300 leading-tight">{collab.name}</h3>
                          <p className="text-[11px] text-yellow-400/50">
                            {collabTrackCount > 0 ? `${collabTrackCount} track${collabTrackCount !== 1 ? 's' : ''}` : 'Próximamente'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 mb-10 bg-[#141414] rounded-2xl border border-zinc-800/50">
                  <Music className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-500">Aún no hay colaboradores registrados</p>
                </div>
              )}

              {/* 4 random featured tracks from all tracks */}
              {(() => {
                const shuffled = [...tracks].sort(() => Math.random() - 0.5);
                const randomFeatured = shuffled.slice(0, 4);
                return randomFeatured.length > 0 && (
                  <div className="mb-10">
                    <div className="flex items-center gap-3 mb-6">
                      <Sparkles className="w-5 h-5 text-yellow-400" />
                      <h2 className="text-2xl font-bold text-zinc-50">Destacados</h2>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {randomFeatured.map(track => (
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
                  </div>
                );
              })()}

              {/* Collaborator tracks — full catalog like Home */}
              {colabTracks.length > 0 && (
                <CollabTracksSection
                  tracks={colabTracks}
                  collabProfiles={collabProfiles}
                  player={player}
                  cart={cart}
                  onDetail={(track) => {
                    setSelectedTrack(track);
                    window.history.pushState({}, '', `/track/${track.id}`);
                  }}
                />
              )}

              {/* Contact CTA */}
              <div className="bg-[#141414] rounded-[22px] border border-zinc-800/50 p-8 sm:p-12 text-center">
                <h2 className="text-2xl font-bold text-zinc-50 mb-3">¿Quieres colaborar?</h2>
                <p className="text-zinc-500 mb-6 max-w-md mx-auto">
                  Si eres DJ o productor y quieres vender tus tracks en Music Drops, escríbenos con tu propuesta.
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
                <Footer onAdmin={() => navigate('admin')} />
              </div>
            </div>
            </>
          );
        })()}

        {/* ============ CLUB360 ============ */}
        {section === 'club360' && !showCheckout && (
          <div className="min-h-screen">
            {/* Hero */}
            <section className="relative min-h-[50vh] sm:min-h-[55vh] flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-violet-500/10 rounded-full blur-[200px]" />
                <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-yellow-400/8 rounded-full blur-[160px]" />
                <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-fuchsia-500/8 rounded-full blur-[140px]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0a0a0a_70%)]" />
              </div>
              <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'linear-gradient(rgba(168,85,247,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,.2) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
              <div className="relative z-10 flex flex-col items-center text-center px-4 w-full max-w-3xl mx-auto py-20 sm:py-24">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mb-6">
                  <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-violet-400/25 bg-violet-400/5">
                    <Crown className="w-4 h-4 text-violet-400" />
                    <span className="text-sm text-violet-400 font-semibold tracking-wide">La comunidad exclusiva para DJs</span>
                  </div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="mb-6">
                  <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-[0.1em] leading-[0.9]">
                    <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">CLUB</span>
                    <span className="text-white">360</span>
                  </h1>
                </motion.div>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.2 }} className="text-lg sm:text-xl text-zinc-400 max-w-xl mb-8 leading-relaxed">
                  Tu espacio privado donde la música, la formación y las oportunidades se encuentran. Únete a una comunidad de DJs que crecen juntos.
                </motion.p>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}>
                  <a
                    href="https://curso-360.vercel.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold text-lg shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-105 active:scale-95 transition-all"
                  >
                    Únete ahora
                    <ArrowRight className="w-5 h-5" />
                  </a>
                </motion.div>
              </div>
            </section>

            {/* Features */}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 -mt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[
                  { icon: Headphones, title: 'Formación continua', desc: 'Acceso a cursos, masterclasses y contenido exclusivo para mejorar tu técnica y tu carrera como DJ.' },
                  { icon: Users, title: 'Comunidad privada', desc: 'Conecta con otros DJs, comparte experiencias, colabora en proyectos y crece junto a una comunidad que entiende tu pasión.' },
                  { icon: Zap, title: 'Creator Studio', desc: 'Herramientas de IA para crear contenido profesional: flyers, estrategias de marketing, letras, análisis viral y mucho más.' },
                  { icon: Star, title: 'Oportunidades reales', desc: 'Accede a eventos, bookings y oportunidades laborales exclusivas para miembros del club.' },
                  { icon: Music, title: 'Music Drops', desc: 'Publica y vende tus tracks, remixes y mashups en nuestra plataforma. Monetiza tu música.' },
                  { icon: Crown, title: 'Soporte personalizado', desc: 'Asesoramiento directo de Alex Selas y el equipo de DJAcademy para impulsar tu carrera.' },
                ].map((feat, i) => (
                  <motion.div
                    key={feat.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 + i * 0.08 }}
                    className="bg-[#141414] rounded-2xl border border-zinc-800/50 p-6 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-violet-500/10 flex items-center justify-center mb-4 group-hover:bg-violet-500/20 transition-colors">
                      <feat.icon className="w-5 h-5 text-violet-400" />
                    </div>
                    <h3 className="text-base font-bold text-zinc-100 mb-2">{feat.title}</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">{feat.desc}</p>
                  </motion.div>
                ))}
              </div>

              {/* CTA final */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.9 }}
                className="mt-12 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 rounded-[22px] border border-violet-500/20 p-8 sm:p-12 text-center"
              >
                <h2 className="text-2xl sm:text-3xl font-bold text-zinc-50 mb-3">Empieza tu camino como DJ profesional</h2>
                <p className="text-zinc-400 mb-8 max-w-lg mx-auto">
                  Únete a CLUB360 y accede a todo lo que necesitas para llevar tu carrera al siguiente nivel.
                </p>
                <a
                  href="https://curso-360.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold text-lg shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-105 active:scale-95 transition-all"
                >
                  Únete a CLUB360
                  <ArrowRight className="w-5 h-5" />
                </a>
              </motion.div>

              <div className="mt-16">
                <Footer onAdmin={() => navigate('admin')} />
              </div>
            </div>
          </div>
        )}

        {/* ============ COLAB ADMIN ============ */}
        {section === 'colab-admin' && !showCheckout && (
          <>
            {!collabAdmin.isAuthenticated ? (
              <CollabLogin
                collaborators={collaborators}
                onLogin={collabAdmin.login}
                onRegister={collabAdmin.register}
              />
            ) : (
              <CollabPanel
                collaborator={(() => {
                  const prof = collabProfiles[collabAdmin.collaboratorId];
                  return {
                    id: collabAdmin.collaboratorId,
                    name: prof?.artistName || collabAdmin.collaboratorId,
                    photoUrl: prof?.photoUrl || '',
                  };
                })()}
                tracks={tracks}
                onAddTrack={handleAddTrack}
                onAddTracksBatch={handleAddTracksBatch}
                onUpdateTrack={handleUpdateTrack}
                onDeleteTrack={handleDeleteTrack}
                onReorderTracks={handleReorderTracks}
                onLogout={collabAdmin.logout}
                collabToken={collabAdmin.getToken()}
              />
            )}
          </>
        )}

        {/* ============ COLAB PAGE (personal) ============ */}
        {section === 'colab-page' && !showCheckout && activeCollabId && (() => {
          const prof = collabProfiles[activeCollabId];
          return (
            <CollabPage
              collaboratorId={activeCollabId}
              collaboratorName={prof?.artistName || activeCollabId}
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
              onNavigate={navigate}
            />
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
                onAddTracksBatch={handleAddTracksBatch}
                onUpdateTrack={handleUpdateTrack}
                onDeleteTrack={handleDeleteTrack}
                onReorderTracks={handleReorderTracks}
                onLogout={admin.logout}
                adminToken={admin.getToken()}
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

      {/* Global Audio Player — hidden on admin panels */}
      {section !== 'admin' && section !== 'colab-admin' && (
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
      )}
    </div>
  );
}
