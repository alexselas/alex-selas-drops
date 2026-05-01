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
import CategoryFilter from './components/CategoryFilter';
import TrackCard from './components/TrackCard';
import TrackDetail from './components/TrackDetail';
import AudioPlayer from './components/AudioPlayer';
import CartDrawer from './components/CartDrawer';
import AdminLogin from './components/AdminLogin';
import AdminPanel from './components/AdminPanel';
import CollabLogin from './components/CollabLogin';
import CollabPanel from './components/CollabPanel';
import CollabPage from './components/CollabPage';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';
import CreditShop from './components/CreditShop';
import UserPanel from './components/UserPanel';
import { Search, ArrowUpDown, Coins, Music, ShoppingCart, Play, Pause, Sparkles, Headphones, Users, Zap, Star, Crown, ArrowRight } from 'lucide-react';
import { formatCredits, formatDuration } from './lib/utils';
import { CREDIT_COSTS, CATEGORY_LABELS, CATEGORY_COLORS } from './types';

/* Collab tracks catalog — same layout as Home */
function CollabTracksSection({ tracks: colabTracks, collabProfiles, player, cart, onDetail }: {
  tracks: Track[];
  collabProfiles: Record<string, any>;
  player: { currentTrack: Track | null; isPlaying: boolean; progress: number; play: (t: Track) => void };
  cart: { isInCart: (id: string) => boolean; addItem: (t: Track) => void };
  onDetail: (t: Track) => void;
}) {
  const [catFilter, setCatFilter] = useState<Category | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [listPage, setListPage] = useState(1);
  const LIST_PER_PAGE = 20;

  const filtered = useMemo(() => {
    let r = [...colabTracks];
    if (catFilter === 'all') r = r.filter(t => t.category !== 'originales');
    else r = r.filter(t => t.category === catFilter);
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter(t => t.title.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q) || t.tags.some(tag => tag.toLowerCase().includes(q))); }
    switch (sort) {
      case 'newest': r.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()); break;
      case 'oldest': r.sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime()); break;
      case 'credits-asc': r.sort((a, b) => CREDIT_COSTS[a.category] - CREDIT_COSTS[b.category]); break;
      case 'credits-desc': r.sort((a, b) => CREDIT_COSTS[b.category] - CREDIT_COSTS[a.category]); break;
      case 'title': r.sort((a, b) => a.title.localeCompare(b.title)); break;
    }
    return r;
  }, [colabTracks, catFilter, search, sort]);

  const displayItems = useMemo(() => {
    return filtered.map(t => ({ type: 'track' as const, track: t }));
  }, [filtered]);

  const totalListPages = Math.max(1, Math.ceil(displayItems.length / LIST_PER_PAGE));
  const paginatedItems = displayItems.slice((listPage - 1) * LIST_PER_PAGE, listPage * LIST_PER_PAGE);

  // Reset page on filter change
  useEffect(() => { setListPage(1); }, [catFilter, search, sort]);

  return (
    <>
      <h2 id="todos-tracks" className="text-2xl font-bold text-zinc-50 mb-6">Todos los tracks</h2>
      <div className="space-y-3 mb-6">
        <CategoryFilter selected={catFilter} onSelect={v => setCatFilter(v)} showOriginales />
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-500 text-sm focus:outline-none focus:border-yellow-400/50 transition-colors" />
          </div>
          <div className="relative flex-shrink-0">
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <select value={sort} onChange={e => setSort(e.target.value as SortOption)} className="pl-10 pr-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-yellow-400/50 transition-colors appearance-none cursor-pointer">
              <option value="newest">Más recientes</option>
              <option value="oldest">Más antiguos</option>
              <option value="credits-asc">Drops: menor</option>
              <option value="credits-desc">Drops: mayor</option>
              <option value="title">A-Z</option>
            </select>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {paginatedItems.map(item => {
          const track = item.track;
          const isCurrent = player.currentTrack?.id === track.id;
          const profKey = track.collaboratorId || 'alex-selas';
          const prof = collabProfiles[profKey];
          const collabName = prof?.artistName || track.collaboratorId || (track.artist || 'Alex Selas');
          const trackColor = (prof as any)?.colorPrimary || '#FACC15';
          return (
            <div key={track.id} className={`relative flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer overflow-hidden ${isCurrent ? 'bg-yellow-400/5 border-yellow-400/30' : 'bg-[#1a1a1a] border-zinc-800/50 hover:border-yellow-400/20'}`} onClick={() => player.play(track)}>
              {/* Progress bar */}
              {isCurrent && <div className="absolute left-0 top-0 bottom-0 bg-yellow-400/10 transition-all duration-200" style={{ width: `${player.progress}%` }} />}
              <button className="relative flex-shrink-0 w-10 h-10 rounded-full bg-zinc-800 hover:gradient-bg flex items-center justify-center transition-all group/play">
                {isCurrent && player.isPlaying ? <Pause className="w-4 h-4 text-yellow-400 group-hover/play:text-black" /> : <Play className="w-4 h-4 text-zinc-400 group-hover/play:text-black ml-0.5" />}
              </button>
              <div className="relative flex-1 min-w-0">
                <div className="flex items-center gap-2"><p className={`text-sm font-semibold truncate ${isCurrent ? 'text-yellow-400' : 'text-zinc-100'}`}>{track.title}</p><span className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${CATEGORY_COLORS[track.category] || 'bg-zinc-600 text-white'}`}>{CATEGORY_LABELS[track.category] ? CATEGORY_LABELS[track.category].toUpperCase() : track.category.toUpperCase()}</span>{track.releaseDate && <span className="text-[10px] text-zinc-600 flex-shrink-0">{new Date(track.releaseDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>}</div>
                <p className="text-xs text-zinc-500 truncate"><span style={{ color: trackColor }} className="font-medium">{collabName}</span>{track.authors ? ` · ${track.authors}` : ''} · {track.genre}{track.bpm > 0 ? ` · ${track.bpm} BPM` : ''}{track.camelot ? ` · ${track.camelot}` : (track.key ? ` · ${track.key}` : '')}{track.analysis?.intensity ? ` · Energía ${track.analysis.intensity}%` : ''}</p>
              </div>
              <span className="relative text-sm font-bold gradient-text flex-shrink-0 hidden sm:block">{formatCredits(CREDIT_COSTS[track.category])}</span>
              <button onClick={e => { e.stopPropagation(); cart.addItem(track); }} disabled={cart.isInCart(track.id)} className={`relative flex-shrink-0 p-2 rounded-lg transition-all ${cart.isInCart(track.id) ? 'text-green-400' : 'text-zinc-500 hover:text-yellow-400 hover:bg-yellow-400/10'}`}><ShoppingCart className="w-4 h-4" /></button>
            </div>
          );
        })}
        {displayItems.length === 0 && (
          <div className="text-center py-16"><Music className="w-12 h-12 text-zinc-700 mx-auto mb-3" /><p className="text-zinc-500">No se encontraron tracks</p></div>
        )}
      </div>

      {/* Pagination */}
      {totalListPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6 mb-16">
          <button onClick={() => { setListPage(p => Math.max(1, p - 1)); document.getElementById('todos-tracks')?.scrollIntoView(); }} disabled={listPage <= 1} className="px-3 py-1.5 rounded-lg text-sm bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Anterior</button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalListPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => { setListPage(p); document.getElementById('todos-tracks')?.scrollIntoView(); }} className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${listPage === p ? 'gradient-bg text-black' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'}`}>{p}</button>
            ))}
          </div>
          <button onClick={() => { setListPage(p => Math.min(totalListPages, p + 1)); document.getElementById('todos-tracks')?.scrollIntoView(); }} disabled={listPage >= totalListPages} className="px-3 py-1.5 rounded-lg text-sm bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">Siguiente</button>
        </div>
      )}
      {displayItems.length > 0 && <p className="text-xs text-zinc-600 text-center mb-16">Pagina {listPage} de {totalListPages} · {displayItems.length} items</p>}
    </>
  );
}

function pathToSection(path: string): Section {
  if (path === '/admin') return 'admin';
  if (path === '/colab-admin') return 'colab-admin';
  if (path === '/MusicDrops' || path === '/colaboradores') return 'colabs';
  if (path === '/club360') return 'club360';
  if (path.match(/^\/collab\/[a-z0-9-]+$/)) return 'colab-page';
  return 'colabs';
}

function getInitialSection(): Section {
  return pathToSection(window.location.pathname);
}

function sectionToPath(s: Section, collabId?: string): string {
  switch (s) {
    case 'colabs': return '/';
    case 'admin': return '/admin';
    case 'colab-admin': return '/colab-admin';
    case 'colab-page': return collabId ? `/collab/${collabId}` : '/';
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
  const [activeCollabId, setActiveCollabId] = useState(getInitialCollabPageId);
  const [collabProfiles, setCollabProfiles] = useState<Record<string, any>>({});
  const [collabProfilesLoaded, setCollabProfilesLoaded] = useState(false);

  // 4 random featured tracks for colabs page — only recalculate when tracks change, not on re-renders
  const colabRandomFeatured = useMemo(() => {
    const featured = tracks.filter(t => t.featured);
    return featured.sort(() => Math.random() - 0.5).slice(0, 4);
  }, [tracks]);

  // Catalog filters
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const TRACKS_PER_PAGE = 10;

  // User auth state
  const [userToken, setUserToken] = useState<string | null>(() => localStorage.getItem('musicdrop-token'));
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [showCreditShop, setShowCreditShop] = useState(false);
  const [userInfo, setUserInfo] = useState<{ id: string; email: string; name: string; credits: number } | null>(() => {
    try { const s = localStorage.getItem('musicdrop-user'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [showAuth, setShowAuth] = useState(false);

  const handleUserAuth = (token: string, user: { id: string; email: string; name: string; credits: number }) => {
    setUserToken(token);
    setUserInfo(user);
  };

  const handleUserLogout = () => {
    setUserToken(null);
    setUserInfo(null);
    localStorage.removeItem('musicdrop-token');
    localStorage.removeItem('musicdrop-user');
    localStorage.removeItem('musicdrop-login-ts');
  };

  // Auto-expire session after 3 hours
  useEffect(() => {
    const SESSION_MAX_MS = 3 * 60 * 60 * 1000;
    const checkExpiry = () => {
      const token = localStorage.getItem('musicdrop-token');
      if (!token) return;
      const ts = localStorage.getItem('musicdrop-login-ts');
      if (!ts || Date.now() - Number(ts) > SESSION_MAX_MS) {
        handleUserLogout();
      }
    };
    checkExpiry();
    const interval = setInterval(checkExpiry, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Refresh user balance
  const refreshBalance = useCallback(async () => {
    if (!userToken) return;
    try {
      const res = await fetch('/api/user-balance', {
        headers: { 'Authorization': `Bearer ${userToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUserInfo(prev => prev ? { ...prev, credits: data.credits, name: data.name || prev.name } : null);
        const stored = localStorage.getItem('musicdrop-user');
        if (stored) {
          const u = JSON.parse(stored);
          u.credits = data.credits;
          localStorage.setItem('musicdrop-user', JSON.stringify(u));
        }
      } else if (res.status === 401) {
        handleUserLogout();
      }
    } catch {}
  }, [userToken]);

  // Refresh balance on mount and verify credit purchase on return from Stripe
  useEffect(() => {
    if (userToken) refreshBalance();
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (params.has('credits_success') && sessionId && userToken) {
      // Verify the payment and add credits
      fetch('/api/verify-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ sessionId }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            setUserInfo(prev => prev ? { ...prev, credits: data.credits } : null);
            const stored = localStorage.getItem('musicdrop-user');
            if (stored) { const u = JSON.parse(stored); u.credits = data.credits; localStorage.setItem('musicdrop-user', JSON.stringify(u)); }
            const bonusMsg = data.bonus > 0 ? ` (incluye ${data.bonus} bonus WELCOME20!)` : '';
            alert(`${data.alreadyProcessed ? '' : `+${data.added} drops anadidos${bonusMsg}. `}Tu saldo: ${data.credits} drops`);
          }
        })
        .catch(() => {});
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [userToken]);

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
              setSection('colabs');
            }
          }
        } else {
          setTracks(demoTracks);
        }
      })
      .catch(() => setTracks(demoTracks))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadTracks(); window.scrollTo(0, 0); }, [loadTracks]);

  // Fetch collaborator profiles
  useEffect(() => {
    fetch('/api/collab-profiles')
      .then(r => r.json())
      .then(data => { if (data && typeof data === 'object') setCollabProfiles(data); })
      .catch(() => {})
      .finally(() => setCollabProfilesLoaded(true));
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

  // Update document title based on section
  useEffect(() => {
    if (section === 'colab-page' && activeCollabId) {
      const prof = collabProfiles[activeCollabId];
      const name = activeCollabId === 'alex-selas' ? 'Alex Selas' : (prof?.artistName || activeCollabId);
      document.title = `${name} — MusicDrop By 360DJAcademy`;
    } else {
      const titles: Record<Section, string> = {
        home: 'MusicDrop By 360DJAcademy',
        catalog: 'MusicDrop By 360DJAcademy',
        colabs: 'MusicDrop By 360DJAcademy',
        'colab-page': 'MusicDrop By 360DJAcademy',
        'colab-admin': 'MusicDrop By 360DJAcademy',
        club360: 'Club360 By 360DJAcademy',
        admin: 'MusicDrop By 360DJAcademy — Admin',
      };
      document.title = titles[section] || 'MusicDrop By 360DJAcademy';
    }
  }, [section, activeCollabId, collabProfiles]);

  // Navigate — always update URL
  const navigate = useCallback((s: Section, collabId?: string) => {
    setSection(s);
    if (s === 'colab-page' && collabId) {
      setActiveCollabId(collabId);
    }
    const newPath = sectionToPath(s, collabId);
    if (window.location.pathname !== newPath) {
      window.history.pushState({ section: s, collabId }, '', newPath);
    }
    window.scrollTo(0, 0);
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      const s = pathToSection(path);
      setSection(s);
      if (s === 'colab-page') {
        const match = path.match(/^\/collab\/([a-z0-9-]+)$/);
        if (match) setActiveCollabId(match[1]);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Filtered tracks for catalog (exclude collaborator-only tracks from home)
  const filteredTracks = useMemo(() => {
    let result = tracks.filter(t => !t.collaboratorId);

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
      case 'credits-asc':
        result.sort((a, b) => CREDIT_COSTS[a.category] - CREDIT_COSTS[b.category]);
        break;
      case 'credits-desc':
        result.sort((a, b) => CREDIT_COSTS[b.category] - CREDIT_COSTS[a.category]);
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

  // Trigger Modal analysis in background (non-blocking)
  const triggerAnalysis = useCallback((trackId: string, fileUrl: string) => {
    if (!fileUrl || fileUrl.startsWith('blob:')) return;
    fetch('/api/analyze-track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getActiveToken()}` },
      body: JSON.stringify({ trackId, audioUrl: fileUrl }),
    }).then(res => res.json()).then(data => {
      if (data.success && data.analysis) {
        // Update track in state with analysis results
        setTracks(prev => prev.map(t => t.id === trackId ? {
          ...t,
          bpm: data.analysis.bpm > 0 ? data.analysis.bpm : t.bpm,
          key: data.analysis.key || t.key,
          duration: data.analysis.duration > 0 ? data.analysis.duration : t.duration,
        } : t));
      }
    }).catch(() => {});
  }, []);

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
      // Auto-analyze in background
      if (newTrack.id && newTrack.fileUrl) triggerAnalysis(newTrack.id, newTrack.fileUrl);
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
        // Auto-analyze each track in background
        newTracks.forEach((t: any) => { if (t.id && t.fileUrl) triggerAnalysis(t.id, t.fileUrl); });
      }
    } catch {
      const newTracks = items.map((d, i) => ({ ...d, id: d.id || `track-${Date.now()}-${i}` } as Track));
      setTracks(prev => [...newTracks, ...prev]);
    }
  }, []);

  const handleUpdateTrack = useCallback(async (data: Omit<Track, 'id'> & { id?: string }) => {
    if (!data.id) return;
    try {
      const res = await fetch('/api/tracks', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getActiveToken()}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Error al guardar: ${err.error || res.status}`);
        return;
      }
    } catch (e) {
      alert('Error de conexion al guardar');
      return;
    }
    setTracks(prev => prev.map(t => (t.id === data.id ? { ...t, ...data } as Track : t)));
  }, []);

  const handleDeleteTrack = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/tracks?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getActiveToken()}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Error al eliminar: ${data.error || res.status}`);
        return;
      }
      setTracks(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      alert('Error de conexion al eliminar. Intenta de nuevo.');
    }
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
        collabArtistName={section === 'colab-page' && activeCollabId ? (activeCollabId === 'alex-selas' ? 'Alex Selas' : (collabProfiles[activeCollabId]?.artistName || activeCollabId)) : undefined}
        userName={userInfo?.name}
        userCredits={userInfo?.credits}
        onLoginClick={() => setShowAuth(true)}
        onLogout={handleUserLogout}
        onBuyCredits={() => setShowCreditShop(true)}
        onMyAccount={() => setShowUserPanel(true)}
        cartCount={cart.count}
        onCartOpen={() => cart.setIsOpen(true)}
      />

      {/* Auth Modal */}
      <AuthModal
        open={showAuth}
        onClose={() => setShowAuth(false)}
        onAuth={handleUserAuth}
      />

      {/* User Panel overlay */}
      {showUserPanel && userToken && userInfo && (
        <div className="fixed inset-0 z-[55] bg-[#0a0a0a] overflow-y-auto pt-16">
          <UserPanel
            userToken={userToken}
            userName={userInfo.name}
            userCredits={userInfo.credits}
            onBack={() => setShowUserPanel(false)}
            onBuyCredits={() => { setShowUserPanel(false); setShowCreditShop(true); }}
            onRefreshBalance={refreshBalance}
          />
        </div>
      )}

      {/* Credit Shop overlay */}
      {showCreditShop && (
        <div className="fixed inset-0 z-[55] bg-[#0a0a0a] overflow-y-auto pt-16">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <button
              onClick={() => setShowCreditShop(false)}
              className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4 text-sm"
            >
              <span>&larr; Volver</span>
            </button>
          </div>
          <CreditShop
            userToken={userToken}
            userCredits={userInfo?.credits ?? 0}
            onLoginRequired={() => { setShowCreditShop(false); setShowAuth(true); }}
            onCreditsUpdated={(c) => setUserInfo(prev => prev ? { ...prev, credits: c } : null)}
          />
        </div>
      )}

      {/* Main content */}
      <main className="pt-16">
        {/* (Home section removed — Music Drop is now the landing page) */}

        {/* ============ MUSIC DROP (landing page) ============ */}
        {section === 'colabs' && (() => {
          // All tracks for catalog (Alex Selas's + collaborators')
          const allCatalogTracks = tracks;
          // Build collaborator list: Music Drop first, then Alex Selas, then rest alphabetically
          const alexProf = collabProfiles['alex-selas'] as any;
          const mdProf = collabProfiles['music-drop'] as any;
          const dynamicCollabs = Object.entries(collabProfiles)
            .filter(([id]) => id !== 'alex-selas' && id !== 'music-drop')
            .map(([id, prof]: [string, any]) => ({
              id,
              name: prof.artistName || id,
              photoUrl: prof.photoUrl || '',
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'es'));
          const alexTrackCount = tracks.filter(t => !t.collaboratorId).length;
          const allProducers = [
            { id: 'music-drop', name: mdProf?.artistName || 'Music Drop', photoUrl: mdProf?.photoUrl || '/logo.png' },
            { id: 'alex-selas', name: alexProf?.artistName || 'Alex Selas', photoUrl: alexProf?.photoUrl || '/logo.png' },
            ...dynamicCollabs,
          ];
          return (
            <>
            {/* MUSIC DROP Hero Banner — Video */}
            <section className="relative min-h-[42vh] sm:min-h-[48vh] flex items-center justify-center overflow-hidden">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
                src="/banner-loop.mp4"
              />
              <div className="absolute inset-0 bg-black/55" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-[#0a0a0a]/60" />
              <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 w-full max-w-3xl mx-auto py-16 sm:py-20">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mb-6">
                  <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-yellow-400/25 bg-black/40 backdrop-blur-sm">
                    <Music className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-yellow-400 font-semibold tracking-wide">La comunidad de los DJs</span>
                  </div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="flex flex-col items-center mb-5">
                  <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-[0.15em] text-white leading-[0.9] drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">MUSIC</h1>
                  <h2 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-[0.25em] gradient-text leading-[0.9] mt-1 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">DROP</h2>
                  <p className="text-xs sm:text-sm text-zinc-300 font-medium tracking-widest mt-2 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">by 360DJAcademy</p>
                </motion.div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.25 }}>
                  <p className="text-sm sm:text-base text-zinc-300 font-medium tracking-[0.25em] uppercase drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                    Remixes &middot; Mashups &middot; Hype Intros &middot; Sesiones
                  </p>
                </motion.div>
              </div>
            </section>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
              <h3 className="text-xl font-bold text-zinc-50 mb-6">Nuestros productores</h3>
              {/* Producer avatars — Alex Selas first, then collaborators — wait for profiles to load */}
              {collabProfilesLoaded && <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-10">
                {allProducers.map(collab => {
                  const trackCount = collab.id === 'alex-selas'
                    ? alexTrackCount
                    : allCatalogTracks.filter(t => t.collaboratorId === collab.id).length;
                  const prof = collabProfiles[collab.id] as any;
                  const pc = prof?.colorPrimary || '#FACC15';
                  return (
                    <button
                      key={collab.id}
                      onClick={() => navigate('colab-page', collab.id)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all"
                      style={{ backgroundColor: `${pc}0D`, border: `1px solid ${pc}33` }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${pc}80`; (e.currentTarget as HTMLElement).style.backgroundColor = `${pc}1A`; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = `${pc}33`; (e.currentTarget as HTMLElement).style.backgroundColor = `${pc}0D`; }}
                    >
                      {collab.photoUrl ? (
                        <img src={collab.photoUrl} alt={collab.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" style={{ border: `2px solid ${pc}66` }} />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ border: `2px solid ${pc}66`, backgroundColor: `${pc}1A` }}>
                          <span className="text-sm font-bold" style={{ color: pc }}>{collab.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="text-left">
                        <h3 className="text-sm font-bold leading-tight" style={{ color: pc }}>{collab.name}</h3>
                        <p className="text-[11px]" style={{ color: `${pc}80` }}>
                          {trackCount > 0 ? `${trackCount} track${trackCount !== 1 ? 's' : ''}` : 'Próximamente'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>}

              {/* Promo banner */}
              <div className="relative overflow-hidden rounded-2xl mb-10">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500" />
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 20px)' }} />
                <div className="relative px-6 py-5 sm:py-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6">
                  <div className="text-center sm:text-left">
                    <p className="text-black/90 font-bold text-lg sm:text-xl">20% extra en tu primera compra de drops</p>
                    <p className="text-black/60 text-sm mt-0.5">Introduce el codigo al comprar tus drops</p>
                  </div>
                  <span className="px-5 py-2.5 bg-black text-yellow-400 font-black text-xl sm:text-2xl tracking-widest rounded-xl shadow-lg">WELCOME20</span>
                </div>
              </div>

              {/* 4 random featured tracks from all tracks */}
              {colabRandomFeatured.length > 0 && (
                <div className="mb-10">
                  <div className="flex items-center gap-3 mb-6">
                    <Sparkles className="w-5 h-5 text-yellow-400" />
                    <h2 className="text-2xl font-bold text-zinc-50">Destacados</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {colabRandomFeatured.map(track => (
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
              )}

              {/* All tracks catalog */}
              {allCatalogTracks.length > 0 && (
                <CollabTracksSection
                  tracks={allCatalogTracks}
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
                  Si eres DJ o productor y quieres vender tus tracks en MusicDrop, escríbenos con tu propuesta.
                </p>
                <p className="text-yellow-400 font-semibold text-lg select-all">soporte@club360.es</p>
              </div>

              {/* Credit Shop */}
              <CreditShop
                userToken={userToken}
                userCredits={userInfo?.credits ?? 0}
                onLoginRequired={() => setShowAuth(true)}
                onCreditsUpdated={(c) => setUserInfo(prev => prev ? { ...prev, credits: c } : null)}
              />

              <div className="mt-16">
                <Footer onAdmin={() => navigate('admin')} />
              </div>
            </div>
            </>
          );
        })()}

        {/* ============ CLUB360 ============ */}
        {section === 'club360' && (
          <div className="min-h-screen">
            {/* Hero */}
            <section className="relative min-h-[50vh] sm:min-h-[55vh] flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-yellow-400/8 rounded-full blur-[200px]" />
                <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-amber-500/8 rounded-full blur-[160px]" />
                <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-yellow-300/6 rounded-full blur-[140px]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0a0a0a_70%)]" />
              </div>
              <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(rgba(250,204,21,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(250,204,21,.2) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
              <div className="relative z-10 flex flex-col items-center text-center px-4 w-full max-w-3xl mx-auto py-20 sm:py-24">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="mb-6">
                  <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-yellow-400/25 bg-yellow-400/5">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-yellow-400 font-semibold tracking-wide">Herramientas de IA para DJs</span>
                  </div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="mb-6">
                  <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-[0.1em] leading-[0.9]">
                    <span className="gradient-text">CLUB</span>
                    <span className="text-white">360</span>
                  </h1>
                </motion.div>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.2 }} className="text-lg sm:text-xl text-zinc-400 max-w-xl mb-8 leading-relaxed">
                  Crea contenido profesional para tu carrera como DJ con inteligencia artificial. Flyers, estrategias de marketing, letras, videoclips, análisis viral y mucho más.
                </motion.p>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}>
                  <a
                    href="https://www.club360.es/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl gradient-bg text-black font-bold text-lg shadow-lg shadow-yellow-400/25 hover:shadow-yellow-400/40 hover:scale-105 active:scale-95 transition-all"
                  >
                    Únete ahora
                    <ArrowRight className="w-5 h-5" />
                  </a>
                </motion.div>
              </div>
            </section>

            {/* Módulos */}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 -mt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  { icon: Star, title: 'Creador', desc: 'Genera prompts para imágenes y vídeos profesionales con IA.' },
                  { icon: Music, title: 'Videoclips', desc: 'Planes de producción completos para tus videoclips musicales.' },
                  { icon: Headphones, title: 'Estudio', desc: 'Fotos de estudio y promos de DJ con calidad profesional.' },
                  { icon: Zap, title: 'Diseño', desc: 'Posters, flyers y cartelería para tus eventos y sesiones.' },
                  { icon: Crown, title: 'Música IA', desc: 'Letras, prompts para Suno AI y producción musical con IA.' },
                  { icon: Users, title: 'Marketing', desc: 'Estrategias virales y planes de contenido para redes sociales.' },
                  { icon: Search, title: 'Análisis', desc: 'Analiza vídeos virales y genera kits de producción.' },
                  { icon: Headphones, title: 'Podcasts', desc: 'Genera temas, guiones y esquemas para tus episodios.' },
                ].map((feat, i) => (
                  <motion.div
                    key={feat.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 + i * 0.06 }}
                    className="bg-[#141414] rounded-2xl border border-zinc-800/50 p-5 hover:border-yellow-400/30 hover:bg-yellow-400/5 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-yellow-400/10 flex items-center justify-center mb-3 group-hover:bg-yellow-400/20 transition-colors">
                      <feat.icon className="w-5 h-5 text-yellow-400" />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-100 mb-1">{feat.title}</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">{feat.desc}</p>
                  </motion.div>
                ))}
              </div>

              {/* CTA final */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.9 }}
                className="mt-12 bg-gradient-to-br from-yellow-400/10 to-amber-500/10 rounded-[22px] border border-yellow-400/20 p-8 sm:p-12 text-center"
              >
                <h2 className="text-2xl sm:text-3xl font-bold text-zinc-50 mb-3">Crea contenido como un profesional</h2>
                <p className="text-zinc-400 mb-8 max-w-lg mx-auto">
                  Accede a todas las herramientas de IA de Club 360 y lleva tu imagen como DJ al siguiente nivel.
                </p>
                <a
                  href="https://www.club360.es/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl gradient-bg text-black font-bold text-lg shadow-lg shadow-yellow-400/25 hover:shadow-yellow-400/40 hover:scale-105 active:scale-95 transition-all"
                >
                  Acceder a Club 360
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
        {section === 'colab-admin' && (
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
        {section === 'colab-page' && activeCollabId && (() => {
          const prof = collabProfiles[activeCollabId];
          const collabDisplayName = activeCollabId === 'alex-selas' ? 'Alex Selas' : (prof?.artistName || activeCollabId);
          return (
            <CollabPage
              collaboratorId={activeCollabId}
              collaboratorName={collabDisplayName}
              tracks={tracks}
              currentTrackId={player.currentTrack?.id || null}
              isPlaying={player.isPlaying}
              progress={player.progress}
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

        {/* ============ ADMIN ============ */}
        {section === 'admin' && (
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
                adminToken={admin.getToken()}
              />
            )}
          </>
        )}
      </main>

      {/* Cart Drawer */}
      <CartDrawer
        items={cart.items}
        isOpen={cart.isOpen}
        onClose={() => cart.setIsOpen(false)}
        onRemoveItem={cart.removeItem}
        onClearCart={cart.clearCart}
        userToken={userToken}
        userCredits={userInfo?.credits ?? 0}
        onLoginRequired={() => { cart.setIsOpen(false); setShowAuth(true); }}
        onBuyCredits={() => { cart.setIsOpen(false); setShowCreditShop(true); }}
        onCreditsUpdated={(c) => { setUserInfo(prev => prev ? { ...prev, credits: c } : null); const s = localStorage.getItem('musicdrop-user'); if (s) { const u = JSON.parse(s); u.credits = c; localStorage.setItem('musicdrop-user', JSON.stringify(u)); } }}
      />

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
              if (window.location.pathname.startsWith('/track/')) {
                // Go back to the page the user was on before opening the track
                if (section === 'colab-page' && activeCollabId) {
                  window.history.replaceState({}, '', `/collab/${activeCollabId}`);
                } else {
                  window.history.replaceState({}, '', '/');
                }
              }
            }}
            onPlay={() => player.play(selectedTrack)}
            onAddToCart={() => cart.addItem(selectedTrack)}
            userToken={userToken}
            userCredits={userInfo?.credits ?? 0}
            onLoginRequired={() => setShowAuth(true)}
            onBuyCredits={() => setShowCreditShop(true)}
            onCreditsUpdated={(c) => { setUserInfo(prev => prev ? { ...prev, credits: c } : null); const s = localStorage.getItem('musicdrop-user'); if (s) { const u = JSON.parse(s); u.credits = c; localStorage.setItem('musicdrop-user', JSON.stringify(u)); } }}
          />
        )}
      </AnimatePresence>

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
