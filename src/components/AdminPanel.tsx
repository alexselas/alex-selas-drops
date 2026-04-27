import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Plus, Edit2, Trash2, LogOut, Music, Package, Tag, Clock,
  LayoutDashboard, ListMusic, ShoppingBag, Settings, Users, Mail,
  TrendingUp, DollarSign, Eye, Play, Radio, Layers, Library,
  Search, ChevronDown, Star, ChevronUp, GripVertical, Copy,
  Save, Loader2, User, Upload, Image, Link, CheckCircle,
} from 'lucide-react';
import type { Track, Category, CollaboratorProfile } from '../types';
import { formatPrice, formatDuration } from '../lib/utils';
import { collaborators } from '../data/collaborators';
import AdminTrackForm from './AdminTrackForm';
import PackUploadForm from './PackUploadForm';
import ImageCropper from './ImageCropper';
import CollabProfileForm from './CollabProfileForm';

type AdminTab = 'dashboard' | 'tracks' | 'orders' | 'newsletter' | 'settings' | 'collabs';

interface AdminPanelProps {
  tracks: Track[];
  onAddTrack: (data: Omit<Track, 'id'> & { id?: string }) => Promise<void> | void;
  onAddTracksBatch: (data: (Omit<Track, 'id'> & { id?: string })[]) => Promise<void> | void;
  onUpdateTrack: (data: Omit<Track, 'id'> & { id?: string }) => Promise<void> | void;
  onDeleteTrack: (id: string) => Promise<void> | void;
  onReorderTracks: (tracks: Track[]) => void;
  onLogout: () => void;
  adminToken?: string;
}

interface Order {
  id: string;
  tracks: string[];
  email: string;
  amount: number;
  date: string;
}

export default function AdminPanel({ tracks, onAddTrack, onAddTracksBatch, onUpdateTrack, onDeleteTrack, onReorderTracks, onLogout, adminToken }: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingPack, setIsAddingPack] = useState(false);
  const [editingPackTracks, setEditingPackTracks] = useState<Track[] | null>(null);
  const [trackSearch, setTrackSearch] = useState('');
  const [trackFilter, setTrackFilter] = useState<Category | 'all' | 'packs'>('all');
  const [expandedAdminPackId, setExpandedAdminPackId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersRevenue, setOrdersRevenue] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersPeriod, setOrdersPeriod] = useState('month');
  const [ordersError, setOrdersError] = useState('');
  const [ordersPage, setOrdersPage] = useState(1);
  const ORDERS_PER_PAGE = 20;

  const getAdminToken = () => sessionStorage.getItem('alex-selas-drops-token') || '';

  const fetchOrders = (period: string) => {
    setOrdersLoading(true);
    setOrdersPeriod(period);
    setOrdersError('');
    setOrdersPage(1);
    fetch(`/api/orders?period=${period}&limit=100`, {
      headers: { Authorization: `Bearer ${getAdminToken()}` },
    })
      .then(r => {
        if (!r.ok) throw new Error(r.status === 401 ? 'Sesion expirada. Cierra sesion y vuelve a entrar.' : `Error ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (data.orders) {
          setOrders(data.orders);
          setOrdersRevenue(data.revenue || 0);
        }
      })
      .catch((e) => { setOrdersError(e.message || 'Error al cargar pedidos'); })
      .finally(() => setOrdersLoading(false));
  };

  const totalOrderPages = Math.max(1, Math.ceil(orders.length / ORDERS_PER_PAGE));
  const paginatedOrders = orders.slice((ordersPage - 1) * ORDERS_PER_PAGE, ordersPage * ORDERS_PER_PAGE);

  useEffect(() => { fetchOrders('month'); }, []);

  // Stats (only own tracks, not collaborator uploads)
  const myTracks = tracks.filter(t => !t.collaboratorId);
  const stats = {
    total: myTracks.length,
    sesiones: myTracks.filter(t => t.category === 'sesiones').length,
    remixes: myTracks.filter(t => t.category === 'remixes').length,
    mashups: myTracks.filter(t => t.category === 'mashups').length,
    librerias: myTracks.filter(t => t.category === 'librerias').length,
    featured: myTracks.filter(t => t.featured).length,
    revenue: ordersRevenue,
    orders: orders.length,
  };

  const categoryLabels: Record<string, string> = {
    sesiones: 'Sesión',
    remixes: 'Remix',
    mashups: 'Mashup',
    librerias: 'Librería',
  };

  const categoryColors: Record<string, string> = {
    sesiones: 'text-emerald-400',
    remixes: 'text-violet-400',
    mashups: 'text-yellow-400',
    librerias: 'text-amber-400',
  };

  const categoryIcons: Record<string, typeof Music> = {
    sesiones: Radio,
    remixes: Tag,
    mashups: Layers,
    librerias: Library,
  };

  // Filter tracks for list (exclude collaborator tracks — those are in their own tab)
  const filteredTracks = tracks.filter(t => {
    if (t.collaboratorId) return false;
    if (trackFilter === 'packs') {
      if (!t.packId) return false;
    } else if (trackFilter !== 'all') {
      if (t.category !== trackFilter) return false;
    }
    if (trackSearch.trim()) {
      const q = trackSearch.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q) || (t.packName || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Newsletter: unique emails from orders
  const newsletterEmails = (() => {
    const seen = new Set<string>();
    const list: { email: string; lastOrder: string; type: string }[] = [];
    for (const o of orders) {
      const e = o.email?.toLowerCase().trim();
      if (!e || e === 'sin email' || e === 'descarga gratuita' || seen.has(e)) continue;
      seen.add(e);
      list.push({ email: o.email, lastOrder: o.date, type: o.amount > 0 ? 'Pago' : 'Gratis' });
    }
    return list;
  })();
  const [emailsCopied, setEmailsCopied] = useState(false);

  const tabs: { id: AdminTab; label: string; icon: typeof Music }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tracks', label: 'Tracks', icon: ListMusic },
    { id: 'orders', label: 'Pedidos', icon: ShoppingBag },
    { id: 'newsletter', label: 'Newsletter', icon: Mail },
    { id: 'settings', label: 'Perfil', icon: User },
    { id: 'collabs', label: 'Colaboradores', icon: Users },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-50">Admin Panel</h1>
            <p className="text-xs text-zinc-500">Admin</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-400/30 transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Cerrar sesión</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-zinc-900/50 rounded-xl border border-zinc-800/50 mb-8 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setIsAdding(false); setEditingTrack(null); }}
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

      {/* ============ DASHBOARD ============ */}
      {tab === 'dashboard' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Tracks', value: stats.total, icon: ListMusic, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
              { label: 'Destacados', value: stats.featured, icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
              { label: 'Pedidos', value: stats.orders, icon: ShoppingBag, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { label: 'Ingresos', value: formatPrice(stats.revenue), icon: DollarSign, color: 'text-violet-400', bg: 'bg-violet-500/10' },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-4">
                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div className="text-2xl font-bold text-zinc-50">{s.value}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Category breakdown */}
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
            <h3 className="text-sm font-semibold text-zinc-300 mb-4">Por categoría</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(['sesiones', 'remixes', 'mashups', 'librerias'] as Category[]).map(cat => {
                const Icon = categoryIcons[cat];
                const count = stats[cat];
                return (
                  <div key={cat} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/30">
                    <Icon className={`w-5 h-5 ${categoryColors[cat]}`} />
                    <div>
                      <div className="text-lg font-bold text-zinc-200">{count}</div>
                      <div className="text-xs text-zinc-500">{categoryLabels[cat]}s</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent orders */}
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-300">Últimos pedidos</h3>
              <button
                onClick={() => setTab('orders')}
                className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
              >
                Ver todos
              </button>
            </div>
            <div className="space-y-2">
              {orders.length === 0 && !ordersLoading && (
                <p className="text-sm text-zinc-600 text-center py-4">Sin pedidos aún</p>
              )}
              {orders.slice(0, 3).map(order => (
                <div key={order.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/30">
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-300 truncate">{order.tracks.join(', ') || 'Track'}</p>
                    <p className="text-xs text-zinc-500">{order.email}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-sm font-semibold text-yellow-400">{formatPrice(order.amount)}</p>
                    <p className="text-xs text-zinc-600">{order.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => { setTab('tracks'); setIsAdding(true); }}
              className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-yellow-400/30 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-200">Subir nuevo track</p>
                <p className="text-xs text-zinc-500">Añade música al catálogo</p>
              </div>
            </button>
            <button
              onClick={() => setTab('tracks')}
              className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-yellow-400/30 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Edit2 className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-200">Gestionar catálogo</p>
                <p className="text-xs text-zinc-500">Edita o elimina tracks</p>
              </div>
            </button>
            <button
              onClick={() => setTab('orders')}
              className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-yellow-400/30 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-200">Ver ventas</p>
                <p className="text-xs text-zinc-500">Historial de pedidos</p>
              </div>
            </button>
          </div>
        </motion.div>
      )}

      {/* ============ TRACKS ============ */}
      {tab === 'tracks' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Form */}
          {(isAddingPack || editingPackTracks) ? (
            <PackUploadForm
              adminToken={adminToken}
              existingTracks={editingPackTracks || undefined}
              onSavePack={async (packTracks) => {
                if (editingPackTracks) {
                  for (const t of packTracks) await onUpdateTrack(t);
                } else {
                  await onAddTracksBatch(packTracks);
                }
                setIsAddingPack(false);
                setEditingPackTracks(null);
              }}
              onCancel={() => { setIsAddingPack(false); setEditingPackTracks(null); }}
            />
          ) : (isAdding || editingTrack) ? (
            <AdminTrackForm
              track={editingTrack}
              adminToken={adminToken}
              onSave={(data) => {
                if (editingTrack) {
                  onUpdateTrack(data);
                } else {
                  onAddTrack(data);
                }
                setEditingTrack(null);
                setIsAdding(false);
              }}
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
                  {/* Search */}
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

                  {/* Category filter */}
                  <div className="relative">
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                    <select
                      value={trackFilter}
                      onChange={e => setTrackFilter(e.target.value as Category | 'all' | 'packs')}
                      className="pl-4 pr-10 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 text-sm focus:outline-none focus:border-yellow-400/50 appearance-none cursor-pointer"
                    >
                      <option value="all">Todas</option>
                      <option value="sesiones">Sesiones</option>
                      <option value="remixes">Remixes</option>
                      <option value="mashups">Mashups</option>
                      <option value="packs">Packs</option>
                      <option value="librerias">Librerías</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Count */}
              {(() => {
                // Build display items: standalone tracks + packs grouped
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
                  <>
                    <p className="text-sm text-zinc-500">
                      {standaloneTracks.length} track{standaloneTracks.length !== 1 ? 's' : ''}{packItems.length > 0 ? ` · ${packItems.length} pack${packItems.length !== 1 ? 's' : ''}` : ''}
                    </p>

                    <div className="space-y-2">
                      {/* Packs — draggable */}
                      {packItems.map(pack => {
                        const isExpanded = expandedAdminPackId === pack.packId;
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
                              onClick={() => setExpandedAdminPackId(isExpanded ? null : pack.packId)}
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
                                  onClick={async e => { e.stopPropagation(); if (confirm(`¿Eliminar pack "${pack.packName}" y sus ${pack.tracks.length} tracks?`)) { for (const t of pack.tracks) await onDeleteTrack(t.id); } }}
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
                                  const packTrackDragging = dragId === track.id;
                                  const packTrackDragOver = dragOverId === track.id;
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
                                      packTrackDragging ? 'opacity-40 bg-zinc-900/30' :
                                      packTrackDragOver ? 'bg-yellow-400/10' :
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
                                        onClick={e => { e.stopPropagation(); setExpandedAdminPackId(null); setEditingTrack(track); setIsAdding(false); setIsAddingPack(false); setEditingPackTracks(null); }}
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
                      {standaloneTracks.map((track, i) => {
                        const CatIcon = categoryIcons[track.category] || Music;
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
                            {/* Drag handle */}
                            <div className="flex-shrink-0 text-zinc-700 hover:text-zinc-400 transition-colors cursor-grab active:cursor-grabbing">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="w-14 h-14 rounded-xl bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                              {track.coverUrl ? (
                                <img src={track.coverUrl} alt="" className="w-full h-full object-cover" draggable={false} />
                              ) : (
                                <CatIcon className={`w-6 h-6 ${categoryColors[track.category]}`} />
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
                );
              })()}
            </>
          )}
        </motion.div>
      )}

      {/* ============ ORDERS ============ */}
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
              <div className="text-xs text-zinc-500">Ingresos totales</div>
            </div>
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-4">
              <div className="w-9 h-9 rounded-lg bg-yellow-400/10 flex items-center justify-center mb-2">
                <TrendingUp className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="text-2xl font-bold text-zinc-50">{orders.length > 0 ? formatPrice(ordersRevenue / orders.length) : '0,00 €'}</div>
              <div className="text-xs text-zinc-500">Promedio por pedido</div>
            </div>
          </div>

          {/* Period filter */}
          <div className="flex flex-wrap gap-2">
            {([
              { value: 'today', label: 'Hoy' },
              { value: 'week', label: 'Semana' },
              { value: 'month', label: 'Mes' },
              { value: 'year', label: 'Año' },
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

            {/* Table header */}
            <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 text-xs text-zinc-500 font-medium border-b border-zinc-800/30">
              <div className="col-span-1">ID</div>
              <div className="col-span-4">Tracks</div>
              <div className="col-span-3">Comprador</div>
              <div className="col-span-2 text-right">Precio</div>
              <div className="col-span-2 text-right">Fecha</div>
            </div>

            {ordersError ? (
              <div className="text-center py-8 text-red-400 text-sm">{ordersError}</div>
            ) : ordersLoading ? (
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
            Pagina {ordersPage} de {totalOrderPages} · {orders.length} pedidos
          </p>
        </motion.div>
      )}

      {/* ============ NEWSLETTER ============ */}
      {tab === 'newsletter' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-zinc-200">Emails de compradores</h3>
              <p className="text-sm text-zinc-500 mt-1">{newsletterEmails.length} emails unicos de todos tus pedidos</p>
            </div>
            <button
              onClick={() => {
                const all = newsletterEmails.map(e => e.email).join(', ');
                navigator.clipboard.writeText(all).then(() => {
                  setEmailsCopied(true);
                  setTimeout(() => setEmailsCopied(false), 2500);
                });
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-bg text-black font-semibold shadow-lg hover:scale-[1.02] transition-transform"
            >
              {emailsCopied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {emailsCopied ? 'Copiados!' : 'Copiar todos'}
            </button>
          </div>

          {newsletterEmails.length === 0 ? (
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-8 text-center">
              <Mail className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500">No hay emails aun. Los emails apareceran cuando haya pedidos.</p>
              <p className="text-xs text-zinc-600 mt-2">Cambia el filtro de periodo en Pedidos a "Todo" para ver todos los emails.</p>
            </div>
          ) : (
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 overflow-hidden">
              <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 text-xs text-zinc-500 font-medium border-b border-zinc-800/30">
                <div className="col-span-5">Email</div>
                <div className="col-span-3">Tipo</div>
                <div className="col-span-4 text-right">Ultimo pedido</div>
              </div>
              <div className="divide-y divide-zinc-800/30 max-h-[500px] overflow-y-auto">
                {newsletterEmails.map(entry => (
                  <div key={entry.email} className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-4 py-3 hover:bg-zinc-800/20 transition-colors">
                    <div className="sm:col-span-5 text-sm text-zinc-300 truncate">{entry.email}</div>
                    <div className="sm:col-span-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        entry.type === 'Pago' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-700/30 text-zinc-400'
                      }`}>{entry.type}</span>
                    </div>
                    <div className="sm:col-span-4 text-xs text-zinc-500 sm:text-right">{entry.lastOrder}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-zinc-600 text-center">
            Los emails se extraen de los pedidos del periodo seleccionado en Pedidos ({ordersPeriod === 'today' ? 'Hoy' : ordersPeriod === 'week' ? 'Semana' : ordersPeriod === 'month' ? 'Mes' : ordersPeriod === 'year' ? 'Ano' : 'Todo'})
          </p>
        </motion.div>
      )}

      {/* ============ PERFIL ============ */}
      {tab === 'settings' && (
        <CollabProfileForm
          collaboratorId="alex-selas"
          collaboratorName="Alex Selas"
          collabToken={getAdminToken()}
          adminEditCollabId="alex-selas"
        />
      )}

      {/* ============ COLABORADORES ============ */}
      {tab === 'collabs' && (
        <CollabManager adminToken={adminToken} tracks={tracks} onAddTrack={onAddTrack} onAddTracksBatch={onAddTracksBatch} onUpdateTrack={onUpdateTrack} onDeleteTrack={onDeleteTrack} />
      )}
    </div>
  );
}

/* ====== COLLAB MANAGER SUB-COMPONENT ====== */
interface CollabManagerProps {
  adminToken?: string;
  tracks: Track[];
  onAddTrack: (data: Omit<Track, 'id'> & { id?: string }) => void;
  onAddTracksBatch: (data: (Omit<Track, 'id'> & { id?: string })[]) => Promise<void> | void;
  onUpdateTrack: (data: Omit<Track, 'id'> & { id?: string }) => void;
  onDeleteTrack: (id: string) => void;
}

interface CollabEntry { id: string; name: string; }

function CollabManager({ adminToken, tracks, onAddTrack, onAddTracksBatch, onUpdateTrack, onDeleteTrack }: CollabManagerProps) {
  const [allCollabs, setAllCollabs] = useState<CollabEntry[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [collabSubTab, setCollabSubTab] = useState<'profile' | 'tracks'>('tracks');
  const [deleting, setDeleting] = useState(false);
  const [profile, setProfile] = useState<CollaboratorProfile>({
    bio: '', photoUrl: '', bannerUrl: '', artistName: '',
    socialLinks: {}, colorPrimary: '#FACC15', colorSecondary: '#EAB308',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingPack, setIsAddingPack] = useState(false);
  const [trackSearch, setTrackSearch] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [localPhotoPreview, setLocalPhotoPreview] = useState('');
  const [localBannerPreview, setLocalBannerPreview] = useState('');
  const [cropperImage, setCropperImage] = useState('');
  const [cropperMode, setCropperMode] = useState<'photo' | 'banner'>('photo');
  const [originalPhoto, setOriginalPhoto] = useState('');
  const [originalBanner, setOriginalBanner] = useState('');
  const [photoDragOver, setPhotoDragOver] = useState(false);
  const [bannerDragOver, setBannerDragOver] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const handlePhotoFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setOriginalPhoto(url);
    setCropperMode('photo');
    setCropperImage(url);
  };

  const handleBannerFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setOriginalBanner(url);
    setCropperMode('banner');
    setCropperImage(url);
  };

  const handleCroppedImage = async (blob: Blob) => {
    const mode = cropperMode;
    setCropperImage('');
    const previewUrl = URL.createObjectURL(blob);
    const isBanner = mode === 'banner';

    if (isBanner) { setLocalBannerPreview(previewUrl); setUploadingBanner(true); }
    else { setLocalPhotoPreview(previewUrl); setUploadingPhoto(true); }

    const field = isBanner ? 'bannerUrl' : 'photoUrl';
    const folder = isBanner ? 'collab-banners' : 'collab-photos';
    const filename = isBanner ? 'banner' : 'profile';
    const clearPreview = () => { if (isBanner) setLocalBannerPreview(''); else setLocalPhotoPreview(''); };
    const stopLoading = () => { if (isBanner) setUploadingBanner(false); else setUploadingPhoto(false); };
    const setUrl = (url: string) => setProfile(prev => ({ ...prev, [field]: url }));

    try {
      const { upload } = await import('@vercel/blob/client');
      const result = await upload(`${folder}/${Date.now()}-${filename}.jpg`, blob, { access: 'public', handleUploadUrl: '/api/upload-url', clientPayload: JSON.stringify({ token: adminToken }) });
      if (result.url) { setUrl(result.url); clearPreview(); stopLoading(); return; }
    } catch (e) { console.log('Blob upload failed, trying server:', e); }

    try {
      const res = await fetch('/api/upload', { method: 'POST', headers: { 'X-Filename': `${folder}-${Date.now()}-${filename}.jpg`, 'X-Folder': folder, 'Content-Type': 'image/jpeg', 'Authorization': `Bearer ${adminToken}` }, body: blob });
      if (res.ok) { const data = await res.json(); if (data.url) { setUrl(data.url); clearPreview(); stopLoading(); return; } }
    } catch (e) { console.log('Server upload failed, using base64:', e); }

    const reader = new FileReader();
    reader.onload = () => { setUrl(reader.result as string); clearPreview(); stopLoading(); };
    reader.onerror = () => stopLoading();
    reader.readAsDataURL(blob);
  };

  // Load registered collaborators from API only
  useEffect(() => {
    fetch('/api/collab-accounts-list', {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.accounts && data.accounts.length > 0) {
          const list: CollabEntry[] = data.accounts.map((a: any) => ({
            id: a.collaboratorId,
            name: a.artistName || a.collaboratorId,
          }));
          setAllCollabs(list);
          setSelectedId(list[0].id);
        }
      })
      .catch(() => {});
  }, [adminToken]);

  const loadProfile = (id: string) => {
    setLoading(true);
    setSaved(false);
    fetch(`/api/collab-profile?id=${id}`)
      .then(r => r.json())
      .then(data => { if (data) setProfile(prev => ({ ...prev, ...data })); else setProfile({ bio: '', photoUrl: '', bannerUrl: '', artistName: '', socialLinks: {}, colorPrimary: '#FACC15', colorSecondary: '#EAB308' }); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (selectedId) { loadProfile(selectedId); setEditingTrack(null); setIsAdding(false); setIsAddingPack(false); } }, [selectedId]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/collab-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
          'X-Admin-Edit-Collab': selectedId,
        },
        body: JSON.stringify(profile),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    setSaving(false);
  };

  const handleTrackSave = (data: Omit<Track, 'id'> & { id?: string }) => {
    const enriched = {
      ...data,
      collaborator: true,
      collaboratorId: selectedId,
      artist: data.artist || profile.artistName || collabEntry?.name || selectedId,
    };
    if (editingTrack) {
      onUpdateTrack(enriched);
    } else {
      onAddTrack(enriched);
    }
    setEditingTrack(null);
    setIsAdding(false);
  };

  const handleDeleteCollab = async () => {
    if (!selectedId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/collab-delete?id=${selectedId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        setAllCollabs(prev => prev.filter(c => c.id !== selectedId));
        const remaining = allCollabs.filter(c => c.id !== selectedId);
        setSelectedId(remaining[0]?.id || '');
      }
    } catch {}
    setDeleting(false);
  };

  const collabTracks = tracks.filter(t => t.collaboratorId === selectedId);
  const filteredCollabTracks = collabTracks.filter(t => {
    if (!trackSearch.trim()) return true;
    const q = trackSearch.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q);
  });

  const inputClass = 'w-full px-4 py-2.5 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-yellow-400/50 text-sm';
  const collabEntry = allCollabs.find(c => c.id === selectedId);

  const categoryLabels: Record<string, string> = { sesiones: 'Sesión', remixes: 'Remix', mashups: 'Mashup', librerias: 'Librería' };
  const categoryColors: Record<string, string> = { sesiones: 'text-emerald-400', remixes: 'text-violet-400', mashups: 'text-yellow-400', librerias: 'text-amber-400' };

  if (allCollabs.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
        <Users className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
        <p className="text-zinc-500">No hay colaboradores registrados</p>
        <p className="text-zinc-600 text-sm mt-1">Los colaboradores aparecerán aquí cuando se registren en /colab-admin</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Selector */}
      <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Selecciona colaborador</h3>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className={`${inputClass} appearance-none cursor-pointer pr-10`}
            >
              {allCollabs.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {selectedId && (
            <button
              onClick={handleDeleteCollab}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          )}
        </div>
      </div>

      {/* Sub-tabs: Tracks / Profile */}
      <div className="flex gap-1 p-1 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
        <button
          onClick={() => { setCollabSubTab('tracks'); setEditingTrack(null); setIsAdding(false); setIsAddingPack(false); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${collabSubTab === 'tracks' ? 'gradient-bg text-black shadow-lg' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
        >
          <ListMusic className="w-4 h-4" />
          Tracks ({collabTracks.length})
        </button>
        <button
          onClick={() => { setCollabSubTab('profile'); setEditingTrack(null); setIsAdding(false); setIsAddingPack(false); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${collabSubTab === 'profile' ? 'gradient-bg text-black shadow-lg' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
        >
          <User className="w-4 h-4" />
          Perfil
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-yellow-400 animate-spin" />
        </div>
      ) : collabSubTab === 'tracks' ? (
        /* ===== TRACKS TAB ===== */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {isAddingPack ? (
            <PackUploadForm
              adminToken={adminToken || ''}
              defaultArtist={profile.artistName || collabEntry?.name || ''}
              hideCollaboratorCheckbox
              onSavePack={async (packTracks) => {
                const enriched = packTracks.map(t => ({
                  ...t,
                  collaborator: true,
                  collaboratorId: selectedId,
                  artist: t.artist || profile.artistName || collabEntry?.name || selectedId,
                }));
                await onAddTracksBatch(enriched);
                setIsAddingPack(false);
              }}
              onCancel={() => setIsAddingPack(false)}
            />
          ) : (isAdding || editingTrack) ? (
            <AdminTrackForm
              track={editingTrack}
              adminToken={adminToken || ''}
              defaultArtist={profile.artistName || collabEntry?.name || ''}
              hideCollaboratorCheckbox
              onSave={handleTrackSave}
              onCancel={() => { setEditingTrack(null); setIsAdding(false); }}
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
                <div className="relative flex-1 sm:flex-initial sm:ml-auto">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={trackSearch}
                    onChange={e => setTrackSearch(e.target.value)}
                    placeholder="Buscar track..."
                    className="w-full sm:w-52 pl-10 pr-4 py-2 rounded-xl bg-zinc-800/50 border border-zinc-700 text-zinc-200 placeholder-zinc-500 text-sm focus:outline-none focus:border-yellow-400/50 transition-colors"
                  />
                </div>
              </div>

              <p className="text-sm text-zinc-500">
                {filteredCollabTracks.length} track{filteredCollabTracks.length !== 1 ? 's' : ''}
              </p>

              {/* Track list */}
              <div className="space-y-2">
                {filteredCollabTracks.map((track, i) => (
                  <motion.div
                    key={track.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors group"
                  >
                    <div className="w-14 h-14 rounded-xl bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {track.coverUrl ? (
                        <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
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
                        {track.duration > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {formatDuration(track.duration)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-yellow-400 hidden sm:block flex-shrink-0">
                      {formatPrice(track.price)}
                    </span>
                    <div className="flex items-center gap-0.5 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingTrack(track); setIsAdding(false); }}
                        className="p-2 rounded-lg text-zinc-500 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { if (confirm(`¿Eliminar "${track.title}"?`)) onDeleteTrack(track.id); }}
                        className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
                {filteredCollabTracks.length === 0 && (
                  <div className="text-center py-16">
                    <ListMusic className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                    <p className="text-zinc-500">Este colaborador no tiene tracks</p>
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      ) : (
        /* ===== PROFILE TAB ===== */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-3xl">
          {/* Artist name */}
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
            <label className="block text-xs text-zinc-500 mb-1">Nombre artístico</label>
            <input
              type="text"
              value={profile.artistName}
              onChange={e => setProfile(prev => ({ ...prev, artistName: e.target.value }))}
              placeholder={collabEntry?.name}
              className={inputClass}
            />
          </div>

          {/* Bio */}
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
            <label className="block text-xs text-zinc-500 mb-1">Biografía</label>
            <textarea
              value={profile.bio}
              onChange={e => setProfile(prev => ({ ...prev, bio: e.target.value.substring(0, 300) }))}
              placeholder="Bio del colaborador..."
              className={`${inputClass} h-24 resize-none`}
            />
            <p className="text-[10px] text-zinc-600 mt-1 text-right">{profile.bio.length}/300</p>
          </div>

          {/* Imágenes — visual upload */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Foto de perfil */}
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
              <h3 className="text-xs font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-yellow-400" />
                Foto de perfil
              </h3>
              <div className="flex flex-col items-center gap-3">
                <div
                  className={`relative w-28 h-28 rounded-full border-3 overflow-hidden cursor-pointer group transition-colors ${photoDragOver ? 'border-yellow-400/50 bg-yellow-400/5' : 'border-zinc-700'}`}
                  onClick={() => photoRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setPhotoDragOver(true); }}
                  onDragLeave={() => setPhotoDragOver(false)}
                  onDrop={e => { e.preventDefault(); setPhotoDragOver(false); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) handlePhotoFile(f); }}
                >
                  {(localPhotoPreview || profile.photoUrl) ? (
                    <img src={localPhotoPreview || profile.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                      <User className="w-10 h-10 text-zinc-600" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    {uploadingPhoto ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Upload className="w-5 h-5 text-white" />}
                  </div>
                </div>
                {(profile.photoUrl || localPhotoPreview) && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { setCropperMode('photo'); setCropperImage(originalPhoto || profile.photoUrl); }} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-yellow-400/30 transition-colors">
                      Editar recorte
                    </button>
                    <button type="button" onClick={() => { setProfile(prev => ({ ...prev, photoUrl: '' })); setLocalPhotoPreview(''); setOriginalPhoto(''); }} className="text-[10px] px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors">
                      Eliminar
                    </button>
                  </div>
                )}
                <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f); if (photoRef.current) photoRef.current.value = ''; }} />
              </div>
            </div>

            {/* Fondo de página */}
            <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
              <h3 className="text-xs font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                <Image className="w-3.5 h-3.5 text-yellow-400" />
                Fondo de página
              </h3>
              <div
                className={`relative w-full rounded-lg overflow-hidden cursor-pointer group border mb-2 transition-colors ${bannerDragOver ? 'border-yellow-400/50 bg-yellow-400/5' : 'border-zinc-700'}`}
                style={{ aspectRatio: '1920/720' }}
                onClick={() => bannerRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setBannerDragOver(true); }}
                onDragLeave={() => setBannerDragOver(false)}
                onDrop={e => { e.preventDefault(); setBannerDragOver(false); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) handleBannerFile(f); }}
              >
                {(localBannerPreview || profile.bannerUrl) ? (
                  <>
                    <img src={localBannerPreview || profile.bannerUrl} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white font-black text-xs uppercase tracking-wider drop-shadow">{profile.artistName || selectedId}</span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full bg-zinc-800/50 flex flex-col items-center justify-center gap-1">
                    <Upload className="w-5 h-5 text-zinc-600 group-hover:text-yellow-400 transition-colors" />
                    <span className="text-[9px] text-zinc-600">Subir foto</span>
                    <span className="text-[9px] text-zinc-600">1920 × 720 px</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploadingBanner ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Upload className="w-4 h-4 text-white" />}
                </div>
              </div>
              {(profile.bannerUrl || localBannerPreview) && (
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => { setCropperMode('banner'); setCropperImage(originalBanner || profile.bannerUrl); }} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-yellow-400/30 transition-colors">Editar recorte</button>
                  <button type="button" onClick={() => bannerRef.current?.click()} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-yellow-400/30 transition-colors">Cambiar</button>
                  <button type="button" onClick={() => { setProfile(prev => ({ ...prev, bannerUrl: '' })); setLocalBannerPreview(''); setOriginalBanner(''); }} className="text-[10px] px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors">Eliminar</button>
                </div>
              )}
              <input ref={bannerRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (!f) return; handleBannerFile(f); if (bannerRef.current) bannerRef.current.value = ''; }} />
            </div>
          </div>

          {/* Image Cropper Modal */}
          {cropperImage && (
            <ImageCropper
              imageUrl={cropperImage}
              shape={cropperMode === 'banner' ? 'banner' : 'circle'}
              onCrop={handleCroppedImage}
              onCancel={() => setCropperImage('')}
            />
          )}

          {/* Social links */}
          <div className="bg-zinc-900/50 rounded-xl border border-zinc-800/50 p-5">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">Redes sociales</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {['instagram', 'tiktok', 'spotify', 'youtube', 'soundcloud'].map(key => (
                <div key={key}>
                  <label className="block text-xs text-zinc-500 mb-1 capitalize">{key}</label>
                  <input
                    type="url"
                    value={(profile.socialLinks as any)[key] || ''}
                    onChange={e => setProfile(prev => ({ ...prev, socialLinks: { ...prev.socialLinks, [key]: e.target.value } }))}
                    placeholder={`https://${key}.com/...`}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 rounded-2xl gradient-bg text-black font-semibold shadow-lg hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar cambios'}
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
