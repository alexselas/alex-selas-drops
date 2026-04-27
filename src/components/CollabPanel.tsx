import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Plus, Edit2, Trash2, LogOut, Music, Clock, Package,
  ListMusic, Search, ChevronDown, ChevronUp, Star, User, GripVertical, ExternalLink,
  ShoppingBag, DollarSign, TrendingUp,
} from 'lucide-react';
import type { Track, Category, Collaborator } from '../types';
import { formatPrice, formatDuration } from '../lib/utils';
import AdminTrackForm from './AdminTrackForm';
import PackUploadForm from './PackUploadForm';
import CollabProfileForm from './CollabProfileForm';

type CollabTab = 'tracks' | 'orders' | 'profile';

interface CollabOrder {
  id: string;
  tracks: string[];
  email: string;
  amount: number;
  date: string;
  status?: string;
}

interface CollabPanelProps {
  collaborator: Collaborator;
  tracks: Track[];
  onAddTrack: (data: Omit<Track, 'id'> & { id?: string }) => void;
  onAddTracksBatch: (data: (Omit<Track, 'id'> & { id?: string })[]) => Promise<void> | void;
  onUpdateTrack: (data: Omit<Track, 'id'> & { id?: string }) => void;
  onDeleteTrack: (id: string) => void;
  onReorderTracks: (tracks: Track[]) => void;
  onLogout: () => void;
  collabToken: string;
}

export default function CollabPanel({
  collaborator,
  tracks,
  onAddTrack,
  onAddTracksBatch,
  onUpdateTrack,
  onDeleteTrack,
  onReorderTracks,
  onLogout,
  collabToken,
}: CollabPanelProps) {
  const [tab, setTab] = useState<CollabTab>('tracks');
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingPack, setIsAddingPack] = useState(false);
  const [editingPackTracks, setEditingPackTracks] = useState<Track[] | null>(null);
  const [trackSearch, setTrackSearch] = useState('');
  const [trackFilter, setTrackFilter] = useState<Category | 'all' | 'packs'>('all');
  const [expandedPackId, setExpandedPackId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Orders state
  const [orders, setOrders] = useState<CollabOrder[]>([]);
  const [ordersRevenue, setOrdersRevenue] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersPeriod, setOrdersPeriod] = useState('month');
  const [ordersPage, setOrdersPage] = useState(1);
  const ORDERS_PER_PAGE = 20;

  const fetchOrders = (period: string) => {
    setOrdersLoading(true);
    setOrdersPeriod(period);
    setOrdersPage(1);
    fetch(`/api/orders?period=${period}&limit=100`, {
      headers: { Authorization: `Bearer ${collabToken}` },
    })
      .then(r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'Sesion expirada' : `Error ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (data.orders) {
          setOrders(data.orders);
          setOrdersRevenue(data.revenue || 0);
        }
      })
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
  };

  useEffect(() => { fetchOrders('month'); }, []);

  const totalOrderPages = Math.max(1, Math.ceil(orders.length / ORDERS_PER_PAGE));
  const paginatedOrders = orders.slice((ordersPage - 1) * ORDERS_PER_PAGE, ordersPage * ORDERS_PER_PAGE);

  const myTracks = tracks.filter(t => t.collaboratorId === collaborator.id);

  const filteredTracks = myTracks.filter(t => {
    if (trackFilter === 'packs') {
      if (!t.packId) return false;
    } else if (trackFilter !== 'all' && t.category !== trackFilter) return false;
    if (trackSearch.trim()) {
      const q = trackSearch.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q) || (t.packName || '').toLowerCase().includes(q);
    }
    return true;
  });

  const handleSave = (data: Omit<Track, 'id'> & { id?: string }) => {
    const enriched = {
      ...data,
      collaborator: true,
      collaboratorId: collaborator.id,
      artist: data.artist || collaborator.name,
    };
    if (editingTrack) {
      onUpdateTrack(enriched);
    } else {
      onAddTrack(enriched);
    }
    setEditingTrack(null);
    setIsAdding(false);
  };

  const categoryLabels: Record<string, string> = {
    sesiones: 'Sesion',
    remixes: 'Remix',
    mashups: 'Mashup',
    hypeintros: 'Hype Intro',
    transiciones: 'Transicion',
    originales: 'Original',
  };

  const categoryColors: Record<string, string> = {
    sesiones: 'text-emerald-400',
    remixes: 'text-violet-400',
    mashups: 'text-yellow-400',
    hypeintros: 'text-pink-400',
    transiciones: 'text-cyan-400',
    originales: 'text-orange-400',
    librerias: 'text-amber-400',
  };

  // Build display items: standalone tracks + grouped packs
  const seenPacks = new Set<string>();
  const standaloneTracks = filteredTracks.filter(t => !t.packId);
  const packItems: { packId: string; packName: string; tracks: Track[]; coverUrl: string; category: string; price: number }[] = [];
  for (const t of filteredTracks) {
    if (t.packId && !seenPacks.has(t.packId)) {
      seenPacks.add(t.packId);
      const packTracks = filteredTracks.filter(ft => ft.packId === t.packId);
      packItems.push({ packId: t.packId, packName: t.packName || 'Pack', tracks: packTracks, coverUrl: t.coverUrl, category: t.category, price: packTracks.reduce((s, pt) => s + pt.price, 0) });
    }
  }
  const totalItems = standaloneTracks.length + packItems.length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {collaborator.photoUrl ? (
            <img src={collaborator.photoUrl} alt={collaborator.name} className="w-10 h-10 rounded-xl object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <p className="text-xs text-zinc-500">Panel de</p>
            <h1 className="text-xl font-bold text-zinc-50">{collaborator.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/collab/${collaborator.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-emerald-400 hover:border-emerald-400/30 transition-colors text-sm"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">Acceder a mi perfil</span>
          </a>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-400/30 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-900/50 rounded-xl border border-zinc-800/50 mb-8">
        {([
          { id: 'tracks' as CollabTab, label: 'Tracks', icon: ListMusic },
          { id: 'orders' as CollabTab, label: 'Pedidos', icon: ShoppingBag },
          { id: 'profile' as CollabTab, label: 'Mi Perfil', icon: User },
        ]).map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setIsAdding(false); setEditingTrack(null); setIsAddingPack(false); setEditingPackTracks(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                tab === t.id
                  ? 'gradient-bg text-black shadow-lg'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ============ PEDIDOS ============ */}
      {tab === 'orders' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-4">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-2">
                <ShoppingBag className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-zinc-50">{orders.length}</div>
              <div className="text-xs text-zinc-500">Total pedidos</div>
            </div>
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-4">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center mb-2">
                <DollarSign className="w-5 h-5 text-violet-400" />
              </div>
              <div className="text-2xl font-bold text-zinc-50">{formatPrice(ordersRevenue)}</div>
              <div className="text-xs text-zinc-500">Ingresos</div>
            </div>
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-4">
              <div className="w-9 h-9 rounded-lg bg-yellow-400/10 flex items-center justify-center mb-2">
                <TrendingUp className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="text-2xl font-bold text-zinc-50">{orders.length > 0 ? formatPrice(ordersRevenue / orders.length) : '0,00 \u20AC'}</div>
              <div className="text-xs text-zinc-500">Promedio</div>
            </div>
          </div>

          {/* Period filter */}
          <div className="flex flex-wrap gap-2">
            {([
              { value: 'today', label: 'Hoy' },
              { value: 'week', label: 'Semana' },
              { value: 'month', label: 'Mes' },
              { value: 'year', label: 'Ano' },
              { value: 'all', label: 'Todo' },
            ] as const).map(p => (
              <button
                key={p.value}
                onClick={() => fetchOrders(p.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  ordersPeriod === p.value
                    ? 'gradient-bg text-black shadow-lg'
                    : 'bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Order list */}
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 overflow-hidden">
            <div className="p-4 border-b border-zinc-800/50">
              <h3 className="text-sm font-semibold text-zinc-300">Historial de pedidos</h3>
            </div>

            <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 text-xs text-zinc-500 font-medium border-b border-zinc-800/30">
              <div className="col-span-1">ID</div>
              <div className="col-span-4">Tracks</div>
              <div className="col-span-3">Comprador</div>
              <div className="col-span-2 text-right">Precio</div>
              <div className="col-span-2 text-right">Fecha</div>
            </div>

            {ordersLoading ? (
              <div className="text-center py-8 text-zinc-500 text-sm">Cargando pedidos...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 text-sm">Sin pedidos aun</div>
            ) : (
              <div className="divide-y divide-zinc-800/30">
                {paginatedOrders.map(order => (
                  <div key={order.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-4 py-3 hover:bg-zinc-800/20 transition-colors">
                    <div className="sm:col-span-1 text-xs text-zinc-500 font-mono">{order.id}</div>
                    <div className="sm:col-span-4 text-sm text-zinc-300 truncate">{order.tracks.join(', ')}</div>
                    <div className="sm:col-span-3 text-sm text-zinc-400 truncate">{order.email}</div>
                    <div className="sm:col-span-2 text-sm font-semibold sm:text-right">
                      {order.amount > 0 ? (
                        <span className="text-emerald-400">{formatPrice(order.amount)}</span>
                      ) : (
                        <span className="text-zinc-500">Gratis</span>
                      )}
                    </div>
                    <div className="sm:col-span-2 text-xs text-zinc-500 sm:text-right">{order.date}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalOrderPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setOrdersPage(p => Math.max(1, p - 1))}
                disabled={ordersPage <= 1}
                className="px-3 py-1.5 rounded-lg text-sm bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalOrderPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setOrdersPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                      ordersPage === p
                        ? 'gradient-bg text-black'
                        : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setOrdersPage(p => Math.min(totalOrderPages, p + 1))}
                disabled={ordersPage >= totalOrderPages}
                className="px-3 py-1.5 rounded-lg text-sm bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </button>
            </div>
          )}

          <p className="text-xs text-zinc-600 text-center">
            Pagina {ordersPage} de {totalOrderPages} · {orders.length} pedidos · Solo tus tracks
          </p>
        </motion.div>
      )}

      {/* ============ MI PERFIL ============ */}
      {tab === 'profile' && (
        <CollabProfileForm
          collaboratorId={collaborator.id}
          collaboratorName={collaborator.name}
          collabToken={collabToken}
        />
      )}

      {/* ============ TRACKS — identical to AdminPanel ============ */}
      {tab === 'tracks' && (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {/* Form */}
        {(isAddingPack || editingPackTracks) ? (
          <PackUploadForm
            adminToken={collabToken}
            defaultArtist={collaborator.name}
            hideCollaboratorCheckbox
            existingTracks={editingPackTracks || undefined}
            onSavePack={async (packTracks) => {
              if (editingPackTracks) {
                for (const t of packTracks) handleSave({ ...t, id: t.id });
              } else {
                const enriched = packTracks.map(t => ({
                  ...t,
                  collaborator: true,
                  collaboratorId: collaborator.id,
                  artist: t.artist || collaborator.name,
                }));
                await onAddTracksBatch(enriched);
              }
              setIsAddingPack(false);
              setEditingPackTracks(null);
            }}
            onCancel={() => { setIsAddingPack(false); setEditingPackTracks(null); }}
          />
        ) : (isAdding || editingTrack) ? (
          <AdminTrackForm
            track={editingTrack}
            adminToken={collabToken}
            defaultArtist={collaborator.name}
            hideCollaboratorCheckbox
            onSave={handleSave}
            onCancel={() => {
              setEditingTrack(null);
              setIsAdding(false);
            }}
          />
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-white font-semibold shadow-lg hover:scale-[1.02] transition-transform"
                >
                  <Plus className="w-5 h-5" />
                  Subir Track
                </button>
                <button
                  onClick={() => setIsAddingPack(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 font-semibold hover:border-yellow-400/30 hover:text-white transition-colors"
                >
                  <Package className="w-5 h-5" />
                  Subir Pack
                </button>
              </div>

              <div className="flex items-center gap-3 sm:ml-auto w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={trackSearch}
                    onChange={e => setTrackSearch(e.target.value)}
                    placeholder="Buscar track..."
                    className="w-full sm:w-52 pl-10 pr-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-500 text-sm focus:outline-none focus:border-yellow-400/50 transition-colors"
                  />
                </div>

                <div className="relative">
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                  <select
                    value={trackFilter}
                    onChange={e => setTrackFilter(e.target.value as Category | 'all' | 'packs')}
                    className="pl-4 pr-10 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-yellow-400/50 appearance-none cursor-pointer"
                  >
                    <option value="all">Todas</option>
                    <option value="packs">Packs</option>
                    <option value="sesiones">Sesiones</option>
                    <option value="remixes">Remixes</option>
                    <option value="mashups">Mashups</option>
                    <option value="hypeintros">Hype Intros</option>
                    <option value="transiciones">Transiciones</option>
                    <option value="originales">Originales</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Count */}
            <p className="text-sm text-zinc-500">
              {standaloneTracks.length} track{standaloneTracks.length !== 1 ? 's' : ''}{packItems.length > 0 ? ` · ${packItems.length} pack${packItems.length !== 1 ? 's' : ''}` : ''}
            </p>

            <div className="space-y-2">
              {/* Packs — draggable */}
              {packItems.map(pack => {
                const isExpanded = expandedPackId === pack.packId;
                const packDragging = dragId === pack.packId;
                const packDragOver = dragOverId === pack.packId;
                return (
                  <div
                    key={pack.packId}
                    className="rounded-xl overflow-hidden"
                    draggable
                    onDragStart={e => { setDragId(pack.packId); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOverId !== pack.packId) setDragOverId(pack.packId); }}
                    onDragLeave={() => { if (dragOverId === pack.packId) setDragOverId(null); }}
                    onDrop={e => {
                      e.preventDefault();
                      if (dragId && dragId !== pack.packId) {
                        const r = [...tracks];
                        const fromIdx = r.findIndex(t => t.id === dragId || t.packId === dragId);
                        const toIdx = r.findIndex(t => t.packId === pack.packId);
                        if (fromIdx !== -1 && toIdx !== -1) {
                          const [moved] = r.splice(fromIdx, 1);
                          r.splice(toIdx, 0, moved);
                          onReorderTracks(r);
                        }
                      }
                      setDragId(null);
                      setDragOverId(null);
                    }}
                  >
                    <div
                      className={`flex items-center gap-4 p-4 border transition-all cursor-pointer group ${
                        packDragging ? 'opacity-40 bg-zinc-900/30 border-zinc-800/30' :
                        packDragOver ? 'bg-yellow-400/5 border-yellow-400/30' :
                        'bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700/50'
                      } ${isExpanded ? 'rounded-t-xl border-b-0' : 'rounded-xl'}`}
                      onClick={() => setExpandedPackId(isExpanded ? null : pack.packId)}
                    >
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-400/20 to-amber-500/20 flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {pack.coverUrl ? (
                          <img src={pack.coverUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-6 h-6 text-yellow-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-zinc-200 truncate">{pack.packName}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-400/10 text-yellow-400 font-bold flex-shrink-0">PACK</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                          <span className={`font-medium ${categoryColors[pack.category]}`}>{categoryLabels[pack.category]}</span>
                          <span>{pack.tracks.length} tracks</span>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-yellow-400 hidden sm:block flex-shrink-0">{formatPrice(pack.price)}</span>
                      <div className="flex items-center gap-0.5 opacity-50 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => { e.stopPropagation(); setEditingPackTracks(pack.tracks); }}
                          className="p-2 rounded-lg text-zinc-500 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors"
                          title="Editar pack"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async e => { e.stopPropagation(); for (const t of pack.tracks) onDeleteTrack(t.id); }}
                          className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          title="Eliminar pack"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="bg-[#111] border border-zinc-800/50 border-t-0 rounded-b-xl divide-y divide-zinc-800/30 max-h-[400px] overflow-y-auto">
                        {pack.tracks.map((track, idx) => {
                          const ptDragging = dragId === track.id;
                          const ptDragOver = dragOverId === track.id;
                          return (
                          <div
                            key={track.id}
                            draggable
                            onDragStart={e => { e.stopPropagation(); setDragId(track.id); e.dataTransfer.effectAllowed = 'move'; }}
                            onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                            onDragOver={e => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; if (dragOverId !== track.id) setDragOverId(track.id); }}
                            onDragLeave={() => { if (dragOverId === track.id) setDragOverId(null); }}
                            onDrop={e => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (dragId && dragId !== track.id) {
                                const r = [...tracks];
                                const fromIdx = r.findIndex(t => t.id === dragId);
                                const toIdx = r.findIndex(t => t.id === track.id);
                                if (fromIdx !== -1 && toIdx !== -1) {
                                  const [moved] = r.splice(fromIdx, 1);
                                  r.splice(toIdx, 0, moved);
                                  onReorderTracks(r);
                                }
                              }
                              setDragId(null);
                              setDragOverId(null);
                            }}
                            className={`flex items-center gap-3 px-5 py-3 transition-all ${
                              ptDragging ? 'opacity-40 bg-zinc-900/30' :
                              ptDragOver ? 'bg-yellow-400/10' :
                              'hover:bg-zinc-800/30'
                            }`}
                            style={{ cursor: 'grab' }}
                          >
                            <div className="flex-shrink-0 text-zinc-700 hover:text-zinc-400 transition-colors cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[11px] text-zinc-600 font-bold w-5 text-center flex-shrink-0">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-zinc-200 truncate">{track.title}</p>
                              <div className="flex items-center gap-2 text-[11px] text-zinc-600">
                                {track.genre && <span>{track.genre}</span>}
                                {track.bpm > 0 && <span>· {track.bpm} BPM</span>}
                                {track.key && <span>· {track.key}</span>}
                                {track.duration > 0 && <span>· {formatDuration(track.duration)}</span>}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-yellow-400/70 hidden sm:block flex-shrink-0">{formatPrice(track.price)}</span>
                            <div className="flex items-center gap-1">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${track.previewUrl ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-600'}`}>
                                Preview {track.previewUrl ? '✓' : '—'}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${track.fileUrl ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-600'}`}>
                                Archivo {track.fileUrl ? '✓' : '—'}
                              </span>
                            </div>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              <button
                                onClick={e => { e.stopPropagation(); setExpandedPackId(null); setEditingTrack(track); setIsAdding(false); setIsAddingPack(false); setEditingPackTracks(null); }}
                                className="p-1.5 rounded-lg text-zinc-500 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors"
                                title="Editar track"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); onDeleteTrack(track.id); }}
                                className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                title="Eliminar track"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Standalone tracks — draggable */}
              {standaloneTracks.map(track => {
                const isDragging = dragId === track.id;
                const isDragOver = dragOverId === track.id;
                return (
                  <div
                    key={track.id}
                    draggable
                    onDragStart={e => { setDragId(track.id); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOverId !== track.id) setDragOverId(track.id); }}
                    onDragLeave={() => { if (dragOverId === track.id) setDragOverId(null); }}
                    onDrop={e => {
                      e.preventDefault();
                      if (dragId && dragId !== track.id) {
                        const r = [...tracks];
                        const fromIdx = r.findIndex(t => t.id === dragId);
                        const toIdx = r.findIndex(t => t.id === track.id);
                        if (fromIdx !== -1 && toIdx !== -1) {
                          const [moved] = r.splice(fromIdx, 1);
                          r.splice(toIdx, 0, moved);
                          onReorderTracks(r);
                        }
                      }
                      setDragId(null);
                      setDragOverId(null);
                    }}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all group ${
                      isDragging ? 'opacity-40 scale-[0.98] bg-zinc-900/30 border-zinc-800/30' :
                      isDragOver ? 'bg-yellow-400/5 border-yellow-400/30 shadow-lg shadow-yellow-400/5' :
                      'bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700/50'
                    }`}
                    style={{ cursor: 'grab' }}
                  >
                    <div className="flex-shrink-0 text-zinc-700 hover:text-zinc-400 transition-colors cursor-grab active:cursor-grabbing">
                      <GripVertical className="w-4 h-4" />
                    </div>
                    <div className="w-14 h-14 rounded-xl bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {track.coverUrl ? (
                        <img src={track.coverUrl} alt="" className="w-full h-full object-cover" draggable={false} />
                      ) : (
                        <Music className="w-6 h-6 text-zinc-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-zinc-200 truncate">{track.title}</p>
                        {track.featured && <Star className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 fill-yellow-400" />}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                        <span className={`font-medium ${categoryColors[track.category]}`}>{categoryLabels[track.category]}</span>
                        <span>{track.genre}</span>
                        {track.bpm > 0 && <span>{track.bpm} BPM</span>}
                        {track.duration > 0 && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" />{formatDuration(track.duration)}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${track.coverUrl ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-600'}`}>Portada {track.coverUrl ? '✓' : '—'}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${track.previewUrl ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-600'}`}>Preview {track.previewUrl ? '✓' : '—'}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${track.fileUrl ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-600'}`}>Archivo {track.fileUrl ? '✓' : '—'}</span>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-yellow-400 hidden sm:block flex-shrink-0">{formatPrice(track.price)}</span>
                    <div className="flex items-center gap-0.5 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingTrack(track); setIsAdding(false); }} className="p-2 rounded-lg text-zinc-500 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors" title="Editar"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => onDeleteTrack(track.id)} className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                );
              })}

              {totalItems === 0 && (
                <div className="text-center py-16">
                  <ListMusic className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-500">No se encontraron tracks</p>
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
      )}
    </div>
  );
}
